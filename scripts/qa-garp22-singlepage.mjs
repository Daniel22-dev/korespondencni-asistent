#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root=path.resolve('.');
const dist=path.join(root,'dist');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR);
const out=path.join(evidenceRoot,'singlepage-runtime.json');
const raw=await readFile(path.join(dist,'index.html'),'utf8');
const runtimeConfigJs=await readFile(path.join(dist,'runtime-config.js'),'utf8');
const platformJs=(await readFile(path.join(dist,'ghrab','ghrab-platform.js'),'utf8'))
  .replace("new URL('./ghrab/ghrab-platform.js', location.href)","new URL('https://example.test/app/ghrab/ghrab-platform.js')");
const id=(process.env.GARP_CANARY_ID||(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`)).toUpperCase();
const marker=`GARP-STUDENT-CANARY-${id}`;
const email=`garp.student.canary.${id.toLowerCase()}@example.invalid`;
const markerA=`${marker}-A`, markerB=`${marker}-B`;
const evidence={schema:'ghrab-garp22-singlepage-evidence-v1',generatedAt:new Date().toISOString(),canary:{id,marker,email,markerA,markerB},checks:[]};
const check=(id,ok,detail={})=>evidence.checks.push({id,ok:Boolean(ok),detail});

function chromiumPath(){for(const p of [process.env.CHROMIUM_PATH,'/usr/bin/chromium','/usr/lib/chromium/chromium'].filter(Boolean))if(existsSync(p))return p;throw new Error('Chromium neni dostupne');}
async function waitJson(url){for(let i=0;i<180;i++){try{const r=await fetch(url);if(r.ok)return await r.json();}catch{}await sleep(50);}throw new Error('Chromium remote debugging timeout');}
class Cdp{constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.events=[];this.ready=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=rej});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else this.events.push(m);};}async call(method,params={}){await this.ready;return new Promise((res,rej)=>{const id=++this.seq;this.pending.set(id,{resolve:res,reject:rej});this.ws.send(JSON.stringify({id,method,params}));});}async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Runtime evaluate failed');return r.result?.value;}close(){try{this.ws.close();}catch{}}}
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

const port=9800+(process.pid%500), profile=`/tmp/garp22-single-${process.pid}`;rmSync(profile,{recursive:true,force:true});
const chrome=spawn(chromiumPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',detached:true});
let client;
try{
  await waitJson(`http://127.0.0.1:${port}/json/version`);
  const pages=await waitJson(`http://127.0.0.1:${port}/json`);
  const page=pages.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(!page)throw new Error('CDP page chybi');
  client=new Cdp(page.webSocketDebuggerUrl);await client.call('Runtime.enable');await client.call('Page.enable');
  const tree=await client.call('Page.getFrameTree');
  await client.call('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:prepareHtml(raw)});
  await client.eval(runtimeConfigJs);await client.eval(platformJs);await client.eval(`window.__GHRAB_STUDIO_ACCESS__={permit:{role:'admin'}};true`);
  const protectedBefore=await client.eval(`document.querySelectorAll('script[type="application/ghrab-protected"][data-ghrab-protected]').length`);
  const unlockCount=await client.eval(`window.GHRAB_PLATFORM?.unlockProtectedScripts?.() ?? -1`);
  let ready=false;for(let i=0;i<160;i++){ready=Boolean(await client.eval(`document.documentElement.dataset.ksShellReady==='true'&&document.documentElement.dataset.ksAppReady==='true'`));if(ready)break;await sleep(25);}
  check('harness.platform-unlock',protectedBefore===1&&unlockCount===1&&ready,{protectedBefore,unlockCount,ready});

  const exported=await client.eval(`(()=>{localStorage.clear();sessionStorage.clear();E('in','raw').value=${JSON.stringify(markerA)};ST.in.raw=${JSON.stringify(markerA)};saveWorkingSessionNow();const text=JSON.stringify(collectSettings());return {containsA:text.includes(${JSON.stringify(markerA)}),containsEmail:text.includes(${JSON.stringify(email)}),length:text.length};})()`);
  check('sim08.export-excludes-working-student-data',!exported.containsA&&!exported.containsEmail,exported);

  const egress=await client.eval(`(async()=>{window.__setTestRunActive(true);localStorage.setItem('ghrab.correspondence.audit-canary',${JSON.stringify(marker)});let capture=null,calls=0;window.__TEST_MOCK_GEMINI=async p=>{calls++;capture=p;return {text:'Bezpečný syntetický výstup',synonyma:{}}};const safe='text bez osobních údajů.';const out=await callGemini(safe,'Vrať JSON {"text":"…"}.','text',{pane:'in',texts:[safe]},{operation:'outgoing-proofread',modelProfile:'balanced'});const dump=JSON.stringify(capture);calls=0;let blocked=null;try{await callGemini('Kontakt: '+${JSON.stringify(email)},'Vrať JSON {"text":"…"}.','text',{pane:'in',texts:['Kontakt: '+${JSON.stringify(email)}]},{operation:'outgoing-proofread',modelProfile:'balanced'});}catch(e){blocked={code:e.code,message:e.message,detailCount:Array.isArray(e.detail)?e.detail.length:0};}return {out:out.text,payloadKeys:Object.keys(capture||{}),containsMarker:dump.includes(${JSON.stringify(marker)}),containsEmail:dump.includes(${JSON.stringify(email)}),containsAuditKey:dump.includes('audit-canary'),callsAfterBlocked:calls,blocked};})()`);
  check('rt19.ai-egress-minimization',egress.out==='Bezpečný syntetický výstup'&&!egress.containsMarker&&!egress.containsEmail&&!egress.containsAuditKey,{payloadKeys:egress.payloadKeys,containsMarker:egress.containsMarker,containsEmail:egress.containsEmail,containsAuditKey:egress.containsAuditKey});
  check('rt19.preflight-zero-egress-for-raw-canary',egress.callsAfterBlocked===0&&egress.blocked?.code==='PREFLIGHT_BLOCKED',{callsAfterBlocked:egress.callsAfterBlocked,blockedCode:egress.blocked?.code});
  check('rt14.preflight-error-redacts-canary',egress.blocked?.code==='PREFLIGHT_BLOCKED'&&!String(egress.blocked?.message||'').includes(email),{blockedCode:egress.blocked?.code,messageContainsCanary:String(egress.blocked?.message||'').includes(email)});

  const retry=await client.eval(`(async()=>{let calls=0;window.__TEST_MOCK_GEMINI=async()=>{calls++;if(calls===1)throw GHRAB_AI.createError('SERVER_UNAVAILABLE',{providerRequests:0});return {text:'RETRY-OK',synonyma:{}}};const safe='text bez osobních údajů.';let first='';try{await callGemini(safe,'Vrať JSON {"text":"…"}.','text',{pane:'in',texts:[safe]},{operation:'outgoing-proofread',modelProfile:'balanced'});}catch(e){first=e.code||e.name;}const second=await callGemini(safe,'Vrať JSON {"text":"…"}.','text',{pane:'in',texts:[safe]},{operation:'outgoing-proofread',modelProfile:'balanced'});return {calls,first,second:second.text,ops:JSON.stringify(loadOpsLog())};})()`);
  check('sim06.interrupted-ai-explicit-retry',retry.calls===2&&retry.first==='SERVER_UNAVAILABLE'&&retry.second==='RETRY-OK'&&!retry.ops.includes('text bez osobních údajů.'),{calls:retry.calls,first:retry.first,second:retry.second,opsContainsPrompt:retry.ops.includes('text bez osobních údajů.')});

  const hostile=await client.eval(`(()=>{window.__GARP_XSS=0;const payload='<img src=x onerror="window.__GARP_XSS=1"><script>window.__GARP_XSS=2<\\/script>';const card=draftCard('in',{text:'Dobrý den,\\n'+payload+'\\n[podpis]'});document.body.appendChild(card);const r={xss:window.__GARP_XSS,img:Boolean(card.querySelector('img')),script:Boolean(card.querySelector('script')),literal:card.textContent.includes('<img')};card.remove();return r;})()`);
  check('sim05.hostile-ai-output-inert',hostile.xss===0&&!hostile.img&&!hostile.script,hostile);

  const reimport=await client.eval(`(()=>{const settings=collectSettings();endWorkAndClearData({reload:false});applyImportedSettings(settings);ST.in.raw=${JSON.stringify(markerB)};E('in','raw').value=${JSON.stringify(markerB)};saveWorkingSessionNow();const dump=JSON.stringify({local:[...Array(localStorage.length)].map((_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]),session:[...Array(sessionStorage.length)].map((_,i)=>[sessionStorage.key(i),sessionStorage.getItem(sessionStorage.key(i))]),body:document.body.innerText});return {hasA:dump.includes(${JSON.stringify(markerA)}),hasB:E('in','raw').value===${JSON.stringify(markerB)},inputValue:E('in','raw').value};})()`);
  check('sim08.reimport-second-logical-context-no-a',!reimport.hasA&&reimport.hasB,reimport);

  const deletion=await client.eval(`(()=>{localStorage.setItem('ghrab.correspondence.audit-canary',${JSON.stringify(marker)});sessionStorage.setItem('ghrab.correspondence.audit-session',${JSON.stringify(email)});localStorage.setItem('unrelated_other_app_key','NEUTRAL');ST.in.raw=${JSON.stringify(markerA)};ST.in.clean=${JSON.stringify(email)};E('in','raw').value=${JSON.stringify(markerA)};$('in_results').textContent=${JSON.stringify(email)};const originalReporter=window.GHRABErrorReporter;let reporterClearCalls=0;window.GHRABErrorReporter={...(originalReporter||{}),clearDraft:()=>{reporterClearCalls++;return true;}};const ok=endWorkAndClearData({reload:false});window.GHRABErrorReporter=originalReporter;const vals=[];const owned=[];for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i),v=store.getItem(k)||'';vals.push([k,v]);if(isOwnedAppStorageKey(k))owned.push(k);}return {ok,storageHasCanary:vals.some(x=>x[1].includes(${JSON.stringify(marker)})||x[1].includes(${JSON.stringify(email)})||x[1].includes(${JSON.stringify(markerA)})||x[1].includes(${JSON.stringify(markerB)})),stateHas:JSON.stringify(ST).includes(${JSON.stringify(marker)})||JSON.stringify(ST).includes(${JSON.stringify(email)}),domHas:(E('in','raw')?.value||'').includes(${JSON.stringify(marker)})||($('in_results')?.textContent||'').includes(${JSON.stringify(email)}),remainingOwnedKeys:owned,unrelatedPreserved:localStorage.getItem('unrelated_other_app_key')==='NEUTRAL',reporterClearCalls};})()`);
  check('rt20.end-work-clears-app-controlled-data',deletion.ok&&!deletion.storageHasCanary&&!deletion.stateHas&&!deletion.domHas&&deletion.remainingOwnedKeys.length===0&&deletion.unrelatedPreserved&&deletion.reporterClearCalls===1,deletion);

  const failSafe=await client.eval(`(()=>{const values=new Map([['rozbor_profile','synthetic'],['unrelated_key','keep']]);const fake={get length(){return values.size},key(i){return [...values.keys()][i]??null},getItem(k){return values.get(String(k))??null},removeItem(k){if(String(k)==='rozbor_profile')throw new Error('synthetic-remove-failure');values.delete(String(k));}};const r=removeOwnedStorageKeys(fake,'syntheticStorage');return {wouldReportSuccess:r.failures.length===0&&r.remaining.length===0,failures:r.failures,remaining:r.remaining};})()`);
  check('rt20.fail-safe-detects-remove-failure',failSafe.wouldReportSuccess===false&&failSafe.failures.length===1&&failSafe.remaining.length===1,failSafe);

  const enumFailSafe=await client.eval(`(()=>{const blocked={get length(){throw new Error('synthetic-enumeration-failure')}};const r=removeOwnedStorageKeys(blocked,'blockedStorage');return {failures:r.failures,remaining:r.remaining};})()`);
  check('rt20.fail-safe-detects-enumeration-failure',enumFailSafe.failures.includes('blockedStorage:enumeration-before')&&enumFailSafe.remaining.includes('blockedStorage:<unverified>'),enumFailSafe);

  const scopeNc=await client.eval(`(()=>{const nc=${JSON.stringify(marker+'-NC-SCOPE')};const scan=()=>{const rows=[];for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i),v=store.getItem(k)||'';rows.push([k,v]);}return {containsCanary:rows.some(([,v])=>v.includes(nc)),keys:rows.map(([k])=>k)};};localStorage.setItem('correspondence_leak_v1',nc);const endWorkResult=endWorkAndClearData({reload:false});const mutated=scan();localStorage.removeItem('correspondence_leak_v1');endWorkAndClearData({reload:false});const clean=scan();return {endWorkResult,mutated,clean};})()`);
  evidence.negativeControls=evidence.negativeControls||[];
  evidence.negativeControls.push({id:'NC-RT20-SCOPE',synthetic:true,expectedMutatedStatus:'FAIL',observedMutatedStatus:scopeNc.mutated.containsCanary?'FAIL':'PASS',expectedCleanStatus:'PASS',observedCleanStatus:scopeNc.clean.containsCanary?'FAIL':'PASS',detail:scopeNc});
  if(!scopeNc.mutated.containsCanary||scopeNc.clean.containsCanary)throw new Error('NC-RT20-SCOPE neprokázala očekávaný FAIL -> PASS přechod');

  const consoleDump=client.events.filter(x=>x.method==='Runtime.consoleAPICalled'||x.method==='Runtime.exceptionThrown'||x.method==='Log.entryAdded').map(x=>JSON.stringify(x.params||{})).join('\n');
  check('rt06.canary-not-in-observed-console',!consoleDump.includes(marker)&&!consoleDump.includes(email),{eventCount:client.events.length});
  evidence.environmentNotes=evidence.environmentNotes||[];
  evidence.environmentNotes.push({id:'rt06.url-canary-navigation',status:'NOT TESTED',reason:'Harness uses Page.setDocumentContent on about:blank because managed Chromium blocks navigation. URL subcheck is intentionally excluded from PASS count instead of being vacuous.'});
} finally {
  client?.close();if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGTERM')}catch{}}await Promise.race([new Promise(r=>chrome.once('exit',r)),sleep(1200)]);if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGKILL')}catch{}}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
evidence.summary={passed:evidence.checks.filter(x=>x.ok).length,failed:evidence.checks.filter(x=>!x.ok).length,total:evidence.checks.length,status:evidence.checks.every(x=>x.ok)?'passed':'failed'};
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({schema:evidence.schema,generatedAt:evidence.generatedAt,canaryId:id,summary:evidence.summary,checks:evidence.checks.map(x=>({id:x.id,ok:x.ok}))},null,2));
if(evidence.summary.failed)process.exit(1);
