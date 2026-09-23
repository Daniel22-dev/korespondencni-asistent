#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const V=path.join(ROOT,'vendor','garp-2.7-consolidated-r1');
const steps=[
  ['package-selftest',['node',path.join(V,'MASTER/TOOLS/package-selftest.mjs')],0],
  ['contract-selftest',['node',path.join(V,'MASTER/TOOLS/contract-selftest.mjs')],0],
  ['policy',['node',path.join(V,'MASTER/TOOLS/validate-policy.mjs'),path.join(ROOT,'security/garp27/garp-policy.json'),'--core',path.join(V,'MASTER/CONTRACTS/garp27-core.json')],0],
  ['live-deferred',['node',path.join(V,'MASTER/TOOLS/validate-live-status.mjs'),path.join(ROOT,'security/garp27/live-status.json'),'--profile',path.join(ROOT,'security/garp27/application-migration-profile.json')],3]
];
const results=[];let fail=false;
for(const [id,cmd,expected] of steps){const r=spawnSync(cmd[0],cmd.slice(1),{cwd:ROOT,encoding:'utf8'});const ok=r.status===expected;results.push({id,expectedExit:expected,actualExit:r.status,pass:ok,stdout:(r.stdout||'').trim(),stderr:(r.stderr||'').trim()});if(!ok)fail=true;}
const report={classification:'GARP27_CONTRACT_GATE',status:fail?'FAIL':'PASS',garpVersion:'2.7',serverPhase:'DEFERRED_BY_OWNER_DECISION',results};
console.log(JSON.stringify(report,null,2));process.exit(fail?1:0);
