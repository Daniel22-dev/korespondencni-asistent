#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [dirArg, appId, version, keyId='release-key-1', outArg='release-integrity.json'] = process.argv.slice(2);
if (!dirArg || !appId || !version) {
  console.error('Usage: node create-release-integrity.mjs <deployment-dir> <appId> <version> [keyId] [output]');
  process.exit(2);
}
const root = path.resolve(dirArg);
const out = path.resolve(outArg);
const exclude = new Set(['release-integrity.json','release-integrity.sig']);
const hex = b => createHash('sha256').update(b).digest('hex');
async function walk(dir, base='') {
  const names=(await readdir(dir)).sort((a,b)=>a.localeCompare(b,'en'));
  const rows=[];
  for (const name of names) {
    const abs=path.join(dir,name); const rel=path.posix.join(base,name);
    const st=await lstat(abs);
    if (st.isSymbolicLink()) throw new Error(`Symlink forbidden: ${rel}`);
    if (st.isDirectory()) rows.push(...await walk(abs,rel));
    else if (st.isFile() && !exclude.has(rel)) {
      const data=await readFile(abs); rows.push({path:rel,size:data.length,sha256:hex(data)});
    }
  }
  return rows;
}
const files=(await walk(root)).sort((a,b)=>a.path.localeCompare(b.path,'en'));
if (!files.length) throw new Error('Deployment directory is empty');
const digestInput=files.map(f=>`${f.path}\0${f.sha256}\0${f.size}\n`).join('');
const manifest={
  schema:'ghrab-release-integrity-v1', appId, version,
  buildId:process.env.GHRAB_BUILD_ID || `local-${Date.now()}`,
  createdAt:new Date().toISOString(),
  sourceCommit:process.env.GHRAB_SOURCE_COMMIT || null,
  sourcePackageSha256:process.env.GHRAB_SOURCE_PACKAGE_SHA256 || null,
  deploymentPackageSha256:null,
  artifactDigest:hex(Buffer.from(digestInput,'utf8')),
  hashAlgorithm:'SHA-256', signature:{algorithm:'Ed25519',keyId}, files
};
await writeFile(out, JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({output:out,files:files.length,artifactDigest:manifest.artifactDigest},null,2));
