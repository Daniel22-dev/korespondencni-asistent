#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateArchitecture } from './architecture-integrity.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const COPY=['src','scripts','security/garp27','vendor/garp-2.7-consolidated-r1','dist','package.json','package-lock.json'];
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ks-garp27-'));for(const rel of COPY){const s=path.join(ROOT,rel),d=path.join(dir,rel);if(!fs.existsSync(s))continue;fs.mkdirSync(path.dirname(d),{recursive:true});fs.cpSync(s,d,{recursive:true});}return dir;}
function mutateJson(root,rel,fn){const p=path.join(root,rel),x=JSON.parse(fs.readFileSync(p,'utf8'));fn(x);fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');}
const cases=[
  {id:'G27-AR-POS',expect:'PASS',mutate:()=>{}},
  {id:'G27-AR01-forbidden-source-edge',expect:'FAIL',mutate:r=>fs.appendFileSync(path.join(r,'src/js/28-ai-integration.js'),"\nimport '../../scripts/garp27/contract-gate.mjs';\n")},
  {id:'G27-AR02-production-test-bypass',expect:'FAIL',mutate:r=>fs.appendFileSync(path.join(r,'dist/index.html'),"\n<script>window.__GHRAB_KORESP_TESTS__=Object.freeze({run(){}})</script>\n")},
  {id:'G27-AR03-uninventoried-ai-operation',expect:'FAIL',mutate:r=>mutateJson(r,'src/ai-operations.json',x=>x.operations.push({...x.operations[0],operation:'synthetic-unapproved-operation'}))},
  {id:'G27-AR03-live-validation-disabled',expect:'FAIL',mutate:r=>mutateJson(r,'src/config/deployment.json',x=>{x.features.liveServerValidationRequired=false;})},
  {id:'G27-AR03-school-local-key-bypass',expect:'FAIL',mutate:r=>mutateJson(r,'src/config/deployment.school-server.json',x=>{x.features.allowLocalProviderKeys=true;})},
  {id:'G27-AR04-policy-self-edit',expect:'FAIL',mutate:r=>mutateJson(r,'security/garp27/architecture-policy.json',x=>{x.minimumCheckedSourceFiles=1;})},
  {id:'G27-AR04-tool-self-edit',expect:'FAIL',mutate:r=>fs.appendFileSync(path.join(r,'scripts/garp27/architecture-integrity.mjs'),'\n// synthetic tool drift\n')},
  {id:'G27-AR05-vendored-master-drift',expect:'FAIL',mutate:r=>fs.appendFileSync(path.join(r,'vendor/garp-2.7-consolidated-r1/MASTER/README.md'),'\nsynthetic drift\n')},
  {id:'G27-AR05-conflicting-active-authority',expect:'FAIL',mutate:r=>fs.writeFileSync(path.join(r,'security/garp27/synthetic-conflict.json'),JSON.stringify({garpVersion:'2.6'},null,2))}
];
const results=[];let failed=0;
for(const c of cases){const r=fixture();try{c.mutate(r);const report=evaluateArchitecture(r);const pass=report.status===c.expect;results.push({id:c.id,expected:c.expect,observed:report.status,pass,failedChecks:report.checks.filter(x=>!x.pass).map(x=>x.id)});if(!pass)failed++;}catch(error){results.push({id:c.id,expected:c.expect,observed:'HARNESS_ERROR',pass:false,error:String(error?.message||error)});failed++;}finally{fs.rmSync(r,{recursive:true,force:true});}}
const report={classification:'GARP27_MUTATION_TEST',status:failed?'FAIL':'PASS',syntheticOnly:true,total:results.length,passed:results.length-failed,failed,results};console.log(JSON.stringify(report,null,2));process.exit(failed?1:0);
