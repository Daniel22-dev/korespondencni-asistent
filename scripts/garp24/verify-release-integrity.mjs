#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
const [dirArg, manifestArg] = process.argv.slice(2);
if (!dirArg || !manifestArg) { console.error('Usage: node verify-release-integrity.mjs <deployment-dir> <manifest>'); process.exit(2); }
const root=path.resolve(dirArg); const manifest=JSON.parse(await readFile(manifestArg,'utf8'));
const hex=b=>createHash('sha256').update(b).digest('hex');
const expected=new Map(manifest.files.map(f=>[f.path,f]));
const seen=new Set(); const errors=[];
async function walk(dir,base='') {
  for (const name of (await readdir(dir)).sort((a,b)=>a.localeCompare(b,'en'))) {
    const abs=path.join(dir,name); const rel=path.posix.join(base,name); const st=await lstat(abs);
    if (st.isSymbolicLink()) { errors.push(`symlink:${rel}`); continue; }
    if (st.isDirectory()) await walk(abs,rel);
    else if (st.isFile() && !['release-integrity.json','release-integrity.sig'].includes(rel)) {
      seen.add(rel); const e=expected.get(rel); const data=await readFile(abs);
      if (!e) errors.push(`unexpected:${rel}`);
      else { if (e.size!==data.length) errors.push(`size:${rel}`); if (e.sha256!==hex(data)) errors.push(`sha256:${rel}`); }
    }
  }
}
await walk(root);
for (const rel of expected.keys()) if (!seen.has(rel)) errors.push(`missing:${rel}`);
const rows=[...expected.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const digestInput=rows.map(f=>`${f.path}\0${f.sha256}\0${f.size}\n`).join('');
if (manifest.artifactDigest!==hex(Buffer.from(digestInput,'utf8'))) errors.push('artifactDigest');
if (errors.length) { console.error(JSON.stringify({status:'TAMPERED',errors},null,2)); process.exit(1); }
console.log(JSON.stringify({status:'VERIFIED',files:seen.size,artifactDigest:manifest.artifactDigest},null,2));
