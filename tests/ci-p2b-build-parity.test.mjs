import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','scripts','ci-p2b-build-parity.mjs');
const SHA='b'.repeat(40);
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function setup(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'ks-p2b-parity-'));
 const root=path.join(base,'repo'), out=path.join(base,'metrics','p2b.json');
 fs.mkdirSync(path.join(root,'qa-results','current','p5'),{recursive:true});
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});
 const index='<html><body>consistent</body></html>\n';
 const manifest='{"id":"correspondence","version":"5.10.34"}\n';
 fs.writeFileSync(path.join(root,'package.json'),'{"version":"5.10.34"}\n');
 fs.writeFileSync(path.join(root,'dist','index.html'),index);
 fs.writeFileSync(path.join(root,'dist','studio-manifest.json'),manifest);
 const receipt={
   schema:'ghrab-p5-evidence-receipt-v1',
   appId:'correspondence',appVersion:'5.10.34',sourceCommit:SHA,runId:'424242',
   testedBuild:[
     {path:'dist/index.html',size:Buffer.byteLength(index),sha256:hash(index)},
     {path:'dist/studio-manifest.json',size:Buffer.byteLength(manifest),sha256:hash(manifest)},
   ]
 };
 const receiptPath=path.join(root,'qa-results','current','p5','p5-evidence-receipt.json');
 const persist=()=>fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
 persist();
 const run=(env={})=>spawnSync(process.execPath,[script],{
   encoding:'utf8',env:{...process.env,P2B_ROOT:root,P2B_AUDIT_OUTPUT:out,GHRAB_SOURCE_COMMIT:SHA,...env}
 });
 const cleanup=()=>fs.rmSync(base,{recursive:true,force:true});
 return {root,out,receipt,receiptPath,persist,run,cleanup};
}
test('identical P5 and Foundation builds yield BYTE_IDENTICAL diagnostic',()=>{
 const f=setup();try{
  const r=f.run();assert.equal(r.status,0,r.stderr);
  const output=JSON.parse(fs.readFileSync(f.out,'utf8'));
  assert.equal(output.status,'BYTE_IDENTICAL');
  assert.equal(output.classification,'NON_ADMISSION_DIAGNOSTIC');
  assert.equal(output.files.length,2);
  assert.ok(output.files.every(x=>x.bytesMatch));
 }finally{f.cleanup();}
});
test('different index HTML yields BYTE_DRIFT, never a release PASS',()=>{
 const f=setup();try{
  fs.writeFileSync(path.join(f.root,'dist','index.html'),'<html>different</html>\n');
  const r=f.run();assert.equal(r.status,0,r.stderr);
  const out=JSON.parse(fs.readFileSync(f.out,'utf8'));
  assert.equal(out.status,'BYTE_DRIFT');
  assert.deepEqual(out.files.map(x=>x.bytesMatch),[false,true]);
 }finally{f.cleanup();}
});
test('different manifest yields BYTE_DRIFT',()=>{
 const f=setup();try{
  fs.writeFileSync(path.join(f.root,'dist','studio-manifest.json'),'{"id":"correspondence","builtAt":"later"}\n');
  assert.equal(f.run().status,0);
  const out=JSON.parse(fs.readFileSync(f.out,'utf8'));
  assert.deepEqual(out.files.map(x=>x.bytesMatch),[true,false]);
 }finally{f.cleanup();}
});
test('P5 receipt bound to another SHA is rejected',()=>{
 const f=setup();try{
  f.receipt.sourceCommit='c'.repeat(40);f.persist();
  const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/different commit/);assert.ok(!fs.existsSync(f.out));
 }finally{f.cleanup();}
});
test('incomplete tested-build inventory is rejected',()=>{
 const f=setup();try{
  f.receipt.testedBuild.pop();f.persist();
  const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/inventory/);assert.ok(!fs.existsSync(f.out));
 }finally{f.cleanup();}
});
test('malformed stored SHA is rejected rather than counted as drift',()=>{
 const f=setup();try{
  f.receipt.testedBuild[0].sha256='untrusted';f.persist();
  const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Invalid tested-build/);
 }finally{f.cleanup();}
});
test('missing post-Foundation dist file fails analysis',()=>{
 const f=setup();try{
  fs.rmSync(path.join(f.root,'dist','index.html'));
  const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Missing dist/);
 }finally{f.cleanup();}
});
test('malformed receipt schema is rejected',()=>{
 const f=setup();try{
  f.receipt.schema='unknown';f.persist();
  assert.notEqual(f.run().status,0);
 }finally{f.cleanup();}
});
test('audit is forbidden inside publicly deployed dist',()=>{
 const f=setup();try{
  const r=f.run({P2B_AUDIT_OUTPUT:path.join(f.root,'dist','injected.json')});
  assert.notEqual(r.status,0);assert.match(r.stderr,/Diagnostic must not modify/);
 }finally{f.cleanup();}
});
test('audit is forbidden inside signed QA evidence',()=>{
 const f=setup();try{
  const r=f.run({P2B_AUDIT_OUTPUT:path.join(f.root,'qa-results','current','p2b.json')});
  assert.notEqual(r.status,0);assert.match(r.stderr,/Diagnostic must not modify/);
 }finally{f.cleanup();}
});
