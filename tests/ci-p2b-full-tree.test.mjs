import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/ci-p2b-full-tree.mjs');
const SHA='a'.repeat(40),TIME='2026-10-09T09:00:00.000Z';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'ks-p2b-tree-'));
 const root=path.join(base,'repo');
 const dist=path.join(root,'dist');
 const receiptPath=path.join(root,'qa-results/current/p5/p5-evidence-receipt.json');
 const baseline=path.join(base,'baseline.json'),report=path.join(base,'report.json');
 fs.mkdirSync(path.dirname(receiptPath),{recursive:true});
 fs.mkdirSync(path.join(dist,'config'),{recursive:true});
 const files={
  'index.html':'<html>original</html>',
  'studio-manifest.json':'{"id":"correspondence","version":"5.10.34"}',
  '.nojekyll':'',
  'assets/asset.js':'export const feature=true;\n',
  'config/runtime-config.json':'{"api":"none"}\n',
  'qa-p5-runtime-report.json':'{"status":"passed"}\n',
  'quality-report.json':'{"status":"passed"}\n',
  'config/quality-manifest.json':'{"generated":true}\n',
 };
 for(const [rel,val] of Object.entries(files)){
  const p=path.join(dist,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,val);
 }
 const testedBuild=['index.html','studio-manifest.json'].map(name=>{
  const contents=fs.readFileSync(path.join(dist,name));return {path:'dist/'+name,size:contents.length,sha256:digest(contents)};
 });
 const receipt={schema:'ghrab-p5-evidence-receipt-v1',appId:'correspondence',
  sourceCommit:SHA,runId:'101',testedBuild};
 fs.writeFileSync(receiptPath,JSON.stringify(receipt));
 const run=(mode,overrides={})=>spawnSync(process.execPath,[script,mode],{
  encoding:'utf8',env:{...process.env,P2B_ROOT:root,P2B_TREE_BASELINE:baseline,
    P2B_TREE_REPORT:report,GHRAB_SOURCE_COMMIT:SHA,GHRAB_BUILD_TIME:TIME,
    GITHUB_RUN_ID:'101',GITHUB_RUN_ATTEMPT:'1',...overrides}
 });
 const cleanup=()=>fs.rmSync(base,{recursive:true,force:true});
 const cleanQa=()=>{for(const n of ['qa-p5-runtime-report.json','quality-report.json','config/quality-manifest.json'])fs.rmSync(path.join(dist,n));};
 return {base,root,dist,receiptPath,baseline,report,run,cleanup,cleanQa};
}
function expectComparison(f,status){
 const r=f.run('compare');assert.equal(r.status,0,r.stderr);
 const d=JSON.parse(fs.readFileSync(f.report,'utf8'));
 assert.equal(d.status,status);return d;
}
test('capture all pre-Foundation dist files and check QA receipt identity',()=>{
 const f=fixture();try{
  const r=f.run('capture');assert.equal(r.status,0,r.stderr);
  const d=JSON.parse(fs.readFileSync(f.baseline,'utf8'));
  assert.equal(d.files.length,8);
  assert.equal(d.sourceCommit,SHA);
  assert.equal(d.files.find(x=>x.path==='dist/.nojekyll').size,0);
 }finally{f.cleanup();}
});
test('all production files identical, expected QA-only extras excluded explicitly',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);
  f.cleanQa();
  const d=expectComparison(f,'PRODUCTION_TREE_IDENTICAL');
  assert.equal(d.summary.beforeFiles,8);
  assert.equal(d.summary.afterFiles,5);
  assert.equal(d.summary.matched,5);
  assert.equal(d.summary.expectedQaOnly,3);
  assert.equal(d.summary.byteDrift,0);
  assert.equal(d.summary.unexplainedBeforeOnly,0);
 }finally{f.cleanup();}
});
test('changed nested production file yields explicit drift',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);
  f.cleanQa();
  fs.writeFileSync(path.join(f.dist,'assets/asset.js'),'tampered\n');
  const d=expectComparison(f,'PRODUCTION_TREE_DRIFT');
  assert.equal(d.byteDrift[0].path,'dist/assets/asset.js');
 }finally{f.cleanup();}
});
test('unexpected missing production asset is not classified as QA-only',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);f.cleanQa();fs.rmSync(path.join(f.dist,'assets/asset.js'));
  const d=expectComparison(f,'PRODUCTION_TREE_DRIFT');
  assert.equal(d.summary.unexplainedBeforeOnly,1);
 }finally{f.cleanup();}
});
test('unexpected new post-Foundation file is detected',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);f.cleanQa();fs.writeFileSync(path.join(f.dist,'extra.js'),'unexpected');
  const d=expectComparison(f,'PRODUCTION_TREE_DRIFT');
  assert.equal(d.summary.afterOnly,1);
 }finally{f.cleanup();}
});
test('wrong P5 source SHA fails before writing a baseline',()=>{
 const f=fixture();try{
  const r=f.run('capture',{GHRAB_SOURCE_COMMIT:'b'.repeat(40)});
  assert.notEqual(r.status,0);assert.ok(!fs.existsSync(f.baseline));
 }finally{f.cleanup();}
});
test('wrong P5 run id fails capture',()=>{
 const f=fixture();try{
  assert.notEqual(f.run('capture',{GITHUB_RUN_ID:'102'}).status,0);
 }finally{f.cleanup();}
});
test('changed source identity between capture and comparison fails',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);f.cleanQa();
  const r=f.run('compare',{GHRAB_SOURCE_COMMIT:'b'.repeat(40)});
  assert.notEqual(r.status,0);assert.ok(!fs.existsSync(f.report));
 }finally{f.cleanup();}
});
test('changed build timestamp between passes fails',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);f.cleanQa();
  assert.notEqual(f.run('compare',{GHRAB_BUILD_TIME:'2026-10-09T09:01:00.000Z'}).status,0);
 }finally{f.cleanup();}
});
test('malformed baseline inventory fails rather than comparing',()=>{
 const f=fixture();try{
  assert.equal(f.run('capture').status,0);
  const d=JSON.parse(fs.readFileSync(f.baseline,'utf8'));
  d.files[0].sha256='corrupt';fs.writeFileSync(f.baseline,JSON.stringify(d));
  f.cleanQa();assert.notEqual(f.run('compare').status,0);
 }finally{f.cleanup();}
});
test('untrusted output in public dist is forbidden',()=>{
 const f=fixture();try{
  assert.notEqual(f.run('capture',{P2B_TREE_BASELINE:path.join(f.dist,'bad.json')}).status,0);
 }finally{f.cleanup();}
});
test('untrusted output in signed QA evidence is forbidden',()=>{
 const f=fixture();try{
  assert.notEqual(f.run('capture',{P2B_TREE_BASELINE:path.join(f.root,'qa-results','current','bad.json')}).status,0);
 }finally{f.cleanup();}
});
test('symlink in production tree fails closed',()=>{
 const f=fixture();try{
  fs.symlinkSync(path.join(f.dist,'index.html'),path.join(f.dist,'alias.html'));
  assert.notEqual(f.run('capture').status,0);
 }finally{f.cleanup();}
});
