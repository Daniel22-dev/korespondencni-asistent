#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const root=path.resolve('.');
const platformSource=await fsp.readFile(path.join(root,'vendor','ghrab-platform-1.1.2','ghrab-platform.js'),'utf8');
const suiteSourceOriginal=await fsp.readFile(path.join(root,'src','js','78-suite-session.js'),'utf8');
const manifest=JSON.parse(await fsp.readFile(path.join(root,'src','config','data-manifest.json'),'utf8'));
const evidenceDir=path.join(root,'audit-evidence','platform-1.1.2');
await fsp.mkdir(evidenceDir,{recursive:true});
const reportPath=path.join(evidenceDir,'qa-suite-session-simulation.json');
const canary='GARP-STUDENT-CANARY-'+crypto.randomBytes(8).toString('hex').toUpperCase();
const SUITE='ghrab.platform.suite-session-generation.v1';
const APP_SEEN='ghrab.correspondence.suite-session-seen.v1';
const RECEIVED='ghrab.correspondence.suite-session-received.v1';
const CLEANUP='ghrab.correspondence.suite-session-cleanup.v1';
const TAB_SEEN='ghrab.correspondence.suite-session-tab-seen.v1';
const PROFILE='ghrab.correspondence.profile.v1';
const WORK='rozbor_work_session_v2';
const APIKEY='ghrab.correspondence.ai.key.session.v1';
const BACKUP='ghrab.correspondence.migration.p2-storage-namespace-v1.backup';
const DONE='ghrab.correspondence.migration.p2-storage-namespace-v1.done';
const H2='ghrab.platform.handoff.v2';
const H1='ghrab.handoff.v1';
const EVENTS='ghrab.pilot.events.v2';
const MANUAL='ghrab-manual-theme';
const RETAIN=new Set([DONE,RECEIVED,CLEANUP,APP_SEEN,TAB_SEEN]);
const sharedLocal=new Map();
const contexts=[];
let nextContextId=1;

function marker(store,key){const raw=store.getItem(key);if(!raw)return '';try{return String(JSON.parse(raw)?.generation||'')}catch{return String(raw)}}
function isOwned(key){const k=String(key);return ((k.startsWith('ghrab.correspondence.')&&!RETAIN.has(k))||k.startsWith('rozbor_')||k.startsWith('ks5_'));}
function handoffOwned(key,v){if(!v||typeof v!=='object')return false;return key===H2?String(v.target?.appId||'')==='correspondence':String(v.target||'')==='correspondence';}

function makeContext({appId='correspondence',sessionBackend=new Map(),negative=false,storageEvents=true,historyNavigation=false,name}={}){
  const id=nextContextId++;
  const listeners=new Map();
  const ops=[];
  const removeFaults=new Set();
  const setFaults=new Set();
  let storageLock=false,cleanupActive=false,cleanupCount=0,reloadCount=0;
  const label=name||`${appId}-${id}`;
  class StorageShim{
    constructor(kind,backend){this.kind=kind;this.backend=backend;}
    get length(){return this.backend.size;}
    key(i){return [...this.backend.keys()][i]??null;}
    getItem(key){const k=String(key);return this.backend.has(k)?String(this.backend.get(k)):null;}
    setItem(key,value){const k=String(key),v=String(value);if(setFaults.has(`${this.kind}:${k}`))throw new Error(`synthetic-set-fault:${this.kind}:${k}`);if(storageLock&&!cleanupActive&&(isOwned(k)||[H2,H1,EVENTS].includes(k)))return undefined;const old=this.getItem(k);this.backend.set(k,v);ops.push({op:'set',kind:this.kind,key:k,value:v});if(this.kind==='local'&&old!==v)dispatchStorage(id,k,old,v);}
    removeItem(key){const k=String(key);if(removeFaults.has(`${this.kind}:${k}`))throw new Error(`synthetic-remove-fault:${this.kind}:${k}`);const old=this.getItem(k);this.backend.delete(k);ops.push({op:'remove',kind:this.kind,key:k});if(this.kind==='local'&&old!==null)dispatchStorage(id,k,old,null);}
    clear(){for(const k of [...this.backend.keys()])this.removeItem(k);}
  }
  const localStorage=new StorageShim('local',sharedLocal),sessionStorage=new StorageShim('session',sessionBackend);
  const documentElement={dataset:{ghrabAppId:appId,ghrabAppVersion:appId==='correspondence'?'5.10.20':'0.21.40'},hasAttribute:()=>false};
  const config={appId,appName:label,appVersion:documentElement.dataset.ghrabAppVersion,requiredPlatformRange:'>=1.1.2 <2.0.0',autoFooter:false,theme:{supported:['light','dark','system'],default:'system'}};
  if(appId==='correspondence') config.storageMigration={id:'p2-storage-namespace-v1',backup:'full',mappings:[]};
  const document={
    readyState:'loading',currentScript:{src:'https://qa.invalid/ghrab/ghrab-platform.js'},documentElement,body:null,visibilityState:'visible',
    getElementById:(x)=>x==='ghrab-platform-config'?{textContent:JSON.stringify(config)}:null,
    addEventListener:(t,fn)=>{const a=listeners.get('document:'+t)||[];a.push(fn);listeners.set('document:'+t,a)},
    dispatchEvent:(e)=>{for(const fn of listeners.get('document:'+e.type)||[])fn(e)},
    querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},append(){},appendChild(){},classList:{add(){},remove(){},contains(){return false}},dataset:{}})
  };
  const windowObj={
    document,localStorage,sessionStorage,Storage:StorageShim,location:{href:'https://qa.invalid/app',reload(){reloadCount++}},navigator:{language:'cs-CZ'},
    performance:{mark(){},measure(){},getEntriesByName(){return[]},getEntriesByType(type){return type==='navigation'&&historyNavigation?[{type:'back_forward'}]:[]},navigation:{type:historyNavigation?2:0},now(){return Date.now()}},URL,TextEncoder,TextDecoder,Blob,crypto:crypto.webcrypto,
    CustomEvent:class CustomEvent{constructor(type,opts={}){this.type=type;this.detail=opts.detail}},
    Event:class Event{constructor(type,opts={}){this.type=type;Object.assign(this,opts)}},
    addEventListener:(t,fn)=>{const a=listeners.get('window:'+t)||[];a.push(fn);listeners.set('window:'+t,a)},
    dispatchEvent:(e)=>{for(const fn of listeners.get('window:'+e.type)||[])fn(e)},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
    setTimeout,clearTimeout,requestAnimationFrame:(fn)=>setTimeout(fn,0),console,alert(){},confirm(){return true},prompt(){return''},open(){return null}
  };
  windowObj.window=windowObj;windowObj.self=windowObj;windowObj.globalThis=windowObj;
  const ctx=vm.createContext({...windowObj,window:windowObj,self:windowObj,globalThis:windowObj,document,localStorage,sessionStorage,Storage:StorageShim,location:windowObj.location,navigator:windowObj.navigator,performance:windowObj.performance,URL,TextEncoder,TextDecoder,Blob,crypto:crypto.webcrypto,CustomEvent:windowObj.CustomEvent,Event:windowObj.Event,setTimeout,clearTimeout,requestAnimationFrame:windowObj.requestAnimationFrame,console});
  // Ensure window/global aliases in the VM refer to the same object graph.
  ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;ctx.document=document;ctx.localStorage=localStorage;ctx.sessionStorage=sessionStorage;ctx.Storage=StorageShim;ctx.location=windowObj.location;
  const record={id,label,ctx,listeners,ops,removeFaults,setFaults,sessionBackend,storageEvents,get storageLock(){return storageLock},get cleanupCount(){return cleanupCount},get reloadCount(){return reloadCount}};
  contexts.push(record);
  vm.runInContext(platformSource,ctx,{filename:'ghrab-platform-1.1.2.js'});
  if(appId==='correspondence'){
    // Privacy facade mirrors the manifest-backed cleanup contract. It is intentionally small:
    // orchestration under test is the real src/js/78-suite-session.js; ownership rules are asserted separately from source/manifest.
    const privacy={
      engageLifecycleLock(){storageLock=true;return true;},
      isLifecycleLocked(){return storageLock;},
      verifyClearOnEndStorage(){
        const remaining=[];for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i);if(k&&isOwned(k))remaining.push(`${store.kind}:${k}`)}
        for(const store of [localStorage,sessionStorage]){
          for(const key of [H2,H1]){const raw=store.getItem(key);if(raw){try{if(handoffOwned(key,JSON.parse(raw)))remaining.push(`${store.kind}:${key}`)}catch{return {ok:false,failures:[`${store.kind}:${key}:unparseable`],remainingOwnedKeys:remaining}}}}
          const raw=store.getItem(EVENTS);if(raw){try{const rows=JSON.parse(raw);if(!Array.isArray(rows))return {ok:false,failures:[`${store.kind}:${EVENTS}:unparseable`],remainingOwnedKeys:remaining};if(rows.some(r=>r&&String(r.appId||'')==='correspondence'))remaining.push(`${store.kind}:${EVENTS}`)}catch{return {ok:false,failures:[`${store.kind}:${EVENTS}:unparseable`],remainingOwnedKeys:remaining}}}
        }
        return {ok:remaining.length===0,failures:[],remainingOwnedKeys:remaining};
      },
      endWork(){cleanupCount++;storageLock=true;cleanupActive=true;let ok=true;try{
        for(const store of [localStorage,sessionStorage]){
          for(let i=store.length-1;i>=0;i--){const k=store.key(i);if(k&&isOwned(k)){try{store.removeItem(k)}catch{ok=false}}}
          for(const key of [H2,H1]){const raw=store.getItem(key);if(!raw)continue;try{const v=JSON.parse(raw);if(handoffOwned(key,v))store.removeItem(key)}catch{ok=false}}
          const raw=store.getItem(EVENTS);if(raw){try{const rows=JSON.parse(raw);if(!Array.isArray(rows)){ok=false}else{const kept=rows.filter(r=>!(r&&String(r.appId||'')==='correspondence'));if(kept.length!==rows.length){if(kept.length)store.setItem(EVENTS,JSON.stringify(kept));else store.removeItem(EVENTS)}}}catch{ok=false}}
        }
      }finally{cleanupActive=false}const v=privacy.verifyClearOnEndStorage();return ok&&v.ok;}
    };
    ctx.GHRABCorrespondencePrivacy=privacy;ctx.window.GHRABCorrespondencePrivacy=privacy;
    ctx.toast=()=>{};
    const source=negative?suiteSourceOriginal.replace('/* GHRAB_SUITE_SESSION_REGISTRATION */ registerSuiteSessionLifecycle();','/* NEGATIVE CONTROL: registration disabled */ void 0;'):suiteSourceOriginal;
    vm.runInContext(source,ctx,{filename:negative?'78-suite-session-negative.js':'78-suite-session.js'});
  }
  return record;
}

function dispatchStorage(sourceId,key,oldValue,newValue){
  for(const rec of contexts){if(rec.id===sourceId||!rec.storageEvents)continue;const event={type:'storage',key,oldValue,newValue,storageArea:rec.ctx.localStorage};for(const fn of rec.listeners.get('window:storage')||[]){try{fn(event)}catch(e){rec.ops.push({op:'listener-error',key,error:String(e)})}}}
}
function reset(){sharedLocal.clear();contexts.splice(0,contexts.length);}
function seed(rec,id,{foreign=false}={}){const c=`${canary}-${id}`;rec.ctx.localStorage.setItem(PROFILE,JSON.stringify({name:c,email:`qa-${id.toLowerCase()}@example.invalid`}));rec.ctx.sessionStorage.setItem(WORK,JSON.stringify({raw:c}));rec.ctx.sessionStorage.setItem(APIKEY,c+'-KEY');rec.ctx.localStorage.setItem(BACKUP,JSON.stringify({entries:[{value:c}]}));rec.ctx.localStorage.setItem(DONE,'qa-done');rec.ctx.localStorage.setItem(MANUAL,'dark');rec.ctx.localStorage.setItem(H2,JSON.stringify({schema:'ghrab-studio-handoff-v2',target:{appId:foreign?'lesson-hub':'correspondence'},payload:{value:{content:{text:c}}}}));rec.ctx.localStorage.setItem(H1,JSON.stringify({schema:'ghrab-handoff-v1',target:foreign?'lesson-hub':'correspondence',material:{content:{text:c}}}));rec.ctx.localStorage.setItem(EVENTS,JSON.stringify([{appId:'correspondence',materialId:c},{appId:'lesson-hub',materialId:'FOREIGN-SYNTHETIC'}]));rec.ops.length=0;return c;}
function snap(rec){const ls=rec.ctx.localStorage,ss=rec.ctx.sessionStorage;let ev=null;try{ev=JSON.parse(ls.getItem(EVENTS)||'null')}catch{}return {profile:ls.getItem(PROFILE),work:ss.getItem(WORK),api:ss.getItem(APIKEY),backup:ls.getItem(BACKUP),done:ls.getItem(DONE),manual:ls.getItem(MANUAL),h2:ls.getItem(H2),h1:ls.getItem(H1),events:ev,generation:ls.getItem(SUITE)||'',seen:ls.getItem(APP_SEEN)||'',received:marker(ls,RECEIVED),cleanup:marker(ls,CLEANUP),tabSeen:marker(ss,TAB_SEEN),locked:rec.storageLock,cleanupCount:rec.cleanupCount,ops:rec.ops.slice()};}
function checks(obj){return Object.entries(obj).map(([id,ok])=>({id,ok:Boolean(ok)}));}
const results=[];function add(name,obj,detail={}){const cs=checks(obj),bad=cs.filter(x=>!x.ok);results.push({name,status:bad.length?'failed':'passed',checks:cs,detail});}
async function settle(){await sleep(25);}

// 1 open child + ordering + ownership
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),child=makeContext({name:'open-child'});seed(child,'OPEN');
  const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-open',clearApplicationData:true});await settle();const s=snap(child),g=end.generation;
  const rm=s.ops.findIndex(x=>x.op==='remove'&&x.key===PROFILE),cm=s.ops.findIndex(x=>x.op==='set'&&x.key===CLEANUP),ack=s.ops.findIndex(x=>x.op==='set'&&x.key===APP_SEEN);
  add('open-child-suite-end',{'local-cleared':s.profile===null,'session-cleared':s.work===null,'credential-cleared':s.api===null,'backup-cleared':s.backup===null,'owned-handoff-cleared':s.h2===null&&s.h1===null,'foreign-event-preserved':Array.isArray(s.events)&&s.events.length===1&&s.events[0].appId==='lesson-hub','migration-marker-preserved':s.done==='qa-done','manual-setting-preserved':s.manual==='dark','received-marker':s.received===g,'cleanup-marker':s.cleanup===g,'tab-marker':s.tabSeen===g,'ack':s.seen===g,'write-lock':s.locked,'ack-after-remove':rm>=0&&ack>rm,'ack-after-cleanup-marker':cm>=0&&ack>cm},{generation:g,rm,cm,ack});
}
// 2 delayed open replay + reload/tab idempotency
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'});coord.ctx.localStorage.setItem(PROFILE,JSON.stringify({name:canary+'-DELAYED'}));coord.ctx.localStorage.setItem(BACKUP,JSON.stringify({value:canary+'-DELAYED'}));const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-delayed'});await settle();
  const session=new Map();const first=makeContext({sessionBackend:session,name:'delayed-first'});await settle();const a=snap(first),count=first.cleanupCount;const second=makeContext({sessionBackend:session,name:'delayed-reload'});await settle();const b=snap(second);
  add('delayed-open-replay',{'replay-clears-local':a.profile===null&&a.backup===null,'replay-marks-cleanup':a.cleanup===end.generation,'replay-marks-tab':a.tabSeen===end.generation,'replay-acks':a.seen===end.generation,'reload-remains-clean':b.profile===null&&b.backup===null,'same-session-tab-marker-persists':b.tabSeen===end.generation,'reload-does-not-clean-again':second.cleanupCount===0&&count===1},{generation:end.generation});
}
// 3 multi-tab + stale writes blocked
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),a=makeContext({name:'tab-a'}),b=makeContext({name:'tab-b'});seed(a,'TAB-A');b.ctx.sessionStorage.setItem(WORK,canary+'-TAB-B');b.ctx.sessionStorage.setItem(APIKEY,canary+'-TAB-B-KEY');a.ops.length=0;b.ops.length=0;const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-multitab'});await settle();const sa=snap(a),sb=snap(b);a.ctx.sessionStorage.setItem(WORK,'STALE-A');b.ctx.sessionStorage.setItem(WORK,'STALE-B');a.ctx.localStorage.setItem(PROFILE,'STALE-A');b.ctx.localStorage.setItem(PROFILE,'STALE-B');const aa=snap(a),bb=snap(b);
  add('multi-tab',{'tab-a-session-cleared':sa.work===null&&sa.api===null,'tab-b-session-cleared':sb.work===null&&sb.api===null,'tab-a-marker':sa.tabSeen===end.generation,'tab-b-marker':sb.tabSeen===end.generation,'shared-local-cleared':sa.profile===null&&sb.profile===null,'stale-a-blocked':aa.work===null&&aa.profile===null,'stale-b-blocked':bb.work===null&&bb.profile===null,'both-locked':aa.locked&&bb.locked},{generation:end.generation,appWideSeen:aa.seen});
}
// 4 pageshow guard analogous to Back/Forward stale restoration
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),child=makeContext({name:'back-forward',storageEvents:false});await settle();seed(child,'BACK');const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-back'});await settle();let before=snap(child);child.storageEvents=true;for(const fn of child.listeners.get('window:pageshow')||[])fn({type:'pageshow'});await settle();const after=snap(child);
  add('browser-history-guard-simulation',{'not-cleaned-while-page-event-suppressed':before.profile!==null,'pageshow-clears-local':after.profile===null,'pageshow-clears-session':after.work===null,'pageshow-tab-marker':after.tabSeen===end.generation,'pageshow-ack':after.seen===end.generation,'pageshow-lock':after.locked},{generation:end.generation});
}
// 5 fresh back_forward boot: replay must stay deferred until pageshow because the browser
// may restore form-control values after scripts have executed.
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),session=new Map();
  const c=`${canary}-HISTORY-BOOT`;
  sharedLocal.set(PROFILE,JSON.stringify({name:c}));
  session.set(WORK,JSON.stringify({raw:c}));
  session.set(APIKEY,c+'-KEY');
  sharedLocal.set(BACKUP,JSON.stringify({entries:[{value:c}]}));
  const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-history-boot',clearApplicationData:true});
  const child=makeContext({name:'history-boot',sessionBackend:session,historyNavigation:true});
  await settle();
  const before=snap(child);
  for(const fn of child.listeners.get('window:pageshow')||[])fn({type:'pageshow',persisted:false});
  await settle();
  const after=snap(child);
  add('browser-history-fresh-navigation-replay',{
    'replay-deferred-before-pageshow':before.profile!==null&&before.work!==null&&before.seen!==end.generation,
    'pageshow-clears-local':after.profile===null&&after.backup===null,
    'pageshow-clears-session':after.work===null&&after.api===null,
    'pageshow-tab-marker':after.tabSeen===end.generation,
    'pageshow-ack':after.seen===end.generation,
    'pageshow-lock':after.locked
  },{generation:end.generation});
}

// 6 fail closed: relevant delete fails, no acknowledgement
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),child=makeContext({name:'fail-closed'});seed(child,'FAIL');child.removeFaults.add('local:'+PROFILE);const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-fault'});await settle();const s=snap(child);
  add('fail-closed-delete-fault',{'fault-leaves-owned-data':s.profile!==null,'no-cleanup-marker':s.cleanup!==end.generation,'no-tab-marker':s.tabSeen!==end.generation,'no-platform-ack':s.seen!==end.generation,'lifecycle-lock-still-engaged':s.locked},{generation:end.generation});
}
// 7 negative control: registration removed in disposable transformed copy => must fail
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),child=makeContext({name:'negative-control',negative:true});seed(child,'NEG');const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-negative'});await settle();const s=snap(child);
  add('negative-control-handler-disabled',{'expected-sensitive-data-remains':s.profile!==null&&s.work!==null,'expected-no-cleanup-marker':s.cleanup!==end.generation,'expected-no-ack':s.seen!==end.generation},{generation:end.generation,expectedOutcome:'FAIL when handler registration is disabled'});
}
// 8 foreign shared-state ownership
reset();{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),child=makeContext({name:'foreign-ownership'});seed(child,'FOREIGN',{foreign:true});const originalH2=child.ctx.localStorage.getItem(H2),originalH1=child.ctx.localStorage.getItem(H1);const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-foreign'});await settle();const s=snap(child);
  add('shared-storage-ownership',{'foreign-handoff-v2-preserved':s.h2===originalH2,'foreign-handoff-v1-preserved':s.h1===originalH1,'own-event-row-cleared':Array.isArray(s.events)&&!s.events.some(r=>r.appId==='correspondence'),'foreign-event-row-preserved':Array.isArray(s.events)&&s.events.some(r=>r.appId==='lesson-hub'),'cleanup-acked':s.seen===end.generation},{generation:end.generation});
}
// 9 F-02 diagnostic: first tab can write app-wide seen before a faulting second tab; child per-tab guard detects/fails second tab, proving central ack is not all-tabs proof.
reset();let f02Diagnostic;{
  const coord=makeContext({appId:'ai-studio',name:'coordinator'}),a=makeContext({name:'f02-good'}),b=makeContext({name:'f02-fault'});seed(a,'F02-A');b.ctx.sessionStorage.setItem(WORK,canary+'-F02-B');b.removeFaults.add('session:'+WORK);const end=coord.ctx.GHRAB_PLATFORM.session.end({reason:'qa-f02'});await settle();const sa=snap(a),sb=snap(b);f02Diagnostic={generation:end.generation,appWideSeen:sa.seen,tabASeen:sa.tabSeen,tabBSeen:sb.tabSeen,tabBWorkRemaining:sb.work!==null,demonstratesAppWideAckIsNotAllTabsProof:sa.seen===end.generation&&sb.tabSeen!==end.generation&&sb.work!==null};
  add('f02-app-wide-ack-diagnostic',{'diagnostic-condition-demonstrated':f02Diagnostic.demonstratesAppWideAckIsNotAllTabsProof},{...f02Diagnostic,status:'open-ecosystem-follow-up'});
}
// 10 F-03 same-origin raw writes are possible by design.
reset();{
  const child=makeContext({name:'f03'}),forged='F03-SYNTHETIC-'+crypto.randomBytes(4).toString('hex');child.ctx.localStorage.setItem(SUITE,forged);child.ctx.localStorage.setItem('ghrab.other-child.suite-session-seen.v1',forged);add('f03-same-origin-trust-boundary',{'global-suite-tombstone-raw-writable':child.ctx.localStorage.getItem(SUITE)===forged,'foreign-child-ack-raw-writable':child.ctx.localStorage.getItem('ghrab.other-child.suite-session-seen.v1')===forged},{risk:'inherent-same-origin-open-ecosystem-debt'});
}

const failed=results.filter(r=>r.status!=='passed');
const report={schema:'ghrab-suite-session-simulation-v1',generatedAt:new Date().toISOString(),appId:'correspondence',appVersion:manifest.appVersion,platformVersion:'1.1.2',contract:'ghrab-suite-session-v1',syntheticDataOnly:true,canary,usesActualPlatformSource:true,usesActualChildSuiteHandlerSource:true,privacyCleanupFacade:'manifest-backed synthetic facade; browser/full-app validation remains separate',browserStatus:'NOT TESTED in this environment: Chromium local navigation blocked by organization policy',results,f02Diagnostic,summary:{total:results.length,passed:results.length-failed.length,failed:failed.length,status:failed.length?'failed':'passed'}};
await fsp.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exitCode=1;
