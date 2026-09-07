#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||process.cwd());
const failures=[]; const checks=[];
const check=(id,ok,detail='')=>{checks.push({id,status:ok?'PASS':'FAIL',detail});if(!ok)failures.push(id);};
const workflows=path.join(root,'.github','workflows');
let uses=[];
if(fs.existsSync(workflows)){
 for(const name of fs.readdirSync(workflows).filter(n=>/\.ya?ml$/i.test(n)).sort()){
  const text=fs.readFileSync(path.join(workflows,name),'utf8');
  for(const m of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) uses.push({file:name,ref:m[1]});
 }
}
const badUses=uses.filter(x=>{const at=x.ref.lastIndexOf('@');if(at<0)return true;const ref=x.ref.slice(at+1);return !/^[0-9a-f]{40}$/i.test(ref);});
check('SHNC-09-github-actions-full-sha',uses.length>0&&badUses.length===0,JSON.stringify({uses:uses.length,badUses}));
let pkg={},lock={};
try{pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));}catch(e){failures.push('package-json');}
const direct={...(pkg.dependencies||{}),...(pkg.devDependencies||{}),...(pkg.optionalDependencies||{})};
const floating=Object.entries(direct).filter(([,v])=>!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(v)));
check('SH-SC-pinned-direct-npm',Object.keys(direct).length>0&&floating.length===0,JSON.stringify({directDependencies:Object.keys(direct).length,floating}));
const rootLock=lock.packages?.['']||{};
const lockMismatch=Object.entries(direct).filter(([name,v])=>String(rootLock.dependencies?.[name]??rootLock.devDependencies?.[name]??rootLock.optionalDependencies?.[name]??'')!==String(v));
check('SH-SC-lockfile-direct-match',lock.lockfileVersion===3&&lockMismatch.length===0,JSON.stringify({lockfileVersion:lock.lockfileVersion,mismatches:lockMismatch}));
const out={schema:'ghrab-ks-pinned-inputs-v1',root,checks,summary:{total:checks.length,passed:checks.length-failures.length,failed:failures.length,status:failures.length?'FAIL':'PASS'}};
console[failures.length?'error':'log'](JSON.stringify(out,null,2));
process.exit(failures.length?1:0);
