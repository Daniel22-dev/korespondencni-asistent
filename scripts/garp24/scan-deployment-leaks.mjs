#!/usr/bin/env node
import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'dist');
const forbiddenDirs=new Set(['.git','.github','test-results','audit-evidence','node_modules']);
const forbiddenExt=new Set(['.map','.pem','.key','.p12','.pfx']);
const secretPatterns=[/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/\b(?:sk|AIza)[A-Za-z0-9_-]{20,}\b/];
const errors=[];
async function walk(dir,base='') {
  for (const name of await readdir(dir)) {
    const abs=path.join(dir,name), rel=path.posix.join(base,name), st=await lstat(abs);
    if (st.isSymbolicLink()) { errors.push(`symlink:${rel}`); continue; }
    if (st.isDirectory()) { if (forbiddenDirs.has(name)) errors.push(`forbidden-dir:${rel}`); else await walk(abs,rel); }
    else if (st.isFile()) {
      if (forbiddenExt.has(path.extname(name).toLowerCase())) errors.push(`forbidden-ext:${rel}`);
      if (st.size<=2_000_000) { const buf=await readFile(abs); const text=buf.toString('utf8'); for (const p of secretPatterns) if (p.test(text)) errors.push(`secret-pattern:${rel}`); }
    }
  }
}
await walk(root);
if (errors.length) { console.error(JSON.stringify({status:'FAIL',errors},null,2)); process.exit(1); }
console.log(JSON.stringify({status:'PASS',root},null,2));
