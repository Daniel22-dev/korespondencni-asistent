#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const V=path.join(ROOT,'vendor','garp-2.7-consolidated-r2');
const validator=path.join(V,'MASTER/TOOLS/validate-policy.mjs');
const core=path.join(V,'MASTER/CONTRACTS/garp27-core.json');
const inventory=path.join(V,'MASTER/INVENTORY/ecosystem-apps.json');
const base=JSON.parse(fs.readFileSync(path.join(ROOT,'security/garp27/garp-policy.json'),'utf8'));
const requiredSections=['identity','requestApiAi','egress','files','dataLifecycle','release','inventory','securityHealth','incident','recovery'];

const cases=[
  {id:'G02-app-positive-current-policy',expected:0,mutate:x=>x},
  {id:'G02-app-reject-unknown-app-id',expected:1,mutate:x=>({...x,appId:'ghost-app'})},
  {id:'G02-app-reject-zero-version',expected:1,mutate:x=>({...x,appVersion:'0.0.0'})},
  {id:'G02-app-reject-invalid-semver',expected:1,mutate:x=>({...x,appVersion:'5.10'})},
  {id:'G02-app-reject-mode-only-sections',expected:1,mutate:x=>{for(const key of requiredSections)x[key]={mode:'explicit-app-policy'};return x;}},
  {id:'G02-app-reject-placeholder-substring',expected:1,mutate:x=>{x.incident={...x.incident,response:'replace-with-owner-contact'};return x;}}
];

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'correspondence-g02-'));
const results=[];
let failed=0;
try{
  for(const c of cases){
    const candidate=c.mutate(structuredClone(base));
    const file=path.join(dir,`${c.id}.json`);
    fs.writeFileSync(file,JSON.stringify(candidate,null,2)+'\n');
    const r=spawnSync('node',[validator,file,'--core',core,'--inventory',inventory],{cwd:ROOT,encoding:'utf8'});
    const pass=r.status===c.expected;
    results.push({id:c.id,expectedExit:c.expected,actualExit:r.status,pass,stdout:(r.stdout||'').trim(),stderr:(r.stderr||'').trim()});
    if(!pass)failed++;
  }
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
const report={classification:'GARP27_G02_APP_POLICY_MUTATION_TEST',status:failed?'FAIL':'PASS',garpVersion:'2.7',consolidationRevision:'2026-09-23-r2',syntheticOnly:true,total:results.length,passed:results.length-failed,failed,results};
console.log(JSON.stringify(report,null,2));
process.exit(failed?1:0);
