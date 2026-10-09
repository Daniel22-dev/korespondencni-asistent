import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/ci-p2b-release-drift-guard.mjs',import.meta.url));
const SHA='a'.repeat(40),STAMP='2026-10-09T10:00:00.000Z',NEW='2026-10-09T10:02:00.123Z';
const json=o=>Buffer.from(JSON.stringify(o,null,2)+'\n','utf8');
const dig=b=>({size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
function artifactDigest(a){const rows=[...a].sort((x,y)=>Buffer.compare(Buffer.from(x.path),Buffer.from(y.path)));return dig(Buffer.from('ghrab-artifact-digest-v2\0'+rows.length+'\n'+rows.map(x=>x.path+'\0'+x.sha256+'\0'+x.size+'\n').join(''))).sha256;}
function fixture(){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ks-p2b-drift-'));
  const root=path.join(home,'repo'),dist=path.join(root,'dist'),bin=path.join(home,'bin');
  fs.mkdirSync(dist,{recursive:true});fs.mkdirSync(bin);
  const git=path.join(bin,'git');fs.writeFileSync(git,'#!/bin/sh\nprintf "%s\\n" "'+SHA+'"\n');fs.chmodSync(git,0o755);
  const put=(n,b)=>{const p=path.join(dist,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b)};
  const mutate=(n,fn)=>{const o=JSON.parse(fs.readFileSync(path.join(dist,n),'utf8'));fn(o);put(n,json(o))};
  const manifest={id:'correspondence',version:'5.10.34',publishedAt:STAMP,platform:{platformVersion:'1.1.2'}};
  const platform={appId:'correspondence',appVersion:'5.10.34',builtAt:STAMP};
  const original=[
    ['dist/index.html',Buffer.from('<h1>safe app</h1>')],
    ['dist/sw.js',Buffer.from('/* service worker */')],
    ['dist/studio-manifest.json',json(manifest)],
    ['dist/platform-build-info.json',json(platform)],
    ['dist/qa-sample.json',json({status:'pass'})],
    ['dist/config/quality-manifest.json',json({status:'pass'})]
  ];
  const entries=original.map(([p,b])=>({path:p,...dig(b)})).sort((x,y)=>x.path<y.path?-1:1);
  const qa=entries.filter(x=>x.path==='dist/qa-sample.json'||x.path==='dist/config/quality-manifest.json');
  const baseline={schema:'ghrab-ci-p2b-dist-tree-baseline-v1',classification:'NON_ADMISSION_DIAGNOSTIC',sourceCommit:SHA,runId:'1234',runAttempt:'1',buildTime:STAMP,files:entries};
  const compare={schema:'ghrab-ci-p2b-dist-tree-comparison-v1',classification:'NON_ADMISSION_DIAGNOSTIC',status:'PRODUCTION_TREE_IDENTICAL',sourceCommit:SHA,runId:'1234',runAttempt:'1',buildTime:STAMP,expectedQaOnly:qa,byteDrift:[],afterOnly:[],unexplainedBeforeOnly:[],summary:{beforeFiles:entries.length,afterFiles:entries.length-qa.length,matched:entries.length-qa.length,expectedQaOnly:qa.length,byteDrift:0,afterOnly:0,unexplainedBeforeOnly:0}};
  const receipt={schema:'ghrab-p5-evidence-receipt-v1',sourceCommit:SHA,runId:'1234',runAttempt:'1',appVersion:'5.10.34',testedBuild:[entries.find(x=>x.path==='dist/index.html'),entries.find(x=>x.path==='dist/studio-manifest.json')]};
  for(const [p,b] of original){if(qa.some(q=>q.path===p))continue;if(p.includes('studio-manifest'))put('studio-manifest.json',json({...manifest,publishedAt:NEW,releaseIdentity:{contract:'ghrab-release-integrity-v2',url:'./release-integrity.json',assuranceMode:'TRANSITIONAL'}}));else if(p.includes('platform-build-info'))put('platform-build-info.json',json({...platform,builtAt:NEW}));else put(p.slice(5),b)}
  for(const n of ['build-provenance.json','sbom.cdx.json','security-evidence-manifest.json'])put(n,json({name:n}));
  const files=fs.readdirSync(dist).map(n=>({path:n,...dig(fs.readFileSync(path.join(dist,n)))}));
  const integrity={schema:'ghrab-release-integrity-v2',appId:'correspondence',version:'5.10.34',sourceCommit:SHA,releaseStage:'LIVE-PUBLIC-PAGES',assuranceMode:'TRANSITIONAL',status:'GREEN',signature:{status:'NOT_PRESENT'},buildRun:{runId:'5678',sourceCommit:SHA},manifestSha256:dig(fs.readFileSync(path.join(dist,'studio-manifest.json'))).sha256,files,artifactDigest:artifactDigest(files)};
  put('release-integrity.json',json(integrity));
  const reseal=()=>mutate('release-integrity.json',x=>{const item=x.files.find(f=>f.path==='studio-manifest.json');Object.assign(item,dig(fs.readFileSync(path.join(dist,'studio-manifest.json'))));x.manifestSha256=item.sha256;x.artifactDigest=artifactDigest(x.files)});
  const save=(n,o)=>fs.writeFileSync(path.join(home,n),json(o));
  save('baseline.json',baseline);save('compare.json',compare);
  const receiptPath=path.join(root,'qa-results/current/p5/p5-evidence-receipt.json');fs.mkdirSync(path.dirname(receiptPath),{recursive:true});fs.writeFileSync(receiptPath,json(receipt));
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,GHRAB_SOURCE_COMMIT:SHA,GHRAB_P5_RUN_ID:'1234',GITHUB_RUN_ID:'5678',P2B_SOURCE_TREE:path.join(home,'baseline.json'),P2B_SOURCE_COMPARE:path.join(home,'compare.json'),P2B_RELEASE_OUTPUT:path.join(home,'report.json')};
  const run=()=>spawnSync(process.execPath,[script],{cwd:root,env,encoding:'utf8'});
  const change=(n,fn)=>{const p=path.join(home,n),o=JSON.parse(fs.readFileSync(p));fn(o);fs.writeFileSync(p,json(o))};
  return {home,root,dist,bin,env,put,mutate,change,run,reseal,receiptPath,reportPath:env.P2B_RELEASE_OUTPUT,dispose:()=>fs.rmSync(home,{recursive:true,force:true})};
}
function negative(name,update,expected){test(name,()=>{const f=fixture();try{update(f);const r=f.run();assert.notEqual(r.status,0,name+' should fail');assert.match(r.stdout+r.stderr,expected)}finally{f.dispose()}})}
test('golden fixture permits only reviewed release transformations',()=>{const f=fixture();try{const r=f.run();assert.equal(r.status,0,r.stderr||r.stdout);const o=JSON.parse(fs.readFileSync(f.reportPath));assert.equal(o.status,'REVIEWED_TRANSFORMS_ONLY');assert.equal(o.unchangedFiles,2);assert.equal(o.releaseOnlyFiles.length,4);assert.equal(o.excludedQaOnlyFiles,2)}finally{f.dispose()}});
negative('modified application HTML',f=>fs.appendFileSync(path.join(f.dist,'index.html'),'tamper'),/Application byte drift/);
negative('modified service worker',f=>fs.appendFileSync(path.join(f.dist,'sw.js'),'tamper'),/Application byte drift/);
negative('modified manifest field with recomputed release digest',f=>{f.mutate('studio-manifest.json',x=>x.platform.platformVersion='99');f.reseal()},/Unreviewed semantic\/byte drift/);
negative('unapproved releaseIdentity field',f=>{f.mutate('studio-manifest.json',x=>x.releaseIdentity.extra=true);f.reseal()},/Unreviewed release identity change/);
negative('modified platform field',f=>f.mutate('platform-build-info.json',x=>x.appId='wrong'),/Unreviewed semantic\/byte drift/);
negative('invalid build timestamp',f=>f.mutate('platform-build-info.json',x=>x.builtAt='INVALID'),/Invalid release time/);
negative('new executable file',f=>f.put('evil.js',Buffer.from('evil')),/Unexpected\/missing release-only files/);
negative('missing SBOM',f=>fs.rmSync(path.join(f.dist,'sbom.cdx.json')),/Unexpected\/missing release-only files/);
negative('public QA report disclosure',f=>f.put('qa-sample.json',json({status:'pass'})),/QA report published/);
negative('forged source commit',f=>f.change('baseline.json',x=>x.sourceCommit='b'.repeat(40)),/Untrusted\/mismatched P5 baseline/);
negative('wrong P5 run ID',f=>f.change('compare.json',x=>x.runId='4321'),/Untrusted\/mismatched P5 baseline/);
negative('wrong P5 run attempt',f=>f.change('baseline.json',x=>x.runAttempt='2'),/Untrusted\/mismatched P5 baseline/);
negative('failed original P5 build parity',f=>f.change('compare.json',x=>x.status='PRODUCTION_TREE_DRIFT'),/Untrusted\/mismatched P5 baseline/);
negative('tampered P5 tested build receipt',f=>{const r=JSON.parse(fs.readFileSync(f.receiptPath));r.testedBuild[0].sha256='b'.repeat(64);fs.writeFileSync(f.receiptPath,json(r))},/P5 tested-build receipt mismatch/);
negative('wrong deployment run identity',f=>f.mutate('release-integrity.json',x=>x.buildRun.runId='9999'),/Invalid release identity/);
negative('unexpected signature mode',f=>f.mutate('release-integrity.json',x=>x.signature.status='VERIFIED'),/Invalid release identity/);
negative('tampered manifest release digest',f=>f.mutate('release-integrity.json',x=>x.manifestSha256='b'.repeat(64)),/Invalid release identity/);
negative('tampered overall release artifact digest',f=>f.mutate('release-integrity.json',x=>x.artifactDigest='b'.repeat(64)),/Release artifact digest mismatch/);
negative('symlink in deployed tree',f=>fs.symlinkSync('index.html',path.join(f.dist,'link.html')),/Symlink or special file/);
negative('audit output inside public dist',f=>{f.env.P2B_RELEASE_OUTPUT=path.join(f.dist,'guard.json')},/Diagnostic output must remain outside repository/);
negative('checked-out code SHA mismatch',f=>fs.writeFileSync(path.join(f.bin,'git'),'#!/bin/sh\nprintf "%s\\n" "'+'b'.repeat(40)+'"\n'),/Checkout SHA mismatch/);
