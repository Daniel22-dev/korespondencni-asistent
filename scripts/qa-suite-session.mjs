#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root=path.resolve('.');
const dist=path.join(root,'dist');
const consumer=JSON.parse(await fsp.readFile(path.join(root,'ghrab-platform.consumer.json'),'utf8'));
if(consumer.platform?.version!=='1.1.2')throw new Error('qa:suite-session vyžaduje Platform 1.1.2');
const rawIndex=await fsp.readFile(path.join(dist,'index.html'),'utf8');
const evidenceDir=path.join(root,'audit-evidence','platform-1.1.2');
await fsp.mkdir(evidenceDir,{recursive:true});
const reportPath=path.join(evidenceDir,'qa-suite-session.json');
const suiteKey='ghrab.platform.suite-session-generation.v1';
const appSeenKey='ghrab.correspondence.suite-session-seen.v1';
const receivedKey='ghrab.correspondence.suite-session-received.v1';
const cleanupKey='ghrab.correspondence.suite-session-cleanup.v1';
const tabSeenKey='ghrab.correspondence.suite-session-tab-seen.v1';
const profileKey='ghrab.correspondence.profile.v1';
const workKey='rozbor_work_session_v2';
const apiSessionKey='ghrab.correspondence.ai.key.session.v1';
const migrationBackupKey='ghrab.correspondence.migration.p2-storage-namespace-v1.backup';
const migrationDoneKey='ghrab.correspondence.migration.p2-storage-namespace-v1.done';
const handoffV2='ghrab.platform.handoff.v2';
const handoffV1='ghrab.handoff.v1';
const eventsKey='ghrab.pilot.events.v2';
const manualTheme='ghrab-manual-theme';
const canaryPrefix='GARP-STUDENT-CANARY-'+crypto.randomBytes(10).toString('hex').toUpperCase();
const syntheticEmail=`qa-${crypto.randomBytes(5).toString('hex')}@example.invalid`;

function chromiumPath(){for(const p of [process.env.CHROMIUM_PATH,'/usr/bin/chromium','/usr/lib/chromium/chromium','/usr/bin/google-chrome'].filter(Boolean))if(fs.existsSync(p))return p;throw new Error('Chromium není dostupné');}
function mime(file){return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file).toLowerCase()]||'application/octet-stream';}
const qaPrelude=`<style>html[data-ghrab-access="granted"] body{visibility:visible!important;opacity:1!important}</style><script data-ghrab-suite-qa-prelude>
(()=>{
  window.__GHRAB_SUITE_QA_OPS__=[]; window.__GHRAB_SUITE_QA_ERRORS__=[];
  const log=(op,key)=>{try{(window.__GHRAB_SUITE_QA_OPS__||=[]).push({op,store:this===window.sessionStorage?'session':'local',key:String(key),at:performance.now()});}catch{}};
  try{
    const p=Storage.prototype,rawSet=p.setItem,rawRemove=p.removeItem;
    p.setItem=function(k,v){try{(window.__GHRAB_SUITE_QA_OPS__||=[]).push({op:'set',store:this===window.sessionStorage?'session':'local',key:String(k),at:performance.now()});}catch{}return rawSet.call(this,k,v)};
    p.removeItem=function(k){try{(window.__GHRAB_SUITE_QA_OPS__||=[]).push({op:'remove',store:this===window.sessionStorage?'session':'local',key:String(k),at:performance.now()});}catch{}return rawRemove.call(this,k)};
  }catch(e){window.__GHRAB_SUITE_QA_ERRORS__.push('instrument:'+String(e))}
  document.documentElement.dataset.ghrabAccess='granted';
  window.__GHRAB_STUDIO_ACCESS__={permit:{role:'admin',apps:['correspondence'],localDevelopment:true}};
  window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.open=()=>null;
  try{if(globalThis.ServiceWorkerContainer?.prototype?.register)globalThis.ServiceWorkerContainer.prototype.register=async()=>({update:async()=>{},addEventListener:()=>{}})}catch{}
  addEventListener('error',e=>window.__GHRAB_SUITE_QA_ERRORS__.push(String(e.error?.stack||e.message||e.error||'error')));
  addEventListener('unhandledrejection',e=>window.__GHRAB_SUITE_QA_ERRORS__.push(String(e.reason?.stack||e.reason||'rejection')));
  document.addEventListener('DOMContentLoaded',()=>{
    try{window.__GHRAB_SUITE_QA_UNLOCK_COUNT__=window.GHRAB_PLATFORM?.unlockProtectedScripts?.()||0}catch(e){window.__GHRAB_SUITE_QA_ERRORS__.push('unlock:'+String(e))}
  },{once:true});
})();
<\/script>`;
function transformApp(source,{negative=false}={}){
  let html=source;
  if(negative){
    const token='/* GHRAB_SUITE_SESSION_REGISTRATION */ registerSuiteSessionLifecycle();';
    if(!html.includes(token))throw new Error('Negative control token nebyl nalezen v dist.');
    html=html.replace(token,'/* GHRAB_SUITE_SESSION_REGISTRATION_NEGATIVE_CONTROL_DISABLED */ void 0;');
  }
  html=html
    .replace(/data-ghrab-access=["']checking["']/gi,'data-ghrab-access="granted"')
    .replace(/<script\b(?=[^>]*data-ghrab-access-bootstrap)[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<meta\b[^>]*http-equiv=["'](?:refresh|content-security-policy)["'][^>]*>/gi,'');
  return html.replace(/<head\b[^>]*>/i,m=>m+'\n'+qaPrelude);
}
const appHtml=transformApp(rawIndex);
const negativeHtml=transformApp(rawIndex,{negative:true});
const coordinatorHtml=`<!doctype html><html lang="cs"><head><meta charset="utf-8"><script id="ghrab-platform-config" type="application/json">${JSON.stringify({appId:'ai-studio',appName:'Suite QA coordinator',appVersion:'0.21.40',requiredPlatformRange:'>=1.1.2 <2.0.0',autoFooter:false,theme:{supported:['light','dark','system'],default:'system'}})}</script></head><body><main>suite coordinator</main><script src="/ghrab/ghrab-platform.js"></script><script>document.documentElement.dataset.ready=window.GHRAB_PLATFORM?.session?.contract||'';<\/script></body></html>`;
const blankHtml='<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>blank</title></head><body><main>blank</main></body></html>';

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/','http://127.0.0.1');
    if(u.pathname==='/app.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(appHtml);return;}
    if(u.pathname==='/negative.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(negativeHtml);return;}
    if(u.pathname==='/coordinator.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(coordinatorHtml);return;}
    if(u.pathname==='/blank.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(blankHtml);return;}
    let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '');if(!rel||rel.endsWith('/'))rel+='index.html';
    rel=path.posix.normalize(rel).replace(/^\.\.\//g,'');
    const file=path.resolve(dist,...rel.split('/'));
    if((!file.startsWith(dist+path.sep)&&file!==dist)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'cache-control':'no-store'});res.end('not found');return;}
    res.writeHead(200,{'content-type':mime(file),'cache-control':'no-store'});fs.createReadStream(file).pipe(res);
  }catch(e){res.writeHead(500);res.end(String(e?.stack||e));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const webPort=server.address().port;
const base=`http://127.0.0.1:${webPort}`;

async function waitJson(url){for(let i=0;i<300;i++){try{const r=await fetch(url);if(r.ok)return await r.json();}catch{}await sleep(40);}throw new Error('Chromium debug timeout');}
class Cdp{
  constructor(target){this.target=target;this.ws=new WebSocket(target.webSocketDebuggerUrl);this.seq=0;this.pending=new Map();this.ready=new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.t);m.error?p.j(new Error(JSON.stringify(m.error))):p.r(m.result);}};}
  async call(method,params={}){await this.ready;return new Promise((r,j)=>{const id=++this.seq,t=setTimeout(()=>{this.pending.delete(id);j(new Error('CDP timeout '+method));},30000);this.pending.set(id,{r,j,t});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const x=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(x.exceptionDetails)throw new Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);return x.result?.value;}
  async close(){try{await this.call('Page.close');}catch{}try{this.ws.close();}catch{}}
}
async function openPage(url){const r=await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});if(!r.ok)throw new Error('Nelze vytvořit Chromium target: '+r.status);const target=await r.json();const c=new Cdp(target);await c.call('Runtime.enable');await c.call('Page.enable');return c;}
async function waitExpr(page,expr,timeoutMs=7000){const until=Date.now()+timeoutMs;let last;while(Date.now()<until){try{last=await page.eval(expr);if(last)return last;}catch{}await sleep(40);}throw new Error('waitExpr timeout: '+expr+' last='+JSON.stringify(last));}
async function waitApp(page){return waitExpr(page,"document.readyState==='complete'&&document.documentElement.dataset.ksAppReady==='true'&&window.GHRABCorrespondenceSuiteSession?.contract==='ghrab-suite-session-v1'",9000);}
async function waitCoordinator(page){
  try{return await waitExpr(page,"document.readyState==='complete'&&window.GHRAB_PLATFORM?.session?.contract==='ghrab-suite-session-v1'",5000);}
  catch(error){
    let diagnostic={};
    try{diagnostic=await page.eval(`(async()=>({readyState:document.readyState,platform:window.GHRAB_PLATFORM?.version||null,session:window.GHRAB_PLATFORM?.session?.contract||null,datasetPlatform:document.documentElement.dataset.ghrabPlatform||null,compat:document.documentElement.dataset.ghrabPlatformCompatibility||null,scripts:[...document.scripts].map(s=>({src:s.src,id:s.id,type:s.type})),fetchStatus:await fetch('/ghrab/ghrab-platform.js',{cache:'no-store'}).then(r=>r.status).catch(e=>'fetch:'+String(e)),body:document.body?.innerText||''}))()`);}catch(diagError){diagnostic={diagnosticError:String(diagError)}}
    console.error('Suite coordinator diagnostic:',JSON.stringify(diagnostic,null,2));
    throw error;
  }
}
function markerExpr(store,key){return `(()=>{const raw=${store}.getItem(${JSON.stringify(key)});if(!raw)return '';try{return String(JSON.parse(raw)?.generation||'')}catch{return String(raw)}})()`;}
async function resetOrigin(coord){await coord.eval(`(()=>{localStorage.clear();sessionStorage.clear();return true})()`);await sleep(50);}
async function endSuite(coord,reason){return coord.eval(`GHRAB_PLATFORM.session.end({reason:${JSON.stringify(reason)},clearApplicationData:true})`);}
function checksFrom(obj){return Object.entries(obj).map(([id,ok])=>({id,ok:Boolean(ok)}));}
const results=[];
function addResult(name,checks,detail={}){const failed=checks.filter(x=>!x.ok);results.push({name,status:failed.length?'failed':'passed',checks,detail});}
async function snapshot(page){return page.eval(`(()=>{
  const mg=(s,k)=>{const raw=s.getItem(k);if(!raw)return '';try{return String(JSON.parse(raw)?.generation||'')}catch{return String(raw)}};
  const events=(()=>{try{return JSON.parse(localStorage.getItem(${JSON.stringify(eventsKey)})||'[]')}catch{return null}})();
  return {profile:localStorage.getItem(${JSON.stringify(profileKey)}),work:sessionStorage.getItem(${JSON.stringify(workKey)}),apiKey:sessionStorage.getItem(${JSON.stringify(apiSessionKey)}),backup:localStorage.getItem(${JSON.stringify(migrationBackupKey)}),migrationDone:localStorage.getItem(${JSON.stringify(migrationDoneKey)}),manualTheme:localStorage.getItem(${JSON.stringify(manualTheme)}),handoffV2:localStorage.getItem(${JSON.stringify(handoffV2)}),handoffV1:localStorage.getItem(${JSON.stringify(handoffV1)}),events,received:mg(localStorage,${JSON.stringify(receivedKey)}),cleanup:mg(localStorage,${JSON.stringify(cleanupKey)}),seen:String(localStorage.getItem(${JSON.stringify(appSeenKey)})||''),tabSeen:mg(sessionStorage,${JSON.stringify(tabSeenKey)}),generation:String(localStorage.getItem(${JSON.stringify(suiteKey)})||''),locked:window.GHRABCorrespondencePrivacy?.isLifecycleLocked?.()===true,ops:(window.__GHRAB_SUITE_QA_OPS__||[]).slice(),errors:(window.__GHRAB_SUITE_QA_ERRORS__||[]).slice(),rawValue:document.getElementById('my_raw')?.value||''};
})()`);}
async function seedOwned(page,id,{foreignHandoff=false}={}){const c=`${canaryPrefix}-${id}`;await page.eval(`(()=>{
  localStorage.setItem(${JSON.stringify(profileKey)},JSON.stringify({name:${JSON.stringify(c)},email:${JSON.stringify(syntheticEmail)}}));
  sessionStorage.setItem(${JSON.stringify(workKey)},JSON.stringify({format:2,raw:${JSON.stringify(c)}}));
  sessionStorage.setItem(${JSON.stringify(apiSessionKey)},${JSON.stringify(c+'-APIKEY')});
  localStorage.setItem(${JSON.stringify(migrationBackupKey)},JSON.stringify({schema:'ghrab-storage-migration-backup-v1',entries:[{value:${JSON.stringify(c)}}]}));
  localStorage.setItem(${JSON.stringify(migrationDoneKey)},'qa-migration-done');
  localStorage.setItem(${JSON.stringify(manualTheme)},'dark');
  const target=${JSON.stringify(foreignHandoff?'lesson-hub':'correspondence')};
  localStorage.setItem(${JSON.stringify(handoffV2)},JSON.stringify({schema:'ghrab-studio-handoff-v2',target:{appId:target},payload:{value:{content:{text:${JSON.stringify(c)}}}}}));
  localStorage.setItem(${JSON.stringify(handoffV1)},JSON.stringify({schema:'ghrab-handoff-v1',target,material:{content:{text:${JSON.stringify(c)}}}}));
  localStorage.setItem(${JSON.stringify(eventsKey)},JSON.stringify([{appId:'correspondence',materialId:${JSON.stringify(c)}},{appId:'lesson-hub',materialId:'FOREIGN-SYNTHETIC'}]));
  const raw=document.getElementById('my_raw');if(raw){raw.value=${JSON.stringify(c)};raw.dispatchEvent(new Event('input',{bubbles:true}));}
  window.__GHRAB_SUITE_QA_OPS__=[];return ${JSON.stringify(c)};
})()`);return c;}

const debugPort=13000+(process.pid%1000),profile=`/tmp/ghrab-suite-session-${process.pid}`;fs.rmSync(profile,{recursive:true,force:true});
const chrome=spawn(chromiumPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--mute-audio','--remote-allow-origins=*',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',detached:true});
let coord;
try{
  await waitJson(`http://127.0.0.1:${debugPort}/json/version`);
  coord=await openPage(base+'/coordinator.html');await waitCoordinator(coord);await resetOrigin(coord);

  // 1) Open-child suite end + ordering + ownership-aware event filtering.
  {
    const page=await openPage(base+'/app.html');await waitApp(page);const canary=await seedOwned(page,'OPEN');
    const ended=await endSuite(coord,'qa-open-child');await sleep(160);const s=await snapshot(page);const gen=ended.generation;
    const removeIdx=s.ops.findIndex(x=>x.op==='remove'&&x.key===profileKey);
    const cleanupIdx=s.ops.findIndex(x=>x.op==='set'&&x.key===cleanupKey);
    const ackIdx=s.ops.findIndex(x=>x.op==='set'&&x.key===appSeenKey);
    const checks=checksFrom({
      'content.local-cleared':s.profile===null,
      'content.session-work-cleared':s.work===null,
      'credential.session-cleared':s.apiKey===null,
      'migration-backup-cleared':s.backup===null,
      'handoff-v2-owned-cleared':s.handoffV2===null,
      'handoff-v1-owned-cleared':s.handoffV1===null,
      'events-own-row-cleared-foreign-preserved':Array.isArray(s.events)&&s.events.length===1&&s.events[0]?.appId==='lesson-hub',
      'migration-tombstone-preserved':s.migrationDone==='qa-migration-done',
      'manual-setting-preserved':s.manualTheme==='dark',
      'suite-tombstone-preserved':s.generation===gen,
      'signal-seen-marker':s.received===gen,
      'cleanup-complete-marker':s.cleanup===gen,
      'tab-cleanup-marker':s.tabSeen===gen,
      'platform-acknowledged':s.seen===gen,
      'write-lock-engaged':s.locked===true,
      'ack-after-content-removal':removeIdx>=0&&ackIdx>removeIdx,
      'ack-after-cleanup-marker':cleanupIdx>=0&&ackIdx>cleanupIdx,
      'no-runtime-errors':s.errors.length===0,
      'canary-not-in-dom':!s.rawValue.includes(canary)
    });
    addResult('open-child-suite-end',checks,{generation:gen,removeIdx,cleanupIdx,ackIdx});await page.close();await sleep(80);
  }

  // 2) Delayed-open replay + reload idempotency.
  {
    await resetOrigin(coord);const canary=`${canaryPrefix}-DELAYED`;
    await coord.eval(`(()=>{localStorage.setItem(${JSON.stringify(profileKey)},JSON.stringify({name:${JSON.stringify(canary)},email:${JSON.stringify(syntheticEmail)}}));localStorage.setItem(${JSON.stringify(migrationBackupKey)},JSON.stringify({entries:[{value:${JSON.stringify(canary)}}]}));return true})()`);
    const ended=await endSuite(coord,'qa-delayed-open');const page=await openPage(base+'/app.html');await waitApp(page);await sleep(140);const first=await snapshot(page);const firstCleanupRaw=await page.eval(`localStorage.getItem(${JSON.stringify(cleanupKey)})`);await sleep(900);await waitApp(page);await sleep(80);const second=await snapshot(page);const secondCleanupRaw=await page.eval(`localStorage.getItem(${JSON.stringify(cleanupKey)})`);
    addResult('delayed-open-replay',checksFrom({
      'replay-cleared-local-content':first.profile===null,
      'replay-cleared-migration-backup':first.backup===null,
      'replay-cleanup-marker':first.cleanup===ended.generation,
      'replay-tab-marker':first.tabSeen===ended.generation,
      'replay-ack':first.seen===ended.generation,
      'reload-remains-clean':second.profile===null&&second.backup===null,
      'reload-does-not-repeat-cleanup-marker':firstCleanupRaw===secondCleanupRaw,
      'reload-tab-marker-stable':second.tabSeen===ended.generation,
      'reload-no-runtime-errors':second.errors.length===0
    }),{generation:ended.generation});await page.close();await sleep(80);
  }

  // 3) Multi-tab: both per-tab sessionStorage paths clear and stale writes are blocked.
  {
    await resetOrigin(coord);const a=await openPage(base+'/app.html'),b=await openPage(base+'/app.html');await Promise.all([waitApp(a),waitApp(b)]);const ca=await seedOwned(a,'TAB-A');await b.eval(`(()=>{sessionStorage.setItem(${JSON.stringify(workKey)},JSON.stringify({format:2,raw:${JSON.stringify(canaryPrefix+'-TAB-B')}}));sessionStorage.setItem(${JSON.stringify(apiSessionKey)},${JSON.stringify(canaryPrefix+'-TAB-B-KEY')});const raw=document.getElementById('my_raw');if(raw)raw.value=${JSON.stringify(canaryPrefix+'-TAB-B')};window.__GHRAB_SUITE_QA_OPS__=[];return true})()`);
    const ended=await endSuite(coord,'qa-multi-tab');await sleep(180);const sa=await snapshot(a),sb=await snapshot(b);
    await a.eval(`(()=>{sessionStorage.setItem(${JSON.stringify(workKey)},'STALE-REWRITE-A');localStorage.setItem(${JSON.stringify(profileKey)},'STALE-REWRITE-A');return true})()`);
    await b.eval(`(()=>{sessionStorage.setItem(${JSON.stringify(workKey)},'STALE-REWRITE-B');localStorage.setItem(${JSON.stringify(profileKey)},'STALE-REWRITE-B');return true})()`);
    const aa=await snapshot(a),bb=await snapshot(b);
    addResult('multi-tab',checksFrom({
      'tab-a-session-cleared':sa.work===null&&sa.apiKey===null,
      'tab-b-session-cleared':sb.work===null&&sb.apiKey===null,
      'tab-a-marked':sa.tabSeen===ended.generation,
      'tab-b-marked':sb.tabSeen===ended.generation,
      'shared-local-cleared':sa.profile===null&&sb.profile===null,
      'tab-a-stale-write-blocked':aa.work===null&&aa.profile===null,
      'tab-b-stale-write-blocked':bb.work===null&&bb.profile===null,
      'both-tabs-locked-until-clean-reload':sa.locked===true&&sb.locked===true,
      'no-tab-a-runtime-errors':sa.errors.length===0,
      'no-tab-b-runtime-errors':sb.errors.length===0,
      'canary-a-not-restored':!aa.rawValue.includes(ca)
    }),{generation:ended.generation});await Promise.all([a.close(),b.close()]);await sleep(100);
  }

  // 4) Browser Back / history restore.
  {
    await resetOrigin(coord);const page=await openPage(base+'/app.html');await waitApp(page);const canary=await seedOwned(page,'BACK');await page.call('Page.navigate',{url:base+'/blank.html'});await waitExpr(page,"location.pathname==='/blank.html'&&document.readyState==='complete'",5000);const ended=await endSuite(coord,'qa-browser-back');const seenBeforeRestore=String(await coord.eval(`localStorage.getItem(${JSON.stringify(appSeenKey)})||''`));await page.eval('history.back()');await waitExpr(page,"location.pathname==='/app.html'",5000);await waitApp(page);await sleep(160);const s=await snapshot(page);
    addResult('browser-back-forward',checksFrom({
      'back-no-ack-before-restored-cleanup':seenBeforeRestore!==ended.generation,
      'back-local-cleared':s.profile===null,
      'back-session-cleared':s.work===null,
      'back-tab-marked':s.tabSeen===ended.generation,
      'back-acknowledged':s.seen===ended.generation,
      'back-dom-not-restored':!s.rawValue.includes(canary),
      'back-page-locked-before-clean-reload':s.locked===true,
      'back-no-runtime-errors':s.errors.length===0
    }),{generation:ended.generation});await page.close();await sleep(80);
  }

  // 5) Fail-closed: one delete fails => no cleanup marker/ack; retry after fault removal succeeds.
  {
    await resetOrigin(coord);const page=await openPage(base+'/app.html');await waitApp(page);await seedOwned(page,'FAIL-CLOSED');
    await page.eval(`(()=>{window.__qaRemoveOriginal=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(String(k)===${JSON.stringify(profileKey)})throw new Error('QA synthetic delete fault');return window.__qaRemoveOriginal.call(this,k)};return true})()`);
    const ended=await endSuite(coord,'qa-fail-closed');await sleep(180);const failed=await snapshot(page);
    await page.eval(`(()=>{Storage.prototype.removeItem=window.__qaRemoveOriginal;delete window.__qaRemoveOriginal;return window.GHRABCorrespondenceSuiteSession.guardCurrentTab('qa-retry-after-fault')})()`);await sleep(150);const recovered=await snapshot(page);
    addResult('fail-closed-storage-error',checksFrom({
      'fault-leaves-target-content':failed.profile!==null,
      'fault-no-cleanup-marker':failed.cleanup!==ended.generation,
      'fault-no-platform-ack':failed.seen!==ended.generation,
      'fault-no-tab-success-marker':failed.tabSeen!==ended.generation,
      'fault-keeps-write-lock':failed.locked===true,
      'retry-clears-content':recovered.profile===null,
      'retry-writes-cleanup-marker':recovered.cleanup===ended.generation,
      'retry-acks-only-after-success':recovered.seen===ended.generation,
      'retry-tab-marker':recovered.tabSeen===ended.generation
    }),{generation:ended.generation});await page.close();await sleep(80);
  }

  // 6) Shared-storage ownership: foreign handoff survives, own event rows do not.
  {
    await resetOrigin(coord);const page=await openPage(base+'/app.html');await waitApp(page);await seedOwned(page,'FOREIGN-OWNERSHIP',{foreignHandoff:true});const before=await snapshot(page);const ended=await endSuite(coord,'qa-foreign-ownership');await sleep(170);const s=await snapshot(page);
    addResult('shared-storage-ownership',checksFrom({
      'foreign-v2-preserved':s.handoffV2===before.handoffV2&&s.handoffV2!==null,
      'foreign-v1-preserved':s.handoffV1===before.handoffV1&&s.handoffV1!==null,
      'own-events-filtered':Array.isArray(s.events)&&s.events.length===1&&s.events[0]?.appId==='lesson-hub',
      'owned-app-content-still-cleared':s.profile===null&&s.work===null,
      'cleanup-can-ack-with-foreign-shared-state':s.seen===ended.generation
    }),{generation:ended.generation});await page.close();await sleep(80);
  }

  // 7) Mandatory negative control: disposable transformed copy has lifecycle registration disabled.
  {
    await resetOrigin(coord);const neg=await openPage(base+'/negative.html');await waitApp(neg);await neg.eval(`localStorage.setItem(${JSON.stringify(profileKey)},${JSON.stringify(canaryPrefix+'-NEGATIVE')})`);const endedNeg=await endSuite(coord,'qa-negative-control');await sleep(180);const ns=await snapshot(neg);const expectedFailObserved=ns.profile!==null&&ns.seen!==endedNeg.generation;await neg.close();await sleep(80);
    await resetOrigin(coord);const pos=await openPage(base+'/app.html');await waitApp(pos);await pos.eval(`localStorage.setItem(${JSON.stringify(profileKey)},${JSON.stringify(canaryPrefix+'-POSITIVE-AFTER-NEGATIVE')})`);const endedPos=await endSuite(coord,'qa-positive-after-negative');await sleep(180);const ps=await snapshot(pos);const cleanPass=ps.profile===null&&ps.cleanup===endedPos.generation&&ps.seen===endedPos.generation;addResult('negative-control',checksFrom({'disposable-disabled-handler-produces-expected-fail':expectedFailObserved,'clean-code-restored-produces-pass':cleanPass}),{negativeGeneration:endedNeg.generation,positiveGeneration:endedPos.generation});await pos.close();await sleep(80);
  }

  // F-02 diagnostic: app-wide platform seen key cannot prove every tab succeeded.
  let f02Diagnostic={};
  {
    await resetOrigin(coord);const a=await openPage(base+'/app.html'),b=await openPage(base+'/app.html');await Promise.all([waitApp(a),waitApp(b)]);await a.eval(`sessionStorage.setItem(${JSON.stringify(workKey)},'${canaryPrefix}-F02-FAULT')`);await b.eval(`sessionStorage.setItem(${JSON.stringify(workKey)},'${canaryPrefix}-F02-OK')`);await a.eval(`(()=>{window.__qaRemoveOriginal=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(String(k)===${JSON.stringify(workKey)})throw new Error('QA per-tab fault');return window.__qaRemoveOriginal.call(this,k)};return true})()`);const ended=await endSuite(coord,'qa-f02-multitab-ack');await sleep(200);const sa=await snapshot(a),sb=await snapshot(b);f02Diagnostic={generation:ended.generation,platformSeenCanBeTrueWhileOneTabFailed:sb.seen===ended.generation&&sa.work!==null&&sa.tabSeen!==ended.generation,failedTabLocked:sa.locked===true,successfulTabSeen:sb.tabSeen===ended.generation};await Promise.all([a.close(),b.close()]);await sleep(80);
  }

  // F-03 same-origin trust-boundary diagnostic, synthetic only.
  await resetOrigin(coord);const forged=`F03-SYNTHETIC-${crypto.randomBytes(5).toString('hex')}`;const f03=await coord.eval(`(()=>{try{localStorage.setItem(${JSON.stringify(suiteKey)},${JSON.stringify(forged)});localStorage.setItem('ghrab.other-child.suite-session-seen.v1',${JSON.stringify(forged)});return {globalTombstoneWritable:localStorage.getItem(${JSON.stringify(suiteKey)})===${JSON.stringify(forged)},foreignAcknowledgementWritable:localStorage.getItem('ghrab.other-child.suite-session-seen.v1')===${JSON.stringify(forged)}}}catch(e){return {error:String(e)}}})()`);await resetOrigin(coord);

  const failedResults=results.filter(r=>r.status!=='passed');
  const report={schema:'ghrab-suite-session-qa-v1',appId:consumer.appId,appVersion:consumer.appVersion,platformVersion:consumer.platform.version,contract:'ghrab-suite-session-v1',generatedAt:new Date().toISOString(),syntheticDataOnly:true,canaryId:canaryPrefix,syntheticEmailDomain:'example.invalid',results,f02Diagnostic,f03TrustBoundary:{...f03,inherentSameOriginRisk:Boolean(f03.globalTombstoneWritable||f03.foreignAcknowledgementWritable),status:'open-ecosystem-debt'},summary:{total:results.length,passed:results.length-failedResults.length,failed:failedResults.length,status:failedResults.length?'failed':'passed'}};
  await fsp.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(failedResults.length)process.exitCode=1;
} finally {
  try{await coord?.close();}catch{}
  server.close();
  if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGTERM');}catch{}}
  await Promise.race([new Promise(r=>chrome.once('exit',r)),sleep(1200)]);
  if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGKILL');}catch{}}
  await sleep(100);fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
