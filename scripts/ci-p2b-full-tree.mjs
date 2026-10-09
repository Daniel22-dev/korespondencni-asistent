#!/usr/bin/env node
// P2B NON-ADMISSION diagnostic: complete dist inventory before and after the
// independent, digest-pinned Foundation rebuild. Never reuse this as a gate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.env.P2B_ROOT || process.cwd());
const dist=path.join(root,'dist');
const mode=process.argv[2];
const baselinePath=process.env.P2B_TREE_BASELINE&&path.resolve(process.env.P2B_TREE_BASELINE);
const reportPath=process.env.P2B_TREE_REPORT&&path.resolve(process.env.P2B_TREE_REPORT);
const sha=String(process.env.GHRAB_SOURCE_COMMIT||process.env.GITHUB_SHA||'').toLowerCase();
const runId=String(process.env.GITHUB_RUN_ID||'local');
const runAttempt=String(process.env.GITHUB_RUN_ATTEMPT||'1');
const buildTime=String(process.env.GHRAB_BUILD_TIME||'');
const abort=msg=>{throw new Error('P2B full-tree audit FAIL: '+msg);};
const reSha=/^[a-f0-9]{64}$/;
function checkOutput(target){
  if(!target)abort('Missing absolute diagnostic output path.');
  const relative=path.relative(root,target);
  if(!(relative==='..'||relative.startsWith('..'+path.sep)))abort('Diagnostic outputs must be outside repository and signed evidence.');
}
function fileIdentity(filepath){
  let stat;try{stat=fs.lstatSync(filepath);}catch{abort('Missing file: '+filepath);}
  if(!stat.isFile())abort('A non-regular file is not certifiable: '+filepath);
  return {size:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex')};
}
function tree(){
  let result=[];
  function walk(folder,rel=''){
    let entries;try{entries=fs.readdirSync(folder,{withFileTypes:true});}catch{abort('Missing dist directory: '+folder);}
    for(const entry of entries){
      const relative=rel?rel+'/'+entry.name:entry.name;
      const filename=path.join(folder,entry.name);
      if(entry.isDirectory())walk(filename,relative);
      else if(entry.isFile())result.push({path:'dist/'+relative,...fileIdentity(filename)});
      else abort('Unexpected symlink or special file: '+relative);
    }
  }
  walk(dist);
  result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(!result.length)abort('Empty dist tree.');
  return result;
}
function write(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');
}
function validInventory(files){
  if(!Array.isArray(files)||!files.length)abort('Incomplete inventory.');
  let last='';
  for(const f of files){
    if(typeof f?.path!=='string'||!/^dist\/(?!\/)(?!.*(?:^|\/)\.\.?\/)[^\\]+$/.test(f.path)||f.path<=last
      ||!Number.isSafeInteger(f.size)||f.size<0||!reSha.test(f.sha256))abort('Malformed or unsorted inventory.');
    last=f.path;
  }
}
function classifiedQaOnly(filename){
  return /^dist\/(?:qa-[^/]+\.json|quality-report\.json|config\/quality-manifest\.json)$/.test(filename);
}
if(!['capture','compare'].includes(mode))abort('Usage: capture|compare.');
if(!/^[a-f0-9]{40}$/.test(sha))abort('Exact Git source SHA required.');
if(!/^\d+$/.test(runId)&&runId!=='local')abort('Invalid GitHub run identity.');
if(!/^\d+$/.test(runAttempt))abort('Invalid attempt.');
if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(buildTime))abort('One pinned ISO build timestamp is required.');
checkOutput(baselinePath);
if(mode==='compare')checkOutput(reportPath);
if(mode==='capture'){
  const receiptFile=path.join(root,'qa-results/current/p5/p5-evidence-receipt.json');
  const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(receipt.schema!=='ghrab-p5-evidence-receipt-v1'||receipt.appId!=='correspondence'
    ||receipt.sourceCommit!==sha||String(receipt.runId)!==runId)abort('P5 receipt is stale or invalid.');
  const files=tree();
  validInventory(files);
  const expected=['dist/index.html','dist/studio-manifest.json'];
  if(!Array.isArray(receipt.testedBuild) || JSON.stringify(receipt.testedBuild.map(f=>f.path))!==JSON.stringify(expected))
    abort('Missing exact P5 tested-build identity.');
  for(const input of receipt.testedBuild){
    const actual=files.find(f=>f.path===input.path);
    if(!actual||actual.sha256!==input.sha256||actual.size!==input.size)
      abort('Pre-Foundation inventory does not match captured P5 tested bytes: '+input.path);
  }
  write(baselinePath,{schema:'ghrab-ci-p2b-dist-tree-baseline-v1',classification:'NON_ADMISSION_DIAGNOSTIC',
    sourceCommit:sha,runId,runAttempt,buildTime,files});
  console.log('P2B complete pre-Foundation dist inventory captured: '+files.length+' files');
}else{
  const snapshot=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
  if(snapshot.schema!=='ghrab-ci-p2b-dist-tree-baseline-v1'||snapshot.classification!=='NON_ADMISSION_DIAGNOSTIC'
    ||snapshot.sourceCommit!==sha||snapshot.runId!==runId||snapshot.runAttempt!==runAttempt
    ||snapshot.buildTime!==buildTime)abort('Baseline identity mismatch (SHA, run, attempt or build time).');
  validInventory(snapshot.files);
  const after=tree();validInventory(after);
  const beforeMap=new Map(snapshot.files.map(x=>[x.path,x]));
  const afterMap=new Map(after.map(x=>[x.path,x]));
  const byteDrift=after.filter(x=>beforeMap.has(x.path)&&
    (beforeMap.get(x.path).sha256!==x.sha256||beforeMap.get(x.path).size!==x.size))
    .map(x=>({path:x.path,before:beforeMap.get(x.path),after:x}));
  const afterOnly=after.filter(x=>!beforeMap.has(x.path));
  const beforeOnly=snapshot.files.filter(x=>!afterMap.has(x.path));
  const expectedQaOnly=beforeOnly.filter(x=>classifiedQaOnly(x.path));
  const unexplainedBeforeOnly=beforeOnly.filter(x=>!classifiedQaOnly(x.path));
  const matched=after.length-afterOnly.length-byteDrift.length;
  const status=byteDrift.length||afterOnly.length||unexplainedBeforeOnly.length?'PRODUCTION_TREE_DRIFT':'PRODUCTION_TREE_IDENTICAL';
  const report={schema:'ghrab-ci-p2b-dist-tree-comparison-v1',classification:'NON_ADMISSION_DIAGNOSTIC',
    sourceCommit:sha,runId,runAttempt,buildTime,status,
    summary:{beforeFiles:snapshot.files.length,afterFiles:after.length,matched,byteDrift:byteDrift.length,
      afterOnly:afterOnly.length,expectedQaOnly:expectedQaOnly.length,unexplainedBeforeOnly:unexplainedBeforeOnly.length},
    byteDrift,afterOnly,expectedQaOnly,unexplainedBeforeOnly,
    warning:'Exact production-surface comparison within ONE P5 CI runner; not cross-run release authorization.'};
  write(reportPath,report);
  console.log('P2B full tree '+status+': '+JSON.stringify(report.summary));
}