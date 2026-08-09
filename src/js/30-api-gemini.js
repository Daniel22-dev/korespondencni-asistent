const MODEL_DEFAULT="gemini-3.6-flash", FALLBACK_MODELS=["gemini-3.5-flash-lite"];
const THINKING_DEFAULT='medium',THINKING_CHEAP='minimal';
let geminiApiKey="", geminiKeyScope="", geminiModel=MODEL_DEFAULT;

function cleanKey(s){return String(s||"").replace(/[^\x21-\x7E]/g,"")}
function inputKey(){return cleanKey($("keyInput").value)}
function setKey(key,scope){geminiApiKey=cleanKey(key);geminiKeyScope=geminiApiKey?scope:"";$("keyInput").value=geminiApiKey;updateKeyStatus()}
function loadKey(){let sessionKey="",legacyKey="";try{sessionKey=sessionStorage.getItem(KEY_SESSION_SK)||""}catch(_){}try{legacyKey=localStorage.getItem(KEY_SK)||"";localStorage.removeItem(KEY_SK)}catch(_){}if(!sessionKey&&legacyKey){try{sessionStorage.setItem(KEY_SESSION_SK,legacyKey);sessionKey=legacyKey}catch(_){}}setKey(sessionKey,sessionKey?"session":"")}
function useKeySession(){const k=inputKey();let stored=true;try{if(k)sessionStorage.setItem(KEY_SESSION_SK,k);else sessionStorage.removeItem(KEY_SESSION_SK)}catch(_){stored=false}setKey(k,k?(stored?"session":"memory"):"");return stored}
function showMessage(title,message){
  const t=$("messageTitle"), m=$("messageText");
  if(t)t.textContent=title||"Upozornění";
  if(m)m.textContent=String(message||"");
  $("messageOverlay").classList.add("show");
}
function saveKeyPermanent(){
  const k=inputKey();
  if(!k){
    clearKey();
    showMessage("Klíč není uložen", "Nejdřív vlož API klíč. Pro běžné použití doporučuji tlačítko „Použít jen pro relaci“.");
    return;
  }
  useKeySession();
  showMessage("Bezpečné uložení pro relaci", "Trvalé ukládání provider klíče bylo v P1 odstraněno. Klíč je uložen pouze do zavření prohlížeče.");
}
function clearKey(){try{sessionStorage.removeItem(KEY_SESSION_SK)}catch(_){}try{localStorage.removeItem(KEY_SK)}catch(_){}setKey("","")}
function updateKeyStatus(){
  const el=$("keyStatus");el.className="api-status";
  if(geminiApiKey){
    if(geminiKeyScope==="session"){el.textContent="✓ Klíč uložen pro relaci";el.classList.add("ok");setStatus("statusKey","relace","ok")}
    else{el.textContent="✓ Klíč zadán (neuložen)";el.classList.add("ok")}
  } else {
    el.textContent="Klíč není nastaven";
    setStatus("statusKey","chybí klíč","warn");
  }
  if(geminiApiKey&&geminiKeyScope==="memory")setStatus("statusKey","zadán, neuložen","warn");
}
$("btnSession").onclick=()=>{const stored=useKeySession();if(stored)flashBtn($("btnSession"),"Uloženo pro relaci ✓");else showMessage("Úložiště relace není dostupné","Klíč lze použít na právě otevřené stránce, ale prohlížeč ho nedokázal uložit do relace. Po obnovení stránky ho bude nutné vložit znovu.")};
$("btnPermanent").onclick=()=>saveKeyPermanent();
$("btnClear").onclick=()=>{clearKey();$("keyInput").value=""};
$("messageClose").onclick=()=>$("messageOverlay").classList.remove("show");
$("messageOverlay").addEventListener("click",e=>{if(e.target.id==="messageOverlay")$("messageOverlay").classList.remove("show")});
function updateApiToggleText(){
  const btn=$("apiToggle"), panel=$("apiPanel");
  if(btn&&panel)btn.textContent=panel.classList.contains("open")?"Skrýt nastavení API ▴":"Nastavit / změnit API klíč ▾";
}
$("apiToggle").onclick=()=>{$("apiPanel").classList.toggle("open");updateApiToggleText()};
updateApiToggleText();
$("keyInput").addEventListener("input",()=>{
  geminiApiKey=inputKey();
  if(geminiApiKey){if(!geminiKeyScope)geminiKeyScope="memory"}else geminiKeyScope="";
  updateKeyStatus();
});
function flashBtn(btn,msg){const o=btn.textContent;btn.textContent=msg;btn.disabled=true;setTimeout(()=>{btn.textContent=o;btn.disabled=false},1300)}
function hasApiKey(){return !!window.GHRAB_PLATFORM?.isSchoolProfile?.()||!!cleanKey(geminiApiKey)}
function requireApiKeyForAction(actionLabel){
  if(hasApiKey())return true;
  const label=actionLabel||'tuto akci';
  const msg='Bez API klíče nejde spustit '+label+'. Vlož klíč v kroku 1 pod tlačítkem „Nastavit / změnit API klíč“ a zvol „Použít jen pro relaci“. Výstup se bez klíče nezačne vytvářet.';
  const api=$('#apiPanel'), apiStep=$('#apiStepPanel');
  if(api)api.classList.add('open');
  updateApiToggleText();
  setStatus('statusKey','chybí klíč','warn');
  showMessage('Chybí API klíč',msg);
  setTimeout(()=>{try{(apiStep||api||document.body).scrollIntoView({behavior:'smooth',block:'start'});const input=$('#keyInput');if(input)input.focus()}catch(_){}},80);
  return false;
}

function migrateStoredModel(n){const v=String(n||"").trim().toLowerCase();
  if(v==="gemini-2.5-flash"||v==="gemini-3.5-flash")return MODEL_DEFAULT;
  if(v==="gemini-2.5-flash-lite"||v==="gemini-3.1-flash-lite")return FALLBACK_MODELS[0];
  return v;}
function isValidModel(n){return /^gemini[-a-z0-9.]+$/i.test(String(n||"").trim())}
function setModel(n){const v=String(n||"").trim().toLowerCase();geminiModel=isValidModel(v)?v:MODEL_DEFAULT;try{localStorage.setItem(MODEL_SK,geminiModel)}catch(_){}updateModelUI()}
function loadModel(){let s="";try{s=localStorage.getItem(MODEL_SK)||""}catch(_){}s=migrateStoredModel(s); geminiModel=isValidModel(s)?s:MODEL_DEFAULT;updateModelUI()}
function updateModelUI(){
  $("qmStrong").classList.toggle("active",geminiModel===MODEL_DEFAULT);$("qmLite").classList.toggle("active",geminiModel===FALLBACK_MODELS[0]);
  const s=$("qmStrong").querySelector(".sub");if(s)s.textContent=MODEL_DEFAULT;
  const l=$("qmLite").querySelector(".sub");if(l)l.textContent=FALLBACK_MODELS[0];
  setStatus("statusModel",geminiModel===MODEL_DEFAULT?"Flash":(geminiModel===FALLBACK_MODELS[0]?"Flash-Lite":geminiModel),"ok");
}
$("qmStrong").onclick=()=>setModel(MODEL_DEFAULT);
$("qmLite").onclick=()=>setModel(FALLBACK_MODELS[0]);
loadKey();loadModel();

const GEMINI_TIMEOUT_MS=60000;
// Přímé volání generateContent posílá média jako inline_data. Oficiální dokumentace uvádí limit celého inline požadavku pod 20 MB,
// proto držíme bezpečnou rezervu 18 MB včetně promptu, textu a base64 dat.
const MAX_INLINE_REQUEST_BYTES=18*1024*1024;
const MAX_TEXT_CHARS=180000;
const MAX_SINGLE_MEDIA_ORIGINAL_BYTES=12*1024*1024;
const MAX_PDF_BYTES=13*1024*1024;
const MAX_IMAGE_SOURCE_BYTES=40*1024*1024;
const MAX_IMAGE_SOURCE_TOTAL_BYTES=80*1024*1024;
const MAX_IMAGE_COUNT=8;
const MAX_OFFICE_SOURCE_BYTES=25*1024*1024;
const MAX_ZIP_ENTRIES=2500;
const MAX_ZIP_ENTRY_BYTES=20*1024*1024;
const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES=80*1024*1024;
const IMAGE_TOTAL_TARGET_BYTES=12*1024*1024;
function humanBytes(n){if(n<1024)return n+' B';if(n<1024*1024)return Math.round(n/1024)+' kB';return (n/1024/1024).toFixed(1).replace('.0','')+' MB'}
function utf8Bytes(s){try{return new TextEncoder().encode(String(s||'')).length}catch(_){return String(s||'').length}}
function assertTextLength(text,label){if(String(text||'').length>MAX_TEXT_CHARS)throw makeAppError((label||'Text')+' je příliš dlouhý ('+String(text||'').length+' znaků). Limit je '+MAX_TEXT_CHARS+' znaků. Rozděl zadání na části, aby model stihl bezpečně vytvořit všechny verze.','TEXT_TOO_LONG')}
function officeExtractNote(kind,text){
  const count=String(text||'').trim().split(/\s+/).filter(Boolean).length;
  return kind+' byl načten lokálně jako textová vrstva ('+count+' slov). Před generováním zkontroluj přepis: složité tabulky, textová pole, vzorce, obrázky a pořadí prvků se mohou v Office souborech převést jen částečně.';
}
function assertInlineRequestSize(body){const bytes=utf8Bytes(JSON.stringify(body));if(bytes>MAX_INLINE_REQUEST_BYTES)throw makeAppError('Vstup je po převodu pro API příliš velký ('+humanBytes(bytes)+'). Bezpečný limit této přímé verze je '+humanBytes(MAX_INLINE_REQUEST_BYTES)+'. Uber počet obrázků, zmenši PDF, nebo vlož jen text.','REQUEST_TOO_LARGE')}
function makeAppError(message,code){const e=new Error(message);e.code=code||"APP";return e}
function friendlyApiMessage(e){
  if(!e)return "Neznámá chyba.";
  if(e.code==="MISSING_KEY")return "Chybí API klíč. Vlož ho v kroku 1 pod tlačítkem „Nastavit / změnit API klíč“ a zvol „Použít jen pro relaci“.";
  if(e.name==="AbortError"||e.code==="TIMEOUT")return "Model neodpověděl včas. Zkus akci spustit znovu.";
  if(e.code==="TEXT_TOO_LONG"||e.code==="FILE_TOO_LARGE"||e.code==="REQUEST_TOO_LARGE"||e.code==="TOO_MANY_IMAGES")return e.message;
  if(e.code==="INCOMPLETE_RESPONSE")return "Model odpověď nedokončil, takže ji appka raději nepoužila. Zkrať zadání, vyber méně verzí nebo to spusť znovu.";
  if(e.code==="SAFETY_STOP")return "Model odpověď zastavil bezpečnostním filtrem. Uprav zadání nebo zkus vložit jen čistý text úloh.";
  if(e.quota)return "Kvóta nebo limit API je vyčerpaný. Zkus to později nebo přepni model.";
  if(e.status===401||e.status===403)return "API klíč není platný nebo nemá oprávnění. Zkontroluj klíč v panelu nahoře.";
  if(e.status===404)return "Zvolený model není dostupný. Přepni model v panelu nastavení nebo to zkus později.";
  if(e.status===400)return "Gemini odmítlo požadavek. Zkontroluj délku nebo obsah vstupu.";
  if(e.status>=500)return "Služba Gemini má dočasný problém. Zkus to znovu.";
  return e.message||"Nepovedlo se spojit s modelem.";
}
/* callGemini je záměrně přiřaditelná proměnná (ne deklarace funkce), aby ji interní testovací režim mohl dočasně nahradit mockem a poté čistě vrátit zpět. */
let callGemini = async function callGeminiImpl(parts,opts={}){
  if(!geminiApiKey)throw makeAppError("Chybí klíč k API. Vlož ho v kroku 1 pod tlačítkem „Nastavit / změnit API klíč“ a zvol „Použít jen pro relaci“.","MISSING_KEY");
  const models=[geminiModel,...FALLBACK_MODELS.filter(m=>m!==geminiModel)];
  const shouldFallback=e=>!!(e&&(e.quota||e.status===429||e.status===503||e.status===500||e.status===404));
  const tryModel=async(model,withThinking=true)=>{
    const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent";
    const generationConfig={maxOutputTokens:60000};
    if(withThinking)generationConfig.thinkingConfig={thinkingLevel:(opts&&opts.thinking)||THINKING_DEFAULT};
    if(opts&&opts.json)generationConfig.responseMimeType='application/json';
    if(opts&&opts.schema)generationConfig.responseSchema=opts.schema;
    const body={contents:[{role:"user",parts}],generationConfig};
    assertInlineRequestSize(body);
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),GEMINI_TIMEOUT_MS);
    let res,data;
    try{
      res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":cleanKey(geminiApiKey)},body:JSON.stringify(body),signal:ctrl.signal});
      data=await res.json().catch(()=>({}));
    }catch(e){
      if(e&&e.name==="AbortError")throw makeAppError("Model neodpověděl včas.","TIMEOUT");
      throw makeAppError("Nepodařilo se připojit k Gemini API: "+(e&&e.message?e.message:"síťová chyba"),"NETWORK");
    }finally{clearTimeout(timer)}
    if(!res.ok){
      const st=(data&&data.error&&data.error.status)?String(data.error.status):"";
      const quota=res.status===429||/RESOURCE_EXHAUSTED/i.test(st);
      const msg=(data&&data.error&&data.error.message)?data.error.message:("HTTP "+res.status);
      const e=new Error(msg);e.quota=quota;e.status=res.status;e.model=model;
      if(withThinking&&res.status===400&&/thinking/i.test(msg))return tryModel(model,false);
      throw e;
    }
    const cand=data.candidates&&data.candidates[0];
    const finish=cand&&cand.finishReason;
    const block=data.promptFeedback&&data.promptFeedback.blockReason;
    if(block){const e=makeAppError("Požadavek byl zablokován: "+block,"SAFETY_STOP");e.model=model;throw e;}
    const text=((cand&&cand.content&&cand.content.parts)||[]).map(p=>p.text||"").join("").trim();
    if(finish&&finish!=="STOP"){
      const code=finish==="MAX_TOKENS"?"INCOMPLETE_RESPONSE":"SAFETY_STOP";
      const e=makeAppError("Model nedokončil odpověď ("+finish+").",code);e.model=model;throw e;
    }
    if(!text)throw makeAppError("Model vrátil prázdnou odpověď.","EMPTY_RESPONSE");
    return text;
  };
  let lastErr=null;
  for(let i=0;i<models.length;i++){
    try{return await tryModel(models[i])}
    catch(e){lastErr=e;if(i<models.length-1&&shouldFallback(e))continue;throw e}
  }
  throw lastErr||makeAppError("Nepodařilo se získat odpověď modelu.","EMPTY_RESPONSE");
};

function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function openGuide(auto=false){
  $('#guide').classList.add('show');
  if(auto)lsSet('dpl_guide_seen','1');
}
function closeGuide(){
  $('#guide').classList.remove('show');
  lsSet('dpl_guide_seen','1');
}
function bindGuideButton(id){const btn=$(id);if(btn)btn.addEventListener('click',()=>openGuide(false));}
bindGuideButton('#helpBtn');
bindGuideButton('#helpTopBtn');
$('#guideClose').addEventListener('click',closeGuide);
$('#guide').addEventListener('click',e=>{if(e.target.id==='guide')closeGuide()});

renderChangelog();
$('#changelogBtn').addEventListener('click',()=>$('#changelogOverlay').classList.add('show'));
$('#changelogClose').addEventListener('click',()=>$('#changelogOverlay').classList.remove('show'));
$('#changelogOverlay').addEventListener('click',e=>{if(e.target.id==='changelogOverlay')$('#changelogOverlay').classList.remove('show')});


const FullscreenControl={
  isActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement)},
  update(){
    const btn=$('#fullscreenToggle'); if(!btn)return;
    const active=this.isActive();
    btn.classList.toggle('active',active);
    btn.textContent=active?'⤢':'⛶';
    btn.setAttribute('aria-label',active?'Ukončit režim celé obrazovky':'Zapnout režim celé obrazovky');
    btn.title=active?'Ukončit celou obrazovku':'Celá obrazovka';
  },
  async toggle(){
    const root=document.documentElement;
    try{
      if(!this.isActive()){
        const fn=root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen;
        if(!fn){showMessage('Celá obrazovka není dostupná','Tento prohlížeč nebo způsob otevření aplikace fullscreen režim nepodporuje.');return}
        await fn.call(root);
      }else{
        const fn=document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen;
        if(fn)await fn.call(document);
      }
    }catch(err){showMessage('Celá obrazovka se nepodařila spustit',friendlyApiMessage(err))}
    this.update();
  },
  init(){
    const btn=$('#fullscreenToggle');
    if(btn)btn.addEventListener('click',()=>this.toggle());
    document.addEventListener('fullscreenchange',()=>this.update());
    document.addEventListener('webkitfullscreenchange',()=>this.update());
    this.update();
  }
};
FullscreenControl.init();

const THEME_SK='dpl_theme';
function applyTheme(mode){
  const dark=mode==='dark';
  document.body.classList.toggle('dark',dark);
  const btn=$('#themeToggle'); if(btn){btn.textContent=dark?'☀️':'🌙';btn.setAttribute('aria-label',dark?'Přepnout na světlý režim':'Přepnout na tmavý režim')}
  const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.setAttribute('content',dark?'#161A20':'#3F9270');
}
function loadTheme(){let m='light';try{m=localStorage.getItem(THEME_SK)||'light'}catch(_){}applyTheme(m)}
$('#themeToggle').addEventListener('click',()=>{
  const next=document.body.classList.contains('dark')?'light':'dark';
  applyTheme(next); try{localStorage.setItem(THEME_SK,next)}catch(_){}
});
loadTheme();

if(!IS_TEST_MODE&&!lsGet('dpl_guide_seen'))openGuide(true);
$('#copyClose').addEventListener('click',()=>$('#copyOverlay').classList.remove('show'));
$('#copyOverlay').addEventListener('click',e=>{if(e.target.id==='copyOverlay')$('#copyOverlay').classList.remove('show')});
$('#pasteText').addEventListener('input',()=>{if($('#pasteText').value.trim())setStatus('statusInput','vložený text','ok');else if(!uploaded)setStatus('statusInput','čeká na zadání','warn')});
$('#cefr').addEventListener('change',async()=>{
  const c=$('#cefr');
  if(c.checked && !subjectAllowsCefr()){
    c.checked=false;saveCefrPreference(false);applyCefrLevels(null);
    setCefrNote('CEFR nelze použít: předmět nevypadá jako jazykový. Pokud jde opravdu o jazykový materiál s neobvyklou zkratkou, zapni ruční vynucení CEFR.','warn');
    showMessage('Předmět nebyl rozpoznán jako jazykový','Zapni volbu „Vynutit CEFR i u nerozpoznaného jazykového předmětu“ hned pod tímto přepínačem a CEFR zaškrtni znovu — pak se úrovně A1–C2 odvodí normálně. U nejazykových předmětů nech CEFR vypnutý; aplikace pracuje jen s úrovněmi obtížnosti.');
    return;
  }
  saveCefrPreference(c.checked);
  if(c.checked)await detectCefrForBase($('#baseText').value.trim());
  else {applyCefrLevels(null);setCefrNote('CEFR je vypnutý. U nejazykových předmětů aplikace používá jen úrovně obtížnosti.')}
  updateCefrRunButton();
});
const cefrForceEl=$('#cefrForce');
if(cefrForceEl)cefrForceEl.addEventListener('change',async()=>{
  syncCefrHintFromSubject();
  const c=$('#cefr');
  if(c&&c.checked&&subjectAllowsCefr())await detectCefrForBase($('#baseText').value.trim());
});
$('#subject').addEventListener('change',syncCefrHintFromSubject);
const cefrRunBtn=$('#cefrRunBtn');if(cefrRunBtn)cefrRunBtn.addEventListener('click',()=>detectCefrForBase($('#baseText').value.trim()));
restoreCefrPreference();updateCefrRunButton();

function setTipOpen(t,open){t.classList.toggle('open',!!open);t.setAttribute('aria-expanded',open?'true':'false')}
function toggleTip(t){document.querySelectorAll('.tip.open').forEach(o=>{if(o!==t)setTipOpen(o,false)});setTipOpen(t,!t.classList.contains('open'))}
document.querySelectorAll('.tip').forEach(t=>{
  t.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggleTip(t)});
  t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggleTip(t)}else if(e.key==='Escape')setTipOpen(t,false)});
});
document.addEventListener('click',()=>document.querySelectorAll('.tip.open').forEach(o=>setTipOpen(o,false)));

function fileToDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Soubor se nepodařilo načíst.'));r.readAsDataURL(file)})}
function dataUrlToBase64(dataUrl){return String(dataUrl||'').split(',')[1]||''}
function fileToBase64(file){return fileToDataUrl(file).then(dataUrlToBase64)}
function fileToArrayBuffer(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Soubor se nepodařilo načíst.'));r.readAsArrayBuffer(file)})}
function fileToText(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Soubor se nepodařilo načíst.'));r.readAsText(file,'utf-8')})}
function loadImg(src){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('Obrázek se nepodařilo načíst.'));img.src=src})}
function canvasToBlob(canvas,type,quality){return new Promise(res=>canvas.toBlob(res,type,quality))}
async function blobToBase64(blob){return dataUrlToBase64(await fileToDataUrl(blob))}
async function resizeImage(file,forceCompress=false,totalCount=1){
  if(file.size>MAX_IMAGE_SOURCE_BYTES)throw makeAppError('Obrázek '+file.name+' je příliš velký ('+humanBytes(file.size)+'). Maximum pro zpracování v prohlížeči je '+humanBytes(MAX_IMAGE_SOURCE_BYTES)+'.','FILE_TOO_LARGE');
  const originalType=(file.type&&/^image\//.test(file.type))?file.type:'image/jpeg';
  const keepOriginal=!forceCompress&&totalCount===1&&file.size<=MAX_SINGLE_MEDIA_ORIGINAL_BYTES;
  const originalDataUrl=await fileToDataUrl(file);
  if(keepOriginal){return {mime_type:originalType,data:dataUrlToBase64(originalDataUrl),name:file.name,bytes:file.size,originalBytes:file.size,compressed:false}}
  const img=await loadImg(originalDataUrl);
  let maxDim=totalCount>1?1900:2300;
  const perImageTarget=Math.max(900*1024,Math.floor(IMAGE_TOTAL_TARGET_BYTES/Math.max(1,totalCount)));
  let quality=0.88, blob=null, canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  for(let attempt=0;attempt<8;attempt++){
    const scale=Math.min(1,maxDim/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
    canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    blob=await canvasToBlob(canvas,'image/jpeg',quality);
    if(!blob)throw new Error('Obrázek se nepodařilo zmenšit.');
    if(blob.size<=perImageTarget||maxDim<=1200)break;
    if(quality>0.72)quality-=0.08;else maxDim=Math.round(maxDim*0.82);
  }
  return {mime_type:'image/jpeg',data:await blobToBase64(blob),name:file.name,bytes:blob.size,originalBytes:file.size,compressed:true,width:canvas.width,height:canvas.height};
}
function mediaParts(items){return items.map(it=>({inline_data:{mime_type:it.mime_type,data:it.data}}))}
function mediaBytes(items){return items.reduce((sum,it)=>sum+utf8Bytes(it.data||''),0)}
function setUploadInfo(msg){const el=$('#uploadInfo');if(msg){el.textContent=msg;el.classList.add('show');setStatus('statusInput','soubor připraven','ok')}else{el.textContent='';el.classList.remove('show');if(!$('#pasteText')||!$('#pasteText').value.trim())setStatus('statusInput','čeká na zadání','warn')}}
function htmlToPlainText(html){const doc=new DOMParser().parseFromString(String(html||''),'text/html');doc.querySelectorAll('script,style,noscript').forEach(el=>el.remove());return (doc.body?doc.body.innerText:doc.documentElement.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}

async function readZipEntries(file,kind){
  if(file.size>MAX_OFFICE_SOURCE_BYTES)throw makeAppError(kind+' soubor je příliš velký ('+humanBytes(file.size)+'). Bezpečný limit je '+humanBytes(MAX_OFFICE_SOURCE_BYTES)+'.','FILE_TOO_LARGE');
  const buf=await fileToArrayBuffer(file), dv=new DataView(buf), bytes=new Uint8Array(buf);
  if(bytes.length<22)throw new Error('Soubor není platný '+kind+'.');
  let eocd=-1;
  const min=Math.max(0,bytes.length-22-65535);
  for(let i=bytes.length-22;i>=min;i--){if(i+22<=bytes.length&&dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('Soubor není platný '+kind+' (chybí ZIP konec).');
  const cdOffset=dv.getUint32(eocd+16,true), cdCount=dv.getUint16(eocd+10,true);
  if(cdCount>MAX_ZIP_ENTRIES)throw makeAppError(kind+' obsahuje příliš mnoho položek.','FILE_TOO_LARGE');
  if(cdOffset>=bytes.length)throw new Error('Soubor '+kind+' má poškozený centrální adresář.');
  let p=cdOffset,totalUncompressed=0;const entries=[];
  for(let i=0;i<cdCount;i++){
    if(p+46>bytes.length||dv.getUint32(p,true)!==0x02014b50)throw new Error('Soubor '+kind+' má neúplný centrální adresář.');
    const method=dv.getUint16(p+10,true),compSize=dv.getUint32(p+20,true),uncompSize=dv.getUint32(p+24,true),nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),lho=dv.getUint32(p+42,true);
    const next=p+46+nameLen+extraLen+commentLen;
    if(next>bytes.length||lho+30>bytes.length)throw new Error('Soubor '+kind+' obsahuje poškozenou položku.');
    if(uncompSize>MAX_ZIP_ENTRY_BYTES)throw makeAppError('Jedna část '+kind+' je po rozbalení příliš velká.','FILE_TOO_LARGE');
    totalUncompressed+=uncompSize;
    if(totalUncompressed>MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES)throw makeAppError(kind+' je po rozbalení příliš velký.','FILE_TOO_LARGE');
    const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+nameLen));
    entries.push({name,method,compSize,uncompSize,lho});p=next;
  }
  async function extract(entry){
    const lp=entry.lho;
    if(dv.getUint32(lp,true)!==0x04034b50)throw new Error('Soubor '+kind+' obsahuje poškozenou lokální položku.');
    const lNameLen=dv.getUint16(lp+26,true),lExtraLen=dv.getUint16(lp+28,true),dataStart=lp+30+lNameLen+lExtraLen,dataEnd=dataStart+entry.compSize;
    if(dataStart<0||dataEnd>bytes.length)throw new Error('Soubor '+kind+' obsahuje neúplná data.');
    const raw=bytes.subarray(dataStart,dataEnd);let out;
    if(entry.method===0)out=raw;
    else if(entry.method===8){
      if(typeof DecompressionStream==='undefined')throw new Error('Prohlížeč neumí rozbalit '+kind+' (chybí DecompressionStream). Zkus vložit text ručně.');
      const ds=new DecompressionStream('deflate-raw');out=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer());
    }else throw new Error('Nepodporovaná komprese v '+kind+'.');
    if(out.length>MAX_ZIP_ENTRY_BYTES||entry.uncompSize&&out.length!==entry.uncompSize)throw new Error('Rozbalená položka '+kind+' má neočekávanou velikost.');
    return out;
  }
  return {entries,extract};
}
function xmlUnescape(t){return String(t||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")}
function officeXmlText(xml){return [...String(xml||'').matchAll(/<(?:w:t|a:t)\b[^>]*>([\s\S]*?)<\/(?:w:t|a:t)>|<(?:w:tab|a:tab)\b[^>]*\/?>(?:<\/(?:w:tab|a:tab)>)?|<(?:w:br|w:cr|a:br)\b[^>]*\/?>(?:<\/(?:w:br|w:cr|a:br)>)?/g)].map(m=>m[1]!=null?xmlUnescape(m[1]):'\n').join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function officeBlockText(xml,blockRe){
  const blocks=[...String(xml||'').matchAll(blockRe)].map(m=>officeXmlText(m[0])).map(t=>t.trim()).filter(Boolean);
  return blocks.length?blocks.join('\n'):officeXmlText(xml);
}
async function readDocx(file){
  const zip=await readZipEntries(file,'.docx');
  const wanted=zip.entries.filter(e=>/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(e.name));
  wanted.sort((a,b)=>{const rank=n=>/document\.xml$/i.test(n)?0:/header/i.test(n)?1:/footer/i.test(n)?2:/footnotes/i.test(n)?3:4;return rank(a.name)-rank(b.name)||a.name.localeCompare(b.name)});
  if(!wanted.length)throw new Error('V .docx se nenašel čitelný obsah dokumentu.');
  const chunks=[];
  for(const entry of wanted){const xml=new TextDecoder('utf-8').decode(await zip.extract(entry));const text=officeBlockText(xml,/<w:p\b[\s\S]*?<\/w:p>/g);if(text.trim())chunks.push(text.trim())}
  return chunks.join('\n\n').trim();
}
async function readPptx(file){
  const zip=await readZipEntries(file,'.pptx');
  const slides=zip.entries.filter(e=>/^ppt\/slides\/slide\d+\.xml$/i.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!slides.length)throw new Error('V .pptx se nenašly čitelné snímky.');
  const chunks=[];
  for(let i=0;i<slides.length;i++){const xml=new TextDecoder('utf-8').decode(await zip.extract(slides[i]));const text=officeBlockText(xml,/<a:p\b[\s\S]*?<\/a:p>/g);if(text.trim())chunks.push('Snímek '+(i+1)+':\n'+text.trim())}
  return chunks.join('\n\n').trim();
}
async function readXlsx(file){
  const zip=await readZipEntries(file,'.xlsx');
  let shared=[];
  const xlsxXmlText=xml=>[...String(xml||'').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>xmlUnescape(m[1])).join('');
  const ss=zip.entries.find(e=>/^xl\/sharedStrings\.xml$/i.test(e.name));
  if(ss){const xml=new TextDecoder('utf-8').decode(await zip.extract(ss));shared=[...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>xlsxXmlText(m[1]))}
  const sheets=zip.entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!sheets.length)throw new Error('V .xlsx se nenašly čitelné listy.');
  const colIndex=ref=>{let n=0;for(const ch of String(ref||'').replace(/\d/g,'')){n=n*26+(ch.charCodeAt(0)-64)}return Math.max(0,n-1)};
  function cellText(cell){
    const type=(cell.match(/\bt="([^"]+)"/)||[])[1]||'',formula=(cell.match(/<f[^>]*>([\s\S]*?)<\/f>/)||[])[1];
    if(type==='inlineStr')return xlsxXmlText(cell);
    const v=(cell.match(/<v>([\s\S]*?)<\/v>/)||[])[1];
    let value=v==null?'':(type==='s'?(shared[Number(v)]||''):xmlUnescape(v));
    if(formula)value='='+xmlUnescape(formula)+(value?' → '+value:'');
    return value;
  }
  const out=[];
  for(let i=0;i<sheets.length;i++){
    const xml=new TextDecoder('utf-8').decode(await zip.extract(sheets[i]));
    const rows=[...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(r=>{
      const cells=[];
      for(const c of r[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)){
        const ref=(c[0].match(/\br="([A-Z]+\d+)"/)||[])[1];
        const idx=ref?colIndex(ref):cells.length;
        while(cells.length<idx)cells.push('');
        cells[idx]=cellText(c[0]);
      }
      return cells.join('\t').replace(/\t+$/,'');
    });
    const body=rows.filter(r=>r.trim()).join('\n');
    if(body.trim())out.push('List '+(i+1)+':\n'+body);
  }
  const text=out.join('\n\n').trim();
  if(!text)throw new Error('V .xlsx se nenašel čitelný obsah.');
  return text;
}
function readRtf(text){
  const cpMatch=String(text||'').match(/\\ansicpg(\d+)/i);
  const enc=cpMatch&&cpMatch[1]==='65001'?'utf-8':(cpMatch?'windows-'+cpMatch[1]:'windows-1250');
  const decodeByte=hex=>{const b=parseInt(hex,16);try{return new TextDecoder(enc).decode(new Uint8Array([b]))}catch(_){return String.fromCharCode(b)}};
  let t=String(text||'');
  t=t.replace(/\\u(-?\d+)\??/g,(_,n)=>String.fromCharCode((Number(n)+65536)%65536));
  t=t.replace(/\\'([0-9a-fA-F]{2})/g,(_,h)=>decodeByte(h));
  t=t.replace(/\\par[d]?/g,'\n').replace(/\\tab/g,'\t');
  t=t.replace(/\{\\\*?\\[^{}]*\}/g,'');
  t=t.replace(/\\[a-zA-Z]+-?\d*\s?/g,'');
  t=t.replace(/[{}]/g,'');
  return t.split('\n').map(l=>l.trim()).filter(Boolean).join('\n');
}

let uploaded=null;
const drop=$('#drop'),fileInput=$('#file');
drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}});
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files&&e.dataTransfer.files.length)handleFiles(e.dataTransfer.files)});
fileInput.addEventListener('change',e=>{if(e.target.files&&e.target.files.length)handleFiles(e.target.files)});

async function handleFiles(fileList){
  const previous={uploaded,filename:$('#filename').textContent,info:$('#uploadInfo').textContent,chip:$('#filechip').classList.contains('show'),thumb:$('#thumb').classList.contains('show'),thumbSrc:$('#thumbImg').src};
  clearErr($('#inputErr'));setUploadInfo('');$('#thumb').classList.remove('show');
  const files=[...fileList];
  if(!files.length)return;
  try{
    if(files.length>1){
      if(files.length>MAX_IMAGE_COUNT)throw makeAppError('Najednou lze nahrát maximálně '+MAX_IMAGE_COUNT+' obrázků. U větší sady je rozděl na více částí.','TOO_MANY_IMAGES');
      if(!files.every(f=>(f.type||'').startsWith('image/')))throw makeAppError('Více souborů najednou je podporováno jen pro obrázky/fotky. PDF, Word, PowerPoint nebo Excel nahraj po jednom.','TOO_MANY_IMAGES');
      const totalSource=files.reduce((sum,f)=>sum+f.size,0);
      if(totalSource>MAX_IMAGE_SOURCE_TOTAL_BYTES)throw makeAppError('Vybrané obrázky mají dohromady '+humanBytes(totalSource)+'. Maximum pro bezpečné zpracování v prohlížeči je '+humanBytes(MAX_IMAGE_SOURCE_TOTAL_BYTES)+'.','FILE_TOO_LARGE');
      const items=[];
      for(const f of files)items.push(await resizeImage(f,true,files.length));
      if(mediaBytes(items)>MAX_INLINE_REQUEST_BYTES)throw makeAppError('Obrázky jsou i po zmenšení pro přímé API volání příliš velké ('+humanBytes(mediaBytes(items))+'). Uber počet fotek nebo je rozděl na části.','REQUEST_TOO_LARGE');
      uploaded={kind:'media',items};
      $('#thumbImg').src='data:'+items[0].mime_type+';base64,'+items[0].data;$('#thumb').classList.add('show');
      $('#filename').textContent='🖼️ '+files.length+' obrázků';
      const saved=files.reduce((sum,f)=>sum+f.size,0)-items.reduce((sum,it)=>sum+it.bytes,0);
      setUploadInfo('Obrázky byly automaticky zmenšeny pro bezpečné odeslání do API. Úspora přibližně '+humanBytes(Math.max(0,saved))+'.');
    } else {
      await handleSingleFile(files[0]);
    }
    $('#filechip').classList.add('show');
    $('#pasteText').value='';
  }catch(err){
    uploaded=previous.uploaded;if(typeof fileInput!=='undefined'&&fileInput)fileInput.value='';$('#filename').textContent=previous.filename;$('#filechip').classList.toggle('show',previous.chip);$('#thumb').classList.toggle('show',previous.thumb);if(previous.thumbSrc)$('#thumbImg').src=previous.thumbSrc;if(previous.info)setUploadInfo(previous.info);else if(previous.uploaded)setUploadInfo('Původní soubor zůstal vybraný.');
    errBox($('#inputErr'),friendlyApiMessage(err)||err.message)
  }
}
async function handleSingleFile(file){
  const name=(file.name||'').toLowerCase();
  const isPdf=file.type==='application/pdf'||name.endsWith('.pdf');
  const isImg=(file.type||'').startsWith('image/');
  const isDocx=name.endsWith('.docx')||file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPptx=name.endsWith('.pptx')||file.type==='application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const isXlsx=name.endsWith('.xlsx')||file.type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const isOldOffice=/\.(doc|ppt|xls)$/.test(name)&&!isDocx&&!isPptx&&!isXlsx;
  const isTxt=name.endsWith('.txt')||name.endsWith('.md')||name.endsWith('.csv')||name.endsWith('.tsv')||name.endsWith('.json')||file.type==='text/plain'||/^text\/(csv|markdown)/.test(file.type||'');
  const isHtml=name.endsWith('.html')||name.endsWith('.htm')||file.type==='text/html';
  const isRtf=name.endsWith('.rtf');
  if(isImg){
    const item=await resizeImage(file,false,1);
    uploaded={kind:'media',items:[item]};
    $('#thumbImg').src='data:'+item.mime_type+';base64,'+item.data;$('#thumb').classList.add('show');
    $('#filename').textContent='🖼️ '+file.name;
    setUploadInfo(item.compressed?'Obrázek byl automaticky zmenšen z '+humanBytes(item.originalBytes)+' na '+humanBytes(item.bytes)+' kvůli bezpečnému API limitu.':'Obrázek se odešle v původní kvalitě.');
  } else if(isPdf){
    if(file.size>MAX_PDF_BYTES)throw makeAppError('PDF je příliš velké pro přímé odeslání ('+humanBytes(file.size)+'). Bezpečný limit pro PDF je '+humanBytes(MAX_PDF_BYTES)+'. Zkus PDF zmenšit, rozdělit nebo vložit text.','FILE_TOO_LARGE');
    const data=await fileToBase64(file);
    uploaded={kind:'media',items:[{mime_type:'application/pdf',data,name:file.name,bytes:file.size,originalBytes:file.size,compressed:false}]};
    $('#filename').textContent='📑 '+file.name;
    setUploadInfo('PDF se odešle přímo. Bezpečný limit je nastaven s rezervou pod inline limitem API.');
  } else if(isDocx){
    const text=await readDocx(file);assertTextLength(text,'Text z .docx');uploaded={kind:'text',text};$('#filename').textContent='📝 '+file.name;setUploadInfo(officeExtractNote('DOCX',text));
  } else if(isPptx){
    const text=await readPptx(file);assertTextLength(text,'Text z .pptx');uploaded={kind:'text',text};$('#filename').textContent='🖼️ '+file.name;setUploadInfo(officeExtractNote('PPTX',text));
  } else if(isXlsx){
    const text=await readXlsx(file);assertTextLength(text,'Text z .xlsx');uploaded={kind:'text',text};$('#filename').textContent='📊 '+file.name;setUploadInfo(officeExtractNote('XLSX',text));
  } else if(isTxt){
    const text=await fileToText(file);assertTextLength(text,'Text ze souboru');uploaded={kind:'text',text};$('#filename').textContent='📝 '+file.name;setUploadInfo('Textový soubor byl načten lokálně. Před pokračováním zkontroluj jeho obsah.');
  } else if(isHtml){
    const text=htmlToPlainText(await fileToText(file));assertTextLength(text,'Text z HTML');uploaded={kind:'text',text};$('#filename').textContent='🌐 '+file.name;setUploadInfo('HTML byl převeden lokálně na čistý text. Zkontroluj tabulky a pořadí prvků.');
  } else if(isRtf){
    const text=readRtf(await fileToText(file));assertTextLength(text,'Text z .rtf');uploaded={kind:'text',text};$('#filename').textContent='📝 '+file.name;setUploadInfo('RTF byl převeden lokálně na čistý text. Zkontroluj formátování a speciální znaky.');
  } else if(isOldOffice){
    throw makeAppError('Starý binární formát '+name.split('.').pop().toUpperCase()+' appka přímo nepřečte. Otevři ho v Office/Google aplikaci a ulož jako .docx/.pptx/.xlsx, nebo vlož text ručně.','FILE_TOO_LARGE');
  } else {
    throw makeAppError('Nepodporovaný formát. Appka umí: fotky/obrázky, PDF, .docx, .pptx, .xlsx, .txt, .rtf, .md, .csv, .tsv, .html a .json.','FILE_TOO_LARGE');
  }
}
$('#filex').addEventListener('click',()=>{uploaded=null;fileInput.value='';$('#filechip').classList.remove('show');$('#thumb').classList.remove('show');setUploadInfo('');setStatus('statusInput',$('#pasteText').value.trim()?'vložený text':'čeká na zadání',$('#pasteText').value.trim()?'ok':'warn')});

$('#extractBtn').addEventListener('click',async()=>{
  clearErr($('#inputErr'));
  const pasted=$('#pasteText').value.trim();
  try{assertTextLength(pasted,'Vložené zadání')}catch(err){errBox($('#inputErr'),friendlyApiMessage(err));return}
  if(!uploaded&&!pasted){errBox($('#inputErr'),'Nahraj soubor nebo vlož text zadání.');return}
  if(uploaded&&pasted){errBox($('#inputErr'),'Je vybraný soubor i vložený text. Jeden vstup odeber, aby bylo jasné, ze kterého zadání se má vycházet.');return}
  if(!uploaded&&pasted){
    $('#baseText').value=pasted;
    if($('#cefr')&&$('#cefr').checked&&subjectAllowsCefr()){
      applyCefrLevels(null);
      setCefrNote('Ručně vložený čistý text byl načten bez AI přepisu. CEFR odhad se kvůli úspoře dotazu nespouští automaticky; použij tlačítko „Odhadnout CEFR úroveň“.','warn');updateCefrRunButton();
    } else {
      if($('#cefr')&&$('#cefr').checked&&!subjectAllowsCefr()){$('#cefr').checked=false;saveCefrPreference(false);applyCefrLevels(null)}
      syncCefrHintFromSubject();
    }
    setStatus('statusFlow','zadání načteno lokálně','ok');
    hide($('#inputPanel'));show($('#configPanel'));
    $('#configPanel').scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if(!requireApiKeyForAction('načtení souboru')){errBox($('#inputErr'),'Bez API klíče se soubor nezačne zpracovávat. Vlož klíč v kroku 1 pod tlačítkem „Nastavit / změnit API klíč“ a zvol „Použít jen pro relaci“.');return}
  const btn=$('#extractBtn'),extractLabel=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="mini"></span> Načítám zadání…';setStatus('statusFlow','načítám zadání','busy');
  const prompt="Toto je zadání školního testu, pracovního listu nebo učebního materiálu libovolného předmětu. Přepiš jeho obsah do čistého, čitelného textu. Zachovej přesně původní jazyk nebo kombinaci jazyků u každé části; nic nepřekládej jen proto, že aplikace má české UI. Zachovej odbornou terminologii, matematický/chemický/fyzikální zápis, jednotky, značky, symboly, tabulkové údaje a číslování. U českých pasáží oprav jen zjevné OCR překlepy, ale výsledná čeština musí být gramaticky, stylisticky i lexikálně bezchybná. Na první řádek dej téma/nadpis, pak očíslované úlohy s plným zněním. Obsah zachovej věrně, nic nepřidávej a nevymýšlej nové úlohy. Pokud jde o více fotek, zpracuj je v pořadí nahrání jako pokračování jednoho materiálu. Odpověz POUZE přepsaným zadáním, bez úvodu a komentáře.";
  let parts;
  try{
    if(uploaded&&uploaded.kind==='media'){
      parts=[{text:'Zpracuj následující mediální vstup nebo vstupy v pořadí nahrání.'},...mediaParts(uploaded.items),{text:prompt}];
    } else if(uploaded&&uploaded.kind==='text'){
      parts=[{text:prompt+"\n\nZADÁNÍ:\n"+uploaded.text}];
    } else {
      parts=[{text:prompt+"\n\nZADÁNÍ:\n"+pasted}];
    }
    const out=await callGemini(parts,{operation:'material-extraction'});
    const extracted=String(out||pasted||(uploaded&&uploaded.text)||'').trim();
    if(!extracted)throw makeAppError('Ze vstupu se nepodařilo získat žádný čitelný text.','EMPTY_EXTRACT');
    $('#baseText').value=extracted;
    if($('#cefr').checked && subjectAllowsCefr()){
      await detectCefrForBase(out||pasted||'');
    } else {
      if($('#cefr').checked && !subjectAllowsCefr()){$('#cefr').checked=false;saveCefrPreference(false);applyCefrLevels(null)}
      syncCefrHintFromSubject();
      if(!looksLikeLanguageSubject(getSubjectValue()))setCefrNote('CEFR je vypnutý. U tohoto materiálu se použijí jen úrovně obtížnosti.');
    }
    hide($('#inputPanel'));show($('#configPanel'));
    $('#configPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){setStatus('statusFlow','chyba načtení','warn');errBox($('#inputErr'),friendlyApiMessage(err))}
  finally{btn.disabled=false;btn.innerHTML=extractLabel}
});

document.querySelectorAll('.tierpick').forEach(p=>{const cb=p.querySelector('input');const s=()=>p.classList.toggle('on',cb.checked);cb.addEventListener('change',s);s()});

function schoolLogoSrc(){const el=$('#schoolLogo');return el&&el.src?el.src:''}
function printHead(){
  const src=schoolLogoSrc();
  const logo=src?'<img class="pa-logo" src="'+src+'" alt="Logo školy" />':'';
  return '<div class="pa-head">'+logo+'<div class="pa-school">Gymnázium, Ostrava-Hrabůvka<small>pracovní list / test</small></div></div>';
}
function metaLine(isKey){
  const parts=[];
  const s=$('#mSubject').value.trim()||$('#subject').value.trim();
  const tp=$('#mTopic').value.trim();
  const c=$('#mClass').value.trim(), d=$('#mDate').value.trim();
  if(s)parts.push('<span><b>Předmět:</b> '+esc(s)+'</span>');
  if(tp)parts.push('<span><b>Téma:</b> '+esc(tp)+'</span>');
  if(c)parts.push('<span><b>Třída:</b> '+esc(c)+'</span>');
  if(d)parts.push('<span><b>Datum:</b> '+esc(d)+'</span>');
  if(!isKey)parts.push('<span><b>Jméno:</b> ……………………</span>');
  return '<div class="pa-meta">'+parts.join('')+'</div>';
}
/* Rozdělí vyrenderovaný list na samostatné bloky cvičení.
   Každé cvičení začíná řádkem typu "1.", "2)", "Cvičení 3", "Exercise 4", "Úloha 5".
   Bloky se v tisku nesmí rozpůlit (CSS .pa-ex { break-inside:avoid }). */
function buildPrintBody(text){
  const lines=String(text||'').split(/\r?\n/);
  // Odsazené číslované možnosti jsou podpoložky, ne nové úlohy; čtyřciferný letopočet také nový blok nezakládá.
  const reStart=/^(?:(?:cvičení|úloha|exercise|task|part)\s*\d{1,2}[.):]?\s+\S|\d{1,2}[.):]\s+\S)/i;
  const blocks=[];let cur=[];
  for(const ln of lines){
    if(reStart.test(ln)&&cur.length){blocks.push(cur.join('\n'));cur=[ln]}
    else cur.push(ln);
  }
  if(cur.length)blocks.push(cur.join('\n'));
  if(blocks.length<=1)return '<div class="pa-ex">'+render(text)+'</div>';
  return blocks.map(b=>'<div class="pa-ex">'+render(b)+'</div>').join('');
}
function openManualCopy(text){
  $('#copyManual').value=text||'';
  $('#copyOverlay').classList.add('show');
  setTimeout(()=>{$('#copyManual').focus();$('#copyManual').select()},0);
}
async function copyText(text,btn,doneLabel='Zkopírováno',resetLabel='Kopírovat'){
  let ok=false;
  if(navigator.clipboard&&window.isSecureContext){
    try{await navigator.clipboard.writeText(text||'');ok=true}catch(_){}
  }
  if(!ok){
    const ta=document.createElement('textarea');
    ta.value=text||'';ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';
    document.body.appendChild(ta);ta.focus();ta.select();
    try{ok=document.execCommand('copy')}catch(_){ok=false}
    ta.remove();
  }
  const old=resetLabel||btn.textContent;
  if(ok){btn.textContent=doneLabel;setTimeout(()=>btn.textContent=old,1500)}
  else{btn.textContent='Zkopíruj ručně';openManualCopy(text);setTimeout(()=>btn.textContent=old,1800)}
}
function getMarkedSection(src,name){
  const names=['WORKSHEET_TITLE','STUDENT_INSTRUCTIONS','TASKS','ANSWER_KEY','TEACHER_NOTE','WORKSHEET'];
  const others=names.filter(n=>n!==name).join('|');
  const re=new RegExp('<<<\\s*'+name+'\\s*>>>([\\s\\S]*?)(?=<<<\\s*(?:'+others+')\\s*>>>|$)','i');
  const m=String(src||'').match(re);
  return m?(m[1]||'').trim():'';
}
function normalizeJsonTextValue(v){
  if(Array.isArray(v))return v.map(normalizeJsonTextValue).filter(Boolean).join('\n');
  if(v&&typeof v==='object')return Object.entries(v).map(([k,val])=>String(k)+': '+normalizeJsonTextValue(val)).join('\n');
  return String(v||'').trim();
}
function stripJsonCodeFence(src){
  return String(src||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
}
function tryParseWorksheetJson(src){
  const raw=stripJsonCodeFence(src);
  const candidates=[raw];
  const first=raw.indexOf('{'), last=raw.lastIndexOf('}');
  if(first>=0&&last>first)candidates.push(raw.slice(first,last+1));
  for(const c of candidates){
    try{
      const obj=JSON.parse(c);
      if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;
      const pick=(...keys)=>{
        for(const k of keys){if(Object.prototype.hasOwnProperty.call(obj,k))return normalizeJsonTextValue(obj[k])}
        return '';
      };
      const parts={
        title:pick('worksheet_title','worksheetTitle','title','nazev'),
        instructions:pick('student_instructions','studentInstructions','instructions','instrukce'),
        tasks:pick('tasks','ulohy','exercises','worksheet','pracovni_list'),
        answerKey:pick('answer_key','answerKey','key','reseni','solutions'),
        teacherNote:pick('teacher_note','teacherNote','note','poznamka')
      };
      if(parts.title||parts.instructions||parts.tasks||parts.answerKey)return parts;
    }catch(_){/* zkusí se další kandidát */}
  }
  return null;
}
