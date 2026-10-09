#!/usr/bin/env node
// Diagnostic only: compare the byte identities of the P5-tested build and the
// independent, digest-pinned GARP27 Foundation rebuild. Never authorize release
// or artifact reuse from this report.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.env.P2B_ROOT || process.cwd());
const dest=process.env.P2B_AUDIT_OUTPUT;
const fail=message=>{throw new Error('P2B parity audit FAIL: '+message);};
const within=(p,dir)=>p===dir || p.startsWith(dir+path.sep);
if(!dest)fail('P2B_AUDIT_OUTPUT is required, outside the production artifact.');
const output=path.resolve(dest);
if(within(output,path.join(root,'dist')) || within(output,path.join(root,'qa-results')))
  fail('Diagnostic must not modify dist/ or release evidence.');
const commit=String(process.env.GHRAB_SOURCE_COMMIT || process.env.GITHUB_SHA || '').toLowerCase();
if(!/^[0-9a-f]{40}$/.test(commit))fail('Exact source SHA is required.');
const safeRead=filepath=>{
  let stat;
  try{stat=fs.lstatSync(filepath);}catch{fail('Missing '+path.relative(root,filepath));}
  if(!stat.isFile() || stat.size<1)fail('Not a nonempty regular file: '+path.relative(root,filepath));
  return {size:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex')};
};
const receiptFile=path.join(root,'qa-results','current','p5','p5-evidence-receipt.json');
safeRead(receiptFile);
const pkgFile=path.join(root,'package.json');
safeRead(pkgFile);
let receipt,pkg;
try{receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));}
catch{fail('Invalid receipt or package JSON.');}
if(receipt.schema!=='ghrab-p5-evidence-receipt-v1' || receipt.appId!=='correspondence' || receipt.appVersion!==pkg.version)
  fail('Unrecognized P5 receipt identity.');
if(receipt.sourceCommit!==commit)fail('P5 receipt belongs to a different commit.');
const required=['dist/index.html','dist/studio-manifest.json'];
if(!Array.isArray(receipt.testedBuild) ||
   JSON.stringify(receipt.testedBuild.map(x=>x?.path))!==JSON.stringify(required))
  fail('Incomplete or unordered tested-build inventory.');
const files=required.map((rel,i)=>{
  const expected=receipt.testedBuild[i];
  if(!/^[a-f0-9]{64}$/.test(expected.sha256||'') || !Number.isInteger(expected.size) || expected.size<1)
    fail('Invalid tested-build digest/size for '+rel);
  const actual=safeRead(path.join(root,rel));
  return {path:rel,tested:{sha256:expected.sha256,size:expected.size},foundation:actual,
          bytesMatch:actual.sha256===expected.sha256 && actual.size===expected.size};
});
const status=files.every(x=>x.bytesMatch)?'BYTE_IDENTICAL':'BYTE_DRIFT';
const report={
  schema:'ghrab-ci-p2b-build-parity-v1',
  classification:'NON_ADMISSION_DIAGNOSTIC',
  sourceCommit:commit,
  p5RunId:String(receipt.runId||''),
  observedAt:new Date().toISOString(),
  status,
  files,
  verdict:'This read-only comparison never replaces independent P5 or GARP controls.',
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('P2B diagnostic '+status+': '+files.map(x=>x.path+'='+String(x.bytesMatch)).join(', '));
