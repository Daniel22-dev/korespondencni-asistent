#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const OUT=path.join(ROOT,'audit-evidence','garp27-current');fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const V=path.join(ROOT,'vendor','garp-2.7-consolidated-r2','MASTER','TOOLS');
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const APP_VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
const sourceIdentity=()=>{if(process.env.GITHUB_SHA&&/^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA))return {value:process.env.GITHUB_SHA,kind:'git-commit'};const h=crypto.createHash('sha1');for(const rel of ['package.json','package-lock.json','src/ai-operations.json','security/garp27/garp-policy.json','security/garp27/architecture-policy.json','security/garp27/capability-inventory.json']){h.update(rel);h.update(fs.readFileSync(path.join(ROOT,rel)));}return {value:h.digest('hex'),kind:'local-source-tree-sha1-surrogate'};};
const steps=[
  {id:'build-production',cmd:['npm','run','build'],expected:0},
  {id:'garp27-contracts',cmd:['npm','run','qa:garp27:contracts'],expected:0},
  {id:'garp27-architecture',cmd:['npm','run','qa:garp27:architecture'],expected:0},
  {id:'garp27-policy-mutations',cmd:['npm','run','qa:garp27:policy-mutations'],expected:0},
  {id:'garp27-mutations',cmd:['npm','run','qa:garp27:mutations'],expected:0},
  {id:'garp27-auto-patch',cmd:['npm','run','qa:garp27:auto-patch'],expected:0},
  {id:'legacy-garp25-static',cmd:['npm','run','qa:garp25:static'],expected:0},
  {id:'promotion-architecture',cmd:['npm','run','qa:promotion-architecture'],expected:0},
  {id:'studio-dispatch-contract',cmd:['npm','run','qa:auto-patch-contract'],expected:0}
];
const results=[];let failed=0;
for(const s of steps){const r=spawnSync(s.cmd[0],s.cmd.slice(1),{cwd:ROOT,encoding:'utf8',env:process.env,maxBuffer:20*1024*1024});const log=`$ ${s.cmd.join(' ')}\nEXIT=${r.status}\n\nSTDOUT\n${r.stdout||''}\nSTDERR\n${r.stderr||''}`;const file=path.join(OUT,`${s.id}.log`);fs.writeFileSync(file,log);const pass=r.status===s.expected;results.push({id:s.id,expectedExit:s.expected,actualExit:r.status,pass,evidence:{id:s.id,sha256:shaFile(file)}});if(!pass)failed++;}
const ident=sourceIdentity();
if(!failed){
  const by=Object.fromEntries(results.map(r=>[r.id,r.evidence]));
  const template=JSON.parse(fs.readFileSync(path.join(ROOT,'security/garp27/application-migration-profile.json'),'utf8'));
  const evidenceIds=['garp27-contracts','garp27-architecture','garp27-policy-mutations','garp27-mutations','garp27-auto-patch','legacy-garp25-static','promotion-architecture','studio-dispatch-contract'];
  const trustedEvidence=Object.fromEntries(evidenceIds.map(id=>[by[id].id,by[id].sha256]));
  const profile={...template,trustedEvidence,releaseIdentity:{appId:'correspondence',appVersion:APP_VERSION,sourceCommit:ident.value}};
  const observedAt=new Date().toISOString();
  const refs=ids=>ids.map(id=>by[id]);
  const components=[
    ['AG-01-policy',['garp27-contracts','garp27-policy-mutations']],['AG-02-identity',['legacy-garp25-static']],['AG-03-request-api-ai',['legacy-garp25-static']],
    ['AG-05-files',['legacy-garp25-static']],['AG-06-data-lifecycle',['legacy-garp25-static']],['AG-07-release',['promotion-architecture']],
    ['AG-08-architecture',['garp27-architecture']],['AG-09-inventory',['garp27-architecture']]
  ].map(([componentId,ids])=>({componentId,presence:'PRESENT',health:'HEALTHY',effectiveness:'PASS',evidenceFreshness:'FRESH',observedAt,evidenceRefs:refs(ids)}));
  const status={schema:'garp27-assurance-status-v1',garpVersion:'2.7',environment:'local-ci',releaseIdentity:profile.releaseIdentity,overall:'DERIVE',components};
  const pf=path.join(OUT,'resolved-migration-profile.json'),sf=path.join(OUT,'assurance-status.json');fs.writeFileSync(pf,JSON.stringify(profile,null,2)+'\n');fs.writeFileSync(sf,JSON.stringify(status,null,2)+'\n');
  const a=spawnSync('node',[path.join(V,'validate-assurance.mjs'),sf,'--profile',pf],{cwd:ROOT,encoding:'utf8'});const af=path.join(OUT,'assurance-validation.log');fs.writeFileSync(af,`EXIT=${a.status}\n${a.stdout||''}\n${a.stderr||''}`);const pass=a.status===0;results.push({id:'assurance-admission',expectedExit:0,actualExit:a.status,pass,evidence:{id:'assurance-admission',sha256:shaFile(af)}});if(!pass)failed++;
}
const summary={classification:'GARP27_FOUNDATION_GATE',schema:'garp27-foundation-summary-v1',garpVersion:'2.7',appId:'correspondence',appVersion:APP_VERSION,status:failed?'FAIL':'FOUNDATION_PASS_LIVE_NOT_TESTED',serverPhase:'DEFERRED_BY_OWNER_DECISION',liveStatus:'NOT_TESTED',sourceIdentity:ident,steps:results,summary:{total:results.length,passed:results.filter(x=>x.pass).length,failed}};fs.writeFileSync(path.join(OUT,'foundation-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));process.exit(failed?1:0);
