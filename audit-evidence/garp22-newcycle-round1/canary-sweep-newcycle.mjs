import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
const evidence=process.argv[3];
if(!root||!evidence) throw new Error('usage: node scanner ROOT EVIDENCE');
const vals=fs.readFileSync(path.join(evidence,'canary-values.txt'),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const scopes=['src','scripts','.github','dist','dist-school-server'];
const textExt=/\.(?:js|mjs|cjs|html|css|json|txt|md|yml|yaml|webmanifest|xml|svg)$/i;
let files=0; const hits=[];
function walk(dir){ if(!fs.existsSync(dir)) return; for(const ent of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,ent.name); if(ent.isDirectory()){ if(ent.name==='node_modules'||ent.name==='audit-evidence') continue; walk(p); } else if(textExt.test(ent.name)){ files++; const s=fs.readFileSync(p,'utf8'); for(const v of vals){ if(s.includes(v)) hits.push({file:path.relative(root,p),kind:v.includes('@')?'email':v.startsWith('GARP-')?'marker':'id'}); } } } }
for(const s of scopes) walk(path.join(root,s));
const result={schema:'garp22-newcycle-canary-sweep-v1',filesScanned:files,valuesChecked:vals.length,hits,status:hits.length?'FAIL':'PASS'};
console.log(JSON.stringify(result,null,2));
if(hits.length) process.exitCode=1;
