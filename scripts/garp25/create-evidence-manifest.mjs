#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [dirArg,outArg='security-evidence-manifest.json']=process.argv.slice(2);
if(!dirArg){console.error('Usage: node create-evidence-manifest.mjs <evidence-dir> [output]');process.exit(2);}
const root=path.resolve(dirArg); const out=path.resolve(outArg);
const hex=b=>createHash('sha256').update(b).digest('hex');
async function walk(dir,base=''){
  const rows=[];
  for(const name of (await readdir(dir)).sort((a,b)=>a.localeCompare(b,'en'))){
    const abs=path.join(dir,name),rel=path.posix.join(base,name),st=await lstat(abs);
    if(st.isSymbolicLink()) throw new Error(`Symlink forbidden: ${rel}`);
    if(st.isDirectory()) rows.push(...await walk(abs,rel));
    else if(st.isFile()) { const d=await readFile(abs); rows.push({path:rel,size:d.length,sha256:hex(d)}); }
  }
  return rows;
}
const files=await walk(root);
const manifest={schema:'ghrab-security-evidence-manifest-v1',appId:process.env.GHRAB_APP_ID||null,version:process.env.GHRAB_APP_VERSION||null,sourceRevision:process.env.GHRAB_SOURCE_COMMIT||null,sourcePackageSha256:process.env.GHRAB_SOURCE_PACKAGE_SHA256||null,createdAt:new Date().toISOString(),files};
await writeFile(out,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS',files:files.length,output:out},null,2));
