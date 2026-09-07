/* ===================== KLÍČ + MODEL ===================== */
window.__setTestRunActive=v=>{ TEST_RUN_ACTIVE=TEST_HOOKS_BUILD_ENABLED&&isTrustedLocalTestOrigin()&&!!v; return TEST_RUN_ACTIVE; };
function testMockAvailable(){ return TEST_HOOKS_BUILD_ENABLED&&isTrustedLocalTestOrigin()&&(IS_TEST_MODE||TEST_RUN_ACTIVE)&&!!window.__TEST_MOCK_GEMINI; }
function currentAiMode(){return window.GHRABRuntime?GHRABRuntime.getMode():"direct-gemini";}
function isAiServiceReady(){return currentAiMode()==="school-gateway"||!!geminiApiKey||testMockAvailable();}
function applyAiRuntimeUi(){
  const school=currentAiMode()==="school-gateway",direct=$("directGeminiSettings"),schoolBox=$("schoolGatewayStatus"),title=$("apiTitle"),toggle=$("apiToggle"),profileHint=$("modelProfileHint");
  if(direct)direct.hidden=school;
  if(schoolBox)schoolBox.hidden=!school;
  if(title)title.textContent=school?"⚡ Generování přes školní AI službu":"⚡ Generování přes Gemini";
  if(toggle)toggle.textContent=school?"Připojení ke školní AI ▾":"Připojení k AI ▾";
  if(profileHint)profileHint.textContent=school?"Školní režim: aplikace předává pouze profil AI; konkrétní model vybírá školní AI služba.":"Serverless režim: aplikace předává pouze profil AI; runtime jej mapuje na odpovídající model Gemini.";
  updateKeyStatus();
}
window.addEventListener("ghrab:runtime-config-changed",applyAiRuntimeUi);

function cleanKey(s){ return String(s||"").replace(/[^\x21-\x7E]/g,""); }
function inputKey(){ return cleanKey($("keyInput").value); }
function setKey(key, scope){ geminiApiKey=cleanKey(key); geminiKeyScope=geminiApiKey?scope:""; $("keyInput").value=geminiApiKey; updateKeyStatus(); }
function loadKey(){ let s="",legacy=""; try{s=sessionStorage.getItem(KEY_SESSION_SK)||"";}catch(_){} try{legacy=localStorage.getItem(KEY_SK)||"";localStorage.removeItem(KEY_SK);}catch(_){} if(!s&&legacy){try{sessionStorage.setItem(KEY_SESSION_SK,legacy);s=legacy;}catch(_){}} setKey(s,s?"session":""); }
function useKeySession(){ const k=inputKey(); try{ if(k) sessionStorage.setItem(KEY_SESSION_SK,k); else sessionStorage.removeItem(KEY_SESSION_SK); }catch(_){} setKey(k,k?"session":""); }
function saveKeyPermanent(){
  const k=inputKey();
  if(!k){clearKey();toast("Nejdřív vlož API klíč.");return;}
  useKeySession();
  try{localStorage.removeItem(KEY_SK);}catch(_){}
  toast("Trvalé ukládání bylo v P1 odstraněno. Klíč platí jen do zavření prohlížeče.");
}
function clearKey(){ try{sessionStorage.removeItem(KEY_SESSION_SK);}catch(_){} try{localStorage.removeItem(KEY_SK);}catch(_){} setKey("",""); }
function updateKeyStatus(){
  const el=$("keyStatus"),badge=$("keyBadge"); if(!el)return;
  el.className="api-status";
  if(currentAiMode()==="school-gateway"){
    el.textContent="Školní režim aktivní";el.classList.add("ok");
    if(badge){badge.className="key-badge ok";badge.textContent="školní režim";}
    return;
  }
  let bCls="none",bTxt="klíč: nezadán";
  if(geminiApiKey){
    if(geminiKeyScope==="session"){el.textContent="✓ Klíč uložen pro relaci";el.classList.add("ok");bCls="ok";bTxt="klíč: relace";}
    else{el.textContent="✓ Klíč zadán (neuložen)";el.classList.add("ok");bCls="ok";bTxt="klíč: jen v paměti";}
  }else el.textContent="Klíč není nastaven";
  if(badge){badge.className="key-badge "+bCls;badge.textContent=bTxt;}
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

function normalizeModelProfile(n){ const v=String(n||"").trim().toLowerCase(); return MODEL_PROFILES.includes(v)?v:MODEL_PROFILE_DEFAULT; }
function migrateStoredModelProfile(n){
  const v=String(n||"").trim().toLowerCase();
  if(MODEL_PROFILES.includes(v)) return v;
  // Jednorázová kompatibilita se starými uloženými providerovými ID.
  if(/flash-lite/.test(v)) return "economy";
  if(v==="gemini-3.5-flash") return "quality";
  if(/^gemini-.*flash/.test(v)) return "balanced";
  return MODEL_PROFILE_DEFAULT;
}
function setModelProfile(n){
  selectedModelProfile=normalizeModelProfile(n);
  try{localStorage.setItem(MODEL_PROFILE_SK,selectedModelProfile);}catch(_){}
  updateModelUI();
}
function loadModelProfile(){
  let s=""; try{s=localStorage.getItem(MODEL_PROFILE_SK)||"";}catch(_){}
  selectedModelProfile=migrateStoredModelProfile(s);
  try{localStorage.setItem(MODEL_PROFILE_SK,selectedModelProfile);}catch(_){}
  updateModelUI();
}
function updateModelUI(){
  document.querySelectorAll("[data-model-profile]").forEach(btn=>{
    const active=btn.dataset.modelProfile===selectedModelProfile;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
  });
}
document.querySelectorAll("[data-model-profile]").forEach(btn=>{ btn.onclick=()=>setModelProfile(btn.dataset.modelProfile); });

const GEMINI_TIMEOUT_MS=45000;
const LAST_PROMPT_SK="rozbor_last_prompt_debug";
const NO_HISTORY_SK="rozbor_no_history";
const OPS_LOG_SK="rozbor_ops_log";
// Silné termíny blokují přímo; víceznačná slova jen v citlivém kontextu.
// Školní zkratky jsou úmyslně oddělené: jsou case-sensitive a musí tvořit celé slovo,
// aby např. „spustíme“ nebo „Spuštění“ neaktivovalo přísný režim přes podřetězec SPU.
const SENSITIVE_ABBREVIATIONS_RE=/(?<![\p{L}\p{M}])(?:PPP|SPU|IVP|SVP|OSPOD)(?![\p{L}\p{M}])/u;
const SENSITIVE_TERMS_SOURCE=String.raw`(?:diagn[oó]z|diagnostik|pedagogicko-psychologick|asistent pedagoga|podp[uů]rn\S*\s+opatřen|zdravotn[ií]\s+(?:stav|obtíž|omezen|dokument)|l[eé]ka[řr]sk\S*\s+zpr[aá]v|psycholog(?!i(?:e|i|í))|psycholožk|psychologick|psychiatr|rodinn[ée] pom[eě]r|soudn[ií]\s+(?:říz|rozhodnut|jedn[aá]n)|soci[aá]ln[ií]\s+situac|k[aá]ze[nň]sk|napomenut|d[uů]tk|vylou[čc]en\S*\s+ze\s+studia|podm[ií]ne[čc]n|[šs]ikan|sebepo[šs]koz|agresivn[ií]\s+chov|alkohol\S*\s+(?:u\s+ž[aá]k|požit|konzum)|drog(?!eri))`;
const SENSITIVE_TERMS_RE=new RegExp(String.raw`(?:^|[^\p{L}])`+SENSITIVE_TERMS_SOURCE,"iu");
const SENSITIVE_TERMS_INTL_RE=/(?:\bdiagnos(?:is|ed|tic\w*)\b|\bADHD\b|\bautis(?:m|tic)\b|\bdyslexi\w*\b|\bdisabilit\w*\b|\bdisabled\b|\bspecial needs\b|\bIEP\b|\bcounsel(?:ing|or|lor)\b|\bpsycholog(?:y|ist|ical|ically)\w*\b|\bpsychiatr\w*\b|\bmedication\b|\bmental health\b|\bdepress\w*\b|\banxiety\b|\bself-?harm\b|\bsuicid\w*\b|\bbully\w*\b|\bharass\w*\b|\babus(?:e|ive)\b|\bsuspen(?:sion|ded)\b|\bexpel\w*\b|\bexpulsion\b|\bdetention\b|\bdivorce\b|\bcustody\b|\bsocial services\b|diagn[oó]stic\w*|discapacidad|dislexi\w*|autismo|necesidades especiales|psic[oó]log\w*|psiquiatr\w*|medicaci[oó]n|salud mental|depresi[oó]n|ansiedad|autolesi[oó]n|suicid\w*|acoso|abuso|expulsi[oó]n|suspensi[oó]n|divorcio|custodia|servicios sociales)/i;
function hasContextualSensitiveTerms(text){
  const s=String(text||"");
  if(/(?:rozvod\S*\s+rodič|rozvád[ěe]j|po\s+rozvodu(?!\s+(?:vody|topení|tepla|plynu|elektřiny|elektroinstalace|vzduchotechniky|sítě|internetu))|rozvodov\S*\s+říz)/iu.test(s))return true;
  if(/soci[aá]ln[ií]\s+(?:situac|služb|odbor|pracovn)/iu.test(s) && /(?:žák|dítě|rodin|rodič|OSPOD|péč|ohrožen)/iu.test(s))return true;
  const sentences=s.split(/(?<=[.!?\n])\s*/u);
  return sentences.some(row=>{
    const dependency=[...row.matchAll(/z[aá]vislost\S*\s+na\s+(?:alkohol|drog|návykov|hazard|automat|telefonu|internetu|sociálních)/igu)].some(m=>{
      const prefix=row.slice(0,m.index||0);
      return !/(?:^|[^\p{L}\p{M}])v(?:e)?\s*$/iu.test(prefix);
    });
    if(dependency)return true;
    if(/psychologi(?:e|i|í)/iu.test(row) && /(?:žák|dítě|syn|dcer|vyšetřen|zpr[aá]v|doporučen|poradn|diagn|PPP|SPU|IVP)/iu.test(row))return true;
    return /(?:doporučen|zpr[aá]v|vyšetřen)\S*\s+z\s+poradn/iu.test(row) && /(?:žák|dítě|vzděláv|podp[uů]rn|diagn|PPP|SPU|IVP|psycholog)/iu.test(row);
  });
}
function hasSensitiveSchoolTerms(text){ const s=String(text||""); return SENSITIVE_ABBREVIATIONS_RE.test(s) || SENSITIVE_TERMS_RE.test(s) || SENSITIVE_TERMS_INTL_RE.test(s) || hasContextualSensitiveTerms(s); }
// Rozlišuj obecné preventivní/edukační TÉMA od citlivého ÚDAJE nebo konkrétní události.
// Broad detektor výše zůstává záměrně konzervativní (vypne historii/debug), ale sám o sobě
// už není důvodem k blokaci odeslání. Blokujeme až osobní, případový nebo incidentní kontext.
function hasBlockingSensitiveSchoolData(text){
  const s=String(text||"");
  if(!hasSensitiveSchoolTerms(s))return false;
  const rows=s.split(/(?<=[.!?\n])\s*/u).filter(Boolean);
  const sensitiveRow=row=>hasSensitiveSchoolTerms(row);
  const individualRe=/(?:žák(?:a|ovi|yně|yni|yní)?(?![\p{L}\p{M}])|student(?:a|ovi|ka|ky|ce)?(?![\p{L}\p{M}])|dít(?:ě|ěte)(?![\p{L}\p{M}])|syn(?:a|ovi)?(?![\p{L}\p{M}])|dcer(?:a|y|u|ou|e)(?![\p{L}\p{M}])|rodič(?:e|ů|i)?(?![\p{L}\p{M}]))[^.!?\n]{0,100}(?:\bmá\b|\bměl[ao]?\b|\bje\b|\bjsou\b|trp|užív|bere|diagn|vyšetř|sebepošk|suicid|šikan|SPU|IVP|PPP|OSPOD|podpůrn|důtk|napomen|vylouč|agresiv|závisl)/iu;
  const relationRe=/(?:\bu\s+(?:žáka|žákyně|studenta|studentky|dítěte|syna|dcery)|\bo\s+(?:žákovi|žákyni|studentovi|studentce|dítěti|synovi|dceři))[^.!?\n]{0,100}/iu;
  const eventRe=/(?:došlo\s+k|došlo\s+ke|objevil[ayo]?\s+se|objevily\s+se|řešíme|řeším|řešili|incident|konkrétní\s+případ|případ\s+žák|byl[ao]?\s+zjištěn|proběhl[ao]?\s+vyšetření|doporučil[ao]?\s+(?:podpůrn|vyšetř)|zpráva\s+z\s+(?:PPP|poradn|psycholog)|rodiče\s+jsou\s+po\s+rozvodu)/iu;
  if(rows.some(row=>sensitiveRow(row)&&(individualRe.test(row)||relationRe.test(row)||eventRe.test(row))))return true;
  // Zjevně obecný/kurikulární kontext: seznam témat, prevence, výuka, školení apod.
  const generalRe=/(?:preven|preventiv|výčet\s+témat|témat(?:a|em|ům|y)?|oblast(?:i|í)?|v\s+rámci\s+výuky|ve\s+výuce|výuk|učiv|tematick\w*\s+plán|seminář|workshop|školen|přednášk|metodik|osvět|program\s+prevence|materiál\s+k\s+preven|rizikov\w*\s+chován\w*\s+žák)/iu;
  if(generalRe.test(s))return false;
  // Bez jasného obecného rámce zachovej konzervativní historické chování.
  return true;
}

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
    const rec={d:Date.now(),type:String(type||"akce").slice(0,40),status:String(status||"ok").slice(0,30),modelProfile:selectedModelProfile||MODEL_PROFILE_DEFAULT,meta:cleanLogMeta(meta||{})};
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
    if(!obj.prirozenost || typeof obj.prirozenost!=="object" || Array.isArray(obj.prirozenost)) obj.prirozenost={stupen:"prirozeny",popis:""};
    if(!["prirozeny","mirne_sablonovity","sablonovity"].includes(obj.prirozenost.stupen)) obj.prirozenost.stupen="prirozeny";
    if(typeof obj.prirozenost.popis!=="string") obj.prirozenost.popis="";
    assertArrayField(obj,"rizika",false);
    assertArrayField(obj,"sablonoviteObraty",false);
  } else if(schema==="synonyms"){
    assertArrayField(obj,"synonyma",true);
  }
  return obj;
}
function saveLastPromptDebug(prompt, system, modelProfile, schema){
  if(isStrictScenarioActive() || hasSensitiveSchoolTerms(prompt) || hasSensitiveSchoolTerms(system)){ try{ sessionStorage.removeItem(LAST_PROMPT_SK); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){} return; }
  const rec={d:Date.now(),modelProfile:normalizeModelProfile(modelProfile||selectedModelProfile),schema:schema||"object",prompt:String(prompt||"").slice(0,30000),system:String(system||"").slice(0,12000)};
  try{ sessionStorage.setItem(LAST_PROMPT_SK, JSON.stringify(rec)); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){}
}
function loadLastPromptDebug(){ try{ return JSON.parse(sessionStorage.getItem(LAST_PROMPT_SK)||"null"); }catch(_){ return null; } }
function friendlyApiMessage(e){
  if(!e)return "Neznámá chyba.";
  const code=String(e.code||"");
  if(code==="BAD_JSON")return "AI služba nevrátila čitelnou odpověď. Vstup zůstal zachovaný, zkus to znovu.";
  if(code==="BAD_SCHEMA")return "Model vrátil neúplnou odpověď. Zkus to znovu.";
  if(code==="INCOMPLETE_RESPONSE")return "Model odpověď nedokončil. Zkrať text nebo akci spusť znovu.";
  if(code==="PREFLIGHT_BLOCKED"&&e.message)return e.message;
  return GHRAB_AI.formatUserError(e,"cs-CZ");
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
  const strictNames=[],strictTexts=Array.isArray(context.strictNameTexts)?context.strictNameTexts:context.texts;strictTexts.forEach(value=>strictPersonalNameCandidates(value,context.pane).forEach(name=>{if(!strictNames.includes(name))strictNames.push(name);}));
  const personalNames=[...new Set([...(iss.personalNames||[]),...strictNames])].map(x=>"pravděpodobné osobní jméno: "+x);
  if(danger.length||personalNames.length){
    const findings=danger.concat(personalNames);
    throw makeAppError("Odeslání zastaveno: bezpečnostní kontrola přesného promptu našla možný neanonymizovaný osobní nebo citlivý údaj. Uprav text nebo použij anonymizované značky.","PREFLIGHT_BLOCKED",findings);
  }
  return Object.freeze({text,clientAnonymized:true,preflightPassed:true});
}
const GEMINI_MAX_OUTPUT_TOKENS=32768;
function inferAiOperation(schema,system){
  if(schema==="analyze")return "incoming-analysis";
  if(schema==="reply")return "reply-draft";
  if(schema==="tone")return "tone-check";
  if(schema==="synonyms")return "synonym-suggestions";
  const text=String(system||"");
  if(/kontroluješ komunikační tón|rizika/i.test(text))return "tone-check";
  if(/uprav|přeformul|preformul/i.test(text))return "draft-refinement";
  return "outgoing-proofread";
}
async function callGemini(prompt,system,schema,safetyContext,opts){
  schema=schema||inferSchema(system);opts=opts||{};
  if(currentAiMode()==="direct-gemini"&&!geminiApiKey&&!testMockAvailable())throw GHRAB_AI.createError("API_KEY_MISSING");
  const pane=safetyContext&&safetyContext.pane;
  const exactPrompt=typeof toModelPersonTokens==="function"?toModelPersonTokens(pane,prompt):String(prompt||"");
  const safetyResult=assertGeminiSafety(safetyContext,exactPrompt);
  const operation=String(opts.operation||inferAiOperation(schema,system)),modelProfile=normalizeModelProfile(opts.modelProfile||selectedModelProfile);
  const thinking=opts.thinking||(schema==="synonyms"||schema==="tone"?"minimal":"medium");
  const diagnostic=modelProfile;
  saveLastPromptDebug(exactPrompt,system,diagnostic,schema);
  const response=await GHRAB_AI.generate({
    clientRequestId:opts.clientRequestId,workflowId:opts.workflowId,operation,modelProfile,
    instructions:String(system||""),inputParts:[{type:"text",text:exactPrompt}],
    outputSchemaId:KS_AI_SCHEMA_IDS[schema]||KS_AI_SCHEMA_IDS.object,
    options:{reasoningHint:thinking,maxOutputTokensHint:GEMINI_MAX_OUTPUT_TOKENS},
    privacy:{clientAnonymized:safetyResult.clientAnonymized,preflightPassed:safetyResult.preflightPassed},
    usageContext:{userActions:1,expectedOutputs:Number(opts.generatedOutputs)||(schema==="reply"?3:1)},
    localContext:{pane,startedAt:Date.now(),validateResult:(raw)=>{
      const object=typeof raw==="string"?parseModelJson(raw):raw;
      const parsed=validateModelJson(object,schema);
      return typeof secureModelResult==="function"?secureModelResult(parsed,schema,pane):parsed;
    }}
  });
  return response.result;
}
function bumpReq(){return GHRAB_AI.getLastUsage();}
