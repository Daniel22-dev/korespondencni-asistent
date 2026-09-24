#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const V=path.join(ROOT,'vendor','garp-2.7-consolidated-r2');
const trust=JSON.parse(fs.readFileSync(path.join(ROOT,'security/garp27/trust-anchor.json'),'utf8'));
const inventory=path.join(V,'MASTER/INVENTORY/ecosystem-apps.json');
const core=path.join(V,'MASTER/CONTRACTS/garp27-core.json');

function execute(id,args,expected=0){
  const r=spawnSync('node',args,{cwd:ROOT,encoding:'utf8'});
  return {id,expectedExit:expected,actualExit:r.status,pass:r.status===expected,stdout:(r.stdout||'').trim(),stderr:(r.stderr||'').trim()};
}
function parseStdout(result){
  try{return JSON.parse(result.stdout);}catch{return null;}
}

const results=[];
results.push(execute('package-selftest',[path.join(V,'MASTER/TOOLS/package-selftest.mjs')]));
const packageReport=parseStdout(results.at(-1));
results.push({
  id:'trusted-package-check-digest',
  expectedExit:0,
  actualExit:packageReport?.checkDigest===trust.canonicalPackageContractCheckSha256?0:1,
  pass:packageReport?.checkDigest===trust.canonicalPackageContractCheckSha256,
  expectedDigest:trust.canonicalPackageContractCheckSha256,
  observedDigest:packageReport?.checkDigest||null
});
results.push(execute('contract-selftest',[path.join(V,'MASTER/TOOLS/contract-selftest.mjs')]));
const contractReport=parseStdout(results.at(-1));
results.push({
  id:'g02-reference-contract',
  expectedExit:0,
  actualExit:contractReport?.g02?.status==='PASS'&&contractReport?.g02?.checks>=5?0:1,
  pass:contractReport?.g02?.status==='PASS'&&contractReport?.g02?.checks>=5,
  observed:contractReport?.g02||null
});
results.push(execute('policy',[path.join(V,'MASTER/TOOLS/validate-policy.mjs'),path.join(ROOT,'security/garp27/garp-policy.json'),'--core',core,'--inventory',inventory]));
results.push(execute('live-deferred',[path.join(V,'MASTER/TOOLS/validate-live-status.mjs'),path.join(ROOT,'security/garp27/live-status.json'),'--profile',path.join(ROOT,'security/garp27/application-migration-profile.json')],3));

const failed=results.filter(r=>!r.pass).length;
const report={classification:'GARP27_CONTRACT_GATE',status:failed?'FAIL':'PASS',garpVersion:'2.7',consolidationRevision:trust.consolidationRevision,serverPhase:'DEFERRED_BY_OWNER_DECISION',results,summary:{total:results.length,passed:results.length-failed,failed}};
console.log(JSON.stringify(report,null,2));
process.exit(failed?1:0);
