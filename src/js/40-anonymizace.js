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
  in: { km:[], emailN:0, phoneN:0, raw:"", clean:"", syn:{}, pozadavky:[], outputReady:false, sensitiveAck:false, reviewedSuggestions:{}, selectedPhrase:"" },
  my: { km:[], emailN:0, phoneN:0, raw:"", clean:"", syn:{}, outputReady:false, sensitiveAck:false, reviewedSuggestions:{}, selectedPhrase:"" },
};
const E = (p,name)=>$(p+"_"+name);
const ACTIVE_KEY_REALS={in:[],my:[]};
function publishActiveKeyReals(p){
  try{ ACTIVE_KEY_REALS[p]=(ST[p].km||[]).map(k=>k.real).filter(Boolean); window.__ACTIVE_KEY_REALS=ACTIVE_KEY_REALS[p].slice(); }catch(_){}
}


/* ===================== DOČASNÉ OBNOVENÍ ROZPRACOVANÉ PRÁCE ===================== */
const WORK_SESSION_KEY="rozbor_work_session_v2";
let workSessionTimer=null,workSessionRestoring=false;
function compactPaneForSession(p){
  const st=ST[p]||{};
  return {
    km:JSON.parse(JSON.stringify(st.km||[])),emailN:st.emailN||0,phoneN:st.phoneN||0,
    raw:String(st.raw||""),clean:String(st.clean||""),pozadavky:Array.isArray(st.pozadavky)?st.pozadavky:[],
    analysis:st.analysis||null,sensitiveAck:!!st.sensitiveAck,reviewedSuggestions:st.reviewedSuggestions||{},
    selectedPhrase:String(st.selectedPhrase||""),replySenderMode:st.replySenderMode||"",outputReady:!!st.outputReady
  };
}
function saveWorkingSessionNow(){
  if(workSessionRestoring)return;
  try{
    const rec={format:2,appVersion:(typeof RELEASE!=="undefined"?RELEASE.version:""),savedAt:Date.now(),active:typeof activePane==="function"?activePane():"in",workspace:document.body.classList.contains("workspace-open"),
      in:{state:compactPaneForSession("in"),raw:E("in","raw")?E("in","raw").value:"",review:!!(E("in","reviewOk")&&E("in","reviewOk").checked),note:$("in_note")?$("in_note").value:""},
      my:{state:compactPaneForSession("my"),raw:E("my","raw")?E("my","raw").value:"",review:!!(E("my","reviewOk")&&E("my","reviewOk").checked),note:$("my_note")?$("my_note").value:""}
    };
    const hasWork=[rec.in,rec.my].some(x=>String(x.raw||"").trim()||String(x.state.clean||"").trim());
    if(hasWork)sessionStorage.setItem(WORK_SESSION_KEY,JSON.stringify(rec));else sessionStorage.removeItem(WORK_SESSION_KEY);
  }catch(_){}
}
function scheduleWorkingSessionSave(){clearTimeout(workSessionTimer);workSessionTimer=setTimeout(saveWorkingSessionNow,180);}
function clearWorkingSession(){try{sessionStorage.removeItem(WORK_SESSION_KEY);}catch(_){};}
function restoreWorkingSession(){
  let rec=null;try{rec=JSON.parse(sessionStorage.getItem(WORK_SESSION_KEY)||"null");}catch(_){rec=null;}
  if(!rec||rec.format!==2)return false;
  workSessionRestoring=true;
  try{
    ["in","my"].forEach(p=>{
      const saved=rec[p]||{},base=ST[p],state=saved.state||{};
      ST[p]=Object.assign(base,state,{syn:base.syn||{},km:Array.isArray(state.km)?state.km:[],reviewedSuggestions:state.reviewedSuggestions||{}});
      const raw=E(p,"raw");if(raw)raw.value=String(saved.raw!=null?saved.raw:state.raw||"");ST[p].raw=raw?raw.value:String(state.raw||"");
      publishActiveKeyReals(p);clearAnalysisCache();
      renderView(p);renderKeyTable(p);renderPreview(p);
      const step=E(p,"step2");if(step)step.hidden=!String(ST[p].clean||"").trim();
    });
    if(ST.in.analysis&&typeof renderAnalysis==="function")renderAnalysis(ST.in.analysis);
    if($("in_note")&&rec.in)$("in_note").value=String(rec.in.note||"");
    if($("my_note")&&rec.my)$("my_note").value=String(rec.my.note||"");
    ["in","my"].forEach(p=>{const cb=E(p,"reviewOk");if(cb)cb.checked=!!(rec[p]&&rec[p].review)&&!cb.disabled;updateSendGate(p);renderPersonReferenceChips(p);});
    if(rec.workspace&&typeof switchTab==="function")switchTab(rec.active==="my"?"my":"in");
    return true;
  }catch(e){console.warn("Obnova rozpracované práce selhala:",e);return false;}
  finally{workSessionRestoring=false;}
}
document.addEventListener("input",scheduleWorkingSessionSave,true);
document.addEventListener("change",scheduleWorkingSessionSave,true);
window.addEventListener("beforeunload",saveWorkingSessionNow);

/* ===================== ANONYMIZACE (ťukání) ===================== */
const PUNCT_RE=/^([<>\[\]{}(),.;:!?„“”"'…»«]*)([\s\S]*?)([<>\[\]{}(),.;:!?„“”"'…»«]*)$/;
function splitPunc(w){ const m=w.match(PUNCT_RE); return m?{pre:m[1],core:m[2],post:m[3]}:{pre:"",core:w,post:""}; }

const KNOWN_PROPER_WORDS=new Set(("Petr Pavel Karel Marek Jan Jana Anna Tereza Daniel Šárka Eva Ondřej Vojtěch Zdeněk Jiří Tomáš Lukáš Michal Martin Jakub Filip Radek Ostrava Brno Praha Olomouc Opava").split(/\s+/));
const STOP=new Set(("Dobrý Dobré Dobrou Dobré Pěkný Pěkné Krásný Krásné Hezký Hezké Milý Milá Milé Vážený Vážená Vážené Vážení "+
  "Děkuji Děkujeme Děkuji Zdravím Zdraví Mává Mávám Mávejte Ahoj Nazdar Čau Nashledanou Sbohem Těším Přeji Přejeme Mějte Omlouvám Omlouváme Bohužel "+
  "Rád Ráda Také Toto Tento Tato Tyto Pokud Když Protože Jelikož Chtěl Chtěla Chtěli Mám Máme Máte Je Jsou Byl Byla Byly Bylo "+
  "Jak Co Kdy Kde Kdo Proč Můj Moje Naše Náš Vaše Váš Vás Vám Vy My Já On Ona Ano Ne Prosím Prosíme Předem Zatím Mezitím "+
  "Pondělí Úterý Středa Čtvrtek Pátek Sobota Neděle Leden Únor Březen Duben Květen Červen Červenec Srpen Září Říjen Listopad Prosinec "+
  "Škola Třída Žák Žáci Rodiče Ředitel Ředitelka Zítra Dnes Včera Můžete Můžeš Volat Potřebuji Posílám Informuji Připomínám Absence Termín Zároveň Následně Ohledně Vzhledem Nicméně "+
  "Mimochodem Podle Navíc Každopádně Přitom Proto Tedy Takže Jinak Například Konkrétně Kromě Včetně Během Kvůli Díky Místo "+
  "Na V Ve S Se K Ke Do Od U Bez Pro O Po Před Za Mezi Nad Pod Přes Při Skrz").split(/\s+/));

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
// České pádové tvary jmen a bezpečný protokol značek osob.
// Skutečné jméno zůstává lokálně. Gemini dostává [[PERSON_A]] a vrací
// [[PERSON_A|N]], kde N je požadovaný český pád 1–7.
const PERSON_CASE_WORDS={1:"osoba",2:"osoby",3:"osobě",4:"osobu",5:"osobo",6:"osobě",7:"osobou"};
const PERSON_CASE_LABELS={1:"1. pád – kdo/co",2:"2. pád – bez koho/čeho",3:"3. pád – ke komu/čemu",4:"4. pád – koho/co",5:"5. pád – oslovení",6:"6. pád – o kom/čem",7:"7. pád – s kým/čím"};
const CZ_SUFFIXES=["níkovi","níkem","níka","ovou","ákovi","ákem","áka","ičkou","ičce","ičku","ičky","čkou","čce","čku","čka","ovi","ové","ova","em","ou","ě","e","i","í","y","a","u"].sort((a,b)=>b.length-a.length);
const CZ_FEMALE_PALATAL={"k":"c","h":"z","g":"z"};
function femaleDative(stem){
  if(stem.endsWith("ch")) return stem.slice(0,-2)+"še";
  const last=stem.slice(-1), rep=CZ_FEMALE_PALATAL[last];
  return rep?stem.slice(0,-1)+rep+"e":stem+"ě";
}
function preserveWholeCase(source,value){
  const src=String(source||""),v=String(value||"");
  if(!src||!v)return v;
  if(src===src.toLocaleUpperCase("cs-CZ"))return v.toLocaleUpperCase("cs-CZ");
  if(src[0]===src[0].toLocaleUpperCase("cs-CZ"))return v[0].toLocaleUpperCase("cs-CZ")+v.slice(1);
  return v.toLocaleLowerCase("cs-CZ");
}
function declineNameWord(word){
  const src=String(word||"").trim(),lo=src.toLocaleLowerCase("cs-CZ");
  const same=()=>({1:src,2:src,3:src,4:src,5:src,6:src,7:src,confidence:"low"});
  if(!lo||lo.length<2)return same();
  const make=(o,confidence="medium")=>{const out={confidence};for(let i=1;i<=7;i++)out[i]=preserveWholeCase(src,o[i]||o[1]||src);return out;};
  if(/^(?:mgr|ing|bc|mudr|rndr|phdr|judr|doc|prof)\.?$/i.test(lo))return same();
  if(/ová$/.test(lo)){
    const st=lo.slice(0,-1);return make({1:lo,2:st+"é",3:st+"é",4:st+"ou",5:lo,6:st+"é",7:st+"ou"},"high");
  }
  if(/ia$/.test(lo)){
    const st=lo.slice(0,-1);return make({1:lo,2:st+"e",3:st+"i",4:st+"i",5:st+"e",6:st+"i",7:st+"í"},"high");
  }
  if(/ie$/.test(lo)){
    const st=lo.slice(0,-1);return make({1:lo,2:lo,3:st+"i",4:st+"i",5:lo,6:st+"i",7:st+"í"},"high");
  }
  if(/a$/.test(lo)){
    const st=lo.slice(0,-1),dat=femaleDative(st);return make({1:lo,2:st+"y",3:dat,4:st+"u",5:st+"o",6:dat,7:st+"ou"},"high");
  }
  if(/ý$/.test(lo)){
    const st=lo.slice(0,-1);return make({1:lo,2:st+"ého",3:st+"ému",4:st+"ého",5:lo,6:st+"ém",7:st+"ým"},"high");
  }
  if(/[eě]k$/.test(lo)&&lo.length>=4){
    const prefix=lo.slice(0,-2),st=/ěk$/.test(lo)?(prefix.replace(/n$/,"ň")+"k"):(prefix+"k");
    return make({1:lo,2:st+"a",3:st+"ovi",4:st+"a",5:st+"u",6:st+"ovi",7:st+"em"},"high");
  }
  if(/ec$/.test(lo)&&lo.length>=4){
    const st=lo.slice(0,-2)+"c";return make({1:lo,2:st+"e",3:st+"ovi",4:st+"e",5:st+"i",6:st+"ovi",7:st+"em"},"high");
  }
  if(/el$/.test(lo)&&lo.length>=4){
    const st=lo.slice(0,-2)+"l";return make({1:lo,2:st+"a",3:st+"ovi",4:st+"a",5:st+"e",6:st+"ovi",7:st+"em"},"medium");
  }
  if(/[eéiíy]$/.test(lo))return same();
  if(/[bcčdďfghjklmnňpqrřsštťvwxzž]$/.test(lo)){
    const gen=lo+(/[šžčřcj]$/.test(lo)?"e":"a"),voc=lo.endsWith("r")?lo.slice(0,-1)+"ře":(/(?:ch|[kgh])$/.test(lo)?lo+"u":(/[šžčřcj]$/.test(lo)?lo+"i":lo+"e"));
    return make({1:lo,2:gen,3:lo+"ovi",4:gen,5:voc,6:lo+"ovi",7:lo+"em"},"medium");
  }
  return same();
}
function generatedPersonForms(real){
  const parts=String(real||"").replace(/[<>]/g," ").trim().split(/\s+/).filter(Boolean);
  const wordForms=parts.map(declineNameWord),out={confidence:wordForms.every(x=>x.confidence==="high")?"high":wordForms.some(x=>x.confidence==="low")?"low":"medium"};
  for(let c=1;c<=7;c++)out[c]=wordForms.map(x=>x[c]).join(" ");
  return out;
}
const PERSON_CASE_PREPOSITIONS={
  2:new Set(["bez","během","dle","do","kolem","kromě","místo","od","podle","u","vedle","včetně","z","ze"]),
  3:new Set(["k","ke","kvůli","naproti","oproti","proti","vůči"]),
  4:new Set(["pro","přes","skrze"]),
  6:new Set(["o"]),
  7:new Set(["s","se","mezi","nad","pod","před","za"])
};
function nameCaseFromContext(raw,phrase){
  const parsed=wordObjs(raw||""),parts=coreWords(phrase).map(x=>x.toLocaleLowerCase("cs-CZ"));
  if(!parts.length)return 1;
  for(let i=0;i<=parsed.words.length-parts.length;i++){
    let ok=true;for(let k=0;k<parts.length;k++)if(parsed.words[i+k].coreL!==parts[k]){ok=false;break;}
    if(!ok)continue;
    const prev=i>0?parsed.words[i-1].coreL:"";
    for(const [c,set] of Object.entries(PERSON_CASE_PREPOSITIONS))if(set.has(prev))return +c;
    return 1;
  }
  return 1;
}
function reverseNameCandidates(word,caseNo){
  const src=String(word||"").trim(),lo=src.toLocaleLowerCase("cs-CZ"),cands=[];
  const add=x=>{x=String(x||"").trim();if(x.length>=2&&!cands.includes(x))cands.push(x);};
  if(/ovou$/.test(lo))add(lo.slice(0,-4)+"ová");
  if(/ové$/.test(lo))add(lo.slice(0,-3)+"ová");
  if(/ou$/.test(lo))add(lo.slice(0,-2)+"a");
  if(/ovi$/.test(lo))add(lo.slice(0,-3));
  if(/em$/.test(lo)){const st=lo.slice(0,-2);add(st);add(st+"ek");add(st+"ec");}
  if(/y$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/u$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/o$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/í$/.test(lo)){add(lo.slice(0,-1)+"ie");add(lo.slice(0,-1)+"ia");}
  if(/ě$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/e$/.test(lo)){const st=lo.slice(0,-1);add(st+"a");add(st);add(st+"ec");add(st+"el");}
  if(/a$/.test(lo)){const st=lo.slice(0,-1);add(st);add(st+"el");add(st+"ek");add(st+"ec");}
  add(lo);
  return cands.filter(c=>normName(declineNameWord(c)[caseNo])===normName(lo)).map(c=>preserveWholeCase(src,c));
}
function canonicalizePersonPhrase(raw,phrase){
  const observed=String(phrase||"").replace(/\s+/g," ").trim(),parts=coreWords(observed);
  if(!observed||!parts.length)return {real:observed,observed,caseNo:1,changed:false,confidence:"low"};
  let caseNo=nameCaseFromContext(raw,observed);
  if(caseNo===1 && parts.some(w=>/(?:ovou|ové|ovi|em|ou|y|ě)$/i.test(w))){
    const inferred=[3,6,7,2,4,5].find(c=>{
      const rows=parts.map(w=>reverseNameCandidates(w,c));
      return rows.every(x=>x.length)&&rows.some((x,i)=>normName(x[0])!==normName(parts[i]));
    });
    if(inferred)caseNo=inferred;
  }
  if(caseNo===1)return {real:observed,observed,caseNo,changed:false,confidence:"high"};
  const bases=parts.map(w=>reverseNameCandidates(w,caseNo)[0]||w),changed=bases.some((x,i)=>normName(x)!==normName(parts[i]));
  if(!changed)return {real:observed,observed,caseNo,changed:false,confidence:"low"};
  const real=bases.join(" ");
  return {real,observed,caseNo,changed:true,confidence:generatedPersonForms(real).confidence};
}
function personFormsForEntry(entry){
  const generated=generatedPersonForms(entry&&entry.real||"");
  const custom=entry&&entry.forms&&typeof entry.forms==="object"?entry.forms:{};
  for(let c=1;c<=7;c++)if(String(custom[c]||"").trim())generated[c]=String(custom[c]).trim();
  return generated;
}
function czechCaseForms(name){
  const f=declineNameWord(name),out=new Set();for(let c=1;c<=7;c++)if(f[c])out.add(String(f[c]).toLocaleLowerCase("cs-CZ"));return out;
}
function addReverseNameBase(variants,lo,base){
  if(!base||base.length<3)return;
  const forms=czechCaseForms(base);if(forms.has(lo))forms.forEach(v=>variants.add(v));
}
function nameVariants(real){
  const lo=String(real||"").toLocaleLowerCase("cs-CZ"),variants=czechCaseForms(lo);
  CZ_SUFFIXES.forEach(suf=>{if(lo.endsWith(suf)&&lo.length-suf.length>=3){const base=lo.slice(0,lo.length-suf.length);czechCaseForms(base).forEach(v=>variants.add(v));}});
  [["ovi",3],["em",2],["a",1],["u",1]].forEach(([suf,n])=>{if(!lo.endsWith(suf))return;const st=lo.slice(0,-n);if(st.endsWith("k")){let base=st.slice(0,-1)+"ek";if(st.endsWith("ňk"))base=st.slice(0,-2)+"něk";addReverseNameBase(variants,lo,base);}});
  [["ovi",3],["em",2],["e",1],["i",1]].forEach(([suf,n])=>{if(!lo.endsWith(suf))return;const st=lo.slice(0,-n);if(st.endsWith("c"))addReverseNameBase(variants,lo,st.slice(0,-1)+"ec");});
  return [...variants].filter(v=>v.length>=2);
}
function nameMatchWord(variants,coreL){return variants.has(coreL);}
function parsePersonToken(token){const m=String(token||"").match(/^osoba\s+([A-Z]+)$/);return m?m[1]:"";}
function personTokenForCase(token,caseNo){const label=parsePersonToken(token);return label?(PERSON_CASE_WORDS[+caseNo]||PERSON_CASE_WORDS[1])+" "+label:token;}
function modelPersonToken(token,caseNo){const label=parsePersonToken(token);return label?"[[PERSON_"+label+(caseNo?("|"+caseNo):"")+"]]":token;}
function toModelPersonTokens(p,text){
  if(text===undefined){text=p;p="";}
  return String(text||"").replace(/\b(osoba|osoby|osobě|osobu|osobo|osobou)\s+([A-Z]+)\b/g,(m,_word,label)=>"[[PERSON_"+label+"]]");
}
function fromModelPersonTokens(text){
  return String(text||"").replace(/\[\[PERSON_([A-Z]+)(?:\|([1-7]))?\]\]/g,(m,label,c)=>personTokenForCase("osoba "+label,+(c||1)));
}
const _isUpper=c=>!!c&&c!==c.toLowerCase()&&c===c.toUpperCase();
function buildMatchers(km){
  const out=[];
  km.filter(k=>k.real&&k.token).forEach(k=>{
    const values=[k.real].concat(Array.isArray(k.aliases)?k.aliases:[]).filter(Boolean),isPerson=/^osoba\b/.test(k.token);
    [...new Set(values.map(v=>String(v).trim()).filter(Boolean))].forEach(value=>{
      const words=value.split(/\s+/).map(w=>splitPunc(w).core).filter(Boolean);
      out.push({token:k.token,isPerson,n:words.length,entry:k,words:words.map(w=>({lo:w.toLocaleLowerCase("cs-CZ"),origLen:w.length,variants:isPerson?new Set(nameVariants(w)):null})),weight:words.reduce((sum,w)=>sum+w.length,0)});
    });
  });
  return out.filter(m=>m.n>0).sort((a,b)=>(b.n-a.n)||(b.weight-a.weight));
}
function wordObjs(text){
  const segs=String(text).split(/(\s+)/),words=[];
  segs.forEach((seg,pi)=>{if(pi%2===0&&seg!==""){const sp=splitPunc(seg);words.push({pi,pre:sp.pre,core:sp.core,post:sp.post,coreL:sp.core.toLocaleLowerCase("cs-CZ"),cap:_isUpper(sp.core[0])});}});
  return {segs,words};
}
// Pro každé slovo vrátí null (ponech), {token,n} (začátek značky) nebo "SKIP" (uvnitř značky).
function matchWordArray(matchers,words){
  const wtok=new Array(words.length).fill(null);let wi=0;
  while(wi<words.length){
    let selected=null;
    for(const exactOnly of [true,false]){
      for(const m of matchers){
        if(wi+m.n>words.length)continue;let ok=true;
        for(let k=0;k<m.n;k++){const w=words[wi+k],mw=m.words[k],exact=w.coreL===mw.lo,shortFeminineCollision=m.isPerson&&w.cap&&mw.lo.length<=3&&w.coreL===mw.lo+"a",good=exactOnly?exact:(m.isPerson&&!shortFeminineCollision?nameMatchWord(mw.variants,w.coreL):exact);if(!good){ok=false;break;}}
        if(ok){selected=m;break;}
      }
      if(selected)break;
    }
    if(selected){wtok[wi]={token:selected.token,n:selected.n,entry:selected.entry};for(let k=1;k<selected.n;k++)wtok[wi+k]="SKIP";wi+=selected.n;}else wi++;
  }
  return wtok;
}
// Nahrazuje po celých slovech. Ve vstupu pro Gemini se pád záměrně zahodí:
// model dostane neutrální [[PERSON_A]] a ve výstupu určí potřebný pád sám.
// Při bezpečnostním čištění hotového výstupu lze naopak povrchový pád zachovat,
// aby případný únik „Cecilii“ po lokálním návratu nezměnil tvar na „Cecilia“.
function matchedPersonCase(entry,words,start,count){
  if(!entry||!/^osoba\b/.test(entry.token||""))return 1;
  const observed=normName(words.slice(start,start+count).map(w=>w.core).join(" "));
  const forms=personFormsForEntry(entry);
  for(let c=1;c<=7;c++)if(normName(forms[c])===observed)return c;
  return 1;
}
function applyKeyToText(p,text,preservePersonCase){
  if(!text)return text||"";
  const {segs,words}=wordObjs(text),wtok=matchWordArray(buildMatchers(ST[p].km.filter(k=>k.real&&k.token)),words);
  let out="",widx=-1;
  for(let pi=0;pi<segs.length;pi++){
    const seg=segs[pi];
    if(pi%2===0){
      if(seg==="")continue;widx++;const t=wtok[widx];
      if(t==="SKIP"){}
      else if(t){
        const last=words[widx+t.n-1],token=preservePersonCase&&/^osoba\b/.test(t.token||"")?personTokenForCase(t.token,matchedPersonCase(t.entry,words,widx,t.n)):t.token;
        out+=words[widx].pre+token+(last?last.post:"");
      }else out+=seg;
    }else {if(wtok[widx+1]!=="SKIP")out+=seg;}
  }
  return out;
}
function cleanFromKey(p){ return applyKeyToText(p, ST[p].raw); }

/* ---- pomocníci pro interaktivní náhled (#3, #4, #6) ---- */
const NAME_CAND_STOP=new Set(["Od","Komu","Kopie","Skrytá","Předmět","Re","Fw","Fwd","Dobrý","Dobrá","Dobré","Milá","Milý","Vážená","Vážený","Vážení","Pane","Paní","Slečno","Prosím","Děkuji","Děkuju","Dobry","Kontakt","Telefon","Tel","Zdravím","Zdraví","Mává","Mávám","Mávejte","Ahoj","Pozdravem","Srdečně","Tématem","Téma","Mimochodem","Podle","Navíc","Každopádně","Přitom","Proto","Tedy","Takže","Jinak","Například","Konkrétně","Kromě","Včetně","Během","Kvůli","Díky","Místo","Na","V","Ve","S","Se","K","Ke","Do","U","Bez","Pro","O","Po","Před","Za","Mezi","Nad","Pod","Přes","Při","Skrz"]);
const NAME_TITLES=new Set(["mgr","ing","bc","mudr","rndr","phdr","judr","doc","prof"]);
function isNameCandidate(core){
  if(!/^\p{L}+$/u.test(core)) return false;
  if(!/^\p{Lu}\p{Ll}{2,}$/u.test(core)) return false;
  if((typeof STOP!=="undefined" && STOP.has && STOP.has(core)) || NAME_CAND_STOP.has(core)) return false;
  return true;
}
function isNameInitial(w){ return !!w && /^\p{Lu}$/u.test(w.core||"") && /\./.test(w.post||""); }
function isLooseNameInitial(w){ return !!w && /^\p{Lu}$/u.test(w.core||""); }
function isNameTitle(w){ return !!w && NAME_TITLES.has(String(w.core||"").toLocaleLowerCase("cs-CZ")) && /\.?/.test(w.post||""); }
function isNamePart(w){ return !!w && (isNameCandidate(w.core)||isNameInitial(w)||isNameTitle(w)); }
function mayJoinNameWords(left,right){
  if(!left||!right) return false;
  const leftPart=isNamePart(left)||isLooseNameInitial(left), rightPart=isNamePart(right)||isLooseNameInitial(right);
  if(!leftPart||!rightPart) return false;
  // Iniciála bez tečky se připojí jen k plnohodnotné části jména, ne k jiné samotné iniciále.
  if(isLooseNameInitial(left)&&!isNameInitial(left)&&!isNameCandidate(right.core)) return false;
  if(isLooseNameInitial(right)&&!isNameInitial(right)&&!isNameCandidate(left.core)) return false;
  if(/[!?;:]/.test(left.post||"")) return false;
  if(/\./.test(left.post||"") && !isNameInitial(left) && !isNameTitle(left)) return false;
  return true;
}
function selectionIsMulti(){ try{ const s=String(window.getSelection()||"").trim(); return s.length>0 && /\s/.test(s); }catch(_){ return false; } }
function clickedNameRange(words,index){
  const current=words[index];
  if(!current||(!isNamePart(current)&&!isLooseNameInitial(current))) return {start:index,end:index,phrase:current&&current.core||""};
  let start=index,end=index;
  if((isNameInitial(current)||isLooseNameInitial(current)) && mayJoinNameWords(words[index-1],current)) start=index-1;
  else if(isNameCandidate(current.core) && isNameTitle(words[index-1]) && mayJoinNameWords(words[index-1],current)) start=index-1;
  else if(isNameCandidate(current.core) && isNameCandidate(words[index-1]&&words[index-1].core) && mayJoinNameWords(words[index-1],current)) start=index-1;
  while(start>0 && isNameTitle(words[start-1]) && mayJoinNameWords(words[start-1],words[start])) start--;
  while(end+1<words.length && end-start<2 && mayJoinNameWords(words[end],words[end+1])){
    const next=words[end+1];
    if(isNameTitle(next)) break;
    end++;
  }
  const parts=words.slice(start,end+1).map(w=>w.core).filter(Boolean);
  return {start,end,phrase:parts.join(" ")};
}
function clickedNamePhrase(words,index){ return clickedNameRange(words,index).phrase; }
function suggestionKey(phrase){ return String(phrase||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("cs-CZ"); }
const ANALYSIS_CACHE={suggestion:new Map(),preflight:new Map()};
function analysisCacheKey(p,text){ const st=ST[p]||{}; return p+"|"+String(text||"")+"|"+JSON.stringify(st.km||[])+"|"+JSON.stringify(st.reviewedSuggestions||{}); }
function clearAnalysisCache(){ ANALYSIS_CACHE.suggestion.clear(); ANALYSIS_CACHE.preflight.clear(); }
function wordStartsSentence(parsed,w){
  if(!w)return false; const prefix=parsed.segs.slice(0,w.pi).join("");
  return !prefix.trim() || /(?:[.!?][\s\u00a0]*|\n[\s\u00a0]*)$/u.test(prefix);
}
function suggestionData(p){
  const cacheKey=analysisCacheKey(p,ST[p]&&ST[p].raw); if(ANALYSIS_CACHE.suggestion.has(cacheKey)) return ANALYSIS_CACHE.suggestion.get(cacheKey);
  const st=ST[p], parsed=wordObjs(st.raw||""), words=parsed.words;
  const wtok=matchWordArray(buildMatchers((st.km||[]).filter(k=>k.real&&k.token)),words);
  const suggestions=[], byWord=new Map(), seen=new Set();
  words.forEach((w,i)=>{
    if(wtok[i] || !isNamePart(w)) return;
    const r=clickedNameRange(words,i), phrase=String(r.phrase||"").trim(), key=suggestionKey(phrase);
    if(!phrase||phrase.length<2||seen.has(key)||(st.reviewedSuggestions&&st.reviewedSuggestions[key]==="keep")) return;
    if(r.start<0||r.end>=words.length) return;
    // Jednoslovné výrazy na začátku věty jsou velmi často běžná slova, ne jména.
    if(r.start===r.end && wordStartsSentence(parsed,words[r.start]) && !KNOWN_PROPER_WORDS.has(words[r.start].core)) return;
    for(let x=r.start;x<=r.end;x++) if(wtok[x]) return;
    seen.add(key);
    const item={phrase,key,start:r.start,end:r.end}; suggestions.push(item);
    for(let x=r.start;x<=r.end;x++) byWord.set(x,item);
  });
  const result={suggestions,byWord,words,wtok,segs:parsed.segs}; ANALYSIS_CACHE.suggestion.set(cacheKey,result); return result;
}
function categoryToken(st,kind){
  const bases={institution:"instituce",place:"místo",title:"název",contact:"kontakt",sensitive:"citlivý údaj"};
  const base=bases[kind]||"citlivý údaj";
  let max=0;
  (st.km||[]).forEach(k=>{const m=String(k.token||"").match(new RegExp("^\\["+base+"\\s+(\\d+)\\]$"));if(m)max=Math.max(max,+m[1]||0);});
  return "["+base+" "+(max+1)+"]";
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
function coreWords(value){ return String(value||"").trim().split(/\s+/).map(x=>splitPunc(x).core).filter(Boolean); }
function exactWordSequenceAt(words,start,parts){
  if(start<0||start+parts.length>words.length) return false;
  return parts.every((part,i)=>String(words[start+i].core||"").toLocaleLowerCase("cs-CZ")===String(part).toLocaleLowerCase("cs-CZ"));
}
function validMergedNameRange(words,start,end){
  const count=end-start+1; if(count<2||count>3) return false;
  const slice=words.slice(start,end+1);
  if(count===3 && !(isNameTitle(slice[0])||isLooseNameInitial(slice[count-1]))) return false;
  for(let i=0;i<slice.length-1;i++) if(!mayJoinNameWords(slice[i],slice[i+1])) return false;
  return true;
}
function adjacentPersonMerge(st, cleaned){
  const parsed=wordObjs(st.raw||""), words=parsed.words, added=coreWords(cleaned);
  if(!added.length) return null;
  const people=(st.km||[]).filter(k=>k&&k.real&&/^osoba\b/.test(k.token||"")).sort((a,b)=>coreWords(b.real).length-coreWords(a.real).length);
  for(const entry of people){
    const known=coreWords(entry.real); if(!known.length) continue;
    for(let ki=0;ki<=words.length-known.length;ki++){
      if(!exactWordSequenceAt(words,ki,known)) continue;
      for(let ai=0;ai<=words.length-added.length;ai++){
        if(!exactWordSequenceAt(words,ai,added)) continue;
        const knownEnd=ki+known.length-1, addedEnd=ai+added.length-1;
        if(!(knownEnd+1===ai || addedEnd+1===ki)) continue;
        const start=Math.min(ki,ai),end=Math.max(knownEnd,addedEnd);
        if(!validMergedNameRange(words,start,end)) continue;
        return {entry,phrase:words.slice(start,end+1).map(w=>w.core).join(" ")};
      }
    }
  }
  return null;
}
function addPhraseAs(p, phrase, kind){
  const st=ST[p]; const cleaned=String(phrase).replace(/\s+/g," ").trim().replace(/^[<>\[\]{}(),.;:!?„“”"'…»«\s]+|[<>\[\]{}(),.;:!?„“”"'…»«\s]+$/g,"");
  if(!cleaned || cleaned.length<1) return;
  let normalized={real:cleaned,observed:cleaned,caseNo:1,changed:false};
  if(kind==="person")normalized=canonicalizePersonPhrase(st.raw,cleaned);
  const storedReal=normalized.real||cleaned;
  const duplicate=st.km.some(k=>[k.real].concat(Array.isArray(k.aliases)?k.aliases:[]).some(v=>normName(v)===normName(cleaned)||normName(v)===normName(storedReal)));
  if(duplicate) return;
  let token="", related="";
  if(["institution","place","title","contact","sensitive"].includes(kind)) token=categoryToken(st,kind);
  else {
    const merged=adjacentPersonMerge(st,cleaned);
    if(merged){
      const previous=merged.entry.real,base=canonicalizePersonPhrase(st.raw,merged.phrase);
      merged.entry.real=base.real||merged.phrase; merged.entry.auto=false;
      const aliases=new Set([].concat(merged.entry.aliases||[],base.changed?[merged.phrase]:[]).filter(Boolean)); merged.entry.aliases=[...aliases];
      if(st.reviewedSuggestions){ delete st.reviewedSuggestions[suggestionKey(previous)]; delete st.reviewedSuggestions[suggestionKey(cleaned)]; delete st.reviewedSuggestions[suggestionKey(merged.phrase)]; }
      afterKeyChange(p); toast(base.changed?"Jméno bylo sloučeno a uloženo v základním tvaru „"+merged.entry.real+"“.":"Sousední části jména byly sloučeny do "+merged.entry.token+"."); return;
    }
    related=tokenForRelatedPerson(st,storedReal)||tokenForRelatedPerson(st,cleaned); token=related||nextPersonToken(st.km);
  }
  const entry={real:storedReal,token,auto:false};
  if(normalized.changed)entry.aliases=[cleaned];
  st.km.push(entry);
  if(st.reviewedSuggestions) delete st.reviewedSuggestions[suggestionKey(cleaned)];
  afterKeyChange(p);
  if(related) toast("Přidáno ke stejné osobě ("+token+").");
  else if(normalized.changed) toast("Jméno bylo uloženo v základním tvaru „"+storedReal+"“. Označený pád zůstává rozpoznatelný.");
}
function addPhrase(p, phrase){ addPhraseAs(p,phrase,"person"); }
function keepSuggestion(p,phrase){
  const st=ST[p]; st.reviewedSuggestions=st.reviewedSuggestions||{}; st.reviewedSuggestions[suggestionKey(phrase)]="keep";
  resetReview(p); renderView(p); renderPreview(p); toast("Výraz ponechán beze změny. Přesto ještě pročti celý text.");
}
function keepSuggestionRows(p,rows){
  const st=ST[p], list=(rows||suggestionData(p).suggestions).filter(x=>x&&x.phrase);
  if(!list.length) return 0;
  st.reviewedSuggestions=st.reviewedSuggestions||{};
  list.forEach(x=>{ st.reviewedSuggestions[suggestionKey(x.phrase)]="keep"; });
  st.selectedPhrase="";
  resetReview(p); renderView(p); renderPreview(p);
  return list.length;
}
function keepAllSuggestions(p,rows){
  const list=(rows||suggestionData(p).suggestions).filter(x=>x&&x.phrase);
  if(!list.length) return;
  const apply=()=>{ const count=keepSuggestionRows(p,list); toast("Ponecháno "+count+" výrazů. Celý text ještě jednou pročti."); };
  if(typeof confirmActionModal==="function") confirmActionModal({
    title:"Ponechat všechny zbývající výrazy?",
    message:"Označených výrazů je "+list.length+". Použij tuto volbu až po přečtení seznamu a pouze tehdy, když mezi nimi není skutečné jméno, instituce, místo ani jiný identifikující údaj.",
    confirmText:"Ponechat všechny",
    onConfirm:apply
  }); else apply();
}
function suggestionActionButtons(p,phrase){
  return '<div class="suggestion-actions" data-phrase="'+escAttr(phrase)+'">'+
    '<button type="button" class="suggestion-action person" data-suggest-kind="person">Osoba</button>'+
    '<button type="button" class="suggestion-action institution" data-suggest-kind="institution">Instituce / organizace</button>'+
    '<button type="button" class="suggestion-action place" data-suggest-kind="place">Místo</button>'+
    '<button type="button" class="suggestion-action title" data-suggest-kind="title">Název / dílo</button>'+
    '<button type="button" class="suggestion-action contact" data-suggest-kind="contact">Kontakt</button>'+
    '<button type="button" class="suggestion-action sensitive" data-suggest-kind="sensitive">Jiný citlivý údaj</button>'+
    '<button type="button" class="suggestion-action keep" data-suggest-kind="keep">Ponechat</button></div>';
}
function clearSelectedPhrase(p){ if(ST[p]) ST[p].selectedPhrase=""; }
function selectPhraseForReview(p,phrase,scrollOnMobile){
  const clean=String(phrase||"").replace(/\s+/g," ").trim(); if(!clean)return;
  ST[p].selectedPhrase=clean;
  renderView(p);
  const panel=E(p,"suggestionPanel");
  if(panel && scrollOnMobile && window.matchMedia && window.matchMedia("(max-width: 820px)").matches) panel.scrollIntoView({behavior:"smooth",block:"end"});
}
function wireSuggestionActions(root,p,close){
  if(!root)return;
  root.querySelectorAll("[data-suggest-kind]").forEach(btn=>btn.onclick=()=>{
    const wrap=btn.closest("[data-phrase]"),phrase=wrap&&wrap.dataset.phrase||"",kind=btn.dataset.suggestKind;
    clearSelectedPhrase(p);
    if(kind==="keep")keepSuggestion(p,phrase);else addPhraseAs(p,phrase,kind);
    if(close)close();
  });
  root.querySelectorAll("[data-select-phrase]").forEach(btn=>btn.onclick=()=>selectPhraseForReview(p,btn.dataset.selectPhrase||"",true));
  const closeBtn=root.querySelector("[data-close-selection]"); if(closeBtn) closeBtn.onclick=()=>{clearSelectedPhrase(p);renderSuggestionPanel(p);};
}

function renderSuggestionPanel(p,suggestions){
  const panel=E(p,"suggestionPanel"); if(!panel)return;
  const rows=suggestions||suggestionData(p).suggestions;
  const selected=String(ST[p].selectedPhrase||"").trim();
  const selectedCard=selected?('<section class="selected-suggestion" aria-label="Zvolený výraz"><div class="selected-suggestion-head"><span><small>Vybraný výraz</small><b>„'+esc(selected)+'“</b></span><button type="button" class="selection-close" data-close-selection aria-label="Zavřít výběr">×</button></div><p>Jak se má výraz anonymizovat?</p>'+suggestionActionButtons(p,selected)+'</section>'):'';
  if(!rows.length){
    panel.className="suggestion-panel resolved"+(selected?" has-selection":"");
    panel.innerHTML=selectedCard+'<div class="suggestion-panel-head"><span class="suggestion-count">✓</span><span><b>Všechny návrhy vyřešeny</b><small>Ještě pročti celý text očima. Kliknutím na libovolné slovo můžeš přidat další náhradu.</small></span></div>';
  }else{
    panel.className="suggestion-panel has-items"+(selected?" has-selection":"");
    panel.innerHTML=selectedCard+'<div class="suggestion-panel-head"><span class="suggestion-count">'+rows.length+'</span><span><b>Výrazy ke kontrole</b><small>Klikni na výraz v e-mailu nebo v seznamu. Kategorie se vždy zobrazí nahoře v tomto panelu.</small></span></div>'+
      '<div class="suggestion-bulk"><button type="button" class="btn ghost small" data-keep-all-suggestions>Ponechat všechny zbývající</button><small>Potvrdíš, že v seznamu není nic citlivého.</small></div>'+
      '<div class="suggestion-list">'+rows.map(x=>'<article class="suggestion-item'+(suggestionKey(selected)===x.key?' active':'')+'"><strong>'+esc(x.phrase)+'</strong><button type="button" class="btn ghost small" data-select-phrase="'+escAttr(x.phrase)+'">Vybrat</button></article>').join("")+'</div>';
    const keepAll=panel.querySelector("[data-keep-all-suggestions]"); if(keepAll) keepAll.onclick=()=>keepAllSuggestions(p,rows);
  }
  wireSuggestionActions(panel,p);
}
function showTapHide(p, phrase, rect){
  if(!tapPopEl){ tapPopEl=document.createElement("div"); tapPopEl.id="tapPop"; document.body.appendChild(tapPopEl); }
  tapPopEl.innerHTML='<b class="tap-pop-title">Jak naložit s „'+esc(phrase)+'“?</b>'+suggestionActionButtons(p,phrase);
  tapPopEl.style.display="block";
  const w=tapPopEl.offsetWidth||360;
  tapPopEl.style.left=Math.max(8, Math.min(window.scrollX+rect.left, window.scrollX+window.innerWidth-w-12))+"px";
  tapPopEl.style.top=(window.scrollY+rect.bottom+6)+"px";
  paintIcons(tapPopEl); wireSuggestionActions(tapPopEl,p,hideTapPop);
  tapPopEl.querySelectorAll("button").forEach(b=>b.onmousedown=(e)=>e.preventDefault());
}
function wireTapSelection(p){
  const view=E(p,"view"); if(!view||view.dataset.selWired) return; view.dataset.selWired="1";
  const handler=()=>setTimeout(()=>{
    const sel=window.getSelection(); if(!sel||!sel.rangeCount){ return; }
    const txt=sel.toString().trim();
    if(!txt || !/\s/.test(txt)){ hideTapPop(); return; }
    if(!view.contains(sel.anchorNode) || !view.contains(sel.focusNode)){ hideTapPop(); return; }
    selectPhraseForReview(p, txt, true);
  },10);
  view.addEventListener("mouseup",handler); view.addEventListener("touchend",handler);
}
if(typeof document!=="undefined"){ document.addEventListener("click",(e)=>{ if(tapPopEl && tapPopEl.style.display==="block" && !tapPopEl.contains(e.target) && !(e.target.closest&&e.target.closest(".tapview"))) hideTapPop(); }); }

function renderView(p){
  const el=E(p,"view"); if(!el) return; el.innerHTML="";
  wireTapSelection(p);
  if(!ST[p].raw.trim()){ el.innerHTML=EMPTY_MARK; renderSuggestionPanel(p,[]); return; }
  const data=suggestionData(p), {segs,words,wtok,byWord,suggestions}=data;
  const mkSpan=(cls,label,title,aria,act,focusable)=>{
    const span=document.createElement("span"); span.className=cls; span.textContent=label; span.title=title;
    span.tabIndex=focusable?0:-1; span.setAttribute("role","button"); span.setAttribute("aria-label",aria);
    span.onclick=(ev)=>{ if(selectionIsMulti()) return; act(ev); };
    span.addEventListener("keydown",ev=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); act(ev); } });
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
      el.appendChild(mkSpan("w hid "+tokenClass(t.token), t.token, "Ťukni a zase odkryješ", "Odkrýt "+t.token, ()=>removeByToken(p,t.token),true));
      const last=words[widx+t.n-1]; if(last && last.post) el.appendChild(document.createTextNode(last.post));
    } else {
      if(w.pre) el.appendChild(document.createTextNode(w.pre));
      const suggestion=byWord.get(widx), phrase=suggestion?suggestion.phrase:w.core;
      const selected=suggestionKey(ST[p].selectedPhrase||"")===suggestionKey(phrase);
      const cls="w"+(suggestion?" maybe suggestion-word":"")+(selected?" selected-word":"");
      const title="Vybrat „"+phrase+"“ a určit kategorii v pravém panelu";
      el.appendChild(mkSpan(cls,w.core,title,"Zkontrolovat "+phrase,()=>selectPhraseForReview(p,phrase,false),!!suggestion));
      if(w.post) el.appendChild(document.createTextNode(w.post));
    }
  }
  const focusable=[...el.querySelectorAll('.w[role="button"]')].filter(x=>x.tabIndex===0);
  if(!focusable.length){ const first=el.querySelector('.w[role="button"]'); if(first) first.tabIndex=0; }
  el.onkeydown=(ev)=>{
    if(ev.key!=="ArrowRight"&&ev.key!=="ArrowLeft")return;
    const all=[...el.querySelectorAll('.w[role="button"]')], i=all.indexOf(document.activeElement); if(i<0||!all.length)return;
    ev.preventDefault(); const next=all[(i+(ev.key==="ArrowRight"?1:-1)+all.length)%all.length];
    all.forEach(x=>x.tabIndex=-1); next.tabIndex=0; next.focus();
  };
  renderSuggestionPanel(p,suggestions);
}
function resetReview(p){ const cb=E(p,"reviewOk"); if(cb) cb.checked=false; if(ST[p])ST[p].outputReady=false; updateSendGate(p); updateProgress(p); }
function afterKeyChange(p){ publishActiveKeyReals(p); ST[p].sensitiveAck=false; ST[p].clean=cleanFromKey(p); resetReview(p); renderView(p); renderKeyTable(p); renderPreview(p); renderPersonReferenceChips(p); scheduleWorkingSessionSave(); }
function addWord(p, core){ addPhraseAs(p,core,"person"); }
function activateSensitiveMode(reason){
  setNoHistory(true);
  try{ sessionStorage.removeItem(LAST_PROMPT_SK); localStorage.removeItem(LAST_PROMPT_SK); }catch(_){}
  try{ logOp("sensitive_mode","on",{reason:reason||"sensitive_terms"}); }catch(_){}
}
function doAnon(p){
  const raw=E(p,"raw").value; if(!raw.trim()) return;
  if(hasSensitiveSchoolTerms(raw)) activateSensitiveMode("obsahuje citlivá školní témata");
  const st=ST[p]; st.raw=raw; st.emailN=0; st.phoneN=0; st.km=[]; st.sensitiveAck=false; st.reviewedSuggestions={}; st.selectedPhrase="";
  buildKey(st, autoDetect(raw));
  afterKeyChange(p);
  const kd=E(p,"keyDetails"); if(kd) kd.open=false;
  clearAnalysisCache(); E(p,"step2").hidden=false;
  E(p,"step2").scrollIntoView({behavior:"smooth",block:"start"});
  updateProgress(p);
  if(p==="my" && typeof updateMyMode==="function") updateMyMode();
}
function renderKeyTable(p){
  const st=ST[p], body=E(p,"keyBody"); body.innerHTML="";
  st.km.forEach((k,idx)=>{ const tr=document.createElement("tr");
    const uses=k.token?(String(st.clean||"").match(new RegExp(escRe(k.token),"g"))||[]).length:0;
    const person=/^osoba\b/.test(k.token||"");
    tr.innerHTML='<td><input value="'+escAttr(k.real)+'" data-i="'+idx+'" data-f="real"></td><td class="tok"><input value="'+escAttr(k.token)+'" data-i="'+idx+'" data-f="token"><small title="Počet výskytů značky v odesílaném náhledu">'+uses+'× v náhledu</small></td><td class="key-actions">'+(person?'<button class="case-row" data-cases="'+idx+'" title="Zkontrolovat nebo upravit skloňování jména">1–7</button>':'')+'<button class="del-row" data-del="'+idx+'" title="Smazat">×</button></td>';
    body.appendChild(tr); });
  renderKeySummary(p);
  E(p,"keyEmpty").style.display=st.km.length?"none":"block";
  body.querySelectorAll("input").forEach(inp=>{ let timer=null; inp.addEventListener("input",(e)=>{
    const row=st.km[+e.target.dataset.i];row[e.target.dataset.f]=e.target.value;if(e.target.dataset.f==="real")delete row.forms;clearAnalysisCache();resetReview(p);
    clearTimeout(timer);timer=setTimeout(()=>{publishActiveKeyReals(p);ST[p].clean=cleanFromKey(p);renderView(p);renderPreview(p);renderKeySummary(p);renderPersonReferenceChips(p);scheduleWorkingSessionSave();},280);
  }); });
  body.querySelectorAll("[data-cases]").forEach(b=>b.onclick=()=>openPersonFormsEditor(p,+b.dataset.cases));
  body.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{st.km.splice(+b.dataset.del,1);afterKeyChange(p);});
  renderPersonReferenceChips(p);
}
function openPersonFormsEditor(p,idx){
  const entry=ST[p]&&ST[p].km&&ST[p].km[idx];if(!entry||!/^osoba\b/.test(entry.token||""))return;
  const forms=personFormsForEntry(entry),rows=[];
  for(let c=1;c<=7;c++)rows.push('<label class="case-form-row"><span>'+esc(PERSON_CASE_LABELS[c])+'</span><input data-case="'+c+'" value="'+escAttr(forms[c]||entry.real)+'"></label>');
  openModal("Skloňování: "+entry.real,'<p class="dialog-text">Tvary zůstávají pouze v tomto prohlížeči a nikdy se neposílají Gemini. U běžných jmen jsou doplněné automaticky; neobvyklé jméno můžeš jednou opravit.</p><div class="case-form-grid">'+rows.join("")+'</div><div class="dialog-actions"><button class="btn ghost case-reset" type="button">Vrátit automatický návrh</button><button class="btn case-save" type="button">Uložit tvary</button></div>',{className:"case-editor-modal",onMount(body,close){
    body.querySelector(".case-reset").onclick=()=>{const auto=generatedPersonForms(entry.real);body.querySelectorAll("[data-case]").forEach(i=>i.value=auto[+i.dataset.case]||entry.real);};
    body.querySelector(".case-save").onclick=()=>{const custom={};body.querySelectorAll("[data-case]").forEach(i=>custom[i.dataset.case]=i.value.trim()||entry.real);entry.forms=custom;clearAnalysisCache();resetReview(p);renderKeyTable(p);scheduleWorkingSessionSave();toast("Skloňování bylo uloženo jen lokálně.");close();};
  }});
}
function insertAtCursor(input,text){
  const start=Number.isFinite(input.selectionStart)?input.selectionStart:input.value.length,end=Number.isFinite(input.selectionEnd)?input.selectionEnd:start;
  const before=input.value.slice(0,start),after=input.value.slice(end),left=before&&!/\s$/.test(before)?" ":"",right=after&&!/^\s/.test(after)?" ":"";
  input.value=before+left+text+right+after;const pos=(before+left+text).length;input.focus();try{input.setSelectionRange(pos,pos);}catch(_){}input.dispatchEvent(new Event("input",{bubbles:true}));
}
function renderPersonReferenceChips(p){
  const input=$(p==="in"?"in_note":"my_note");if(!input||!input.parentNode)return;
  const id=p+"_personRefs";let box=$(id);if(!box){box=document.createElement("div");box.id=id;box.className="person-reference-box";input.insertAdjacentElement("afterend",box);}
  const people=(ST[p].km||[]).filter(k=>k.real&&/^osoba\b/.test(k.token||""));
  if(!people.length){box.hidden=true;box.innerHTML="";return;}
  box.hidden=false;box.innerHTML='<span class="person-reference-title">Vložit bezpečně osobu:</span><div class="person-reference-chips">'+people.map((k,i)=>'<button type="button" class="person-reference-chip" data-person="'+i+'"><b>'+esc(k.token)+'</b><span>'+esc(k.real)+'</span></button>').join("")+'</div><small>Jméno vidíš jen lokálně. Do Gemini se vloží pouze anonymní značka.</small>';
  box.querySelectorAll("[data-person]").forEach((btn,i)=>btn.onclick=()=>insertAtCursor(input,people[i].token));
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
function renderPreview(p){
  renderSafety(p);
  updateSendGate(p);
}
function stripSafeTokens(text){
  return String(text||"").replace(/\[e-mail \d+\]|\[telefon \d+\]|\[rodné číslo \d+\]|\[datum narození \d+\]|\[číslo účtu \d+\]|\[instituce \d+\]|\[místo \d+\]|\[název \d+\]|\[kontakt \d+\]|\[citlivý údaj \d+\]|\b(?:osoba|osoby|osobě|osobu|osobo|osobou) [A-Z]+\b|\[\[PERSON_[A-Z]+(?:\|[1-7])?\]\]|\[podpis\]|\[učitel\]/g," ");
}
function preflightIssues(text,p){
  const cacheKey=analysisCacheKey(p,text); if(ANALYSIS_CACHE.preflight.has(cacheKey)) return ANALYSIS_CACHE.preflight.get(cacheKey);
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
    const exact=new Set();
    active.forEach(real=>String(real||"").split(/\s+/).forEach(part=>{ nameVariants(part).forEach(v=>exact.add(norm(v))); }));
    if(exact.size){
      const missed=[];
      stripped.split(/[^\p{L}]+/u).forEach(word=>{
        const n=norm(word); if(n.length<2) return;
        if(exact.has(n)&&!missed.includes(word)) missed.push(word);
      });
      if(missed.length) addD("nezakrytý tvar již skrytého jména: "+missed.slice(0,3).join(", "));
    }
  }catch(_){}
  const result={danger,warn,names}; ANALYSIS_CACHE.preflight.set(cacheKey,result); return result;
}
function normName(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("cs-CZ");}
function editDistance(a,b){
  a=normName(a);b=normName(b);const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j];}
  return prev[b.length];
}
function commonPrefixLength(a,b){a=normName(a);b=normName(b);let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i;}
function likelyKnownPersonTokens(p,word){
  const observed=normName(word);if(observed.length<2)return [];
  const hits=[];
  (ST[p].km||[]).filter(k=>k.real&&/^osoba\b/.test(k.token||"")).forEach(entry=>{
    const matched=String(entry.real).split(/\s+/).some(part=>{
      const base=normName(splitPunc(part).core);if(!base)return false;
      if(new Set(nameVariants(base).map(normName)).has(observed))return true;
      const min=Math.min(base.length,observed.length);
      return min>=6&&Math.max(base.length,observed.length)>=7&&Math.abs(base.length-observed.length)<=2&&editDistance(base,observed)<=2&&commonPrefixLength(base,observed)>=min-2;
    });
    if(matched&&!hits.includes(entry.token))hits.push(entry.token);
  });
  return hits;
}
function replaceLikelyKnownNameForms(p,text){
  const parsed=wordObjs(text),replace=new Map(),ambiguous=[];
  parsed.words.forEach((w,i)=>{
    if(!w.core||/^(?:osoba|osoby|osobě|osobu|osobo|osobou)$/i.test(w.core))return;
    const hits=likelyKnownPersonTokens(p,w.core);
    if(hits.length===1)replace.set(i,hits[0]);else if(hits.length>1)ambiguous.push(w.core);
  });
  if(!replace.size)return {text:String(text||""),replaced:0,ambiguous};
  let out="",widx=-1;for(let pi=0;pi<parsed.segs.length;pi++){const seg=parsed.segs[pi];if(pi%2===0){if(seg==="")continue;widx++;const token=replace.get(widx);out+=token?(parsed.words[widx].pre+token+parsed.words[widx].post):seg;}else out+=seg;}
  return {text:out,replaced:replace.size,ambiguous};
}
function unresolvedAuxiliaryNames(text){
  const stripped=stripSafeTokens(text),parsed=wordObjs(stripped),localStop=new Set(["Gemini","Google","Teams","Dobrý","Dobry","Vážený","Vážená","Milý","Milá","Prosím","Děkuji","Nemohu","Nemůžu","Napiš","Navrhni","Přidej","Uveď","Odpověz"]),out=[];
  parsed.words.forEach(w=>{
    if(!isNameCandidate(w.core)||localStop.has(w.core)||STOP.has(w.core)||wordStartsSentence(parsed,w))return;
    if(!out.includes(w.core))out.push(w.core);
  });
  return out;
}
function safeAuxiliaryText(p,raw,state,label){
  const original=String(raw||"").trim();if(!original)return "";
  let clean=applyKeyToText(p,original);
  const fuzzy=replaceLikelyKnownNameForms(p,clean);clean=applyKeyToText(p,fuzzy.text);
  const iss=preflightIssues(clean,p),unknown=unresolvedAuxiliaryNames(clean),findings=iss.danger.slice();
  if(fuzzy.ambiguous.length)findings.push("nejednoznačný tvar jména: "+fuzzy.ambiguous.join(", "));
  if(unknown.length)findings.push("nevyřešené možné jméno nebo vlastní název: "+unknown.join(", "));
  if(findings.length){
    const msg=(label||"Doplňující pokyn")+" obsahuje možný osobní nebo citlivý údaj („"+findings.join("; ")+"“). Vlož osobu pomocí místního štítku pod polem, použij značku osoba A/B, nebo pokyn zobecni.";
    if(state)state.innerHTML='<div class="error"><b>Pokyn nebyl odeslán.</b> '+esc(msg)+'</div>';else toast(msg);
    flashPreview(p);return null;
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
  if(iss.warn.length) return {level:"warn", title:"Heuristická kontrola", msg:"Aplikace našla možné názvy nebo jiné nejednoznačné výrazy. Samy o sobě pokračování neblokují; rozhodující je seznam návrhů v kroku 2 a tvoje ruční kontrola.", action:"Pokud nejde o citlivé údaje, vyřeš návrhy a potvrď kontrolu."};
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
  const km=ST[p].km||[], unresolved=suggestionData(p).suggestions;
  const cO=km.filter(k=>/^osoba/.test(k.token||"")).length;
  const cE=km.filter(k=>/^\[e-mail/.test(k.token||"")).length;
  const cT=km.filter(k=>/^\[telefon/.test(k.token||"")).length;
  const cOther=km.filter(k=>/^\[(instituce|místo|název|kontakt|citlivý údaj)/.test(k.token||"")).length;
  const iss=preflightIssues(clean,p), cb=E(p,"reviewOk");
  const counts=czCount(cO,"osoba","osoby","osob")+", "+czCount(cE,"e-mail","e-maily","e-mailů")+", "+czCount(cT,"telefon","telefony","telefonů")+(cOther?", "+czCount(cOther,"další údaj","další údaje","dalších údajů"):"");
  const step2ok=unresolved.length===0;
  const step3ok=!!(cb&&cb.checked);
  const danger=iss.danger.length>0;
  el.className="preview-summary show review-steps";
  el.innerHTML='<div class="review-step done"><span class="review-step-no">1</span><span><b>Citlivé údaje skryty</b><small><span class="review-meta-label">Co je skryto:</span> '+esc(counts)+'.</small></span><span class="review-state">Hotovo</span></div>'+
    '<div class="review-step '+(step2ok?'done':'action')+'"><span class="review-step-no">2</span><span><b>Návrhy k posouzení</b><small>'+(step2ok?'Všechny návrhy jsou vyřešené.':'Zbývá rozhodnout o '+czCount(unresolved.length,'výrazu','výrazech','výrazech')+'.')+'</small></span>'+
      (step2ok?'<span class="review-state">Hotovo</span>':'<span class="review-step-actions"><button type="button" class="btn ghost small" data-review-first>Projít jednotlivě</button><button type="button" class="btn primary small" data-review-keep-all>Ponechat všech '+unresolved.length+'</button></span>')+'</div>'+
    '<div class="review-step '+(step2ok?(step3ok?'done':'ready'):'locked')+'"><span class="review-step-no">3</span><span><b>Potvrzení uživatele</b><small>'+(step2ok?(step3ok?'Ruční kontrola byla potvrzena.':'Teď můžeš zaškrtnout pole Zkontrolováno.'):"Nejprve dokonči krok 2.")+'</small></span><span class="review-state">'+(step3ok?'Hotovo':(step2ok?'Čeká na potvrzení':'Zamčeno'))+'</span></div>'+
    '<div class="review-model-note"><b>Co odejde modelu:</b> hlavní anonymizovaný text, zvolené parametry a znovu prověřená poznámka. Před API se kontroluje celý sestavený prompt. <b>Co je rizikové:</b> '+(danger?esc(iss.danger.join('; ')):'žádný blokující nález')+'.</div>';
  const first=el.querySelector("[data-review-first]"); if(first) first.onclick=()=>{const row=suggestionData(p).suggestions[0];if(row)selectPhraseForReview(p,row.phrase,true);};
  const keep=el.querySelector("[data-review-keep-all]"); if(keep) keep.onclick=()=>keepAllSuggestions(p,unresolved);
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
  renderSafetyCounts(p);
  renderPreviewSummary(p);
}
function updateSendGate(p){
  const cb=E(p,"reviewOk"), btn=p==="in"?$("in_analyzeBtn"):$("my_goBtn"), unresolved=(ST[p].raw||"").trim()?suggestionData(p).suggestions.length:0;
  const a=safetyAudit(ST[p].clean||"",p), hardStop=a.level==="danger" || (a.level==="nosend" && !(ST[p]&&ST[p].sensitiveAck));
  if(cb){
    cb.disabled=unresolved>0 || hardStop;
    if(cb.disabled) cb.checked=false;
    cb.title=hardStop?"Nejdřív odstraň blokující citlivý údaj.":(unresolved>0?("Nejdřív rozhodni o "+unresolved+" označených výrazech."):"Po přečtení celého textu potvrď kontrolu.");
    const label=cb.closest(".review-check"); if(label){label.classList.toggle("blocked",cb.disabled);label.classList.toggle("ready",!cb.disabled&&!cb.checked);label.classList.toggle("done",!!cb.checked);}
  }
  if(btn && cb){ btn.disabled=cb.disabled || !cb.checked; btn.title=hardStop?"Pokračování blokuje bezpečnostní nález.":(unresolved>0?("Nejprve rozhodni o "+unresolved+" návrzích."):(!cb.checked?"Zaškrtni Zkontrolováno.":"Odeslat anonymizovaný text k rozboru.")); }
  const reason=E(p,"gateReason");
  if(reason){
    reason.className="gate-reason "+(hardStop?"danger":unresolved>0?"action":cb&&cb.checked?"ok":"ready");
    reason.innerHTML=hardStop?'<b>Nelze pokračovat:</b> bezpečnostní kontrola našla blokující údaj.':unresolved>0?('<b>Ještě chybí:</b> rozhodnout o '+czCount(unresolved,'výrazu','výrazech','výrazech')+'. Použij krok 2 výše.'):cb&&cb.checked?'<b>Připraveno.</b> Můžeš pokračovat.':'<b>Poslední krok:</b> zaškrtni pole Zkontrolováno.';
  }
  updateProgress(p);
}
function flashPreview(p){
  const pv=E(p,"view"); if(!pv) return;
  pv.classList.add("preview-flash"); pv.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>pv.classList.remove("preview-flash"),900);
}
["in","my"].forEach(p=>{
  E(p,"anonBtn").onclick=()=>doAnon(p);
  E(p,"reAnon").onclick=()=>doAnon(p);
  E(p,"addRow").onclick=()=>addRow(p);
  E(p,"remember").onclick=()=>rememberNames(ST[p].km);
  E(p,"reviewOk").addEventListener("change",()=>{if(!E(p,"reviewOk").checked)ST[p].outputReady=false;updateSendGate(p);});
  E(p,"raw").addEventListener("input",()=>{
    const value=E(p,"raw").value;
    if(ST[p].raw!==value){
      ST[p].raw=value;ST[p].clean="";ST[p].km=[];ST[p].outputReady=false;ST[p].sensitiveAck=false;ST[p].reviewedSuggestions={};ST[p].selectedPhrase="";publishActiveKeyReals(p);
      const cb=E(p,"reviewOk");if(cb)cb.checked=false;
      clearAnalysisCache(); const step2=E(p,"step2");if(step2)step2.hidden=true;
      const results=$(p==="in"?"in_results":"my_results");if(results)results.innerHTML="";
      updateSendGate(p); scheduleWorkingSessionSave();
    }else { updateProgress(p); scheduleWorkingSessionSave(); }
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
function genericPersonCase(word){
  const lo=String(word||"").toLocaleLowerCase("cs-CZ");
  if(lo==="osoby")return 2;if(lo==="osobě")return 3;if(lo==="osobu")return 4;if(lo==="osobo")return 5;if(lo==="osobou")return 7;return 1;
}
function canonicalPersonEntry(entries){return [...(entries||[])].sort((a,b)=>String(b.real||"").length-String(a.real||"").length)[0]||null;}
function recompose(p,text){
  let t=String(text||"");
  const groups=new Map();
  (ST[p].km||[]).forEach(k=>{if(!k||!k.token||!k.real)return;const arr=groups.get(k.token)||[];arr.push(k);groups.set(k.token,arr);});
  [...groups.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([token,entries])=>{
    const canonicalEntry=canonicalPersonEntry(entries),canonical=canonicalEntry&&canonicalEntry.real||"";
    if(/^osoba\b/.test(token)){
      const label=parsePersonToken(token),forms=personFormsForEntry(canonicalEntry||{real:canonical});
      const salRe=new RegExp("((?:(?:Ahoj|Milý|Milá|Vážený|Vážená|Pane|Paní)\\s+|(?:Dobrý den|Dobrý večer)\\s*,?\\s*))"+escRe(token)+"(?=\\s*[,!?.]|\\s|$)","gi");
      t=t.replace(salRe,(m,lead)=>lead+(forms[5]||salutationName(entries.map(x=>x.real),lead)));
      const genericRe=new RegExp("\\b(osoba|osoby|osobě|osobu|osobo|osobou)\\s+"+escRe(label)+"\\b","gi");
      t=t.replace(genericRe,(m,word)=>forms[genericPersonCase(word)]||canonical);
    }
    t=t.replace(new RegExp(escRe(token),"g"),canonical);
  });
  if(typeof normalizeReplySignature==="function")t=normalizeReplySignature(t);
  t=t.replace(/\[podpis\]|\[učitel\]|\(\s*učitel\s*\)/gi,signatureText());
  return t.replace(/\n{3,}/g,"\n\n").trimEnd();
}
function knownKeyLeaks(p,text){
  const stripped=stripSafeTokens(text),words=wordObjs(stripped).words.map(w=>normName(w.core)).filter(Boolean),leaks=[];
  (ST[p].km||[]).filter(k=>k.real&&k.token).forEach(entry=>{
    if(!/^osoba\b/.test(entry.token||"")){
      if(String(stripped).toLocaleLowerCase("cs-CZ").includes(String(entry.real).toLocaleLowerCase("cs-CZ"))&&!leaks.includes(entry.real))leaks.push(entry.real);
      return;
    }
    String(entry.real).split(/\s+/).forEach(part=>{const vars=new Set(nameVariants(splitPunc(part).core).map(normName));words.forEach(w=>{if(vars.has(w)&&!leaks.includes(part))leaks.push(part);});});
  });
  return leaks;
}
function sanitizeModelString(p,value){
  const original=String(value||"");let text=fromModelPersonTokens(original),replaced=text!==original?1:0;
  const keyed=applyKeyToText(p,text,true);if(keyed!==text)replaced++;text=keyed;
  const fuzzy=replaceLikelyKnownNameForms(p,text);if(fuzzy.replaced)replaced+=fuzzy.replaced;text=applyKeyToText(p,fuzzy.text,true);
  const leaks=knownKeyLeaks(p,text);
  if(leaks.length||fuzzy.ambiguous.length)throw makeAppError("Výstup modelu obsahoval skutečný údaj, který se nepodařilo bezpečně skrýt.","OUTPUT_PRIVACY_BLOCKED",leaks.concat(fuzzy.ambiguous));
  return {text,replaced};
}
function secureModelResult(obj,schema,p){
  if(!p||!obj||typeof obj!=="object")return obj;
  let replacements=0;
  const walk=value=>{
    if(typeof value==="string"){const safe=sanitizeModelString(p,value);replacements+=safe.replaced;return safe.text;}
    if(Array.isArray(value))return value.map(walk);
    if(value&&typeof value==="object"){
      const out={};Object.keys(value).forEach(key=>{if(knownKeyLeaks(p,key).length)return;out[key]=walk(value[key]);});return out;
    }
    return value;
  };
  const safe=walk(obj);
  if(replacements){try{toast("Ve výstupu modelu byly bezpečnostně upraveny značky nebo zachycený skutečný údaj.");}catch(_){};try{logOp("output_privacy","sanitized",{pane:p,count:replacements,schema});}catch(_){}}
  return safe;
}
function tokenizeHTML(p, text){
  let html=esc(text);
  [...new Set(ST[p].km.map(k=>k.token).filter(Boolean))].sort((a,b)=>b.length-a.length).forEach(t=>{
    if(/^osoba\b/.test(t)){
      const label=parsePersonToken(t),re=new RegExp("\\b(osoba|osoby|osobě|osobu|osobo|osobou)\\s+"+escRe(label)+"\\b","g");
      html=html.replace(re,m=>'<span class="token '+tokenClass(t)+'">'+m+'</span>');
    }else html=html.replace(new RegExp(escRe(esc(t)),"g"),'<span class="token '+tokenClass(t)+'">'+esc(t)+'</span>');
  });
  html=html.replace(/\[podpis\]|\[učitel\]|\(\s*učitel\s*\)/gi, m=>{
    const signature=typeof signatureText==="function"?signatureText():m;
    return '<span class="token t-sign visible-signature" contenteditable="false" data-sign-token="[podpis]" title="Podpis se doplňuje lokálně z profilu a neposílá se Gemini.">'+esc(signature)+'</span>';
  });
  return html;
}

