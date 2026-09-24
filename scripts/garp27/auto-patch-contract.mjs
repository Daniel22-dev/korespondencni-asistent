#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const V=path.join(ROOT,'vendor','garp-2.7-consolidated-r2','MASTER','TOOLS');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const APP_VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
const artifact=fs.existsSync(path.join(ROOT,'dist/index.html'))?sha(path.join(ROOT,'dist/index.html')):'0'.repeat(64);
const policy=sha(path.join(ROOT,'security/garp27/garp-policy.json'));
const source=(process.env.GITHUB_SHA&&/^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA))?process.env.GITHUB_SHA:crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT,'package-lock.json'))).digest('hex');
const evidenceFile=path.join(ROOT,'security/garp27/architecture-policy.json');const evidenceSha=sha(evidenceFile);
const base={schema:'garp27-auto-patch-manifest-v1',garpVersion:'2.7',releaseId:`correspondence-${APP_VERSION}-${source.slice(0,12)}`,sequence:1,previousReleaseId:null,target:{appId:'correspondence',version:APP_VERSION,commitSha:source,artifactSha256:artifact,policySha256:policy},source:{repository:'Daniel22-dev/korespondencni-asistent',allowlisted:true},gates:[
{id:'foundation',status:'PASS',evidenceRefs:[{id:'architecture-policy',sha256:evidenceSha}]},
{id:'architecture',status:'PASS',evidenceRefs:[{id:'architecture-policy',sha256:evidenceSha}]},
{id:'legacy-regression',status:'PASS',evidenceRefs:[{id:'architecture-policy',sha256:evidenceSha}]},
{id:'release-integrity',status:'PASS',evidenceRefs:[{id:'architecture-policy',sha256:evidenceSha}]},
{id:'studio-dispatch',status:'PASS',evidenceRefs:[{id:'architecture-policy',sha256:evidenceSha}]}
]};
const trust={schema:'garp27-auto-patch-trust-v1',garpVersion:'2.7',target:base.target,source:{repository:base.source.repository,allowlisted:true},requiredGates:base.gates.map(g=>({id:g.id,allowNA:false})),trustedEvidence:{'architecture-policy':evidenceSha},replay:{minimumSequence:1,previousReleaseId:null}};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ks-garp27-ap-'));const write=(n,x)=>{const p=path.join(dir,n);fs.writeFileSync(p,JSON.stringify(x,null,2));return p};
const prepared=write('prepared.json',{...base,state:'PREPARED'}),validated=write('validated.json',{...base,state:'VALIDATED'}),committed=write('committed.json',{...base,state:'COMMITTED'}),trustFile=write('trust.json',trust);
const tests=[
['prepared-admission',['node',path.join(V,'validate-auto-patch.mjs'),prepared,'--trust',trustFile],0],
['validated-admission',['node',path.join(V,'validate-auto-patch.mjs'),validated,'--trust',trustFile],0],
['committed-admission',['node',path.join(V,'validate-auto-patch.mjs'),committed,'--trust',trustFile,'--require-committed'],0],
['transition-prepared-validated',['node',path.join(V,'validate-auto-patch-transition.mjs'),prepared,validated],0],
['transition-validated-committed',['node',path.join(V,'validate-auto-patch-transition.mjs'),validated,committed],0]
];
const results=[];let failed=0;for(const [id,cmd,expected] of tests){const r=spawnSync(cmd[0],cmd.slice(1),{encoding:'utf8'});const pass=r.status===expected;results.push({id,expectedExit:expected,actualExit:r.status,pass});if(!pass)failed++;}
const bad=JSON.parse(JSON.stringify(base));bad.state='COMMITTED';bad.gates=[];const badFile=write('bad.json',bad);const neg=spawnSync('node',[path.join(V,'validate-auto-patch.mjs'),badFile,'--trust',trustFile,'--require-committed'],{encoding:'utf8'});const negPass=neg.status===1;results.push({id:'negative-empty-gates',expectedExit:1,actualExit:neg.status,pass:negPass});if(!negPass)failed++;
fs.rmSync(dir,{recursive:true,force:true});const report={classification:'GARP27_AUTO_PATCH_CONTRACT',status:failed?'FAIL':'PASS',liveAutoPatchClaim:false,note:'Synthetic admission/state-machine test only; actual Pages dispatch remains separately gated by exact live release verification.',results};console.log(JSON.stringify(report,null,2));process.exit(failed?1:0);
