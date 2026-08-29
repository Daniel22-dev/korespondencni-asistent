#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root=path.resolve('.');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR);
const out=path.join(evidenceRoot,'production-test-boundary.json');
const raw=await readFile(path.join(root,'dist','index.html'),'utf8');
const runtimeConfigJs=await readFile(path.join(root,'dist','runtime-config.js'),'utf8');
const platformJs=(await readFile(path.join(root,'dist','ghrab','ghrab-platform.js'),'utf8'))
  .replace("new URL('./ghrab/ghrab-platform.js', location.href)","new URL('https://example.test/app/ghrab/ghrab-platform.js')");

function chromiumPath(){for(const p of [process.env.CHROMIUM_PATH,'/usr/bin/chromium','/usr/lib/chromium/chromium'].filter(Boolean))if(existsSync(p))return p;throw new Error('Chromium neni dostupne');}
async function waitJson(url){for(let i=0;i<180;i++){try{const r=await fetch(url);if(r.ok)return await r.json();}catch{}await sleep(50);}throw new Error('Chromium remote debugging timeout');}
class Cdp{constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=rej});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};}async call(method,params={}){await this.ready;return new Promise((res,rej)=>{const id=++this.seq;this.pending.set(id,{resolve:res,reject:rej});this.ws.send(JSON.stringify({id,method,params}));});}async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Runtime evaluate failed');return r.result?.value;}close(){try{this.ws.close();}catch{}}}
function prepareHtml(source){
  const storage=`<script data-garp-storage>(()=>{class M{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){k=String(k);return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}};try{Object.defineProperty(window,'Storage',{value:M,configurable:true});Object.defineProperty(window,'localStorage',{value:new M(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new M(),configurable:true})}catch{}window.matchMedia=window.matchMedia||(()=>({matches:false,media:'',addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));})();<\/script>`;
  let html=source
    .replace(/(<html\b[^>]*\bdata-ghrab-access=)["']checking["']/i,'$1"granted"')
    .replace(/<meta\b[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi,'')
    .replace(/<link\b[^>]*href=["']\/AI-Studio-GHRAB\/access\/access-gate\.css["'][^>]*>/gi,'')
    .replace(/<script\b[^>]*data-ghrab-runtime-config[^>]*><\/script>/gi,'')
    .replace(/<script\b[^>]*data-ghrab-platform-loader[^>]*><\/script>/gi,'')
    .replace(/<script\b(?=[^>]*data-ghrab-access-bootstrap)[^>]*>[\s\S]*?<\/script>/gi,'');
  return html.replace(/<head\b[^>]*>/i,m=>`${m}\n${storage}`);
}

const evidence={schema:'ghrab-garp22-production-test-boundary-v1',generatedAt:new Date().toISOString(),checks:[]};
const check=(id,ok,detail={})=>evidence.checks.push({id,ok:Boolean(ok),detail});
const port=10300+(process.pid%400),profile=`/tmp/garp22-prod-boundary-${process.pid}`;rmSync(profile,{recursive:true,force:true});
const chrome=spawn(chromiumPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',detached:true});
let client;
try{
  await waitJson(`http://127.0.0.1:${port}/json/version`);
  const pages=await waitJson(`http://127.0.0.1:${port}/json`);const page=pages.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(!page)throw new Error('CDP page chybi');
  client=new Cdp(page.webSocketDebuggerUrl);await client.call('Runtime.enable');await client.call('Page.enable');const tree=await client.call('Page.getFrameTree');
  await client.call('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:prepareHtml(raw)});await client.eval(runtimeConfigJs);await client.eval(platformJs);await client.eval(`window.__GHRAB_STUDIO_ACCESS__={permit:{role:'admin'}};true`);
  const unlockCount=await client.eval(`window.GHRAB_PLATFORM?.unlockProtectedScripts?.() ?? -1`);let ready=false;for(let i=0;i<160;i++){ready=Boolean(await client.eval(`document.documentElement.dataset.ksShellReady==='true'&&document.documentElement.dataset.ksAppReady==='true'`));if(ready)break;await sleep(25);}check('harness.production-ready',unlockCount===1&&ready,{unlockCount,ready});
  const state=await client.eval(`(async()=>{const before=GHRABRuntime.getMode();const setActive=window.__setTestRunActive(true);window.__TEST_MOCK_GEMINI=async()=>({text:'SHOULD-NOT-RUN'});const mockAvailable=testMockAvailable();const coreTestMode=ksCoreTestModeFor('direct-gemini');const replace=GHRABRuntime.replaceForTesting({...GHRABRuntime.getConfig(),ai:{...GHRABRuntime.getConfig().ai,mode:'school-gateway',selectedMode:'school-gateway',defaultMode:'school-gateway'}});const after=GHRABRuntime.getMode();localStorage.setItem('unrelated_boundary_marker','KEEP');let runnerError='',openResult=null;try{await runKorespTests();}catch(e){runnerError=String(e&&e.message||e);}try{openResult=openTestRunner(false);}catch(e){openResult='THREW:'+String(e&&e.message||e);}const dev=openDeveloperTools();const devTestsPresent=Boolean(dev?.body?.querySelector('#devTests'));try{dev?.close?.();}catch{}return {buildFlag:TEST_HOOKS_BUILD_ENABLED,setActive,mockAvailable,coreTestMode,replace,modeUnchanged:before===after,coreTestingType:typeof GHRAB_AI.__testing,windowRunnerType:typeof window.runKorespTests,windowOpenType:typeof window.openTestRunner,testApiType:typeof window.__GHRAB_KORESP_TESTS__,runnerError,openResult,marker:localStorage.getItem('unrelated_boundary_marker'),devTestsPresent};})()`);
  check('c03.production-build-flag-off',state.buildFlag===false,state);
  check('c03.global-activation-inert',state.setActive===false&&state.mockAvailable===false&&state.coreTestMode===false,state);
  check('c03.runtime-replacement-inert',state.replace===false&&state.modeUnchanged===true,state);
  check('c03.core-testing-api-not-exported',state.coreTestingType==='undefined',state);
  check('c08.production-test-runner-not-window-exported',state.windowRunnerType==='undefined'&&state.windowOpenType==='undefined'&&state.testApiType==='undefined',state);
  check('c08.production-test-runner-fails-closed',state.runnerError==='TEST_RUNNER_DISABLED'&&state.openResult===false&&state.marker==='KEEP',state);
  check('c09.production-admin-ui-hides-test-runner',state.devTestsPresent===false,state);
} finally {
  client?.close();if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGTERM')}catch{}}await Promise.race([new Promise(r=>chrome.once('exit',r)),sleep(1200)]);if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGKILL')}catch{}}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
evidence.summary={passed:evidence.checks.filter(x=>x.ok).length,failed:evidence.checks.filter(x=>!x.ok).length,total:evidence.checks.length,status:evidence.checks.every(x=>x.ok)?'passed':'failed'};
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));if(evidence.summary.failed)process.exit(1);
