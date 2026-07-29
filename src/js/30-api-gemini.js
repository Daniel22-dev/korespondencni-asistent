/* ===================== KLÍČ + MODEL ===================== */
const KEY_SK="rozbor_gemini_key", KEY_SESSION_SK="rozbor_gemini_key_session", MODEL_SK="rozbor_gemini_model";
const MODEL_DEFAULT="gemini-3.6-flash", FALLBACK_MODELS=["gemini-3.5-flash-lite"];
let geminiApiKey="", geminiKeyScope="", geminiModel=MODEL_DEFAULT;
let TEST_RUN_ACTIVE=false;
window.__setTestRunActive=v=>{ TEST_RUN_ACTIVE=!!v; };
function testMockAvailable(){ return (IS_TEST_MODE||TEST_RUN_ACTIVE) && !!window.__TEST_MOCK_GEMINI; }

function cleanKey(s){ return String(s||"").replace(/[^\x21-\x7E]/g,""); }
function inputKey(){ return cleanKey($("keyInput").value); }
function setKey(key, scope){ geminiApiKey=cleanKey(key); geminiKeyScope=geminiApiKey?scope:""; $("keyInput").value=geminiApiKey; updateKeyStatus(); }
function loadKey(){ let s="",p=""; try{s=sessionStorage.getItem(KEY_SESSION_SK)||"";}catch(_){} try{p=localStorage.getItem(KEY_SK)||"";}catch(_){} setKey(s||p, s?"session":(p?"permanent":"")); }
function useKeySession(){ const k=inputKey(); try{ if(k) sessionStorage.setItem(KEY_SESSION_SK,k); else sessionStorage.removeItem(KEY_SESSION_SK); }catch(_){} setKey(k,k?"session":""); }
function saveKeyPermanent(){
  const k=inputKey();
  const persist=()=>{try{if(k)localStorage.setItem(KEY_SK,k);else localStorage.removeItem(KEY_SK);}catch(_){}setKey(k,k?"permanent":"");if(k)toast("Klíč byl uložen trvale na tomto zařízení.");};
  if(!k){persist();return;}
  const phrase="UKLÁDÁM NA OSOBNÍM ZAŘÍZENÍ";
  openModal("Trvalé uložení API klíče",'<p class="dialog-text">Klíč zůstane v tomto prohlížeči i po zavření, dokud ho ručně nesmažeš. Tuto volbu použij pouze na vlastním osobním zařízení.</p><label class="dialog-label" style="margin-top:14px">Pro potvrzení opiš přesně:</label><p style="font-weight:800;letter-spacing:.02em">'+phrase+'</p><input class="dialog-input" id="permanentPhrase" type="text" autocomplete="off" autofocus><div class="dialog-actions"><button type="button" class="btn ghost" id="permanentCancel">Zrušit</button><button type="button" class="btn" id="permanentConfirm">Uložit trvale</button></div>',{onMount(body,close){
    const input=body.querySelector("#permanentPhrase");
    const norm=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
    const submit=()=>{if(norm(input.value)!==norm(phrase)){toast("Věta nesouhlasí — klíč nebyl uložen trvale.");input.focus();return;}persist();close();};
    body.querySelector("#permanentCancel").onclick=close;body.querySelector("#permanentConfirm").onclick=submit;input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submit();}});
  }});
}
function clearKey(){ try{sessionStorage.removeItem(KEY_SESSION_SK);}catch(_){} try{localStorage.removeItem(KEY_SK);}catch(_){} setKey("",""); }
function updateKeyStatus(){
  const el=$("keyStatus"); el.className="api-status";
  const badge=$("keyBadge"); let bCls="none", bTxt="klíč: nezadán";
  if(geminiApiKey){ if(geminiKeyScope==="permanent"){el.textContent="✓ Klíč uložen trvale";el.classList.add("perm"); bCls="perm"; bTxt="klíč: trvale";} else if(geminiKeyScope==="session"){el.textContent="✓ Klíč uložen pro relaci";el.classList.add("ok"); bCls="ok"; bTxt="klíč: relace";} else {el.textContent="✓ Klíč zadán (neuložen)";el.classList.add("ok"); bCls="ok"; bTxt="klíč: jen v paměti";} }
  else el.textContent="Klíč není nastaven";
  if(badge){ badge.className="key-badge "+bCls; badge.textContent=bTxt; }
}
$("btnSession").onclick=()=>{ useKeySession(); flash($("btnSession"),"Uloženo pro relaci ✓"); };
$("btnPermanent").onclick=()=>{ saveKeyPermanent(); };
$("btnClear").onclick=()=>{ clearKey(); $("keyInput").value=""; };
$("apiToggle").onclick=()=>{ const open=$("apiPanel").classList.toggle("open"); $("apiToggle").setAttribute("aria-expanded",open?"true":"false"); };
// psaní klíče ho rovnou aktivuje pro tuto relaci (v paměti), i bez kliknutí na tlačítko
$("keyInput").addEventListener("input",()=>{
  geminiApiKey=inputKey();
  if(geminiApiKey){ if(!geminiKeyScope) geminiKeyScope="memory"; }
  else geminiKeyScope="";
  updateKeyStatus();
});
function flash(btn,msg){ const o=btn.textContent; btn.textContent=msg; btn.disabled=true; setTimeout(()=>{ btn.textContent=o; btn.disabled=false; },1300); }
function isBusy(btn){ return !!btn && btn.dataset && btn.dataset.busy==="1"; }
function setBusy(btn, label){
  if(!btn) return ()=>{};
  if(btn.dataset.busy==="1") return ()=>{};
  btn.dataset.busy="1"; btn.dataset.prevHtml=btn.innerHTML; btn.disabled=true; btn.classList.add("is-busy"); btn.setAttribute("aria-busy","true");
  btn.innerHTML='<span class="btn-spin" aria-hidden="true"></span>'+esc(label||"Pracuji…");
  return ()=>{ btn.classList.remove("is-busy"); btn.disabled=false; btn.removeAttribute("aria-busy"); if(btn.dataset.prevHtml!=null) btn.innerHTML=btn.dataset.prevHtml; delete btn.dataset.busy; delete btn.dataset.prevHtml; };
}

function migrateStoredModel(n){const v=String(n||"").trim().toLowerCase();if(v==="gemini-2.5-flash"||v==="gemini-3.5-flash")return MODEL_DEFAULT;if(v==="gemini-2.5-flash-lite"||v==="gemini-3.1-flash-lite")return FALLBACK_MODELS[0];return v;}
function isValidModel(n){ return /^gemini[-a-z0-9.]+$/i.test(String(n||"").trim()); }
function setModel(n){ const v=String(n||"").trim().toLowerCase(); geminiModel=isValidModel(v)?v:MODEL_DEFAULT; $("modelInput").value=geminiModel; try{localStorage.setItem(MODEL_SK,geminiModel);}catch(_){} updateModelUI(); }
function loadModel(){ let s=""; try{s=localStorage.getItem(MODEL_SK)||"";}catch(_){} s=migrateStoredModel(s); geminiModel=isValidModel(s)?s:MODEL_DEFAULT; $("modelInput").value=geminiModel; updateModelUI(); }
function updateModelUI(){
  $("qmStrong").classList.toggle("active",geminiModel===MODEL_DEFAULT); $("qmLite").classList.toggle("active",geminiModel===FALLBACK_MODELS[0]);
  const ph=$("modelInput"); if(ph) ph.placeholder=MODEL_DEFAULT;
  const s=$("qmStrong")&&$("qmStrong").querySelector(".sub"); if(s) s.textContent=MODEL_DEFAULT;
  const l=$("qmLite")&&$("qmLite").querySelector(".sub"); if(l) l.textContent=FALLBACK_MODELS[0];
}
$("modelInput").addEventListener("change",(e)=>setModel(e.target.value));
$("qmStrong").onclick=()=>setModel(MODEL_DEFAULT); $("qmLite").onclick=()=>setModel(FALLBACK_MODELS[0]);

const GEMINI_TIMEOUT_MS=45000;
const LAST_PROMPT_SK="rozbor_last_prompt_debug";
const NO_HISTORY_SK="rozbor_no_history";
const OPS_LOG_SK="rozbor_ops_log";
// Obecná slova (opatření, poradna, soud, sociální, incident, alkohol) blokují jen v citlivém kontextu.
const SENSITIVE_TERMS_SOURCE="(?:diagn[oó]z|diagnostik|PPP|SPU|IVP|SVP|OSPOD|pedagogicko-psychologick|(?:doporučen|zpr[aá]v|vyšetřen)\\S*\\s+(?:(?:z|v)\\s+)?poradn|asistent pedagoga|podp[uů]rn\\S*\\s+opatřen|zdravotn[ií]\\s+(?:stav|obtíž|omezen|dokument)|l[eé]ka[řr]sk\\S*\\s+zpr[aá]v|psycholo|psychiatr|rodinn[ée] pom[eě]r|rozvod|soudn[ií]\\s+(?:říz|rozhodnut|jedn[aá]n)|soci[aá]ln[ií]\\s+(?:situac|služb|odbor|pracovn)|k[aá]ze[nň]sk|napomenut|d[uů]tk|vylou[čc]en\\S*\\s+ze\\s+studia|podm[ií]ne[čc]n|[šs]ikan|sebepo[šs]koz|agresivn[ií]\\s+chov|z[aá]vislost|alkohol\\S*\\s+(?:u\\s+ž[aá]k|požit|konzum)|drog)";
const SENSITIVE_TERMS_RE=new RegExp("(?:^|[^\\p{L}])"+SENSITIVE_TERMS_SOURCE,"iu");
// EN/ES citlivé termíny — vždy zapnuto (chrání i když je vstup cizojazyčný a výstup český).
const SENSITIVE_TERMS_INTL_RE=/(?:\bdiagnos(?:is|ed|tic\w*)\b|\bADHD\b|\bautis(?:m|tic)\b|\bdyslexi\w*\b|\bdisabilit\w*\b|\bdisabled\b|\bspecial needs\b|\bIEP\b|\bcounsel(?:ing|or|lor)\b|\bpsycholog\w*\b|\bpsychiatr\w*\b|\btherap(?:y|ist)\b|\bmedication\b|\bmental health\b|\bdepress\w*\b|\banxiety\b|\bself-?harm\b|\bsuicid\w*\b|\bbully\w*\b|\bharass\w*\b|\babus(?:e|ive)\b|\bsuspen(?:sion|ded)\b|\bexpel\w*\b|\bexpulsion\b|\bdetention\b|\bdivorce\b|\bcustody\b|\bsocial services\b|\billness\b|\bdisease\b|\bdisorder\b|diagn[oó]stic\w*|discapacidad|dislexi\w*|autismo|necesidades especiales|psic[oó]log\w*|psiquiatr\w*|terapia|medicaci[oó]n|salud mental|depresi[oó]n|ansiedad|autolesi[oó]n|suicid\w*|acoso|abuso|expulsi[oó]n|suspensi[oó]n|divorcio|custodia|servicios sociales|enfermedad)/i;
function hasSensitiveSchoolTerms(text){ const s=String(text||""); return SENSITIVE_TERMS_RE.test(s) || SENSITIVE_TERMS_INTL_RE.test(s); }
function cleanLogMeta(meta){
  const deny=/prompt|text|body|content|system|raw|clean|email|mail/i;
  const out={};
  Object.keys(meta||{}).slice(0,12).forEach(k=>{
    if(deny.test(k)) return;
    const v=meta[k];
    if(v===undefined || typeof v==="function") return;
    if(Array.isArray(v)) out[k]=v.map(x=>String(x).slice(0,80)).slice(0,8);
    else if(v && typeof v==="object") out[k]=String(JSON.stringify(v)).slice(0,160);
    else out[k]=String(v).slice(0,160);
  });
  return out;
}
function loadOpsLog(){ try{ const a=JSON.parse(localStorage.getItem(OPS_LOG_SK)||"[]"); return Array.isArray(a)?a:[]; }catch(_){ return []; } }
function saveOpsLog(items){ try{ localStorage.setItem(OPS_LOG_SK, JSON.stringify((items||[]).slice(0,80))); }catch(_){} }
function logOp(type,status,meta){
  try{
    const rec={d:Date.now(),type:String(type||"akce").slice(0,40),status:String(status||"ok").slice(0,30),model:geminiModel||"",meta:cleanLogMeta(meta||{})};
    const a=loadOpsLog(); a.unshift(rec); saveOpsLog(a);
  }catch(_){}
}
function clearOpsLog(){ try{ localStorage.removeItem(OPS_LOG_SK); }catch(_){} }
function makeAppError(message, code, detail){ const e=new Error(message); e.code=code||"APP"; if(detail!==undefined) e.detail=detail; return e; }
function inferSchema(system){
  const s=String(system||"");
  if(/"navrhy"/.test(s)) return "reply";
  if(/"pozadavky"/.test(s) && /"shrnuti"/.test(s)) return "analyze";
  if(/"rizika"/.test(s) && /"naladeni"/.test(s)) return "tone";
  if(/"synonyma"\s*:\s*\[/.test(s)) return "synonyms";
  if(/"text"/.test(s)) return "text";
  return "object";
}
function extractJsonCandidate(raw){
  let text=String(raw||"").replace(/```json|```/gi,"").trim();
  if(!text) throw makeAppError("Model vrátil prázdnou odpověď.","EMPTY_RESPONSE");
  try{ JSON.parse(text); return text; }catch(_){}
  const start=[...text].findIndex(ch=>ch==="{"||ch==="[");
  if(start<0) throw makeAppError("Model nevrátil platný JSON ani rozpoznatelný JSON blok.","BAD_JSON",text.slice(0,500));
  const open=text[start], close=open==="{"?"}":"]";
  let depth=0, inStr=false, escNext=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(inStr){ if(escNext) escNext=false; else if(ch==="\\") escNext=true; else if(ch==='"') inStr=false; continue; }
    if(ch==='"'){ inStr=true; continue; }
    if(ch===open) depth++;
    else if(ch===close){ depth--; if(depth===0) return text.slice(start,i+1); }
  }
  throw makeAppError("Model vrátil neuzavřený JSON blok.","BAD_JSON",text.slice(0,500));
}
function parseModelJson(raw){
  const candidate=extractJsonCandidate(raw);
  try{ return JSON.parse(candidate); }
  catch(e){ throw makeAppError("Model vrátil poškozený JSON. Zkus akci spustit znovu.","BAD_JSON",candidate.slice(0,500)); }
}
function assertArrayField(obj, key, required){
  if(required && !Array.isArray(obj[key])) throw makeAppError("Odpověď modelu nemá očekávané pole „"+key+"“.","BAD_SCHEMA");
  if(obj[key]!==undefined && !Array.isArray(obj[key])) obj[key]=[];
}
function validateModelJson(obj, schema){
  if(!obj || typeof obj!=="object" || Array.isArray(obj)) throw makeAppError("Odpověď modelu není objekt JSON.","BAD_SCHEMA");
  schema=schema||"object";
  if(schema==="analyze"){
    if(typeof obj.shrnuti!=="string") throw makeAppError("Rozbor nemá pole „shrnuti“.","BAD_SCHEMA");
    if(!obj.naladeni || typeof obj.naladeni!=="object") obj.naladeni={stupen:"neutral",popis:""};
    ["pozadavky","upozorneni","terminy","dohodnuto","nezodpovezene"].forEach((key)=>assertArrayField(obj,key,key==="pozadavky"));
    if(typeof obj.odesilatelRole!=="string") obj.odesilatelRole="";
    if(typeof obj.priorita!=="string" || !/^(dnes|tyden|fyi|delegovat)$/.test(obj.priorita)) obj.priorita="tyden";
    if(typeof obj.nalehavost!=="string") obj.nalehavost="běžná";
    obj.konflikt=!!obj.konflikt;
    if(typeof obj.dalsiKrok!=="string") obj.dalsiKrok="";
    if(!obj.vlakno || typeof obj.vlakno!=="object" || Array.isArray(obj.vlakno)) obj.vlakno={jeVlakno:false,pocetZprav:1,vyvoj:[]};
    obj.vlakno.jeVlakno=!!obj.vlakno.jeVlakno;
    if(!Array.isArray(obj.vlakno.vyvoj)) obj.vlakno.vyvoj=[];
  } else if(schema==="reply"){
    assertArrayField(obj,"navrhy",true);
    obj.navrhy.forEach((n,i)=>{ if(!n || typeof n!=="object" || typeof n.text!=="string") throw makeAppError("Návrh "+(i+1)+" nemá text.","BAD_SCHEMA"); });
    const wanted=["strucna","standardni","diplomaticka"];
    obj.navrhy=obj.navrhy.slice(0,3).map((n,i)=>{ n.typ=wanted.includes(n.typ)?n.typ:wanted[i]||"standardni"; if(!n.styl) n.styl=({strucna:"Stručná",standardni:"Standardní",diplomaticka:"Diplomatická"}[n.typ]); return n; });
    if(!obj.synonyma || typeof obj.synonyma!=="object" || Array.isArray(obj.synonyma)) obj.synonyma={};
  } else if(schema==="text"){
    if(typeof obj.text!=="string") throw makeAppError("Odpověď modelu nemá pole „text“.","BAD_SCHEMA");
    if(!obj.synonyma || typeof obj.synonyma!=="object" || Array.isArray(obj.synonyma)) obj.synonyma={};
  } else if(schema==="tone"){
    if(!obj.naladeni || typeof obj.naladeni!=="object") obj.naladeni={stupen:"neutral",popis:""};
    assertArrayField(obj,"rizika",false);
  } else if(schema==="synonyms"){
    assertArrayField(obj,"synonyma",true);
  }
  return obj;
}
function saveLastPromptDebug(prompt, system, model, schema){
  if(isStrictScenarioActive() || hasSensitiveSchoolTerms(prompt) || hasSensitiveSchoolTerms(system)){ try{ sessionStorage.removeItem(LAST_PROMPT_SK); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){} return; }
  const rec={d:Date.now(),model:model||geminiModel,schema:schema||"object",prompt:String(prompt||"").slice(0,30000),system:String(system||"").slice(0,12000)};
  try{ sessionStorage.setItem(LAST_PROMPT_SK, JSON.stringify(rec)); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){}
}
function loadLastPromptDebug(){ try{ return JSON.parse(sessionStorage.getItem(LAST_PROMPT_SK)||"null"); }catch(_){ return null; } }
function friendlyApiMessage(e){
  if(!e) return "Neznámá chyba.";
  if(e.code==="MISSING_KEY") return "Chybí API klíč. Vlož ho nahoře v panelu Klíč k API a použij ho pro relaci.";
  if(e.name==="AbortError" || e.code==="TIMEOUT") return "Model neodpověděl včas. Vstup zůstal zachovaný, zkus akci spustit znovu.";
  if(e.code==="BAD_JSON") return "Model nevrátil čitelný JSON. Vstup zůstal zachovaný, zkus to znovu.";
  if(e.code==="BAD_SCHEMA") return "Model vrátil neúplnou odpověď. Zkus to znovu; pokud se to opakuje, přepni model.";
  if(e.code==="INCOMPLETE_RESPONSE") return "Model odpověď nedokončil. Zkrať text nebo akci spusť znovu.";
  if(e.code==="SAFETY_STOP") return "Gemini požadavek nebo odpověď zastavilo bezpečnostním filtrem. Uprav vstup a zkus to znovu.";
  if(e.code==="PREFLIGHT_REQUIRED") return "Bezpečnostní kontrola této akce nebyla správně zapojena. Akce byla preventivně zastavena.";
  if(e.code==="PREFLIGHT_BLOCKED") return e.message;
  if(e.code==="OUTPUT_PRIVACY_BLOCKED") return "Odpověď modelu obsahovala skutečný údaj, který se nepodařilo bezpečně skrýt. Výstup nebyl zobrazen; spusť akci znovu nebo zkontroluj klíč náhrad.";
  if(e.quota) return "Kvóta nebo limit API je vyčerpaný. Zkus lehčí model, počkej, nebo použij jiný klíč.";
  if(e.status===401 || e.status===403) return "API klíč není platný nebo nemá oprávnění. Zkontroluj klíč v horním panelu.";
  if(e.status===400) return "Gemini odmítlo požadavek. Zkontroluj délku textu a anonymizaci.";
  if(e.status>=500) return "Služba Gemini má dočasný problém. Vstup zůstal zachovaný, zkus to znovu.";
  return e.message || "Nepovedlo se spojit s modelem.";
}
function setApiError(container, err, retryFn){
  if(!container) return;
  const id="retry_"+Math.random().toString(36).slice(2);
  const devId="dev_"+Math.random().toString(36).slice(2);
  const devMode=typeof DEV_MODE!=="undefined"&&DEV_MODE;
  container.innerHTML='<div class="error"><b>Nepovedlo se:</b> '+esc(friendlyApiMessage(err))+'<div class="retry-row"><button class="btn small" id="'+id+'">Zkusit znovu</button>'+(devMode?'<button class="btn ghost small" id="'+devId+'">Vývojářské nástroje</button>':'')+'</div></div>';
  const b=$(id); if(b && retryFn) b.onclick=()=>retryFn();
  const dev=$(devId); if(dev) dev.onclick=openDeveloperTools;
}
function assertGeminiSafety(context, exactPrompt){
  if(!context || !Array.isArray(context.texts)) throw makeAppError("Chybí povinný anonymizační preflight této akce.","PREFLIGHT_REQUIRED");
  const text=[String(exactPrompt||""),...context.texts.map(x=>String(x||""))].filter(Boolean).join("\n");
  const iss=preflightIssues(text,context.pane);
  const danger=context.ackSensitive ? iss.danger.filter(x=>!/citlivé/.test(x)) : iss.danger;
  if(danger.length){
    const findings=danger;
    throw makeAppError("Odeslání zastaveno: bezpečnostní kontrola přesného promptu našla možný osobní nebo citlivý údaj („"+findings.join(", ")+"“). Uprav text nebo použij anonymizované značky.","PREFLIGHT_BLOCKED",findings);
  }
  return text;
}
const GEMINI_MAX_OUTPUT_TOKENS=32768;
async function callGemini(prompt, system, schema, safetyContext, opts){
  schema=schema||inferSchema(system); opts=opts||{};
  if(!geminiApiKey && !testMockAvailable()) throw makeAppError("Chybí klíč k API. Vlož ho v „Klíč k API“ nahoře a zvol „Použít jen pro relaci“.","MISSING_KEY");
  const pane=safetyContext&&safetyContext.pane;
  const exactPrompt=typeof toModelPersonTokens==="function"?toModelPersonTokens(pane,prompt):String(prompt||"");
  assertGeminiSafety(safetyContext,exactPrompt);
  const thinking=opts.thinking||(schema==="synonyms"||schema==="tone"?"minimal":"medium");
  if(testMockAvailable()){
    const mocked=await window.__TEST_MOCK_GEMINI({prompt:exactPrompt,system,schema,thinking});
    const obj=typeof mocked==="string"?parseModelJson(mocked):mocked;
    const parsed=validateModelJson(obj,schema);
    return typeof secureModelResult==="function"?secureModelResult(parsed,schema,pane):parsed;
  }
  const requestModel=async(model,withThinking)=>{
    const started=Date.now();
    try{ logOp("api",withThinking?"start":"thinking_retry",{model,schema}); }catch(_){}
    saveLastPromptDebug(exactPrompt, system, model, schema);
    const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent";
    const generationConfig={maxOutputTokens:GEMINI_MAX_OUTPUT_TOKENS,responseMimeType:"application/json"};
    if(withThinking&&thinking) generationConfig.thinkingConfig={thinkingLevel:thinking};
    const body={contents:[{role:"user",parts:[{text:exactPrompt}]}],systemInstruction:{parts:[{text:system}]},generationConfig};
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(), GEMINI_TIMEOUT_MS);
    let res,data;
    try{
      res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":cleanKey(geminiApiKey)},body:JSON.stringify(body),signal:ctrl.signal});
      data=await res.json().catch(()=>({}));
    }catch(e){
      if(e&&e.name==="AbortError"){ try{logOp("api","timeout",{model,schema,ms:Date.now()-started});}catch(_){} throw makeAppError("Model neodpověděl včas.","TIMEOUT"); }
      try{logOp("api","network_error",{model,schema,ms:Date.now()-started});}catch(_){}
      throw makeAppError("Nepodařilo se připojit k Gemini API: "+(e&&e.message?e.message:"síťová chyba"),"NETWORK");
    }finally{ clearTimeout(timer); }
    if(!res.ok){
      const st=(data&&data.error&&data.error.status)?String(data.error.status):"";
      const quota=res.status===429||/RESOURCE_EXHAUSTED/i.test(st);
      const msg=(data&&data.error&&data.error.message)?data.error.message:("HTTP "+res.status);
      try{logOp("api",quota?"quota":"http_error",{model,schema,status:res.status,ms:Date.now()-started});}catch(_){}
      const e=new Error(msg); e.quota=quota; e.status=res.status; e.thinkingRejected=withThinking&&res.status===400&&/thinking/i.test(msg); throw e;
    }
    const cand=data.candidates&&data.candidates[0];
    const finish=cand&&cand.finishReason;
    const block=data.promptFeedback&&data.promptFeedback.blockReason;
    if(block) throw makeAppError("Požadavek byl zablokován: "+block,"SAFETY_STOP");
    const text=((cand&&cand.content&&cand.content.parts)||[]).map(p=>p.text||"").join("").trim();
    if(finish&&finish!=="STOP") throw makeAppError("Model nedokončil odpověď ("+finish+").",finish==="MAX_TOKENS"?"INCOMPLETE_RESPONSE":"SAFETY_STOP");
    try{const parsed=validateModelJson(parseModelJson(text),schema),secured=typeof secureModelResult==="function"?secureModelResult(parsed,schema,pane):parsed;logOp("api","success",{model,schema,ms:Date.now()-started});return secured;}
    catch(e){try{logOp("api",e&&e.code?e.code:"parse_error",{model,schema,ms:Date.now()-started});}catch(_){}throw e;}
  };
  const tryModel=async(model)=>{ try{return await requestModel(model,true);}catch(e){if(e&&e.thinkingRejected)return await requestModel(model,false);throw e;} };
  bumpReq();
  try{return await tryModel(geminiModel);}
  catch(e){
    const fallbackAllowed=e&&(e.quota||e.status===404||e.status===429||e.status===500||e.status===503);
    if(fallbackAllowed){const fb=FALLBACK_MODELS.find(m=>m!==geminiModel);if(fb){bumpReq();return await tryModel(fb);}}
    throw e;
  }
}
function bumpReq(){ /* požadavky se značí u akcí (1 ⚡); sdílený klíč nelze měřit z jedné aplikace */ }

