/* ===================== SPRÁVA LOKÁLNÍCH DAT ===================== */

const UI_MODE_SK="rozbor_ui_mode";
const MAX_IMPORT_FILE_BYTES=1024*1024;
const APP_RETAIN_LOCAL_STORAGE_KEYS=new Set([
  "ghrab.correspondence.migration.p2-storage-namespace-v1.done",
  "ghrab.correspondence.suite-session-received.v1",
  "ghrab.correspondence.suite-session-cleanup.v1",
  "ghrab.correspondence.suite-session-seen.v1",
  "ghrab.correspondence.suite-session-tab-seen.v1"
]);
const SHARED_HANDOFF_V2_KEY="ghrab.platform.handoff.v2";
const SHARED_HANDOFF_V1_KEY="ghrab.handoff.v1";
const SHARED_EVENTS_KEY="ghrab.pilot.events.v2";
const SHARED_STORAGE_KEYS=new Set([SHARED_HANDOFF_V2_KEY,SHARED_HANDOFF_V1_KEY,SHARED_EVENTS_KEY]);
let endWorkStorageWriteLocked=false;
let endWorkStorageCleanupInProgress=false;
function importFileWithinLimit(file,maxBytes=MAX_IMPORT_FILE_BYTES){
  const size=Number(file&&file.size);
  return !!file&&Number.isFinite(size)&&size>=0&&size<=Number(maxBytes||0);
}
function importTextWithinLimit(raw,maxBytes=MAX_IMPORT_FILE_BYTES){
  return new Blob([String(raw||"")]).size<=Number(maxBytes||0);
}
function storageKeySnapshot(store){
  const keys=[];
  try{
    const length=Number(store&&store.length);
    if(!Number.isFinite(length)||length<0)throw new Error("storage-length-unavailable");
    for(let i=0;i<length;i+=1){
      const key=store.key(i);
      if(key!==null&&key!==undefined&&!keys.includes(String(key)))keys.push(String(key));
    }
    return Object.freeze({keys:Object.freeze(keys),enumerable:true});
  }catch(_){
    return Object.freeze({keys:Object.freeze([]),enumerable:false});
  }
}
function storageKeyList(store){return storageKeySnapshot(store).keys.slice();}
function isOwnedAppStorageKey(key){
  const value=String(key||"");
  if(APP_RETAIN_LOCAL_STORAGE_KEYS.has(value))return false;
  return /^(?:rozbor_|ks5_|ghrab\.correspondence\.)/.test(value);
}
function appStorageSnapshot(store){
  const snap=storageKeySnapshot(store);
  return Object.freeze({keys:Object.freeze(snap.keys.filter(isOwnedAppStorageKey)),enumerable:snap.enumerable});
}
function appStorageKeys(store){return appStorageSnapshot(store).keys.slice();}
function setUiMode(mode){
  mode = (mode === "advanced") ? "advanced" : "simple";
  document.body.classList.toggle("ui-simple", mode === "simple");
  document.body.classList.toggle("ui-advanced", mode === "advanced");
  const simple=$("uiSimple"), advanced=$("uiAdvanced");
  if(simple){ simple.classList.toggle("on", mode === "simple"); simple.setAttribute("aria-pressed",mode==="simple"?"true":"false"); }
  if(advanced){ advanced.classList.toggle("on", mode === "advanced"); advanced.setAttribute("aria-pressed",mode==="advanced"?"true":"false"); }
  const guide=$("safetyGuideInline"); if(guide) guide.open=mode==="advanced";
  try{ localStorage.setItem(UI_MODE_SK, mode); }catch(_){}
  renderChoiceSummary("in");
  renderChoiceSummary("my");
}
function initUiMode(){
  let mode="simple";
  try{ mode=localStorage.getItem(UI_MODE_SK)||"simple"; }catch(_){}
  document.querySelectorAll(".ui-mode-btn[data-ui-mode]").forEach(btn=>{
    btn.addEventListener("click", ()=>setUiMode(btn.dataset.uiMode));
  });
  setUiMode(mode);
}

function removeOwnedStorageKeys(store,label){
  const prefix=String(label||"storage");
  const failures=[];
  const before=appStorageSnapshot(store);
  if(!before.enumerable)return {failures:[prefix+":enumeration-before"],remaining:[prefix+":<unverified>"]};
  before.keys.forEach(k=>{try{store.removeItem(k);}catch(_){failures.push(prefix+":"+k);}});
  const after=appStorageSnapshot(store);
  if(!after.enumerable){failures.push(prefix+":enumeration-after");return {failures,remaining:[prefix+":<unverified>"]};}
  return {failures,remaining:after.keys.map(k=>prefix+":"+k)};
}
function parseSharedJson(raw){try{return {ok:true,value:JSON.parse(String(raw))};}catch(_){return {ok:false,value:null};}}
function handoffOwnedByCorrespondence(key,value){
  if(!value||typeof value!=="object")return false;
  if(key===SHARED_HANDOFF_V2_KEY)return String(value.target&&value.target.appId||"")==="correspondence";
  return String(value.target||"")==="correspondence";
}
function inspectSharedOwnedContent(store,label){
  const failures=[],owned=[];
  for(const key of [SHARED_HANDOFF_V2_KEY,SHARED_HANDOFF_V1_KEY]){
    let raw=null;try{raw=store.getItem(key);}catch(_){failures.push(label+":"+key+":read");continue;}
    if(raw===null)continue;
    const parsed=parseSharedJson(raw);
    if(!parsed.ok){failures.push(label+":"+key+":unparseable");continue;}
    if(handoffOwnedByCorrespondence(key,parsed.value))owned.push(label+":"+key);
  }
  let rawEvents=null;try{rawEvents=store.getItem(SHARED_EVENTS_KEY);}catch(_){failures.push(label+":"+SHARED_EVENTS_KEY+":read");}
  if(rawEvents!==null){
    const parsed=parseSharedJson(rawEvents);
    if(!parsed.ok||!Array.isArray(parsed.value))failures.push(label+":"+SHARED_EVENTS_KEY+":unparseable");
    else if(parsed.value.some(row=>row&&String(row.appId||"")==="correspondence"))owned.push(label+":"+SHARED_EVENTS_KEY);
  }
  return {failures,owned};
}
function clearSharedOwnedContent(store,label){
  const failures=[];
  for(const key of [SHARED_HANDOFF_V2_KEY,SHARED_HANDOFF_V1_KEY]){
    let raw=null;try{raw=store.getItem(key);}catch(_){failures.push(label+":"+key+":read");continue;}
    if(raw===null)continue;
    const parsed=parseSharedJson(raw);
    if(!parsed.ok){failures.push(label+":"+key+":unparseable");continue;}
    if(!handoffOwnedByCorrespondence(key,parsed.value))continue;
    try{store.removeItem(key);}catch(_){failures.push(label+":"+key+":remove");continue;}
    try{if(store.getItem(key)!==null)failures.push(label+":"+key+":verify");}catch(_){failures.push(label+":"+key+":verify-read");}
  }
  let rawEvents=null;try{rawEvents=store.getItem(SHARED_EVENTS_KEY);}catch(_){failures.push(label+":"+SHARED_EVENTS_KEY+":read");}
  if(rawEvents!==null){
    const parsed=parseSharedJson(rawEvents);
    if(!parsed.ok||!Array.isArray(parsed.value))failures.push(label+":"+SHARED_EVENTS_KEY+":unparseable");
    else{
      const kept=parsed.value.filter(row=>!(row&&String(row.appId||"")==="correspondence"));
      if(kept.length!==parsed.value.length){
        try{if(kept.length)store.setItem(SHARED_EVENTS_KEY,JSON.stringify(kept));else store.removeItem(SHARED_EVENTS_KEY);}catch(_){failures.push(label+":"+SHARED_EVENTS_KEY+":rewrite");}
      }
    }
  }
  const after=inspectSharedOwnedContent(store,label);
  return {failures:failures.concat(after.failures),remaining:after.owned};
}
function verifyClearOnEndStorage(){
  const failures=[],remaining=[];
  for(const [store,label] of [[localStorage,"localStorage"],[sessionStorage,"sessionStorage"]]){
    const app=appStorageSnapshot(store);
    if(!app.enumerable)failures.push(label+":enumeration");else remaining.push(...app.keys.map(k=>label+":"+k));
    const shared=inspectSharedOwnedContent(store,label);failures.push(...shared.failures);remaining.push(...shared.owned);
  }
  return Object.freeze({ok:failures.length===0&&remaining.length===0,failures:Object.freeze(failures),remainingOwnedKeys:Object.freeze(remaining)});
}
function shouldBlockEndWorkWrite(store,key){
  if(!endWorkStorageWriteLocked||endWorkStorageCleanupInProgress)return false;
  const value=String(key||"");
  if(APP_RETAIN_LOCAL_STORAGE_KEYS.has(value))return false;
  if(SHARED_STORAGE_KEYS.has(value))return true;
  return isOwnedAppStorageKey(value);
}
(function installEndWorkStorageWriteGate(){
  try{
    const proto=window.Storage&&window.Storage.prototype;
    if(!proto||proto.__ghrabCorrespondenceEndWorkWriteGate===true)return;
    const previous=proto.setItem;
    if(typeof previous!=="function")return;
    Object.defineProperty(proto,"__ghrabCorrespondenceEndWorkWriteGate",{configurable:false,enumerable:false,value:true});
    proto.setItem=function(key,value){
      if(shouldBlockEndWorkWrite(this,key))return undefined;
      return previous.call(this,key,value);
    };
  }catch(_){}
})();
function engageEndWorkLifecycleLock(){
  endWorkStorageWriteLocked=true;
  try{suppressWorkingSession();}catch(_){}
  return true;
}
function clearAllLocalData(options){
  // Maž pouze obsah vlastněný touto aplikací podle data manifestu a PC-01.
  // Sdílený handoff/event storage se čistí podmíněně; cizí child data zůstávají zachována.
  const opts=options&&typeof options==="object"?options:{};
  let localResult,sessionResult,localShared,sessionShared;
  endWorkStorageCleanupInProgress=true;
  try{
    localResult=removeOwnedStorageKeys(localStorage,"localStorage");
    sessionResult=removeOwnedStorageKeys(sessionStorage,"sessionStorage");
    localShared=clearSharedOwnedContent(localStorage,"localStorage");
    sessionShared=clearSharedOwnedContent(sessionStorage,"sessionStorage");
  }finally{endWorkStorageCleanupInProgress=false;}
  const removeFailures=localResult.failures.concat(sessionResult.failures,localShared.failures,sessionShared.failures);
  const remainingOwnedKeys=localResult.remaining.concat(sessionResult.remaining,localShared.remaining,sessionShared.remaining);
  let memoryUiOk=true;
  try{
    geminiApiKey=""; geminiKeyScope=""; selectedModelProfile=MODEL_PROFILE_DEFAULT;
    clearAnonymizationCaches();
    try{ $("keyInput").value=""; }catch(_){}
    updateKeyStatus(); updateModelUI(); renderTemplates();
    try{renderMyProfileContext();renderWritingStyleControls();}catch(_){}
  }catch(_){memoryUiOk=false;}
  const verification=verifyClearOnEndStorage();
  const ok=removeFailures.length===0&&remainingOwnedKeys.length===0&&verification.ok&&memoryUiOk;
  const allFailures=removeFailures.concat(verification.failures);
  const allRemaining=[...new Set(remainingOwnedKeys.concat(verification.remainingOwnedKeys))];
  if(!opts.silent)toast(ok?"Lokální data smazána ✓":"Smazání dat se nepodařilo dokončit. Neopouštěj sdílené zařízení, zavři tuto kartu a informuj správce.",{persistent:!ok});
  return Object.freeze({ok,removeFailures:Object.freeze(allFailures.slice()),remainingOwnedKeys:Object.freeze(allRemaining.slice()),memoryUiOk});
}
function resetTransientPaneState(p){
  if(!ST[p])return;
  Object.keys(ST[p]).forEach(key=>delete ST[p][key]);
  Object.assign(ST[p],{km:[],emailN:0,phoneN:0,raw:"",clean:"",syn:{},pozadavky:[],outputReady:false,sensitiveAck:false,reviewedSuggestions:{},selectedPhrase:""});
  ACTIVE_KEY_REALS[p]=[];
  const raw=E(p,"raw");if(raw)raw.value="";
  const note=$(p+"_note");if(note)note.value="";
  const file=E(p,"file");if(file)file.value="";
  const review=E(p,"reviewOk");if(review)review.checked=false;
  const results=$(p+"_results");if(results)results.replaceChildren();
}
function endWorkAndClearData(options){
  const opts=options&&typeof options==="object"?options:{};
  let transientOk=true,reporterOk=true,reloadOk=true;
  if(opts.lifecycleLock===true||opts.reload!==false){try{engageEndWorkLifecycleLock();}catch(_){transientOk=false;}}
  else{try{suppressWorkingSession();}catch(_){transientOk=false;}}
  try{clearTimeout(workSessionTimer);}catch(_){transientOk=false;}
  try{resetTransientPaneState("in");resetTransientPaneState("my");}catch(_){transientOk=false;}
  try{window.__ACTIVE_KEY_REALS=[];}catch(_){transientOk=false;}
  try{window.GHRABCorrespondenceWorkbench?.clearTransientState?.();}catch(_){transientOk=false;}
  try{
    if(window.GHRABErrorReporter)reporterOk=typeof window.GHRABErrorReporter.clearDraft==="function"&&window.GHRABErrorReporter.clearDraft()!==false;
  }catch(_){reporterOk=false;}
  const deletion=clearAllLocalData({silent:true});
  let ok=transientOk&&reporterOk&&deletion.ok;
  if(opts.reload!==false){
    try{
      setTimeout(()=>{try{toast("Pokud se aplikace sama znovu nenačetla, zavři tuto kartu před odchodem od sdíleného zařízení.",{persistent:true});}catch(_){}},1500);
      location.reload();
    }catch(_){reloadOk=false;ok=false;}
  }
  if(!opts.silent){
    if(ok)toast("Práce ukončena a lokální data smazána ✓");
    else toast("Ukončení práce se nepodařilo bezpečně dokončit. Neopouštěj sdílené zařízení, zavři tuto kartu a informuj správce.",{persistent:true});
  }
  return ok&&reloadOk;
}
window.GHRABCorrespondencePrivacy=Object.freeze({
  endWork:endWorkAndClearData,
  verifyClearOnEndStorage,
  engageLifecycleLock:engageEndWorkLifecycleLock,
  isLifecycleLocked:()=>endWorkStorageWriteLocked
});
function collectSettings(){
  return {
    _app:"korespondencni-asistent", _verze:RELEASE.version, _exportovano:new Date().toISOString(),
    profil: loadProfile(),
    slovnikJmen: loadDict(),
    sablony: loadTpls(),
    modelProfile: selectedModelProfile,
    rezimUI: (function(){ try{ return localStorage.getItem(UI_MODE_SK)||"simple"; }catch(_){ return "simple"; } })(),
    neukladatHistorii: isNoHistory()
    // ZÁMĚRNĚ neexportujeme API klíč ani historii e-mailů (citlivé)
  };
}
async function exportSettings(){
  try{
    const payload=collectSettings();
    if(window.GHRABArtifact?.download){
      await window.GHRABArtifact.download({appId:"correspondence",appVersion:RELEASE.version,artifactType:"correspondence-settings",sensitivity:"restricted",contentManifest:[{kind:"settings",schema:"korespondencni-asistent-settings-v1"}],payload,filename:"korespondencni-asistent-nastaveni.ghrab.json"});
    }else{
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);a.download="korespondencni-asistent-nastaveni.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    }
    toast("Nastavení exportováno ✓");
  }catch(e){ toast("Export se nepovedl."); }
}
function applyImportedSettings(obj){
  if(!obj || typeof obj!=="object") throw new Error("neplatný soubor");
  if(obj._app && obj._app!=="korespondencni-asistent") throw new Error("soubor není nastavení Korespondenčního asistenta");
  if(obj.profil && typeof obj.profil==="object"){ try{ localStorage.setItem("rozbor_profile", JSON.stringify(typeof sanitizeProfile==="function"?sanitizeProfile(obj.profil):{})); }catch(_){} }
  if(Array.isArray(obj.slovnikJmen)){ try{ saveDict(obj.slovnikJmen); }catch(_){} }
  if(Array.isArray(obj.sablony)){ try{ saveTpls(obj.sablony); }catch(_){} }
  if(obj.modelProfile || obj.model){ try{ setModelProfile(migrateStoredModelProfile(obj.modelProfile||obj.model)); }catch(_){} }
  if(obj.rezimUI){ try{ setUiMode(obj.rezimUI); }catch(_){} }
  try{ setNoHistory(!!obj.neukladatHistorii); }catch(_){}
  try{ renderTemplates(); }catch(_){}
  try{ if(typeof renderMyProfileContext==="function")renderMyProfileContext(); }catch(_){}
  try{ if(typeof renderWritingStyleControls==="function")renderWritingStyleControls(); }catch(_){}
}
function importSettings(file){
  if(!file) return;
  if(!importFileWithinLimit(file)){toast("Import se nepovedl: soubor je větší než 1 MB.");return;}
  const r=new FileReader();
  r.onload=async()=>{ try{
    const raw=String(r.result||"{}");
    if(!importTextWithinLimit(raw))throw new Error("soubor je větší než 1 MB");
    const parsed=window.GHRABArtifact?.unwrapMaybe?await window.GHRABArtifact.unwrapMaybe(raw,{allowLegacy:true,expectedAppId:"correspondence",verifyChecksum:true}):{payload:JSON.parse(raw)};
    const obj=parsed.payload;
    const apply=()=>{try{applyImportedSettings(obj);toast("Nastavení importováno ✓");}catch(e){toast("Import se nepovedl: "+(e.message||"neplatný soubor"));}};
    if(!obj._app && (obj.profil||obj.slovnikJmen)){
      const parts=[]; if(obj.profil)parts.push("profil odesílatele"); if(obj.slovnikJmen)parts.push("slovník skutečných jmen");
      confirmActionModal({title:"Starší soubor nastavení",message:"Soubor nemá identifikaci aplikace. Pokračováním se přepíše "+parts.join(" a ")+". Importovat?",confirmText:"Importovat",onConfirm:apply});
    }else apply();
  }catch(e){toast("Import se nepovedl: "+(e.message||"neplatný soubor"));} };
  r.onerror=()=>toast("Soubor se nepovedlo načíst.");
  r.readAsText(file,"utf-8");
}
function openDataManager(){
  const noHist=isNoHistory();
  const html='<p class="hint">Všechno níže zůstává jen v tomto prohlížeči. Na sdíleném školním počítači je bezpečnější po práci data smazat.</p>'+
    '<label class="data-switch"><input type="checkbox" id="dmNoHistory" '+(noHist?'checked':'')+'><span><b>Neukládat historii výstupů</b><br><span class="hint">Bezpečná výchozí volba. Po vypnutí se může uložit jen anonymizovaná verze se značkami, nikdy text se skutečnými jmény.</span></span></label>'+
    '<div class="data-switch"><span>↔</span><span><b>Přenos mezi zařízeními</b><br><span class="hint">Exportuje profil, slovník jmen, šablony, model a nastavení do souboru. <b>Soubor může obsahovat skutečná jména ze slovníku; chraň ho jako citlivý. API klíč ani historii e-mailů neobsahuje.</b></span></span></div>'+
    '<div class="row"><button class="btn ghost small" id="dmExport">Exportovat nastavení</button><button class="btn ghost small" id="dmImport">Importovat ze souboru</button><input type="file" id="dmImportFile" accept="application/json,.json" style="display:none"></div>'+
    '<div class="data-switch data-danger"><span>⚠️</span><span><b>Ukončit práci na sdíleném zařízení</b><br>Vymaže lokální i dočasná data této aplikace, pracovní texty a obnovovací stav. Nakonec aplikaci znovu načte, aby se odstranil i obsah držený pouze v paměti.</span></div>'+
    '<div class="row"><button class="btn ghost" id="dmSave">Uložit nastavení</button><button class="btn danger" id="dmClear"><span class="action-icon" data-ic="warn"></span>Smazat všechna lokální data</button><button class="btn danger" id="dmEndWork"><span class="action-icon" data-ic="warn"></span>Ukončit práci</button></div>';
  const m=openModal("Správa lokálních dat", html, {label:"Správa lokálních dat"});
  m.body.querySelector("#dmSave").onclick=()=>{ setNoHistory(m.body.querySelector("#dmNoHistory").checked); m.close(); toast("Nastavení uloženo ✓"); };
  m.body.querySelector("#dmExport").onclick=exportSettings;
  const fileInp=m.body.querySelector("#dmImportFile");
  m.body.querySelector("#dmImport").onclick=()=>fileInp.click();
  fileInp.onchange=()=>{ if(fileInp.files&&fileInp.files[0]){ importSettings(fileInp.files[0]); fileInp.value=""; } };
  m.body.querySelector("#dmClear").onclick=()=>{ confirmActionModal({title:"Smazat všechna lokální data",message:"Opravdu smazat API klíč, anonymizovanou historii, profil, slovník jmen, šablony, profil AI, debug data a technický log z tohoto prohlížeče? Tuto akci nelze vrátit.",confirmText:"Smazat data",danger:true,onConfirm(){clearAllLocalData();m.close();}}); };
  m.body.querySelector("#dmEndWork").onclick=()=>{ confirmActionModal({title:"Ukončit práci",message:"Vymazat pracovní texty, lokální a dočasná data této aplikace a znovu ji načíst? Použij tuto volbu zejména na sdíleném zařízení.",confirmText:"Ukončit a vymazat",danger:true,onConfirm(){m.close();endWorkAndClearData();}}); };
}


function openAiRuntimeDiagnostics(){
  const config=GHRABRuntime.getConfig(),usage=GHRAB_AI.getLastUsage();
  const safe={schema:config.schema,app:config.app,ai:{mode:config.ai.mode,gatewayUrl:config.ai.gatewayUrl,healthUrl:config.ai.healthUrl,allowDirectMode:config.ai.allowDirectMode,allowDirectFallback:config.ai.allowDirectFallback,defaultModelProfile:config.ai.defaultModelProfile,requestTimeoutMs:config.ai.requestTimeoutMs,directGemini:config.ai.directGemini},transports:GHRAB_AI.getState().transports,lastUsage:usage||null};
  return openModal("Diagnostika AI připojení",'<p class="hint">Zobrazuje pouze veřejnou konfiguraci a provozní metadata. API klíče, prompty ani odpovědi se zde nevypisují.</p><pre class="mono" style="white-space:pre-wrap;max-height:420px;overflow:auto">'+esc(JSON.stringify(safe,null,2))+'</pre>',{label:"Diagnostika AI připojení"});
}
function openOpsLog(){
  const rows=loadOpsLog();
  const list=rows.length?rows.map(r=>{
    const when=new Date(r.d||Date.now()).toLocaleString("cs-CZ");
    return '<div class="ops-row"><b>'+esc(r.type||"akce")+' · '+esc(r.status||"ok")+'</b><div class="ops-meta">'+esc(when)+' · profil AI: '+esc(r.modelProfile||r.model||"—")+'</div><pre>'+esc(JSON.stringify(r.meta||{},null,2))+'</pre></div>';
  }).join(""):'<p class="empty">Technický log je prázdný.</p>';
  const html='<p class="hint">Log ukládá pouze technické stavy aplikace: čas, typ akce, profil AI, výsledek, kód chyby nebo timeout. <b>Neukládá texty e-mailů, prompty ani hotové odpovědi.</b></p><div class="ops-log">'+list+'</div><div class="row"><button class="btn ghost small" id="opsClear">Smazat technický log</button></div>';
  const m=openModal("Technický provozní log", html, {label:"Technický provozní log"});
  const clr=m.body.querySelector("#opsClear"); if(clr) clr.onclick=()=>{ clearOpsLog(); m.close(); toast("Technický log smazán"); };
  return m;
}
function openDeveloperTools(){
  const testCard=testRunnerAvailable()?'<button class="dev-tool-card" id="devTests"><b>Automatické testy</b><span>Lokální smoke testy bez volání API.</span></button>':'';
  const html='<p class="hint">Tyto nástroje jsou určené pro správu a ladění aplikace. Běžný učitel je při práci s e-mailem nepotřebuje.</p>'+
    '<div class="dev-tools-grid">'+testCard+
    '<button class="dev-tool-card" id="devDebug"><b>Debug prompt</b><span>Poslední anonymizovaný prompt, pokud není vypnutý citlivým režimem.</span></button>'+
    '<button class="dev-tool-card" id="devOps"><b>Technický log</b><span>Stavy, chyby a timeouty bez textů e-mailů.</span></button>'+    '<button class="dev-tool-card" id="devAiRuntime"><b>AI runtime</b><span>Aktivní transport, kontrakt, adaptéry a poslední usage metadata.</span></button>'+
    '</div>';
  const m=openModal("Vývojářské nástroje", html, {label:"Vývojářské nástroje"});
  const devTests=m.body.querySelector("#devTests");if(devTests)devTests.onclick=()=>{ m.close(); openTestRunner(false); };
  m.body.querySelector("#devDebug").onclick=()=>{ m.close(); openLastPromptDebug(); };
  m.body.querySelector("#devOps").onclick=()=>{ m.close(); openOpsLog(); };
  m.body.querySelector("#devAiRuntime").onclick=()=>{ m.close(); openAiRuntimeDiagnostics(); };
  return m;
}
function makeParamFold(title, nodes, openByDefault, tip){
  const usable=nodes.filter(Boolean);
  if(!usable.length) return null;
  const d=document.createElement("details"); d.className="param-fold simple-hide"; if(openByDefault) d.open=true;
  const sum=document.createElement("summary"); sum.textContent=title;
  if(tip){ const b=document.createElement("button"); b.type="button"; b.className="help-tip"; b.setAttribute("aria-label","Nápověda k "+title); b.dataset.tip=tip; b.textContent="i"; b.onclick=e=>e.preventDefault(); sum.append(" ",b); }
  d.appendChild(sum);
  const body=document.createElement("div"); body.className="param-fold-body"; d.appendChild(body);
  usable.forEach(n=>body.appendChild(n));
  return d;
}
function compactAdvancedParams(){
  const card=document.querySelector("#pane-my .params");
  if(!card || card.dataset.compactParams==="1") return;
  const grp=(data)=>{ const ch=card.querySelector('.chips[data-group="'+data+'"]'); return ch ? ch.closest(".pgroup") : null; };
  const byId=(id)=>$(id);
  const tpl=byId("my_tplGroup");
  const before=card.querySelector(".simple-action-note") || card.querySelector(".choice-summary") || card.querySelector(".row.actsticky");
  const audienceFold=makeParamFold("Komu píšu", [grp("my_adresat"), byId("my_scopeGroup"), byId("my_senderGroup"), grp("my_oslov")], true);
  const scenarioFold=makeParamFold("Volitelný školní scénář", [byId("my_scenarioGroup")], false, "Scénář není nový režim ani pevná šablona. Pouze přednastaví typ práce, adresáta, počet adresátů, oslovení, účel, tón, délku a někdy bezpečnostní režim. Změny se zobrazí i v jednoduchém režimu.");
  const actionFold=makeParamFold("Podrobnosti zvolené práce", [byId("my_fixGroup"), byId("my_styleGroup"), byId("my_ucelGroup"), grp("my_lang")], false);
  const resultFold=makeParamFold("Podoba výsledku", [byId("my_toneGroup"), byId("my_lenGroup"), byId("my_writingStyleGroup"), byId("my_subjGroup")], false);
  if(audienceFold) audienceFold.id="my_audienceFold";
  if(scenarioFold) scenarioFold.id="my_scenarioFold";
  if(actionFold) actionFold.id="my_actionFold";
  if(resultFold) resultFold.id="my_resultFold";
  const folds=[audienceFold,scenarioFold,actionFold,resultFold].filter(Boolean);
  folds.forEach(f=>card.insertBefore(f,before));
  if(tpl) card.insertBefore(tpl, folds[0] || before);
  card.dataset.compactParams="1";
  if(typeof initAccessibleTooltips==="function") initAccessibleTooltips(card);
  if(typeof updateMyMode==="function") updateMyMode();
}




function initAccessibleTooltips(root=document){
  root.querySelectorAll('.help-tip[data-tip]').forEach((btn,i)=>{
    if(btn.dataset.a11yTip)return; btn.dataset.a11yTip="1";
    const span=document.createElement("span"); span.className="sr-only"; span.id="helpTipText"+(i+1)+"_"+Math.random().toString(36).slice(2,7); span.textContent=btn.dataset.tip;
    btn.after(span); btn.setAttribute("aria-describedby",span.id);
  });
}
