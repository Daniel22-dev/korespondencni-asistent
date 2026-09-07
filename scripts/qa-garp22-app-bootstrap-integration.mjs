#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
import vm from 'node:vm';

const root=path.resolve('.');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR);
const out=path.join(evidenceRoot,'app-bootstrap-integration.json');
const html=fs.readFileSync(path.join(root,'dist','index.html'),'utf8');
const match=html.match(/<script type="module" data-ghrab-access-bootstrap>([\s\S]*?)<\/script>/);
if(!match) throw new Error('Access bootstrap script was not found in dist/index.html');
const original=match[1];
const protectedCount=(html.match(/type="application\/ghrab-protected"[^>]*data-ghrab-protected/g)||[]).length;
const guardCallIndex=original.indexOf('await protectApp(APP_ID');
const unlockIndex=original.indexOf('const unlock = window.GHRAB_PLATFORM?.unlockProtectedScripts');
const importNeedle="const { protectApp } = await import('/AI-Studio-GHRAB/access/app-guard.js');";
const reporterNeedle="void import('./access/error-reporter-adapter.js').catch((reporterError) => {";
if((original.split(importNeedle).length-1)!==1) throw new Error('Guard import transform is not exact');
if((original.split(reporterNeedle).length-1)!==1) throw new Error('Reporter import transform is not exact');
const transformed=original
  .replace(importNeedle,"const { protectApp } = await globalThis.__GHRAB_TEST_GUARD_LOADER__();")
  .replace(/void import\('\.\/access\/error-reporter-adapter\.js'\)\.catch\(\(reporterError\) => \{[\s\S]*?\n\s*\}\);/,"void Promise.resolve();");

class FakeElement {
  constructor(){this.style={};this.innerHTML='';this.textContent='';this.className='';this.beforeNodes=[];}
  before(node){this.beforeNodes.push(node);}
}
class FakeDocument extends EventTarget {
  constructor(){super();this.documentElement={dataset:{ghrabAccess:'checking'}};this.body=new FakeElement();this.actions=new FakeElement();}
  createElement(){return new FakeElement();}
  querySelector(selector){return selector==='.ghrab-access-gate-actions'?this.actions:null;}
}
function detailEvent(type,detail){const e=new Event(type);Object.defineProperty(e,'detail',{value:detail});return e;}
async function runCase(name,mode){
  const document=new FakeDocument();
  let unlockCalls=0;
  const window={GHRAB_PLATFORM:{unlockProtectedScripts(){unlockCalls++; if(mode==='allow'){document.documentElement.dataset.ksAppReady='true'; return 1;} return 1;}}};
  const logs=[];
  const guardLoader=async()=>{
    if(mode==='loader-error') throw Object.assign(new Error('synthetic guard import failure'),{name:'SyntheticGuardLoadError'});
    return {protectApp:async(appId)=>{
      if(appId!=='correspondence') throw new Error('wrong app id');
      if(mode==='allow'){
        document.dispatchEvent(detailEvent('ghrab:app-access-granted',{permit:{role:'teacher',apps:['correspondence'],synthetic:true}}));
        return true;
      }
      return false;
    }};
  };
  const context=vm.createContext({window,document,Event,Object,String,Error,Promise,console:{warn:(...a)=>logs.push(['warn',...a.map(String)]),error:(...a)=>logs.push(['error',...a.map(String)])},globalThis:null,__GHRAB_TEST_GUARD_LOADER__:guardLoader});
  context.globalThis=context;
  await vm.runInContext(`(async()=>{${transformed}\n})()`,context,{filename:`app-bootstrap-${name}.mjs`});
  return {name,mode,unlockCalls,access:window.__GHRAB_STUDIO_ACCESS__||null,ghrabAccess:document.documentElement.dataset.ghrabAccess,body:document.body.innerHTML,logs};
}
const cases=[];
cases.push(await runCase('deny-no-permit','deny'));
cases.push(await runCase('guard-load-failure','loader-error'));
cases.push(await runCase('allow-valid-permit','allow'));
const checks=[
  {id:'N06.bootstrap-protected-script-present',ok:protectedCount>=1,detail:{protectedCount}},
  {id:'N06.guard-before-unlock',ok:guardCallIndex>=0&&unlockIndex>guardCallIndex,detail:{guardCallIndex,unlockIndex}},
  {id:'N06.denial-does-not-unlock',ok:cases[0].unlockCalls===0&&cases[0].access===null&&cases[0].ghrabAccess==='denied',detail:cases[0]},
  {id:'N06.guard-import-failure-does-not-unlock',ok:cases[1].unlockCalls===0&&cases[1].access===null&&cases[1].ghrabAccess==='denied',detail:cases[1]},
  {id:'N06.allow-path-requires-guard-and-unlock',ok:cases[2].unlockCalls===1&&cases[2].access?.appId==='correspondence'&&cases[2].access?.permit?.synthetic===true,detail:cases[2]},
];
const failed=checks.filter(x=>!x.ok);
const result={schema:'garp22-app-bootstrap-integration-v1',generatedAt:new Date().toISOString(),syntheticOnly:true,source:'dist/index.html actual bootstrap with only dynamic imports injected',checks,cases,status:failed.length?'failed':'passed'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,passed:checks.length-failed.length,failed:failed.length,total:checks.length},null,2));
if(failed.length)process.exit(1);
