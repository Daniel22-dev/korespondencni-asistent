#!/usr/bin/env node
// Supplementary fail-closed comparison. Does not replace P5/GARP or claim signed attestation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), dist=path.join(root,'dist');
const sha=String(process.env.GHRAB_SOURCE_COMMIT||'').toLowerCase();
const run=String(process.env.GHRAB_P5_RUN_ID||'');
const fail=msg=>{throw Error('P2B cross-run FAIL: '+msg)};
const digest=b=>({size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const inventoryFile=process.env.P2B_SOURCE_TREE,compareFile=process.env.P2B_SOURCE_COMPARE,out=process.env.P2B_RELEASE_OUTPUT;
if(!/^[a-f0-9]{40}$/.test(sha)||!/^\d+$/.test(run)||!inventoryFile||!compareFile||!out)fail('Missing trusted input identifiers');
if(!path.relative(root,path.resolve(out)).startsWith('..'+path.sep))fail('Diagnostic output must remain outside repository');
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim().toLowerCase()!==sha)fail('Checkout SHA mismatch');
const base=readJson(inventoryFile),comparison=readJson(compareFile),receipt=readJson('qa-results/current/p5/p5-evidence-receipt.json');
if(base.schema!=='ghrab-ci-p2b-dist-tree-baseline-v1'||base.classification!=='NON_ADMISSION_DIAGNOSTIC'
||comparison.schema!=='ghrab-ci-p2b-dist-tree-comparison-v1'||comparison.classification!=='NON_ADMISSION_DIAGNOSTIC'
||comparison.status!=='PRODUCTION_TREE_IDENTICAL'||receipt.schema!=='ghrab-p5-evidence-receipt-v1'
||base.sourceCommit!==sha||comparison.sourceCommit!==sha||receipt.sourceCommit!==sha
||String(base.runId)!==run||String(comparison.runId)!==run||String(receipt.runId)!==run
||String(base.runAttempt)!==String(receipt.runAttempt)||String(comparison.runAttempt)!==String(receipt.runAttempt)
||base.buildTime!==comparison.buildTime)fail('Untrusted/mismatched P5 baseline');
if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(base.buildTime))fail('Invalid baseline timestamp');
const qaOnly=p=>/^dist\/(?:qa-[^/]+\.json|quality-report\.json|config\/quality-manifest\.json)$/.test(p);
const files=new Map(),list=[];
function walk(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix?prefix+'/'+e.name:e.name,abs=path.join(dir,e.name);if(e.isDirectory())walk(abs,rel);else if(e.isFile()){const entry={path:'dist/'+rel,...digest(fs.readFileSync(abs))};files.set(entry.path,entry);list.push(entry);}else fail('Symlink or special file in production: '+rel)}}
walk(dist);
const originals=new Map();
if(!Array.isArray(base.files)||base.files.length===0)fail('Missing P5 inventory');
for(const e of base.files){if(typeof e.path!=='string'||!/^dist\/[^\\]+$/.test(e.path)||e.path.split('/').some(p=>!p||p==='..'||p==='.')||originals.has(e.path)||!Number.isSafeInteger(e.size)||e.size<0||!/^[a-f0-9]{64}$/.test(e.sha256))fail('Invalid baseline path/hash');originals.set(e.path,e)}
const qa=base.files.filter(e=>qaOnly(e.path));
if(JSON.stringify(qa)!==JSON.stringify(comparison.expectedQaOnly)||comparison.summary?.beforeFiles!==base.files.length||comparison.summary?.afterFiles!==base.files.length-qa.length||comparison.summary?.matched!==base.files.length-qa.length||comparison.summary?.expectedQaOnly!==qa.length||comparison.summary?.byteDrift!==0||comparison.summary?.afterOnly!==0||comparison.summary?.unexplainedBeforeOnly!==0||comparison.byteDrift?.length||comparison.afterOnly?.length||comparison.unexplainedBeforeOnly?.length)fail('P5 full-tree comparison counts do not match');
const matches=(a,b)=>a&&b&&a.size===b.size&&a.sha256===b.sha256;
if(receipt.testedBuild?.map(x=>x.path).join(',')!=='dist/index.html,dist/studio-manifest.json'||receipt.testedBuild.some(e=>!matches(e,originals.get(e.path))))fail('P5 tested-build receipt mismatch');
const release=readJson('dist/release-integrity.json'),manifestEntry=files.get('dist/studio-manifest.json');
if(release.schema!=='ghrab-release-integrity-v2'||release.sourceCommit!==sha||release.appId!=='correspondence'||release.version!==receipt.appVersion||release.releaseStage!=='LIVE-PUBLIC-PAGES'||release.assuranceMode!=='TRANSITIONAL'||release.status!=='GREEN'||release.signature?.status!=='NOT_PRESENT'||String(release.buildRun?.runId)!==String(process.env.GITHUB_RUN_ID)||release.buildRun?.sourceCommit!==sha||release.manifestSha256!==manifestEntry?.sha256)fail('Invalid release identity');
const normalize=(filename,key,identity=false)=>{const entry=originals.get(filename),data=readJson(path.join(dist,filename.slice(5)));if(typeof data[key]!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data[key])||!Number.isFinite(Date.parse(data[key])))fail('Invalid release time: '+filename);
if(identity){if(JSON.stringify(data.releaseIdentity)!==JSON.stringify({contract:'ghrab-release-integrity-v2',url:'./release-integrity.json',assuranceMode:'TRANSITIONAL'}))fail('Unreviewed release identity change');delete data.releaseIdentity}
data[key]=base.buildTime;
if(!matches(digest(Buffer.from(JSON.stringify(data,null,2)+'\n')),entry))fail('Unreviewed semantic/byte drift: '+filename);
};
let same=0;
for(const [name,entry] of originals){if(qaOnly(name)){if(files.has(name))fail('QA report published: '+name);continue}
if(name==='dist/studio-manifest.json')normalize(name,'publishedAt',true);
else if(name==='dist/platform-build-info.json')normalize(name,'builtAt');
else{if(!matches(files.get(name),entry))fail('Application byte drift: '+name);same++}}
const extras=[...files.keys()].filter(x=>!originals.has(x)).sort();
const expected=['dist/build-provenance.json','dist/release-integrity.json','dist/sbom.cdx.json','dist/security-evidence-manifest.json'].sort();
if(JSON.stringify(extras)!==JSON.stringify(expected))fail('Unexpected/missing release-only files');
if(!Array.isArray(release.files)||release.files.length!==files.size-1)fail('Bad release manifest inventory');
const declared=new Map(release.files.map(e=>[e.path,e]));
if(declared.size!==release.files.length)fail('Duplicate sealed release paths');
for(const [p,e] of files){if(p==='dist/release-integrity.json')continue;if(!matches(e,declared.get(p.slice(5))))fail('Sealed release bytes mismatch: '+p)}
const ordered=[...release.files].sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
const canonical='ghrab-artifact-digest-v2\0'+ordered.length+'\n'+ordered.map(e=>e.path+'\0'+e.sha256+'\0'+e.size+'\n').join('');
if(digest(Buffer.from(canonical)).sha256!==release.artifactDigest)fail('Release artifact digest mismatch');
fs.mkdirSync(path.dirname(out),{recursive:true});
const report={schema:'ghrab-p2b-cross-run-guard-v1',classification:'SUPPLEMENTARY_DRIFT_GUARD_NOT_A_SIGNATURE',status:'REVIEWED_TRANSFORMS_ONLY',sourceCommit:sha,p5RunId:run,p5RunAttempt:String(receipt.runAttempt),releaseRunId:String(process.env.GITHUB_RUN_ID),unchangedFiles:same,reviewedMetadata:['studio-manifest.json:publishedAt+releaseIdentity','platform-build-info.json:builtAt'],releaseOnlyFiles:extras,excludedQaOnlyFiles:qa.length,releaseArtifactDigest:release.artifactDigest};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('P2B release proof PASS: '+JSON.stringify(report));
