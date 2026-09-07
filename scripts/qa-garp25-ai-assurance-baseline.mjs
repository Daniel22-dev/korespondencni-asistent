#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||process.cwd());
const baselinePath=path.resolve(process.argv[3]||path.join(root,'security','AI-ASSURANCE-BASELINE.json'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let b;try{b=JSON.parse(fs.readFileSync(baselinePath,'utf8'));}catch(e){console.error(JSON.stringify({status:'FAIL',errors:['baseline-unreadable']},null,2));process.exit(1);}
const errors=[]; const observed=[];
if(b.schema!=='ghrab-ai-assurance-baseline-v1')errors.push('schema');
for(const item of b.files||[]){const p=path.join(root,item.path);if(!fs.existsSync(p)){errors.push(`missing:${item.path}`);continue;}const h=sha(p);observed.push({path:item.path,expected:item.sha256,observed:h});if(h!==item.sha256)errors.push(`hash-mismatch:${item.path}`);}
const out={schema:'ghrab-ai-assurance-baseline-check-v1',status:errors.length?'FAIL':'PASS',baselineVersion:b.appVersion||null,providerModelPolicy:b.providerModelPolicy||null,errors,observed};
console[errors.length?'error':'log'](JSON.stringify(out,null,2));process.exit(errors.length?1:0);
