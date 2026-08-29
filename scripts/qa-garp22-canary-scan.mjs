#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
const root=path.resolve('.');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR||'garp23-release-gate');
const evidencePath=path.join(evidenceRoot,'singlepage-runtime.json');
const hasCycleEvidence=Boolean(process.env.GARP_EVIDENCE_DIR)&&fs.existsSync(evidencePath),ev=hasCycleEvidence?JSON.parse(fs.readFileSync(evidencePath,'utf8')):null;
const needles=hasCycleEvidence?[ev.canary.marker,ev.canary.email].filter(Boolean):[];
const markerPattern=/\bGARP-STUDENT-CANARY-[A-Z0-9]{8,}-[A-Z0-9]{7,}(?:-[AB])?\b/g;
const emailPattern=/\bgarp\.student\.canary\.[a-z0-9]{8,}-[a-z0-9]{7,}(?:-[ab])?@example\.invalid\b/gi;
const roots=['src','dist','dist-school-server','scripts','.github'].filter(p=>fs.existsSync(path.join(root,p)));
const allowedExt=new Set(['.js','.mjs','.cjs','.json','.html','.css','.md','.txt','.yml','.yaml','.webmanifest','.xml']);
const hits=[];let files=0;
function walk(abs,rel){for(const e of fs.readdirSync(abs,{withFileTypes:true})){if(['node_modules','.git','audit-evidence'].includes(e.name))continue;const a=path.join(abs,e.name),r=path.join(rel,e.name);if(e.isDirectory())walk(a,r);else if(e.isFile()&&allowedExt.has(path.extname(e.name).toLowerCase())){files++;let s='';try{s=fs.readFileSync(a,'utf8')}catch{}const exact=needles.some(n=>s.includes(n)),shaped=!hasCycleEvidence&&(markerPattern.test(s)||emailPattern.test(s));markerPattern.lastIndex=0;emailPattern.lastIndex=0;if(exact||shaped)hits.push(r);}}}
for(const rr of roots)walk(path.join(root,rr),rr);
const result={schema:'garp23-canary-artifact-sweep-v2',generatedAt:new Date().toISOString(),mode:hasCycleEvidence?'current-cycle-exact':'release-pattern-gate',canaryId:hasCycleEvidence?ev.canary.id:null,scope:roots,filesScanned:files,unexpectedExactHits:hits,status:hits.length?'failed':'passed'};
const out=path.join(evidenceRoot,'canary-artifact-sweep.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,filesScanned:files,unexpectedExactHits:hits},null,2));
if(hits.length)process.exit(1);
