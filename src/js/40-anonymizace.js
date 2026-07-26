/* ===================== TRVALÝ SLOVNÍK JMEN ===================== */
function loadDict(){
  try{
    const raw=JSON.parse(localStorage.getItem("rozbor_dict")||"[]");
    if(!Array.isArray(raw)) return [];
    const seen=new Set(), clean=[];
    raw.forEach(item=>{
      const real=String(item&&item.real||"").trim();
      const key=real.toLocaleLowerCase("cs-CZ");
      if(real.length>=2 && !seen.has(key)){ seen.add(key); clean.push({real}); }
    });
    return clean;
  }catch(_){ return []; }
}
function saveDict(arr){
  try{
    const seen=new Set(), clean=[];
    (Array.isArray(arr)?arr:[]).forEach(item=>{
      const real=String(item&&item.real||"").trim();
      const key=real.toLocaleLowerCase("cs-CZ");
      if(real.length>=2 && !seen.has(key)){ seen.add(key); clean.push({real}); }
    });
    localStorage.setItem("rozbor_dict", JSON.stringify(clean));
  }catch(_){}
}
function rememberNames(km){
  const candidates=(km||[]).filter(k=>k.real&&k.token&&!/^\[/.test(k.token));
  if(!candidates.length){toast("V klíči nejsou žádná jména k uložení.");return;}
  confirmActionModal({title:"Uložit skutečná jména na zařízení?",message:"Slovník bude obsahovat skutečná jména a zůstane v tomto prohlížeči. Použij tuto funkci jen na vlastním zabezpečeném zařízení, nikdy na sdíleném školním počítači. Slovník lze kdykoli smazat ve Správě lokálních dat.",confirmText:"Uložit jména",onConfirm(){
    const dict=loadDict();
    candidates.forEach(k=>{if(!dict.some(d=>d.real.toLocaleLowerCase("cs-CZ")===k.real.toLocaleLowerCase("cs-CZ")))dict.push({real:k.real});});
    saveDict(dict);toast("Uloženo "+loadDict().length+" jmen na tomto zařízení.");
  }});
}

/* ===================== STAV PER ZÁLOŽKA ===================== */
const ST = {
  in: { km:[], emailN:0, phoneN:0, raw:"", clean:"", syn:{}, pozadavky:[], outputReady:false, sensitiveAck:false },
  my: { km:[], emailN:0, phoneN:0, raw:"", clean:"", syn:{}, outputReady:false, sensitiveAck:false },
};
const E = (p,name)=>$(p+"_"+name);
const ACTIVE_KEY_REALS={in:[],my:[]};
function publishActiveKeyReals(p){
  try{ ACTIVE_KEY_REALS[p]=(ST[p].km||[]).map(k=>k.real).filter(Boolean); window.__ACTIVE_KEY_REALS=ACTIVE_KEY_REALS[p].slice(); }catch(_){}
}

/* ===================== ANONYMIZACE (ťukání) ===================== */
const PUNCT_RE=/^([<>\[\]{}(),.;:!?„“”"'…»«]*)([\s\S]*?)([<>\[\]{}(),.;:!?„“”"'…»«]*)$/;
function splitPunc(w){ const m=w.match(PUNCT_RE); return m?{pre:m[1],core:m[2],post:m[3]}:{pre:"",core:w,post:""}; }

const STOP=new Set(("Dobrý Dobré Dobrou Dobré Pěkný Pěkné Krásný Krásné Hezký Hezké Milý Milá Milé Vážený Vážená Vážené Vážení "+
  "Děkuji Děkujeme Děkuji Zdravím Ahoj Nazdar Čau Nashledanou Sbohem Těším Přeji Přejeme Mějte Omlouvám Omlouváme Bohužel "+
  "Rád Ráda Také Toto Tento Tato Tyto Pokud Když Protože Jelikož Chtěl Chtěla Chtěli Mám Máme Máte Je Jsou Byl Byla Byly Bylo "+
  "Jak Co Kdy Kde Kdo Proč Můj Moje Naše Náš Vaše Váš Vás Vám Vy My Já On Ona Ano Ne Prosím Prosíme Předem Zatím Mezitím "+
  "Pondělí Úterý Středa Čtvrtek Pátek Sobota Neděle Leden Únor Březen Duben Květen Červen Červenec Srpen Září Říjen Listopad Prosinec "+
  "Škola Třída Žák Žáci Rodiče Ředitel Ředitelka").split(/\s+/));

function autoDetect(text){
  const found=[]; const add=(r)=>{ r=(r||"").trim(); if(r.length<2) return; if(found.some(f=>f.toLowerCase()===r.toLowerCase())) return; found.push(r); };
  // jen jisté signály — žádné hádání jmen (jména si přidáš ťuknutím)
  (text.match(/[A-Za-z0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}/gu)||[]).forEach(add);
  // čísla účtů a rodná čísla zamaskuj, ať je detekce telefonu nesebere jako 9 číslic
  const masked=String(text).replace(reAccount("g")," ").replace(/\b\d{6}\/\d{3,4}\b/g," ");
  // telefon: +420 / 00420, mezery, pomlčky, tečky i lomítka, i bez oddělovačů
  (masked.match(/(?:\+420|00420)?[\s./\-]?\d{3}[\s./\-]?\d{3}[\s./\-]?\d{3}/g)||[])
    .map(m=>m.trim()).filter(m=>m.replace(/\D/g,"").length>=9).forEach(add);
  return found;
}
// strukturované osobní identifikátory — vysoká jistota, bezpečné automaticky skrýt (#5)
function autoStructured(text){
  const out=[];
  (text.match(/\b\d{6}\/\d{3,4}\b/g)||[]).forEach(m=>out.push({real:m, kind:"rc"}));
  (text.match(reAccount("g"))||[]).forEach(m=>out.push({real:m, kind:"ucet"}));
  const re=/(?:nar\.|narozen[aáéíý]*|datum\s+narození|datum\s+nar\.)\s*(\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4})/gi;
  let mm; while((mm=re.exec(text))){ const d=(mm[1]||"").trim(); if(d) out.push({real:d, kind:"dob"}); }
  return out;
}
function personLabel(n){ let s="", x=(n|0)+1; while(x>0){ x--; s=String.fromCharCode(65+(x%26))+s; x=Math.floor(x/26); } return s; }
function countPersons(km){ return km.filter(k=>/^osoba\b/.test(k.token||"")).length; }
function personLabelIndex(label){
  const m=String(label||"").match(/^osoba\s+([A-Z]+)$/); if(!m) return -1;
  let n=0; for(const ch of m[1]) n=n*26+(ch.charCodeAt(0)-64); return n-1;
}
function nextPersonToken(km){
  const max=(km||[]).reduce((n,k)=>Math.max(n,personLabelIndex(k&&k.token)), -1);
  return "osoba "+personLabel(max+1);
}
function tokenFor(st, real){
  if(/^[A-Za-z0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}$/u.test(real)) return "[e-mail "+(++st.emailN)+"]";
  if(/\d{3}/.test(real) && real.replace(/\D/g,"").length>=6) return "[telefon "+(++st.phoneN)+"]";
  return nextPersonToken(st.km);
}
function dictionaryNameAppears(text, real){
  const probe={real:String(real||"").trim(),token:"osoba Z"};
  if(!probe.real) return false;
  const parsed=wordObjs(text);
  return matchWordArray(buildMatchers([probe]), parsed.words).some(Boolean);
}
function buildKey(st, detected){
  loadDict().forEach(d=>{
    if(st.km.some(k=>k.real.toLocaleLowerCase("cs-CZ")===d.real.toLocaleLowerCase("cs-CZ"))) return;
    if(dictionaryNameAppears(st.raw,d.real)) st.km.push({real:d.real,token:tokenFor(st,d.real),auto:true});
  });
  detected.forEach(real=>{ if(st.km.some(k=>k.real.toLowerCase()===real.toLowerCase())) return; st.km.push({real,token:tokenFor(st,real),auto:true}); });
  // strukturované identifikátory (rodné číslo, datum narození) — automaticky, vysoká jistota
  autoStructured(st.raw).forEach(it=>{
    if(st.km.some(k=>k.real.toLowerCase()===it.real.toLowerCase())) return;
    const base=it.kind==="rc"?"rodné číslo":it.kind==="ucet"?"číslo účtu":"datum narození";
    const cnt=st.km.filter(k=>(k.token||"").indexOf("["+base)===0).length;
    st.km.push({real:it.real, token:"["+base+" "+(cnt+1)+"]", auto:true});
  });
}
// České pádové tvary jmen. Generujeme konkrétní tvary, nikoli obecné prefixy:
// prefixová shoda spolykala cizí jména (Jan → Janák), explicitní sada je bezpečná i u krátkých jmen.
const CZ_SUFFIXES=["níkovi","níkem","níka","ovou","ákovi","ákem","áka","ičkou","ičce","ičku","ičky","čkou","čce","čku","čka","ovi","ové","ova","em","ou","ě","e","i","y","a","u"].sort((a,b)=>b.length-a.length);
const CZ_FEMALE_PALATAL={"k":"c","h":"z","g":"z"};
function femaleDative(stem){
  if(stem.endsWith("ch")) return stem.slice(0,-2)+"še";
  const last=stem.slice(-1), rep=CZ_FEMALE_PALATAL[last];
  return rep?stem.slice(0,-1)+rep+"e":stem+"ě";
}
function czechCaseForms(name){
  const lo=String(name||"").toLocaleLowerCase("cs-CZ");
  const out=new Set([lo]);
  if(lo.length<2) return out;
  if(/ová$/.test(lo)){
    const s=lo.slice(0,-1); ["é","ou"].forEach(x=>out.add(s+x));
    return out;
  }
  if(/a$/.test(lo)){
    const s=lo.slice(0,-1); ["y","u","o","ou"].forEach(x=>out.add(s+x)); out.add(femaleDative(s)); out.add(s+"ovi");
    return out;
  }
  // Pohyblivé „e“ v běžných mužských jménech: Karel → Karla/Karlovi/Karlem/Karle,
  // Pavel → Pavla/Pavlovi/Pavlem/Pavle. Jde o konkrétní tvary, ne prefixovou shodu.
  if(/el$/.test(lo) && lo.length>=4){
    const s=lo.slice(0,-2)+"l"; ["a","ovi","em","e"].forEach(x=>out.add(s+x));
  }
  if(/ý$/.test(lo)){
    const s=lo.slice(0,-1); ["ého","ému","ým","í"].forEach(x=>out.add(s+x));
    return out;
  }
  if(/[eéií]$/.test(lo)){
    const s=lo.replace(/[eéií]$/,""); ["e","i","í","ovi","em"].forEach(x=>out.add(s+x));
    return out;
  }
  // U třípísmenných jmen neprodukujeme nejednoznačné Jana/Janu: mohlo by jít o jiné jméno.
  if(lo.length>=4){
    out.add(lo+(/[šžčřcj]$/.test(lo)?"e":"a"));
    out.add(lo+"u");
  }
  out.add(lo+"ovi"); out.add(lo+"em");
  if(lo.endsWith("r")) out.add(lo.slice(0,-1)+"ře");
  else if(/(?:ch|[kgh])$/.test(lo)) out.add(lo+"u");
  else if(/[šžčřcj]$/.test(lo)) out.add(lo+"i");
  else out.add(lo+"e");
  return out;
}
function nameVariants(real){
  const lo=String(real||"").toLocaleLowerCase("cs-CZ"), variants=czechCaseForms(lo);
  // Když uživatel označí skloňovaný tvar, odvoď bezpečný základ a z něj opět jen konkrétní tvary.
  CZ_SUFFIXES.forEach(suf=>{
    if(lo.endsWith(suf) && lo.length-suf.length>=3){
      const base=lo.slice(0,lo.length-suf.length); czechCaseForms(base).forEach(v=>variants.add(v));
    }
  });
  return [...variants].filter(v=>v.length>=2);
}
function nameMatchWord(variants, coreL, isCap, origLen){
  return variants.has(coreL);
}
const _isUpper=c=>!!c && c!==c.toLowerCase() && c===c.toUpperCase();
function buildMatchers(km){
  return km.filter(k=>k.real&&k.token).map(k=>{
    const words=String(k.real).trim().split(/\s+/).map(w=>splitPunc(w).core).filter(Boolean);
    const isPerson=/^osoba\b/.test(k.token);
    return {
      token:k.token, isPerson, n:words.length,
      words: words.map(w=>({ lo:w.toLowerCase(), origLen:w.length, variants:isPerson?new Set(nameVariants(w)):null })),
      weight: words.reduce((s,w)=>s+w.length,0)
    };
  }).filter(m=>m.n>0).sort((a,b)=> (b.n-a.n) || (b.weight-a.weight));
}
function wordObjs(text){
  const segs=String(text).split(/(\s+)/); const words=[];
  segs.forEach((s,pi)=>{ if(pi%2===0 && s!==""){ const sp=splitPunc(s); words.push({pi, pre:sp.pre, core:sp.core, post:sp.post, coreL:sp.core.toLowerCase(), cap:_isUpper(sp.core[0])}); } });
  return {segs, words};
}
// Pro každé slovo vrátí null (ponech), {token,n} (začátek značky) nebo "SKIP" (uvnitř značky).
function matchWordArray(matchers, words){
  const wtok=new Array(words.length).fill(null); let wi=0;
  while(wi<words.length){
    let selected=null;
    // Nejdřív vždy přesná shoda všech osob. Tím Jana Nováková nemůže pohltit přesné „Jan Novák“.
    for(const exactOnly of [true,false]){
      for(const m of matchers){
        if(wi+m.n>words.length) continue;
        let ok=true;
        for(let k=0;k<m.n;k++){
          const w=words[wi+k], mw=m.words[k];
          const exact=w.coreL===mw.lo;
          const good=exactOnly ? exact : (m.isPerson ? nameMatchWord(mw.variants,w.coreL,w.cap,mw.origLen) : exact);
          if(!good){ok=false;break;}
        }
        if(ok){selected=m;break;}
      }
      if(selected)break;
    }
    if(selected){wtok[wi]={token:selected.token,n:selected.n};for(let k=1;k<selected.n;k++)wtok[wi+k]="SKIP";wi+=selected.n;}
    else wi++;
  }
  return wtok;
}
// Nahrazuje po CELÝCH slovech (žádné podřetězce → žádné „osoba Aovi"),
// víceslovná jména skloňuje po jednotlivých slovech a spojí do jedné značky.
function applyKeyToText(p, text){
  if(!text) return text||"";
  const {segs, words}=wordObjs(text);
  const wtok=matchWordArray(buildMatchers(ST[p].km.filter(k=>k.real&&k.token)), words);
  let out="", widx=-1;
  for(let pi=0; pi<segs.length; pi++){
    const s=segs[pi];
    if(pi%2===0){
      if(s==="") continue;
      widx++;
      const t=wtok[widx];
      if(t==="SKIP"){ /* uvnitř značky → vynech */ }
      else if(t){ const last=words[widx+t.n-1]; out+=words[widx].pre+t.token+(last?last.post:""); }
      else { out+=s; }
    } else {
      if(wtok[widx+1]==="SKIP"){ /* vnitřní mezera značky → vynech */ }
      else out+=s;
    }
  }
  return out;
}
function cleanFromKey(p){ return applyKeyToText(p, ST[p].raw); }

/* ---- pomocníci pro interaktivní náhled (#3, #4, #6) ---- */
const NAME_CAND_STOP=new Set(["Od","Komu","Kopie","Skrytá","Předmět","Re","Fw","Fwd","Dobrý","Dobrá","Dobré","Milá","Milý","Vážená","Vážený","Vážení","Pane","Paní","Slečno","Prosím","Děkuji","Děkuju","Zdravím","Ahoj","Pozdravem","Srdečně","Tématem","Téma"]);
function isNameCandidate(core){
  if(!/^\p{L}+$/u.test(core)) return false;
  if(!/^\p{Lu}\p{Ll}{2,}$/u.test(core)) return false;
  if((typeof STOP!=="undefined" && STOP.has && STOP.has(core)) || NAME_CAND_STOP.has(core)) return false;
  return true;
}
function selectionIsMulti(){ try{ const s=String(window.getSelection()||"").trim(); return s.length>0 && /\s/.test(s); }catch(_){ return false; } }
function clickedNamePhrase(words,index){
  const current=words[index];
  if(!current || !isNameCandidate(current.core)) return current&&current.core||"";
  const next=words[index+1], prev=words[index-1];
  const canJoin=(left,right)=>!!left&&!!right&&isNameCandidate(left.core)&&isNameCandidate(right.core)&&!/[.!?;:]/.test(left.post||"");
  if(canJoin(current,next)) return current.core+" "+next.core;
  if(canJoin(prev,current)) return prev.core+" "+current.core;
  return current.core;
}
function removeByToken(p, token){ const st=ST[p]; st.km=st.km.filter(k=>k.token!==token); afterKeyChange(p); }
let nameHintOn=(function(){ try{ return localStorage.getItem("rozbor_name_hints")==="1"; }catch(_){ return false; } })();
function ensureNameHintToggle(p){
  if($(p+"_nameHintRow")) return;
  const view=E(p,"view"); if(!view||!view.parentNode) return;
  const row=document.createElement("label"); row.id=p+"_nameHintRow"; row.className="name-hint-toggle";
  row.innerHTML='<input type="checkbox" '+(nameHintOn?"checked":"")+'><span>Zvýraznit možná jména k ťuknutí</span>';
  row.querySelector("input").addEventListener("change",e=>{ nameHintOn=e.target.checked; try{localStorage.setItem("rozbor_name_hints",nameHintOn?"1":"0");}catch(_){} renderView("in"); renderView("my"); });
  view.parentNode.insertBefore(row, view);
  if(p+"_nameHintRow"){ const cb=row.querySelector("input"); if(cb) cb.checked=nameHintOn; }
}
let tapPopEl=null;
function hideTapPop(){ if(tapPopEl) tapPopEl.style.display="none"; }
function tokenForRelatedPerson(st, cleaned){
  const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("cs-CZ");
  const n=norm(cleaned); if(n.length<2) return "";
  const hit=(st.km||[]).find(k=>{
    if(!k.real||!/^osoba\b/.test(k.token||"")) return false;
    return String(k.real).split(/\s+/).some(part=>new Set(nameVariants(part).map(norm)).has(n));
  });
  return hit?hit.token:"";
}
function addPhrase(p, phrase){
  const st=ST[p]; const cleaned=String(phrase).replace(/\s+/g," ").trim().replace(/^[<>\[\]{}(),.;:!?„“”"'…»«\s]+|[<>\[\]{}(),.;:!?„“”"'…»«\s]+$/g,"");
  if(!cleaned || cleaned.length<2) return;
  if(st.km.some(k=>k.real.toLocaleLowerCase("cs-CZ")===cleaned.toLocaleLowerCase("cs-CZ"))) return;
  const related=tokenForRelatedPerson(st,cleaned), token=related||nextPersonToken(st.km);
  st.km.push({real:cleaned,token,auto:false}); afterKeyChange(p);
  if(related) toast("Přidáno ke stejné osobě ("+token+").");
}
function showTapHide(p, phrase, rect){
  if(!tapPopEl){ tapPopEl=document.createElement("div"); tapPopEl.id="tapPop"; document.body.appendChild(tapPopEl); }
  tapPopEl.innerHTML='<button class="btn small primary" id="tapHideBtn"><span class="action-icon" data-ic="lock"></span>Skrýt vybrané jako 1 osobu</button>';
  tapPopEl.style.display="block";
  const w=tapPopEl.offsetWidth||250;
  tapPopEl.style.left=Math.max(8, Math.min(window.scrollX+rect.left, window.scrollX+window.innerWidth-w-12))+"px";
  tapPopEl.style.top=(window.scrollY+rect.bottom+6)+"px";
  paintIcons(tapPopEl);
  tapPopEl.querySelector("#tapHideBtn").onmousedown=(e)=>e.preventDefault();
  tapPopEl.querySelector("#tapHideBtn").onclick=()=>{ addPhrase(p, phrase); hideTapPop(); };
}
function wireTapSelection(p){
  const view=E(p,"view"); if(!view||view.dataset.selWired) return; view.dataset.selWired="1";
  const handler=()=>setTimeout(()=>{
    const sel=window.getSelection(); if(!sel||!sel.rangeCount){ return; }
    const txt=sel.toString().trim();
    if(!txt || !/\s/.test(txt)){ hideTapPop(); return; }
    if(!view.contains(sel.anchorNode) || !view.contains(sel.focusNode)){ hideTapPop(); return; }
    showTapHide(p, txt, sel.getRangeAt(0).getBoundingClientRect());
  },10);
  view.addEventListener("mouseup",handler); view.addEventListener("touchend",handler);
}
if(typeof document!=="undefined"){ document.addEventListener("click",(e)=>{ if(tapPopEl && tapPopEl.style.display==="block" && !tapPopEl.contains(e.target) && !(e.target.closest&&e.target.closest(".tapview"))) hideTapPop(); }); }

function renderView(p){
  const el=E(p,"view"); if(!el) return; el.innerHTML="";
  ensureNameHintToggle(p); wireTapSelection(p);
  if(!ST[p].raw.trim()){ el.innerHTML=EMPTY_MARK; return; }
  const {segs, words}=wordObjs(ST[p].raw);
  const wtok=matchWordArray(buildMatchers(ST[p].km.filter(k=>k.real&&k.token)), words);
  const mkSpan=(cls, label, title, aria, act)=>{
    const span=document.createElement("span"); span.className=cls; span.textContent=label; span.title=title;
    span.tabIndex=0; span.setAttribute("role","button"); span.setAttribute("aria-label",aria);
    span.onclick=()=>{ if(selectionIsMulti()) return; act(); };
    span.addEventListener("keydown",ev=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); act(); } });
    return span;
  };
  let widx=-1;
  for(let pi=0; pi<segs.length; pi++){
    const s=segs[pi];
    if(pi%2===1){ if(wtok[widx+1]!=="SKIP") el.appendChild(document.createTextNode(s)); continue; }
    if(s==="") continue;
    widx++;
    const w=words[widx], t=wtok[widx];
    if(t==="SKIP") continue;
    if(t){
      if(w.pre) el.appendChild(document.createTextNode(w.pre));
      el.appendChild(mkSpan("w hid "+tokenClass(t.token), t.token, "Ťukni a zase odkryješ", "Odkrýt "+t.token, ()=>removeByToken(p,t.token)));
      const last=words[widx+t.n-1]; if(last && last.post) el.appendChild(document.createTextNode(last.post));
    } else {
      if(w.pre) el.appendChild(document.createTextNode(w.pre));
      const maybe=nameHintOn && isNameCandidate(w.core);
      const phrase=clickedNamePhrase(words,widx);
      const phraseTitle=phrase!==w.core?"Skrýt celé jméno "+phrase:(maybe?"Možná jméno — ťukni pro skrytí":"Ťukni a skryješ");
      el.appendChild(mkSpan("w"+(maybe?" maybe":""), w.core, phraseTitle, "Skrýt "+phrase, ()=>phrase!==w.core?addPhrase(p,phrase):addWord(p,w.core)));
      if(w.post) el.appendChild(document.createTextNode(w.post));
    }
  }
}
function resetReview(p){ const cb=E(p,"reviewOk"); if(cb) cb.checked=false; if(ST[p])ST[p].outputReady=false; updateSendGate(p); updateProgress(p); }
function afterKeyChange(p){ publishActiveKeyReals(p); ST[p].sensitiveAck=false; ST[p].clean=cleanFromKey(p); resetReview(p); renderView(p); renderKeyTable(p); renderPreview(p); }
function addWord(p, core){
  const st=ST[p]; if(!core) return; if(st.km.some(k=>k.real.toLocaleLowerCase("cs-CZ")===core.toLocaleLowerCase("cs-CZ"))) return;
  const related=tokenForRelatedPerson(st,core), token=related||tokenFor(st,core); st.km.push({real:core,token,auto:false}); afterKeyChange(p);
  if(related) toast("Přidáno ke stejné osobě ("+token+").");
}
function activateSensitiveMode(reason){
  setNoHistory(true);
  try{ sessionStorage.removeItem(LAST_PROMPT_SK); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){}
  try{ logOp("sensitive_mode","on",{reason:reason||"sensitive_terms"}); }catch(_){}
}
function doAnon(p){
  const raw=E(p,"raw").value; if(!raw.trim()) return;
  if(hasSensitiveSchoolTerms(raw)) activateSensitiveMode("obsahuje citlivá školní témata");
  const st=ST[p]; st.raw=raw; st.emailN=0; st.phoneN=0; st.km=[]; st.sensitiveAck=false;
  buildKey(st, autoDetect(raw));
  afterKeyChange(p);
  const kd=E(p,"keyDetails"); if(kd) kd.open=false;
  E(p,"step2").style.display="grid";
  E(p,"step2").scrollIntoView({behavior:"smooth",block:"start"});
  updateProgress(p);
}
function renderKeyTable(p){
  const st=ST[p], body=E(p,"keyBody"); body.innerHTML="";
  st.km.forEach((k,idx)=>{ const tr=document.createElement("tr");
    const uses=k.token?(String(st.clean||"").match(new RegExp(escRe(k.token),"g"))||[]).length:0;
    tr.innerHTML='<td><input value="'+escAttr(k.real)+'" data-i="'+idx+'" data-f="real"></td><td class="tok"><input value="'+escAttr(k.token)+'" data-i="'+idx+'" data-f="token"><small title="Počet výskytů značky v odesílaném náhledu">'+uses+'× v náhledu</small></td><td><button class="del-row" data-del="'+idx+'" title="Smazat">×</button></td>';
    body.appendChild(tr); });
  renderKeySummary(p);
  E(p,"keyEmpty").style.display=st.km.length?"none":"block";
  body.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",(e)=>{
    st.km[+e.target.dataset.i][e.target.dataset.f]=e.target.value;
    publishActiveKeyReals(p); ST[p].clean=cleanFromKey(p);
    resetReview(p);
    renderView(p); renderPreview(p); renderKeySummary(p);
  }));
  body.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ st.km.splice(+b.dataset.del,1); afterKeyChange(p); });
}
function keySummaryItems(arr){ return arr.map(k=>k.token||k.real).filter(Boolean).slice(0,3).join(" · ") || "—"; }
function renderKeySummary(p){
  const body=E(p,"keyBody"); if(!body) return;
  let panel=$(p+"_keyPanel");
  if(!panel){ panel=document.createElement("div"); panel.className="key-summary"; panel.id=p+"_keyPanel"; const table=body.closest("table"); if(table) table.parentNode.insertBefore(panel, table); }
  const km=ST[p].km||[];
  const osoby=km.filter(k=>/^osoba/.test(k.token||""));
  const emails=km.filter(k=>/^\[e-mail/.test(k.token||""));
  const phones=km.filter(k=>/^\[telefon/.test(k.token||""));
  const manual=km.filter(k=>k.auto===false);
  const cards=[
    [svgIcon("user")+" Skryté osoby",osoby],
    [svgIcon("mail")+" Skryté e-maily",emails],
    [svgIcon("phone")+" Skryté telefony",phones],
    [svgIcon("edit")+" Ručně přidané",manual],
  ];
  const line=E(p,"keySummaryLine");
  if(line){
    const total=km.length;
    line.textContent=total ? ("Skryto: "+osoby.length+" osob, "+emails.length+" e-mailů, "+phones.length+" telefonů · ručně "+manual.length) : "Zatím bez náhrad.";
  }
  panel.innerHTML=cards.map(([label,arr])=>'<div class="key-card '+(arr.length?'':'emptyish')+'"><b>'+label+'</b><span class="count">'+arr.length+'</span><div class="items" title="'+escAttr(keySummaryItems(arr))+'">'+esc(keySummaryItems(arr))+'</div></div>').join("");
}
function addRow(p){ const st=ST[p]; st.km.push({real:"",token:nextPersonToken(st.km),auto:false}); renderKeyTable(p); renderKeySummary(p); }
function renderRiskPieces(text){
  let parts=[{text:String(text||""), cls:"", title:""}];
  const apply=(re, cls, title)=>{
    const out=[];
    parts.forEach(part=>{
      if(part.cls){ out.push(part); return; }
      let last=0; const src=part.text; re.lastIndex=0; let m;
      while((m=re.exec(src))){
        if(m.index>last) out.push({text:src.slice(last,m.index), cls:"", title:""});
        out.push({text:m[0], cls, title});
        last=m.index+m[0].length;
        if(m[0].length===0) re.lastIndex++;
      }
      if(last<src.length) out.push({text:src.slice(last), cls:"", title:""});
    });
    parts=out;
  };
  apply(/[A-Za-z0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}/gu,"ri-danger","Možný e-mail – skryj nebo odstraň");
  apply(reAccount("g"),"ri-danger","Možné číslo účtu – skryj nebo odstraň");
  apply(/(?:\+420|00420)?[\s./-]*\d{3}[\s./-]?\d{3}[\s./-]?\d{3}/g,"ri-danger","Možný telefon – skryj nebo odstraň");
  apply(/\b\d{2}[0156]\d[0-3]\d\/?\d{3,4}\b/g,"ri-danger","Možný rodný nebo datumový identifikátor");
  apply(/\b(?:nar\.|narozen(?:a|ý)?|datum narození|datum nar\.)\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}\b/gi,"ri-danger","Možné datum narození");
  apply(/\b\d{1,2}\.\s*\d{1,2}\.\s*(?:19|20)\d{2}\b/g,"ri-warn","Datum – ověř, zda nejde o datum narození");
  apply(/\b[1-4]\.\s?[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]\b/g,"ri-warn","Třída – zvaž, zda v kombinaci s dalšími údaji neidentifikuje žáka");
  apply(/\b(?:ul\.|ulice|náměstí|nábřeží|č\.p\.|čp\.|bytem|adresa)\b/gi,"ri-warn","Výraz související s adresou – zkontroluj kontext");
  apply(new RegExp(SENSITIVE_TERMS_SOURCE,"giu"),"ri-danger","Citlivé školní, zdravotní nebo kázeňské téma");
  apply(new RegExp(SENSITIVE_TERMS_INTL_RE.source,"gi"),"ri-danger","Citlivé téma (EN/ES)");
  const out=[];
  parts.forEach(part=>{
    if(part.cls){ out.push(part); return; }
    let last=0; const src=part.text;
    const re=/[A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž]+/g; let m;
    while((m=re.exec(src))){
      if(m.index>last) out.push({text:src.slice(last,m.index), cls:"", title:""});
      const word=m[0];
      if(isNameCandidate(word)) out.push({text:word, cls:"ri-warn", title:"Možné jméno nebo vlastní název – zkontroluj"});
      else out.push({text:word, cls:"", title:""});
      last=m.index+word.length;
    }
    if(last<src.length) out.push({text:src.slice(last), cls:"", title:""});
  });
  return out.map(part=>part.cls?'<mark class="risk-inline '+part.cls+'" title="'+esc(part.title)+'">'+esc(part.text)+'</mark>':esc(part.text)).join("");
}
function renderPreview(p){
  const clean=ST[p].clean||"";
  const tokens=[...new Set(ST[p].km.map(k=>k.token).filter(Boolean))].sort((a,b)=>b.length-a.length);
  let html="";
  if(tokens.length){
    const re=new RegExp(tokens.map(escRe).join("|"),"g");
    let last=0, m;
    while((m=re.exec(clean))){
      if(m.index>last) html+=renderRiskPieces(clean.slice(last,m.index));
      const t=m[0]; html+='<span class="token '+tokenClass(t)+'">'+esc(t)+'</span>';
      last=m.index+t.length;
    }
    if(last<clean.length) html+=renderRiskPieces(clean.slice(last));
  } else {
    html=renderRiskPieces(clean);
  }
  E(p,"preview").innerHTML=html||EMPTY_MARK;
  renderSafety(p);
  updateSendGate(p);
}
function stripSafeTokens(text){
  return String(text||"").replace(/\[e-mail \d+\]|\[telefon \d+\]|\[rodné číslo \d+\]|\[datum narození \d+\]|\[číslo účtu \d+\]|osoba [A-Z]+|\[podpis\]|\[učitel\]/g," ");
}
function preflightIssues(text,p){
  const stripped=stripSafeTokens(text);
  const danger=[], warn=[], names=[];
  const addD=(x)=>{ if(!danger.includes(x)) danger.push(x); };
  const addW=(x)=>{ if(!warn.includes(x)) warn.push(x); };
  if(/[A-Za-z0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}/u.test(stripped)) addD("e-mail");
  const phoneScan=stripped.replace(reAccount("g")," ").replace(/\b\d{6}\/\d{3,4}\b/g," ");
  if((phoneScan.match(/(?:\+420|00420)?[\s./-]*\d{3}[\s./-]?\d{3}[\s./-]?\d{3}/g)||[]).some(m=>m.replace(/\D/g,"").length>=9)) addD("telefon");
  if(reAccount().test(stripped)) addD("číslo bankovního účtu");
  if(/\b\d{2}[0156]\d[0-3]\d\/?\d{3,4}\b/.test(stripped)) addD("rodné číslo / datumový identifikátor");
  if(/\b(nar\.|narozen(?:a|ý)?|datum narození|datum nar\.)\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}\b/i.test(stripped)) addD("datum narození");
  else if(/\b\d{1,2}\.\s*\d{1,2}\.\s*(?:19|20)\d{2}\b/.test(stripped)) addW("datum – ověř, zda nejde o datum narození");
  if(/(?:^|[^\p{L}\d])[1-4]\.\s?\p{Lu}(?!\p{L})/u.test(stripped)) addW("třída – sama o sobě není identifikátor, ale zkontroluj kombinaci údajů");
  if(/\b(ul\.|ulice|náměstí|nábřeží|č\.p\.|čp\.|bytem|adresa)\b/i.test(stripped)) addW("výraz související s adresou – zkontroluj kontext");
  if(/ob[čc]ansk\S*\s+pr[uů]kaz/i.test(stripped) || /pr[uů]kaz\S*\s+totožnost/i.test(stripped) || /\bOP[\s.:]*\d{6,10}\b/.test(stripped)) addD("doklad totožnosti (OP / pas)");
  const addrW=stripped.match(/\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]*(?:ní|ová|ova|ská|cká|ého)\s+\d{1,4}\b/g);
  if(addrW) addW("možná adresa (ulice + číslo, heuristika): "+addrW.slice(0,2).join(", "));
  if(SENSITIVE_TERMS_RE.test(stripped) || SENSITIVE_TERMS_INTL_RE.test(stripped)) addD("citlivé školní/zdravotní nebo kázeňské údaje");
  const localStop=new Set(["Od","Komu","Kopie","Předmět","Predmet","Re","FW","Fwd","Gemini","Google","Dobrý","Dobry","Dobr","Pane","Paní","Pani","Prosím","Prosim","Pište","Piste","Pozdravem","Vážená","Vážený","Vážení"]);
  stripped.split(/[^A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž]+/)
    .filter(w=>/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}$/.test(w))
    .filter(w=>!STOP.has(w) && !localStop.has(w))
    .forEach(w=>{ if(!names.includes(w)) names.push(w); });
  if(names.length){ const more=names.length>3?(" + "+(names.length-3)+" dalších"):""; addW("možná jména nebo vlastní názvy (heuristika, ne jistota): "+names.slice(0,3).join(", ")+more); }
  // uložená jména (slovník) — chytni i malými písmeny / nezakrytá, nezávisle na velikosti
  try{
    const lo=stripped.toLowerCase(); const dictHits=[];
    loadDict().forEach(d=>{
      const nClean=String(d.real||"").replace(/[^\p{L}\p{M}\s\-]/gu,"").trim();
      if(nClean.length<2) return;
      const re=new RegExp("(?:^|[^a-záčďéěíňóřšťúůýž])"+nClean.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![a-záčďéěíňóřšťúůýž])","i");
      if(re.test(lo) && !dictHits.includes(nClean)) dictHits.push(nClean);
    });
    if(dictHits.length) addW("uložené jméno zůstává v textu nezakryté: "+dictHits.slice(0,3).join(", ")+(dictHits.length>3?(" + "+(dictHits.length-3)+" dalších"):""));
  }catch(_){}
  // Zbytek, který odpovídá jinému pádu již skrytého jména, je tvrdá stopka.
  try{
    const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("cs-CZ");
    const active=(p&&ACTIVE_KEY_REALS[p]?ACTIVE_KEY_REALS[p]:(window.__ACTIVE_KEY_REALS||[]));
    const exact=new Set(), roots=[];
    active.forEach(real=>String(real||"").split(/\s+/).forEach(part=>{
      nameVariants(part).forEach(v=>exact.add(norm(v)));
      const root=norm(part); if(root.length>=4) roots.push(root);
    }));
    if(exact.size||roots.length){
      const missed=[];
      stripped.split(/[^\p{L}]+/u).forEach(word=>{
        const n=norm(word); if(n.length<2) return;
        const suffixMatch=roots.some(root=>n.startsWith(root)&&/^(?:a|u|e|i|y|ovi|ove|ova|ovou|em|ou|mu|ho)$/.test(n.slice(root.length)));
        if((exact.has(n)||suffixMatch)&&!missed.includes(word)) missed.push(word);
      });
      if(missed.length) addD("nezakrytý tvar již skrytého jména: "+missed.slice(0,3).join(", "));
    }
  }catch(_){}
  return {danger,warn,names};
}
function safeAuxiliaryText(p, raw, state, label){
  const original=String(raw||"").trim();
  if(!original) return "";
  const clean=applyKeyToText(p, original);
  const iss=preflightIssues(clean,p);
  if(iss.danger.length){
    const findings=iss.danger;
    const msg=(label||"Doplňující pokyn")+" obsahuje možný osobní nebo citlivý údaj („"+findings.join(", ")+"“). Použij anonymizovanou značku, například osoba A, nebo pokyn zobecni.";
    if(state) state.innerHTML='<div class="error"><b>Pokyn nebyl odeslán.</b> '+esc(msg)+'</div>';
    else toast(msg);
    flashPreview(p);
    return null;
  }
  return clean;
}
function enforcePreflight(p, state, extraTexts){
  const texts=[ST[p].clean||""].concat(extraTexts||[]).filter(Boolean).join("\n");
  const iss=preflightIssues(texts,p);
  const danger=(ST[p]&&ST[p].sensitiveAck) ? iss.danger.filter(x=>!/citlivé/.test(x)) : iss.danger;
  if(danger.length){
    try{ logOp("preflight","stop",{pane:p,issues:danger}); }catch(_){}
    if(danger.some(x=>/citlivé/.test(x))) activateSensitiveMode("preflight citlivé téma");
    const msg="Raději neposílat: v textu zůstává možný citlivý údaj („"+danger.join(", ")+"“). Uprav náhled nebo poznámku tak, aby obsahoval jen anonymizované značky a obecné formulace.";
    if(state) state.innerHTML='<div class="error"><b>Odeslání zastaveno.</b> '+esc(msg)+'</div>';
    flashPreview(p);
    return false;
  }
  return true;
}
function safetyAudit(text,p){
  const iss=preflightIssues(text,p);
  if(iss.danger.length){
    const sensitive=iss.danger.some(x=>/citlivé/.test(x));
    return {
      level:sensitive?"nosend":"danger",
      title:sensitive?"Raději neposílat":"Červená",
      msg:(sensitive?"Text obsahuje citlivé školní/zdravotní nebo kázeňské téma. Neodesílej konkrétní údaje modelu; nahraď je obecným popisem. ":"V náhledu možná zůstává citlivý údaj. ")+"Nález: "+iss.danger.join(", ")+".",
      action:sensitive?"Neodesílat konkrétní údaje. Zobečni situaci a odstraň identifikátory.":"Neodesílat, nejdřív uprav text."
    };
  }
  if(iss.warn.length) return {level:"warn", title:"Kontrolní upozornění", msg:"Aplikace upozorňuje na "+iss.warn.join("; ")+". Upozornění samo o sobě generování neblokuje.", action:"Posuď nález očima. Pokud nejde o osobní nebo citlivý údaj, potvrď kontrolu."};
  return {level:"ok", title:"Zelená", msg:"Nevidím zjevný e-mail, telefon, rodné číslo, adresu ani podezřelé jméno. Přesto ještě projdi náhled očima.", action:"Pokračuj až po ruční kontrole náhledu."};
}
function renderSafetyCounts(p){
  const safetyEl=E(p,"safety"); if(!safetyEl||!safetyEl.parentNode) return;
  let row=$(p+"_safetyCounts");
  if(!row){ row=document.createElement("div"); row.id=p+"_safetyCounts"; safetyEl.parentNode.insertBefore(row, safetyEl); }
  row.className="safety-counts advanced-only";
  const km=ST[p].km||[];
  const cO=km.filter(k=>/^osoba/.test(k.token||"")).length;
  const cE=km.filter(k=>/^\[e-mail/.test(k.token||"")).length;
  const cT=km.filter(k=>/^\[telefon/.test(k.token||"")).length;
  const cell=(ic,lbl,n)=>'<span class="sc'+(n?"":" zero")+'">'+svgIcon(ic)+' '+esc(lbl)+' <b>'+n+'</b></span>';
  row.innerHTML=cell("user","skryté osoby",cO)+cell("mail","e-maily",cE)+cell("phone","telefony",cT);
}
function czCount(n, one, few, many){
  return n+" "+(n===1?one:(n>=2&&n<=4?few:many));
}
function renderPreviewSummary(p){
  const el=E(p,"previewSummary"); if(!el) return;
  const clean=ST[p].clean||"";
  if(!clean.trim()){ el.className="preview-summary"; el.innerHTML=""; return; }
  const km=ST[p].km||[];
  const cO=km.filter(k=>/^osoba/.test(k.token||"")).length;
  const cE=km.filter(k=>/^\[e-mail/.test(k.token||"")).length;
  const cT=km.filter(k=>/^\[telefon/.test(k.token||"")).length;
  const iss=preflightIssues(clean,p);
  const total=cO+cE+cT;
  const show=clean.length>260 || total>0 || iss.danger.length || iss.warn.length;
  if(!show){ el.className="preview-summary"; el.innerHTML=""; return; }
  const counts=czCount(cO,"osoba","osoby","osob")+", "+czCount(cE,"e-mail","e-maily","e-mailů")+", "+czCount(cT,"telefon","telefony","telefonů");
  const riskClass=iss.danger.length?"danger":(iss.warn.length?"warn":"ok");
  const riskText=iss.danger.length?iss.danger.join(", "):(iss.warn.length?iss.warn.join("; "):"bez zjevného nálezu");
  const riskItems=iss.danger.concat(iss.warn).slice(0,8).map(x=>'<li class="'+(iss.danger.includes(x)?'danger':'warn')+'">'+esc(x)+'</li>').join("");
  el.className="preview-summary show";
  el.innerHTML='<div class="privacy-triad">'+
    '<div class="privacy-tile"><b>Co je skryto</b>'+esc(counts)+'</div>'+ 
    '<div class="privacy-tile '+riskClass+'"><b>Co je rizikové</b>'+esc(riskText)+'</div>'+ 
    '<div class="privacy-tile"><b>Co odejde modelu</b>Pouze náhled níže po ručním potvrzení.</div>'+ 
    '</div>'+(riskItems?'<ul class="preview-risk-list" aria-label="Rizika v náhledu">'+riskItems+'</ul>':'');
}
function renderReadyBanner(p, audit){
  const el=E(p,"readyBanner"); if(!el) return;
  const clean=ST[p].clean||"";
  if(clean.trim() && audit && (audit.level==="ok" || audit.level==="warn")){
    const warn=audit.level==="warn";
    el.className="ready-banner show"+(warn?" warn":"");
    el.innerHTML='<span class="rb-icon" aria-hidden="true">'+(warn?'!':'✓')+'</span><span><b>'+(warn?'Náhled obsahuje kontrolní upozornění.':'Náhled je připraven ke kontrole.')+'</b><small>'+(warn?'Posuď označené položky, potvrď kontrolu a pokračuj jen tehdy, pokud nejde o citlivé údaje.':'Přečti ho očima a teprve potom potvrď checkbox pod náhledem.')+'</small></span>';
  } else {
    el.className="ready-banner";
    el.innerHTML="";
  }
}
function localSafeFallbackText(p){
  if(p==="in"){
    return "Dobrý den,\n\nděkuji za zprávu. Vzhledem k tomu, že jde o citlivou školní záležitost, navrhuji ji neřešit podrobně e-mailem. Domluvme si prosím osobní setkání nebo telefonický rozhovor.\n\nS pozdravem";
  }
  return "Dobrý den,\n\nobracím se na Vás kvůli citlivé školní záležitosti. Z důvodu ochrany osobních údajů nebudu podrobnosti rozepisovat e-mailem. Navrhuji domluvit osobní setkání nebo telefonický rozhovor.\n\nS pozdravem";
}
function showSafeFallback(p){
  const out=E(p,"safeFallbackOutput"); if(!out) return;
  const text=localSafeFallbackText(p);
  out.innerHTML='<div class="sf-template-label">Lokální šablona — nic se neposílá k modelu</div><pre>'+esc(text)+'</pre><div class="sf-actions"><button type="button" class="btn ghost small">Zkopírovat</button></div>';
  const btn=out.querySelector("button"); if(btn) btn.onclick=()=>copyText(text,btn);
  try{ logOp("safe_fallback","show",{pane:p}); }catch(_){}
}
function renderSafeFallback(p, audit){
  const el=E(p,"safeFallback"); if(!el) return;
  if(!audit || audit.level!=="nosend"){
    el.className="safe-fallback";
    el.innerHTML="";
    return;
  }
  const danger=preflightIssues(ST[p].clean||"",p).danger;
  const onlyTermHeuristic=danger.length>0 && danger.every(x=>/citlivé/.test(x));
  el.className="safe-fallback show";
  el.innerHTML='<div class="sf-head"><b>Další bezpečný krok bez AI:</b> můžeš si vytvořit obecnou odpověď, která neobsahuje konkrétní citlivé údaje.</div><div class="sf-note">Tlačítko níže pouze lokálně zobrazí šablonu. Nevolá Gemini, neodesílá text a nemění původní náhled.</div><div class="sf-actions"><button type="button" class="btn ghost small" data-safe-fallback="'+escAttr(p)+'"><span class="action-icon" data-ic="life"></span>Vytvořit bezpečnou obecnou verzi</button>'+(onlyTermHeuristic?'<button type="button" class="btn ghost small" data-ack-sensitive="'+escAttr(p)+'">Posoudil(a) jsem to — nejde o citlivý údaj, pokračovat</button>':'')+'</div><div class="sf-output" id="'+escAttr(p)+'_safeFallbackOutput"></div>';
  const btn=el.querySelector("[data-safe-fallback]"); if(btn) btn.onclick=()=>showSafeFallback(p);
  const ack=el.querySelector("[data-ack-sensitive]");
  if(ack) ack.onclick=()=>{
    ST[p].sensitiveAck=true;
    try{ logOp("sensitive_override","ack",{pane:p}); }catch(_){}
    toast("Pokračuješ na vlastní odpovědnost. Historie i debug zůstávají vypnuté.");
    renderPreview(p);
  };
}
function renderSafety(p){
  const el=E(p,"safety"); if(!el) return;
  let a=safetyAudit(ST[p].clean||"",p);
  if(a.level==="nosend" && ST[p]&&ST[p].sensitiveAck){
    a={level:"warn",title:"Ručně posouzeno",msg:"Termínové upozornění bylo výslovně posouzeno. Strukturální identifikátory zůstávají vždy blokované.",action:"Pokračuj jen s anonymizovaným textem a po kontrole náhledu."};
  }
  const lvl=a.level==="nosend"?"nosend":a.level==="danger"?"danger":a.level==="warn"?"warn":"ok";
  el.className="safety "+lvl;
  const sym=lvl==="ok"?"✓":lvl==="warn"?"!":"✕";
  const stopHead=lvl==="nosend"?'<span class="stop-title">STOP – nejdřív uprav náhled</span>':'';
  el.innerHTML='<span class="sicon" aria-hidden="true">'+sym+'</span><span class="sbody">'+stopHead+'<b>'+esc(a.title)+':</b> '+esc(a.msg)+'<span class="safety-action">'+esc(a.action||"")+'</span></span>';
  renderSafeFallback(p, a);
  renderReadyBanner(p, a);
  renderSafetyCounts(p);
  renderPreviewSummary(p);
}
function updateSendGate(p){
  const cb=E(p,"reviewOk"); const btn=p==="in"?$("in_analyzeBtn"):$("my_goBtn");
  if(btn && cb){ const a=safetyAudit(ST[p].clean||"",p); btn.disabled=!cb.checked || a.level==="danger" || (a.level==="nosend" && !(ST[p]&&ST[p].sensitiveAck)); }
  updateProgress(p);
}
function flashPreview(p){
  const pv=E(p,"preview"); if(!pv) return;
  pv.classList.add("preview-flash"); pv.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>pv.classList.remove("preview-flash"),900);
}
["in","my"].forEach(p=>{
  E(p,"anonBtn").onclick=()=>doAnon(p);
  E(p,"reAnon").onclick=()=>doAnon(p);
  E(p,"addRow").onclick=()=>addRow(p);
  E(p,"remember").onclick=()=>rememberNames(ST[p].km);
  E(p,"prevToggle").onclick=()=>flashPreview(p);
  E(p,"reviewOk").addEventListener("change",()=>{if(!E(p,"reviewOk").checked)ST[p].outputReady=false;updateSendGate(p);});
  E(p,"raw").addEventListener("input",()=>{
    const value=E(p,"raw").value;
    if(ST[p].raw!==value){
      ST[p].raw=value;ST[p].clean="";ST[p].km=[];ST[p].outputReady=false;ST[p].sensitiveAck=false;publishActiveKeyReals(p);
      const cb=E(p,"reviewOk");if(cb)cb.checked=false;
      const step2=E(p,"step2");if(step2)step2.style.display="none";
      const results=$(p==="in"?"in_results":"my_results");if(results)results.innerHTML="";
      updateSendGate(p);
    }else updateProgress(p);
  });
});

/* ===================== SKLÁDÁNÍ / ZNAČKY ===================== */
const VOCATIVE_EXACT={
  "dan":"Dane","daniel":"Danieli","jan":"Jane","petr":"Petře","pavel":"Pavle","karel":"Karle","marek":"Marku","jiří":"Jiří","jiri":"Jiří","ondřej":"Ondřeji","ondrej":"Ondřeji","matěj":"Matěji","matej":"Matěji","tadeáš":"Tadeáši","tadeas":"Tadeáši","lukáš":"Lukáši","lukas":"Lukáši","tomáš":"Tomáši","tomas":"Tomáši","michal":"Michale","martin":"Martine","jakub":"Jakube","filip":"Filipe","radek":"Radku","vojtěch":"Vojtěchu","vojtech":"Vojtěchu","aleš":"Aleši","ales":"Aleši","miloš":"Miloši","milos":"Miloši"
};
function preserveInitialCase(source,value){
  if(!source)return value;
  return source[0]===source[0].toLocaleUpperCase("cs-CZ")?value[0].toLocaleUpperCase("cs-CZ")+value.slice(1):value.toLocaleLowerCase("cs-CZ");
}
function czechVocativeWord(word){
  const src=String(word||"").trim(),lo=src.toLocaleLowerCase("cs-CZ"); if(!lo)return src;
  if(VOCATIVE_EXACT[lo])return preserveInitialCase(src,VOCATIVE_EXACT[lo]);
  let out=lo;
  if(/a$/.test(lo))out=lo.slice(0,-1)+"o";
  else if(/(?:š|ž|č|ř|c|j)$/.test(lo))out=lo+"i";
  else if(/(?:k|g|ch)$/.test(lo))out=lo+"u";
  else if(/(?:n|m|b|p|v|f|s|z|t|d|l|r)$/.test(lo))out=lo+"e";
  return preserveInitialCase(src,out);
}
function nameParts(real){
  const titles=/^(?:mgr|ing|bc|mudr|rndr|phdr|judr|doc|prof)\.?$/i;
  return String(real||"").replace(/[<>]/g," ").split(/\s+/).map(x=>x.replace(/^[,.;:]+|[,.;:]+$/g,"")).filter(x=>x&&!titles.test(x));
}
function salutationName(reals,lead){
  const one=(reals||[]).map(String).filter(x=>nameParts(x).length===1).sort((a,b)=>a.length-b.length)[0];
  const canonical=(reals||[]).map(String).sort((a,b)=>b.length-a.length)[0]||"";
  const parts=nameParts(one||canonical); if(!parts.length)return canonical;
  const useLast=/\b(?:pane|paní)\s*$/i.test(String(lead||""));
  return czechVocativeWord(useLast?parts[parts.length-1]:parts[0]);
}
function recompose(p, text){
  let t=String(text||"");
  const groups=new Map();
  (ST[p].km||[]).forEach(k=>{if(!k||!k.token||!k.real)return;const a=groups.get(k.token)||[];if(!a.includes(k.real))a.push(k.real);groups.set(k.token,a);});
  [...groups.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([token,reals])=>{
    const canonical=[...reals].sort((a,b)=>String(b).length-String(a).length)[0];
    if(/^osoba\b/.test(token)){
      const salRe=new RegExp("((?:Ahoj|Milý|Milá|Vážený|Vážená|Pane|Paní)\\s+)"+escRe(token)+"(?=\\s*[,!?.]|\\s|$)","gi");
      t=t.replace(salRe,(m,lead)=>lead+salutationName(reals,lead));
    }
    t=t.replace(new RegExp(escRe(token),"g"),canonical);
  });
  t=t.replace(/\[podpis\]|\[učitel\]|\(\s*učitel\s*\)/gi, signatureText());
  return t;
}
function tokenizeHTML(p, text){
  let html=esc(text);
  [...new Set(ST[p].km.map(k=>k.token).filter(Boolean))].sort((a,b)=>b.length-a.length).forEach(t=>{ html=html.replace(new RegExp(escRe(esc(t)),"g"),'<span class="token '+tokenClass(t)+'">'+esc(t)+'</span>'); });
  html=html.replace(/\[podpis\]|\[učitel\]|\(\s*učitel\s*\)/gi, m=>'<span class="token t-sign" title="Nahradí se tvým podpisem z profilu.">'+m+'</span>');
  return html;
}

