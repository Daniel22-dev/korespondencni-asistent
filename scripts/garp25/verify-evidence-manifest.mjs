#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

const [dirArg,manifestArg]=process.argv.slice(2);
if(!dirArg||!manifestArg){console.error('Usage: node verify-evidence-manifest.mjs <evidence-dir> <manifest>');process.exit(2);}
const root=path.resolve(dirArg), manifest=JSON.parse(await readFile(manifestArg,'utf8'));
const expected=new Map((manifest.files||[]).map(x=>[x.path,x])); const seen=new Set(); const errors=[];
const hex=b=>createHash('sha256').update(b).digest('hex');
async function walk(dir,base=''){
 for(const name of (await readdir(dir)).sort((a,b)=>a.localeCompare(b,'en'))){
  const abs=path.join(dir,name),rel=path.posix.join(base,name),st=await lstat(abs);
  if(st.isSymbolicLink()){errors.push(`symlink:${rel}`);continue;}
  if(st.isDirectory()) await walk(abs,rel);
  else if(st.isFile()){
    seen.add(rel); const e=expected.get(rel),d=await readFile(abs);
    if(!e) errors.push(`unexpected:${rel}`);
    else { if(e.size!==d.length) errors.push(`size:${rel}`); if(e.sha256!==hex(d)) errors.push(`sha256:${rel}`); }
  }
 }
}
await walk(root);
for(const rel of expected.keys()) if(!seen.has(rel)) errors.push(`missing:${rel}`);
if(errors.length){console.error(JSON.stringify({status:'FAIL',errors},null,2));process.exit(1);}
console.log(JSON.stringify({status:'PASS',files:seen.size},null,2));
