/* ===================== TRVALÝ SLOVNÍK JMEN ===================== */
function cleanStoredPersonForms(forms){
  if(!forms||typeof forms!=="object")return null;
  const clean={};let count=0;
  for(let c=1;c<=7;c++){const value=String(forms[c]||"").trim();if(value){clean[c]=value;count++;}}
  return count===7?clean:null;
}
function cleanDictionaryEntry(item){
  const real=String(item&&item.real||"").trim();if(real.length<2)return null;
  const out={real},forms=cleanStoredPersonForms(item&&item.forms);if(forms)out.forms=forms;return out;
}
function loadDict(){
  try{
    const raw=JSON.parse(localStorage.getItem("rozbor_dict")||"[]");
    if(!Array.isArray(raw))return [];
    const seen=new Set(),clean=[];
    raw.forEach(item=>{const entry=cleanDictionaryEntry(item);if(!entry)return;const key=entry.real.toLocaleLowerCase("cs-CZ");if(!seen.has(key)){seen.add(key);clean.push(entry);}});
    return clean;
  }catch(_){return [];}
}
function saveDict(arr){
  try{
    const seen=new Set(),clean=[];
    (Array.isArray(arr)?arr:[]).forEach(item=>{const entry=cleanDictionaryEntry(item);if(!entry)return;const key=entry.real.toLocaleLowerCase("cs-CZ");if(!seen.has(key)){seen.add(key);clean.push(entry);}});
    localStorage.setItem("rozbor_dict",JSON.stringify(clean));
  }catch(_){}
}
function rememberNames(km){
  const candidates=(km||[]).filter(k=>k.real&&k.token&&!/^\[/.test(k.token));
  if(!candidates.length){toast("V klíči nejsou žádná jména k uložení.");return;}
  confirmActionModal({title:"Uložit skutečná jména na zařízení?",message:"Slovník bude obsahovat skutečná jména a případně ručně potvrzené pádové tvary. Vše zůstane v tomto prohlížeči. Použij tuto funkci jen na vlastním zabezpečeném zařízení, nikdy na sdíleném školním počítači. Slovník lze kdykoli smazat ve Správě lokálních dat.",confirmText:"Uložit jména",onConfirm(){
    const dict=loadDict();
    candidates.forEach(candidate=>{const entry=cleanDictionaryEntry(candidate);if(!entry)return;const key=entry.real.toLocaleLowerCase("cs-CZ"),index=dict.findIndex(d=>d.real.toLocaleLowerCase("cs-CZ")===key);if(index<0)dict.push(entry);else if(entry.forms)dict[index].forms=entry.forms;});
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
let workSessionTimer=null,workSessionRestoring=false,workSessionSuppressed=false;
function compactPaneForSession(p){
  const st=ST[p]||{};
  return {
    km:JSON.parse(JSON.stringify(st.km||[])),emailN:st.emailN||0,phoneN:st.phoneN||0,
    raw:String(st.raw||""),clean:String(st.clean||""),pozadavky:Array.isArray(st.pozadavky)?st.pozadavky:[],
    analysis:st.analysis||null,sensitiveAck:!!st.sensitiveAck,reviewedSuggestions:st.reviewedSuggestions||{},
    selectedPhrase:String(st.selectedPhrase||""),replySenderMode:st.replySenderMode||""
  };
}
function saveWorkingSessionNow(){
  if(workSessionRestoring||workSessionSuppressed)return;
  try{
    const hasSensitiveDraft=["in","my"].some(p=>hasSensitiveSchoolTerms((E(p,"raw")&&E(p,"raw").value)||(ST[p]&&ST[p].raw)||""));
    if(hasSensitiveDraft){clearWorkingSession();return;}
    const rec={format:2,appVersion:(typeof RELEASE!=="undefined"?RELEASE.version:""),savedAt:Date.now(),active:typeof activePane==="function"?activePane():"in",workspace:document.body.classList.contains("workspace-open"),
      in:{state:compactPaneForSession("in"),raw:E("in","raw")?E("in","raw").value:"",review:!!(E("in","reviewOk")&&E("in","reviewOk").checked),note:$("in_note")?$("in_note").value:""},
      my:{state:compactPaneForSession("my"),raw:E("my","raw")?E("my","raw").value:"",review:!!(E("my","reviewOk")&&E("my","reviewOk").checked),note:$("my_note")?$("my_note").value:""}
    };
    const hasWork=[rec.in,rec.my].some(x=>String(x.raw||"").trim()||String(x.state.clean||"").trim());
    if(hasWork)sessionStorage.setItem(WORK_SESSION_KEY,JSON.stringify(rec));else sessionStorage.removeItem(WORK_SESSION_KEY);
  }catch(_){}
}
function scheduleWorkingSessionSave(){
  clearTimeout(workSessionTimer);
  const hasSensitiveDraft=["in","my"].some(p=>hasSensitiveSchoolTerms((E(p,"raw")&&E(p,"raw").value)||(ST[p]&&ST[p].raw)||""));
  if(hasSensitiveDraft){clearWorkingSession();return;}
  workSessionTimer=setTimeout(saveWorkingSessionNow,180);
}
function clearWorkingSession(){try{sessionStorage.removeItem(WORK_SESSION_KEY);}catch(_){};}
function suppressWorkingSession(){workSessionSuppressed=true;clearWorkingSession();}
function resumeWorkingSession(){workSessionSuppressed=false;}
function restoreWorkingSession(){
  let rec=null;try{rec=JSON.parse(sessionStorage.getItem(WORK_SESSION_KEY)||"null");}catch(_){rec=null;}
  if(!rec||rec.format!==2)return false;
  workSessionRestoring=true;
  try{
    ["in","my"].forEach(p=>{
      const saved=rec[p]||{},base=ST[p],state=saved.state||{};
      const restoredKm=Array.isArray(state.km)?state.km.map(item=>{const entry=Object.assign({},item);return applyGeneratedCaseReview(entry,{force:!!entry.caseUnresolved,reasons:entry.reviewReasons||[]});}):[];
      ST[p]=Object.assign(base,state,{syn:base.syn||{},km:restoredKm,reviewedSuggestions:state.reviewedSuggestions||{},outputReady:false});
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

const KNOWN_PROPER_WORDS=new Set(("Petr Pavel Karel Marek Jan Jana Anna Tereza Petra Pavla Barbora Daniel Šárka Eva Monika Lenka Radka Jitka Olga Alena Denisa Ondřej Vojtěch Zdeněk Jiří Tomáš Lukáš Michal Martin Jakub Filip Radek Havel Ostrava Brno Praha Olomouc Opava").split(/\s+/));
try{CZ_PERSON_GRAMMAR.knownGivenNames().forEach(name=>KNOWN_PROPER_WORDS.add(name));}catch(_){}
const KNOWN_GIVEN_SPELLINGS=new Set((()=>{try{return CZ_PERSON_GRAMMAR.knownGivenNames().map(name=>String(name).normalize("NFC").toLocaleLowerCase("cs-CZ"));}catch(_){return [];}})());
const KNOWN_SURNAME_SPELLINGS=new Set((()=>{try{return CZ_PERSON_GRAMMAR.knownSurnames().map(name=>String(name).normalize("NFC").toLocaleLowerCase("cs-CZ"));}catch(_){return [];}})());
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
  // Účty, rodná čísla a identifikátory dokladů nesmějí být zaměněny za telefon.
  const masked=maskDocumentNumbers(String(text).replace(reAccount("g")," ").replace(/\b\d{6}\/\d{3,4}\b/g," "));
  (masked.match(rePhone("gu"))||[]).map(m=>m.trim()).forEach(add);
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
function dictionaryNameAppears(text,stored){
  const source=stored&&typeof stored==="object"?stored:{real:stored};
  const probe={real:String(source.real||"").trim(),token:"osoba Z"};
  const forms=cleanStoredPersonForms(source.forms);if(forms)probe.forms=forms;
  if(!probe.real)return false;
  const parsed=wordObjs(text);
  return matchWordArray(buildMatchers([probe]),parsed.words).some(Boolean);
}
function buildKey(st, detected){
  loadDict().forEach(d=>{
    if(st.km.some(k=>k.real.toLocaleLowerCase("cs-CZ")===d.real.toLocaleLowerCase("cs-CZ")))return;
    if(dictionaryNameAppears(st.raw,d)){
      const entry={real:d.real,token:tokenFor(st,d.real),auto:true},forms=cleanStoredPersonForms(d.forms);
      if(forms)entry.forms=forms;applyGeneratedCaseReview(entry);st.km.push(entry);
    }
  });
  detected.forEach(real=>{if(st.km.some(k=>k.real.toLowerCase()===real.toLowerCase()))return;const entry={real,token:tokenFor(st,real),auto:true};applyGeneratedCaseReview(entry);st.km.push(entry);});
  autoStructured(st.raw).forEach(it=>{
    if(st.km.some(k=>k.real.toLowerCase()===it.real.toLowerCase()))return;
    const base=it.kind==="rc"?"rodné číslo":it.kind==="ucet"?"číslo účtu":"datum narození";
    const cnt=st.km.filter(k=>(k.token||"").indexOf("["+base)===0).length;
    st.km.push({real:it.real,token:"["+base+" "+(cnt+1)+"]",auto:true});
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
  if(rep)return stem.slice(0,-1)+rep+"e";
  if(last==="r")return stem.slice(0,-1)+"ře";
  if(/[dtnbpvfm]$/u.test(stem))return stem+"ě";
  return stem+"e";
}
function preserveWholeCase(source,value){
  const src=String(source||""),v=String(value||"");
  if(!src||!v)return v;
  if(src===src.toLocaleUpperCase("cs-CZ"))return v.toLocaleUpperCase("cs-CZ");
  if(src[0]===src[0].toLocaleUpperCase("cs-CZ"))return v[0].toLocaleUpperCase("cs-CZ")+v.slice(1);
  return v.toLocaleLowerCase("cs-CZ");
}
function declineNameWord(word,options){return CZ_PERSON_GRAMMAR.declineWord(word,options||{});}
function wordCaseForms(base,caseNo,options,prepared){
  const src=String(base||"").trim(),lo=src.toLocaleLowerCase("cs-CZ"),forms=prepared||declineNameWord(src,options||{}),out=new Set([normName(forms[caseNo]||src)]);
  if((caseNo===3||caseNo===6)&&/[bcčdďfghjklmnňpqrřsštťvwxzž]$/u.test(lo)){
    out.add(normName(lo+"u"));
    if(/[jřšžčc]$/u.test(lo))out.add(normName(lo+"i"));
  }
  if((caseNo===3||caseNo===6)&&/^(?:pavel|karel|havel)$/u.test(lo))out.add(normName(lo.slice(0,-2)+"lu"));
  if(caseNo===4&&/ia$/u.test(lo)&&lo.length<=4)out.add(normName(lo.slice(0,-1)+"u"));
  return out;
}
function generatedPersonForms(real){return CZ_PERSON_GRAMMAR.declinePerson(real);}
function applyGeneratedCaseReview(entry,options={}){
  if(!entry)return entry;
  if(!/^osoba\b/.test(entry.token||"")||!String(entry.real||"").trim()){
    delete entry.caseUnresolved;delete entry.reviewReasons;return entry;
  }
  const custom=cleanStoredPersonForms(entry.forms);
  if(custom){entry.forms=custom;entry.caseUnresolved=false;entry.reviewReasons=[];return entry;}
  delete entry.forms;
  const generated=generatedPersonForms(entry.real),reasons=[...new Set([].concat(options.reasons||[],generated.reviewReasons||[]).filter(Boolean))];
  entry.caseUnresolved=!!options.force||!!generated.requiresReview;
  entry.reviewReasons=entry.caseUnresolved?reasons:[];
  return entry;
}
const PERSON_CASE_PREPOSITIONS={
  2:new Set(["bez","během","dle","do","kolem","kromě","místo","od","podle","u","vedle","včetně","z","ze"]),
  3:new Set(["k","ke","kvůli","naproti","oproti","proti","vůči"]),
  4:new Set(["pro","přes","skrze","za","na","o","mimo"]),
  6:new Set(["o","po","na","v","ve","při"]),
  7:new Set(["s","se","mezi","nad","pod","před","za"])
};
function nameCaseHints(raw,phrase){
  const parsed=wordObjs(raw||""),parts=coreWords(phrase).map(x=>x.toLocaleLowerCase("cs-CZ")),out=[];
  if(!parts.length)return out;
  for(let i=0;i<=parsed.words.length-parts.length;i++){
    if(!parts.every((x,k)=>parsed.words[i+k].coreL===x))continue;
    const prev=i>0?parsed.words[i-1].coreL:"";
    for(const [c,set] of Object.entries(PERSON_CASE_PREPOSITIONS))if(set.has(prev))out.push(+c);
    break;
  }
  return [...new Set(out)];
}
function reverseNameCandidates(word,caseNo){
  const src=String(word||"").trim(),lo=src.toLocaleLowerCase("cs-CZ"),cands=[];
  const add=x=>{x=String(x||"").trim();if(x.length>=2&&!cands.includes(x))cands.push(x);};
  const addMobileEl=st=>{if(/[^aeiouyáéíóúůý]l$/u.test(st))add(st.slice(0,-1)+"el");};
  if(/ovou$/.test(lo))add(lo.slice(0,-4)+"ová");
  if(/ové$/.test(lo)){add(lo.slice(0,-3)+"ová");add(lo.slice(0,-1)+"á");}
  if(/ou$/.test(lo)){add(lo.slice(0,-2)+"a");add(lo.slice(0,-2)+"á");}
  if(/ího$/.test(lo))add(lo.slice(0,-3)+"í");
  if(/ímu$/.test(lo))add(lo.slice(0,-3)+"í");
  if(/ím$/.test(lo))add(lo.slice(0,-2)+"í");
  if(/ého$/.test(lo))add(lo.slice(0,-3)+"ý");
  if(/ému$/.test(lo))add(lo.slice(0,-3)+"ý");
  if(/ým$/.test(lo))add(lo.slice(0,-2)+"ý");
  if(/ém$/.test(lo))add(lo.slice(0,-2)+"ý");
  if(/é$/.test(lo)){add(lo.slice(0,-1)+"á");add(lo.slice(0,-1)+"ý");}
  if(/ovi$/.test(lo)){
    const st=lo.slice(0,-3);
    if(/ňk$/.test(st))add(st.slice(0,-2)+"něk");
    else if(/[^aeiouyáéíóúůý]k$/u.test(st))add(st.slice(0,-1)+"ek");
    if(/[^aeiouyáéíóúůý]c$/u.test(st))add(st.slice(0,-1)+"ec");
    addMobileEl(st);
    add(st);     // Dvořákovi -> Dvořák; neznámé kmeny zůstanou nízko
    add(st+"a"); // Honzovi / Nikolovi -> Honza / Nikola
    add(st+"o"); // Ivovi / Mariovi -> Ivo / Mario
  }
  if(/em$/.test(lo)){const st=lo.slice(0,-2);addMobileEl(st);if(/ňk$/.test(st))add(st.slice(0,-2)+"něk");else if(/[^aeiouyáéíóúůý]k$/u.test(st))add(st.slice(0,-1)+"ek");if(/[^aeiouyáéíóúůý]c$/u.test(st))add(st.slice(0,-1)+"ec");add(st);add(st+"o");}
  if(/u$/.test(lo)){const st=lo.slice(0,-1);addMobileEl(st);add(st);add(st+"a");}
  if(/ii$/.test(lo)){add(lo.slice(0,-2)+"ie");add(lo.slice(0,-2)+"ia");}
  if(/i$/.test(lo)){
    const st=lo.slice(0,-1);
    if(st.endsWith("c"))add(st.slice(0,-1)+"ka");
    if(st.endsWith("z")){add(st.slice(0,-1)+"ga");add(st.slice(0,-1)+"ha");}
    add(st);add(st+"ie");add(st+"ia");
  }
  if(/y$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/o$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/í$/.test(lo)){add(lo);add(lo.slice(0,-1)+"ie");add(lo.slice(0,-1)+"ia");}
  if(/ě$/.test(lo))add(lo.slice(0,-1)+"a");
  if(/e$/.test(lo)){
    const st=lo.slice(0,-1);
    if(st.endsWith("c"))add(st.slice(0,-1)+"ka");
    if(st.endsWith("z")){add(st.slice(0,-1)+"ga");add(st.slice(0,-1)+"ha");}
    add(st+"a");add(st);add(st+"ec");add(st+"el");
  }
  if(/a$/.test(lo)){const st=lo.slice(0,-1);if(/ňk$/.test(st))add(st.slice(0,-2)+"něk");else if(/[^aeiouyáéíóúůý]k$/u.test(st))add(st.slice(0,-1)+"ek");if(/[^aeiouyáéíóúůý]c$/u.test(st))add(st.slice(0,-1)+"ec");addMobileEl(st);add(st+"el");add(st);}
  add(lo);
  // Kandidáty nefiltrujeme jen podle samostatného slova. U rodově
  // nejednoznačných jmen (Andrea, Nikola) může správný rod určit až celé
  // jméno a příjmení. Definitivní ověření proto provede phraseMatchesCase().
  const scored=cands.map((candidate,index)=>{
    const contexts=[{}, {gender:"male",role:"given"},{gender:"male",role:"surname"},{gender:"female",role:"given"},{gender:"female",role:"surname"}];
    const analyses=contexts.map(context=>declineNameWord(candidate,context)),matching=analyses.filter(forms=>wordCaseForms(candidate,caseNo,null,forms).has(normName(lo)));
    matching.sort((a,b)=>Number(a.requiresReview)-Number(b.requiresReview)||({high:3,medium:2,low:1}[b.confidence]||0)-({high:3,medium:2,low:1}[a.confidence]||0));
    const best=matching[0]||analyses[0],direct=matching.length>0;
    const exactGiven=knownGivenSpelling(candidate),exactSurname=knownSurnameSpelling(candidate),known=knownCanonicalPerson(candidate),exact=caseNo===1&&normName(candidate)===normName(lo);
    const score=(exactGiven?120:0)+(exactSurname?100:0)+(known?20:0)+(direct?(best.requiresReview?45:80):0)+(!best.requiresReview?20:0)+(exact?5:0)-index/1000;
    return {candidate,score};
  });
  return scored.sort((a,b)=>b.score-a.score).map(x=>preserveWholeCase(src,x.candidate));
}
function cartesianCandidateRows(rows,limit=180){
  let out=[[]];
  for(const row of rows){const next=[];for(const base of out){for(const x of row.slice(0,8)){next.push(base.concat(x));if(next.length>=limit)break;}if(next.length>=limit)break;}out=next;if(!out.length)break;}
  return out;
}
function phraseMatchesCase(base,observed,caseNo){
  const bases=coreWords(base),seen=coreWords(observed);if(bases.length!==seen.length)return false;
  const analysis=generatedPersonForms(base);
  if(normName(analysis[caseNo])===normName(observed))return true;
  return bases.every((word,i)=>wordCaseForms(word,caseNo,analysis.contexts&&analysis.contexts[i],analysis.wordForms&&analysis.wordForms[i]).has(normName(seen[i])));
}
function rawContainsExactPerson(raw,real,observed){
  const target=coreWords(real).map(normName),seen=wordObjs(raw||"").words.map(word=>normName(word.core));
  if(!target.length||seen.length<target.length)return false;
  let count=0;for(let i=0;i<=seen.length-target.length;i++)if(target.every((word,index)=>seen[i+index]===word))count++;
  // Přesně označený úsek není sám o sobě důkazem, že jde o nominativ.
  // U nezměněného kandidáta požadujeme další výskyt téhož tvaru v textu.
  return normName(real)===normName(observed)?count>1:count>0;
}
function canonicalSurnameCandidate(real){
  const parts=coreWords(real);if(parts.length<2)return false;
  const last=parts[parts.length-1];return knownSurnameSpelling(last)||/(?:ová|á|ý|í)$/u.test(String(last).toLocaleLowerCase("cs-CZ"));
}
function canonicalizePersonPhrase(raw,phrase){
  const observed=String(phrase||"").replace(/\s+/g," ").trim(),parts=coreWords(observed);
  if(!observed||!parts.length)return {real:observed,observed,caseNo:1,changed:false,confidence:"unresolved",reviewReasons:["Základní tvar jména se nepodařilo určit."]};
  const hints=nameCaseHints(raw,observed),order=[...hints,2,3,4,7,6,5,1].filter((x,i,a)=>a.indexOf(x)===i),matches=[],rank={high:3,medium:2,low:1,unresolved:0};
  const storedExact=new Set(loadDict().map(item=>normName(item.real)));
  for(const caseNo of order){
    const rows=parts.map(w=>reverseNameCandidates(w,caseNo));if(rows.some(x=>!x.length))continue;
    for(const bases of cartesianCandidateRows(rows)){
      const real=bases.join(" ");
      if(!phraseMatchesCase(real,observed,caseNo))continue;
      const changed=normName(real)!==normName(observed);
      const generated=generatedPersonForms(real),confidence=generated.requiresReview?"unresolved":generated.confidence;
      matches.push({real,observed,caseNo,changed,confidence,hinted:hints.includes(caseNo),order:order.indexOf(caseNo),score:rank[confidence]||0,known:knownCanonicalPerson(real),givenKnown:knownGivenPerson(real),surnameCanonical:canonicalSurnameCandidate(real),storedExact:storedExact.has(normName(real)),contextExact:rawContainsExactPerson(raw,real,observed)});
    }
  }
  if(matches.length){
    const hinted=matches.filter(x=>x.hinted),pool=hinted.length?hinted:matches;
    const compare=(a,b)=>Number(b.storedExact)-Number(a.storedExact)||b.score-a.score||Number(b.contextExact)-Number(a.contextExact)||Number(b.givenKnown)-Number(a.givenKnown)||Number(b.surnameCanonical)-Number(a.surnameCanonical)||Number(b.known)-Number(a.known)||a.order-b.order||Number(a.changed)-Number(b.changed);
    pool.sort(compare);
    let best=pool[0];
    const exactNominatives=matches.filter(x=>x.caseNo===1&&!x.changed).sort(compare),exactNominative=exactNominatives[0];

    if(!hinted.length&&exactNominative){
      // Samostatné Petra/Jana může být ženský nominativ i pád Petr/Jan.
      // Zachováme přesně označený tvar, ale vyžádáme potvrzení identity.
      const counterpart=parts.length===1?matches.find(x=>x.changed&&x.score>=exactNominative.score&&genderedNominativeCounterparts(x.real,exactNominative.real)):null;
      if(counterpart){
        const alternatives=[...new Set([exactNominative.real,counterpart.real])];
        return {real:exactNominative.real,observed,caseNo:1,changed:false,confidence:"unresolved",alternatives,reviewReasons:["Tvar „"+observed+"“ může být samostatný nominativ i pád jiného jména ("+alternatives.join(" / ")+"). Zkontrolujte 1. pád."]};
      }
      // Je-li přesný tvar stejně nebo více spolehlivý, je bezpečnější jej
      // nepřepisovat domnělým základním tvarem. Neplatí to pro zjevně
      // nevyřešený tvar (Petrovi/Pavlu), proti němuž stojí známý kandidát.
      if(exactNominative.score>best.score||(exactNominative.score===0&&best.score===0))best=exactNominative;
    }

    // Některé pády jsou společné více skutečným jménům (např. Markem může
    // být Marek i Marko). Bez nominativu v textu nebo přesného lokálního
    // slovníku nesmíme zvolit jedno jméno potichu.
    if(!best.contextExact&&!best.storedExact&&best.confidence!=="unresolved"){
      const alternatives=[...new Map(pool.filter(x=>x.caseNo===best.caseNo&&x.confidence===best.confidence&&x.score===best.score&&x.givenKnown===best.givenKnown&&x.surnameCanonical===best.surnameCanonical&&x.known===best.known).map(x=>[normName(x.real),x.real])).values()];
      if(alternatives.length>1)return {real:best.real,observed:best.observed,caseNo:best.caseNo,changed:best.changed,confidence:"unresolved",alternatives,reviewReasons:["Tvar „"+observed+"“ odpovídá více základním podobám ("+alternatives.slice(0,4).join(" / ")+"). Zkontrolujte 1. pád."]};
    }
    return {real:best.real,observed:best.observed,caseNo:best.caseNo,changed:best.changed,confidence:best.confidence};
  }
  return {real:observed,observed,caseNo:0,changed:false,confidence:"unresolved",aliases:[observed],reviewReasons:["Základní tvar ani skloňovací vzor se nepodařilo spolehlivě určit."]};
}
function personFormsForEntry(entry){
  const generated=generatedPersonForms(entry&&entry.real||""),custom=cleanStoredPersonForms(entry&&entry.forms);
  if(custom){for(let c=1;c<=7;c++)generated[c]=custom[c];generated.requiresReview=false;generated.reviewReasons=[];generated.confidence="high";generated.source="custom";}
  return generated;
}
function czechCaseForms(name){
  const f=declineNameWord(name),out=new Set();for(let c=1;c<=7;c++)if(f[c])out.add(String(f[c]).toLocaleLowerCase("cs-CZ"));
  const lo=String(name||"").toLocaleLowerCase("cs-CZ");if(/^(?:pavel|karel|havel)$/u.test(lo))out.add(lo.slice(0,-2)+"lu");
  return out;
}
function addReverseNameBase(variants,lo,base){
  if(!base||base.length<3)return;
  const forms=czechCaseForms(base);if(forms.has(lo))forms.forEach(v=>variants.add(v));
}
function nameVariants(real){
  const lo=String(real||"").toLocaleLowerCase("cs-CZ"),variants=czechCaseForms(lo),direct=declineNameWord(lo);
  // U spolehlivého základního tvaru nerozebírej koncovku znovu. Ze jména Petra/Jana
  // by se jinak odvodilo celé mužské paradigma Petr/Jan. Zpětné heuristiky zůstávají
  // jen pro starší nebo ručně vložené položky, které nevypadají jako jistý nominativ.
  if(direct.confidence!=="high"||direct.requiresReview){
    CZ_SUFFIXES.forEach(suf=>{if(lo.endsWith(suf)&&lo.length-suf.length>=3){const base=lo.slice(0,lo.length-suf.length);czechCaseForms(base).forEach(v=>variants.add(v));}});
    [["ovi",3],["em",2],["a",1],["u",1]].forEach(([suf,n])=>{if(!lo.endsWith(suf))return;const st=lo.slice(0,-n);if(st.endsWith("k")){let base=st.slice(0,-1)+"ek";if(st.endsWith("ňk"))base=st.slice(0,-2)+"něk";addReverseNameBase(variants,lo,base);}});
    [["ovi",3],["em",2],["e",1],["i",1]].forEach(([suf,n])=>{if(!lo.endsWith(suf))return;const st=lo.slice(0,-n);if(st.endsWith("c"))addReverseNameBase(variants,lo,st.slice(0,-1)+"ec");});
  }
  return [...variants].filter(v=>v.length>=2);
}
function genderedNominativeCounterparts(a,b){
  const aw=coreWords(a).map(normName),bw=coreWords(b).map(normName);
  if(!aw.length||aw.length!==bw.length)return false;
  if(aw.slice(1).some((word,index)=>word!==bw[index+1]))return false;
  const x=aw[0],y=bw[0];
  return !!(x&&y&&x!==y&&(x+"a"===y||y+"a"===x||x+"ova"===y||y+"ova"===x));
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
  const out=[],seen=new Set();
  const pushMatcher=(k,value,isPerson,partOnly,variantRows)=>{
    const words=String(value||"").split(/\s+/).map(w=>splitPunc(w).core).filter(Boolean);if(!words.length)return;
    const signature=[k.token,words.map(normName).join(" "),partOnly?"part":"full",(variantRows||[]).map(row=>[...row].sort().join("/")).join("|")].join("|");if(seen.has(signature))return;seen.add(signature);
    out.push({token:k.token,isPerson,partOnly:!!partOnly,n:words.length,entry:k,words:words.map((w,index)=>({lo:w.toLocaleLowerCase("cs-CZ"),origLen:w.length,variants:isPerson?new Set(variantRows&&variantRows[index]?variantRows[index]:[normName(w)]):null})),weight:words.reduce((sum,w)=>sum+w.length,0)});
  };
  km.filter(k=>k.real&&k.token).forEach(k=>{
    const isPerson=/^osoba\b/.test(k.token),real=String(k.real||"").trim(),realWords=coreWords(real);
    if(!isPerson){pushMatcher(k,real,false,false,null);return;}
    const forms=personFormsForEntry(k),variantRows=realWords.map(word=>new Set([String(word).toLocaleLowerCase("cs-CZ")]));
    for(let c=1;c<=7;c++){
      const row=coreWords(forms[c]);if(row.length!==realWords.length)continue;
      row.forEach((word,index)=>variantRows[index].add(String(word).toLocaleLowerCase("cs-CZ")));
    }
    pushMatcher(k,real,true,false,variantRows);
    if(realWords.length>1)realWords.forEach((word,index)=>{
      if(word.length>=3&&!/^(?:mgr|ing|bc|mudr|rndr|phdr|judr|doc|prof)\.?$/i.test(word))pushMatcher(k,word,true,true,[variantRows[index]]);
    });
    // Alias is an exact observed form. Expanding it again could create an
    // unrelated name; the canonical full-name paradigm is handled above.
    [...new Set((Array.isArray(k.aliases)?k.aliases:[]).map(v=>String(v).trim()).filter(Boolean))].forEach(alias=>pushMatcher(k,alias,true,false,coreWords(alias).map(word=>new Set([String(word).toLocaleLowerCase("cs-CZ")]))));
  });
  return out.filter(m=>m.n>0).sort((a,b)=>(b.n-a.n)||(b.weight-a.weight));
}
function wordObjs(text){
  const source=String(text),segs=source.split(/(\s+)/),words=[];
  let offset=0,lineIndex=0;
  segs.forEach((seg,pi)=>{
    if(pi%2===1){ offset+=seg.length; lineIndex+=(seg.match(/\r\n|\r|\n/g)||[]).length; return; }
    if(seg!==""){
      const sp=splitPunc(seg),gapBefore=pi>0?segs[pi-1]:"";
      words.push({pi,pre:sp.pre,core:sp.core,post:sp.post,raw:seg,coreL:sp.core.toLocaleLowerCase("cs-CZ"),cap:_isUpper(sp.core[0]),gapBefore,lineBreakBefore:/[\r\n\u2028\u2029]/.test(gapBefore),lineIndex,segmentStart:offset,segmentEnd:offset+seg.length,coreStart:offset+sp.pre.length,coreEnd:offset+sp.pre.length+sp.core.length});
    }
    offset+=seg.length;
  });
  return {source,segs,words};
}
// Pro každé slovo vrátí null (ponech), {token,n} (začátek značky) nebo "SKIP" (uvnitř značky).
function matchWordArray(matchers,words){
  const wtok=new Array(words.length).fill(null);let wi=0;
  while(wi<words.length){
    let selected=null;
    for(const exactOnly of [true,false]){
      for(const m of matchers){
        if(wi+m.n>words.length)continue;let ok=true;
        for(let k=0;k<m.n;k++){const w=words[wi+k],mw=m.words[k];if(k>0&&w.lineBreakBefore){ok=false;break;}const exact=w.coreL===mw.lo,shortFeminineCollision=m.isPerson&&w.cap&&mw.lo.length<=3&&w.coreL===mw.lo+"a",counterpartCollision=m.isPerson&&m.partOnly&&genderedNominativeCounterparts(mw.lo,w.coreL),good=exactOnly?exact:(m.isPerson&&!shortFeminineCollision&&!counterpartCollision?nameMatchWord(mw.variants,w.coreL):exact);if(!good){ok=false;break;}}
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
  // Jméno se nikdy nesmí sloučit přes konec řádku (např. podpis + nadpis další sekce).
  if(right.lineBreakBefore) return false;
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
function structuredInstitutionSuggestions(parsed){
  const out=[],text=String(parsed&&parsed.source||""),words=parsed&&parsed.words||[];
  // Běžné exporty a formuláře uvádějí instituci jako hodnotu za štítkem.
  // Hodnota může obsahovat čárky, pomlčky i právní formu a vybírá se vždy celá.
  const re=/^[ \t]*(?:school[ \t]+name|název[ \t]+školy|název[ \t]+instituce|škola|school|institution|instituce|organizace|organization|organisation)[ \t]*:[ \t]*(\S[^\r\n]*?)[ \t]*$/gimu;
  let m;
  while((m=re.exec(text))){
    const row=m[0],value=String(m[1]||"").trim(); if(!value)continue;
    const colon=row.indexOf(":"),tail=colon>=0?row.slice(colon+1):"",leading=(tail.match(/^\s*/)||[""])[0].length;
    const start=m.index+colon+1+leading,end=start+value.length;
    const indexes=[]; words.forEach((w,i)=>{if(w.segmentEnd>start&&w.segmentStart<end)indexes.push(i);});
    if(!indexes.length)continue;
    out.push({phrase:value,key:suggestionKey(value),start:indexes[0],end:indexes[indexes.length-1],kind:"institution",structured:true});
  }
  return out;
}
function suggestionData(p){
  const cacheKey=analysisCacheKey(p,ST[p]&&ST[p].raw); if(ANALYSIS_CACHE.suggestion.has(cacheKey)) return ANALYSIS_CACHE.suggestion.get(cacheKey);
  const st=ST[p], parsed=wordObjs(st.raw||""), words=parsed.words;
  const wtok=matchWordArray(buildMatchers((st.km||[]).filter(k=>k.real&&k.token)),words);
  const suggestions=[], byWord=new Map(), seen=new Set();
  structuredInstitutionSuggestions(parsed).forEach(item=>{
    if(!item.phrase||seen.has(item.key)||(st.reviewedSuggestions&&st.reviewedSuggestions[item.key]==="keep"))return;
    for(let x=item.start;x<=item.end;x++)if(wtok[x])return;
    seen.add(item.key);suggestions.push(item);for(let x=item.start;x<=item.end;x++)byWord.set(x,item);
  });
  words.forEach((w,i)=>{
    if(wtok[i] || byWord.has(i) || !isNamePart(w)) return;
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
  const bases={institution:"instituce",place:"místo",title:"název",contact:"kontakt",sensitive:"citlivý údaj",docnum:"číslo dokladu"};
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
  const n=norm(cleaned),observedParts=coreWords(cleaned); if(n.length<2) return "";
  const hit=(st.km||[]).find(k=>{
    if(!k.real||!/^osoba\b/.test(k.token||"")) return false;
    return String(k.real).split(/\s+/).some(part=>{
      if(observedParts.length===1&&genderedNominativeCounterparts(part,observedParts[0]))return false;
      return new Set(nameVariants(part).map(norm)).has(n);
    });
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

function personEntriesOverlap(a,b){
  const aw=coreWords(a&&a.real),bw=coreWords(b&&b.real);if(!aw.length||aw.length!==bw.length)return false;
  if(aw.length===1&&genderedNominativeCounterparts(aw[0],bw[0]))return false;
  return aw.every((word,i)=>{const av=new Set(nameVariants(word).map(normName));return nameVariants(bw[i]).some(x=>av.has(normName(x)));});
}
function mergeOverlappingPersonEntries(st){
  for(let i=0;i<st.km.length;i++)for(let j=i+1;j<st.km.length;j++){
    const a=st.km[i],b=st.km[j];if(!/^osoba\b/.test(a.token||"")||!/^osoba\b/.test(b.token||"")||!personEntriesOverlap(a,b))continue;
    const keep=a.caseUnresolved&&!b.caseUnresolved?b:a,drop=keep===a?b:a;
    const forceReview=!!a.caseUnresolved||!!b.caseUnresolved,reasons=[...new Set([].concat(a.reviewReasons||[],b.reviewReasons||[]).filter(Boolean))];
    keep.aliases=[...new Set([].concat(keep.aliases||[],drop.real||[],drop.aliases||[]).filter(Boolean))];
    if(!keep.forms&&drop.forms)keep.forms=drop.forms;
    applyGeneratedCaseReview(keep,{force:forceReview,reasons});
    const keepIndex=st.km.indexOf(keep),dropIndex=st.km.indexOf(drop);st.km.splice(dropIndex,1);if(dropIndex<keepIndex)i--;
    j=i;
  }
}
function knownGivenSpelling(value){return KNOWN_GIVEN_SPELLINGS.has(String(value||"").normalize("NFC").toLocaleLowerCase("cs-CZ"));}
function knownSurnameSpelling(value){return KNOWN_SURNAME_SPELLINGS.has(String(value||"").normalize("NFC").toLocaleLowerCase("cs-CZ"));}
function knownGivenPerson(real){const first=coreWords(real)[0];return !!first&&knownGivenSpelling(first);}
function knownCanonicalPerson(real){
  const parts=coreWords(real),known=new Set([...KNOWN_PROPER_WORDS].map(normName));if(!parts.length)return false;
  const dict=loadDict(),dictExact=new Set(dict.map(x=>normName(x.real))),dictParts=new Set();
  dict.forEach(x=>coreWords(x.real).forEach(part=>dictParts.add(normName(part))));
  if(dictExact.has(normName(real)))return true;
  return parts.every((part,index)=>known.has(normName(part))||dictParts.has(normName(part))||(index>0&&knownSurnameSpelling(part)));
}
function personCaseNeedsReview(raw,observed,normalized){
  return !!(normalized&&normalized.changed&&normalized.confidence!=="unresolved"&&!nameCaseHints(raw,observed).length&&!knownCanonicalPerson(normalized.real));
}
function normalizePersonSelection(raw,observed){
  const normalized=canonicalizePersonPhrase(raw,observed),generated=generatedPersonForms(normalized.real||observed);
  const reasons=[...new Set([].concat(normalized.reviewReasons||[],generated.reviewReasons||[]).filter(Boolean))];
  if(generated.requiresReview)normalized.confidence="unresolved";
  if(personCaseNeedsReview(raw,observed,normalized)){
    normalized.confidence="unresolved";
    reasons.push("Základní tvar byl odvozen bez jednoznačné pádové nápovědy; potvrď, že patří správné osobě.");
  }
  if(normalized.confidence==="unresolved")normalized.reviewReasons=[...new Set(reasons)];
  return normalized;
}
function addPhraseAs(p, phrase, kind){
  const st=ST[p];const cleaned=String(phrase).replace(/\s+/g," ").trim().replace(/^[<>\[\]{}(),.;:!?„“”"'…»«\s]+|[<>\[\]{}(),.;:!?„“”"'…»«\s]+$/g,"");
  if(!cleaned||cleaned.length<1)return;
  let normalized={real:cleaned,observed:cleaned,caseNo:1,changed:false};
  if(kind==="person")normalized=normalizePersonSelection(st.raw,cleaned);
  const storedReal=normalized.real||cleaned;
  const duplicate=st.km.some(k=>[k.real].concat(Array.isArray(k.aliases)?k.aliases:[]).some(v=>normName(v)===normName(cleaned)||normName(v)===normName(storedReal)));
  if(duplicate)return;
  let token="",related="";
  if(["institution","place","title","contact","sensitive","docnum"].includes(kind))token=categoryToken(st,kind);
  else{
    const merged=adjacentPersonMerge(st,cleaned);
    if(merged){
      const previous=merged.entry.real,base=normalizePersonSelection(st.raw,merged.phrase);
      merged.entry.real=base.real||merged.phrase;merged.entry.auto=false;delete merged.entry.forms;
      const aliases=new Set([].concat(merged.entry.aliases||[],base.changed?[merged.phrase]:[]).filter(Boolean));merged.entry.aliases=[...aliases];
      applyGeneratedCaseReview(merged.entry,{force:base.confidence==="unresolved",reasons:base.reviewReasons||[]});
      if(st.reviewedSuggestions){delete st.reviewedSuggestions[suggestionKey(previous)];delete st.reviewedSuggestions[suggestionKey(cleaned)];delete st.reviewedSuggestions[suggestionKey(merged.phrase)];}
      afterKeyChange(p);const mergedIndex=st.km.indexOf(merged.entry);
      if(merged.entry.caseUnresolved&&mergedIndex>=0){toast("Skloňování sloučeného jména vyžaduje kontrolu.");setTimeout(()=>openPersonFormsEditor(p,mergedIndex,true),40);}
      else toast(base.changed?"Jméno bylo sloučeno a uloženo v základním tvaru „"+merged.entry.real+"“.":"Sousední části jména byly sloučeny do "+merged.entry.token+".");
      return;
    }
    related=tokenForRelatedPerson(st,storedReal);token=related||nextPersonToken(st.km);
  }
  const entry={real:storedReal,token,auto:false};
  if(normalized.changed||normalized.confidence==="unresolved")entry.aliases=[cleaned];
  if(kind==="person")applyGeneratedCaseReview(entry,{force:normalized.confidence==="unresolved",reasons:normalized.reviewReasons||[]});
  st.km.push(entry);if(kind==="person")mergeOverlappingPersonEntries(st);
  if(st.reviewedSuggestions)delete st.reviewedSuggestions[suggestionKey(cleaned)];
  afterKeyChange(p);const finalEntry=st.km.includes(entry)?entry:st.km.find(k=>/^osoba\b/.test(k.token||"")&&personEntriesOverlap(k,entry)),idx=st.km.indexOf(finalEntry);
  if(finalEntry&&finalEntry.caseUnresolved&&idx>=0){toast("Skloňování nebylo spolehlivě rozpoznáno. Zkontroluj základní tvar a pády.");setTimeout(()=>openPersonFormsEditor(p,idx,true),40);}
  else if(related)toast("Přidáno ke stejné osobě ("+token+").");
  else if(normalized.changed)toast("Jméno bylo uloženo v základním tvaru „"+storedReal+"“. Označený pád zůstává rozpoznatelný.");
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
  setNoHistory(true); suppressWorkingSession();
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
function caseReviewTooltip(entry){
  const reasons=[...new Set([].concat(entry&&entry.reviewReasons||[]).filter(Boolean))];
  return reasons.length?"Odeslání je pozastavené. "+reasons.join(" "):"Odeslání je pozastavené, dokud nepotvrdíš pádové tvary.";
}
function caseWarningHtml(entry){return entry&&entry.caseUnresolved?'<small class="case-warning" title="'+escAttr(caseReviewTooltip(entry))+'">&#9888; Zkontroluj skloňování</small>':'';}
function renderKeyTable(p){
  const st=ST[p],body=E(p,"keyBody");body.innerHTML="";
  st.km.forEach((k,idx)=>{const tr=document.createElement("tr");
    const uses=k.token?(String(st.clean||"").match(new RegExp(escRe(k.token),"g"))||[]).length:0,person=/^osoba\b/.test(k.token||"");
    tr.classList.toggle("case-unresolved",!!k.caseUnresolved);tr.innerHTML='<td><input value="'+escAttr(k.real)+'" data-i="'+idx+'" data-f="real">'+caseWarningHtml(k)+'</td><td class="tok"><input value="'+escAttr(k.token)+'" data-i="'+idx+'" data-f="token"><small title="Počet výskytů značky v odesílaném náhledu">'+uses+'× v náhledu</small></td><td class="key-actions">'+(person?'<button class="case-row" data-cases="'+idx+'" title="Zkontrolovat nebo upravit skloňování jména">1–7</button>':'')+'<button class="del-row" data-del="'+idx+'" title="Smazat">×</button></td>';
    body.appendChild(tr);
  });
  renderKeySummary(p);E(p,"keyEmpty").style.display=st.km.length?"none":"block";
  body.querySelectorAll("input").forEach(inp=>{let timer=null;inp.addEventListener("input",e=>{
    const row=st.km[+e.target.dataset.i];row[e.target.dataset.f]=e.target.value;
    if(e.target.dataset.f==="real"){
      delete row.forms;applyGeneratedCaseReview(row);
      const tr=e.target.closest("tr"),old=tr&&tr.querySelector(".case-warning");
      if(row.caseUnresolved){if(!old)e.target.insertAdjacentHTML("afterend",caseWarningHtml(row));else old.title=caseReviewTooltip(row);}else if(old)old.remove();
      if(tr)tr.classList.toggle("case-unresolved",!!row.caseUnresolved);
    }
    clearAnalysisCache();resetReview(p);clearTimeout(timer);timer=setTimeout(()=>{publishActiveKeyReals(p);ST[p].clean=cleanFromKey(p);renderView(p);renderPreview(p);renderKeySummary(p);renderPersonReferenceChips(p);scheduleWorkingSessionSave();updateSendGate(p);},280);
  });});
  body.querySelectorAll("[data-cases]").forEach(b=>b.onclick=()=>openPersonFormsEditor(p,+b.dataset.cases));
  body.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{st.km.splice(+b.dataset.del,1);afterKeyChange(p);});renderPersonReferenceChips(p);
}
function openPersonFormsEditor(p,idx,forceReview){
  const entry=ST[p]&&ST[p].km&&ST[p].km[idx];if(!entry||!/^osoba\b/.test(entry.token||""))return;
  const auto=generatedPersonForms(entry.real),forms=personFormsForEntry(entry),rows=[];
  for(let c=1;c<=7;c++)rows.push('<label class="case-form-row"><span>'+esc(PERSON_CASE_LABELS[c])+'</span><input data-case="'+c+'" value="'+escAttr(forms[c]||entry.real)+'"></label>');
  const reasons=[...new Set([].concat(entry.reviewReasons||[],auto.reviewReasons||[]).filter(Boolean))],reasonHtml=reasons.length?'<small class="case-review-reason"><b>Důvod kontroly:</b> '+esc(reasons.join(" "))+'</small><br>':'';
  const blocked=entry.caseUnresolved||forceReview;
  openModal("Skloňování: "+entry.real,'<p class="dialog-text">'+(blocked?'<b>Automatika si u tohoto jména není dostatečně jistá. Odeslání je pozastavené, dokud nepotvrdíš všech sedm tvarů.</b><br>'+reasonHtml:'')+'Tvary se použijí pouze lokálně při anonymizaci a vrácení jména; AI model je nikdy nedostane. Potvrzení je součástí této rozpracované práce. Do trvalého slovníku se tvary uloží pouze pozdější výslovnou akcí <b>Uložit jména</b>.</p><div class="case-form-grid">'+rows.join("")+'</div><div class="dialog-actions"><button class="btn ghost case-reset" type="button">Vrátit automatický návrh</button><button class="btn case-save" type="button">Potvrdit tvary</button></div>',{className:"case-editor-modal",onMount(body,close){
    body.querySelector(".case-reset").onclick=()=>{const proposal=generatedPersonForms(entry.real);body.querySelectorAll("[data-case]").forEach(input=>input.value=proposal[+input.dataset.case]||entry.real);};
    body.querySelector(".case-save").onclick=()=>{
      const custom={},inputs=[...body.querySelectorAll("[data-case]")],empty=inputs.find(input=>!input.value.trim());
      if(empty){empty.focus();toast("Vyplň všech sedm pádových tvarů.");return;}
      inputs.forEach(input=>custom[input.dataset.case]=input.value.trim());entry.forms=custom;entry.real=custom[1];applyGeneratedCaseReview(entry);clearAnalysisCache();afterKeyChange(p);scheduleWorkingSessionSave();toast("Tvary byly potvrzeny pro tuto práci. Trvale se uloží až přes Uložit jména.");close();
    };
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
  box.hidden=false;box.innerHTML='<span class="person-reference-title">Vložit bezpečně osobu:</span><div class="person-reference-chips">'+people.map((k,i)=>'<button type="button" class="person-reference-chip" data-person="'+i+'"><b>'+esc(k.token)+'</b><span>'+esc(k.real)+'</span></button>').join("")+'</div><small>Jméno vidíš jen lokálně. Do AI služby se vloží pouze anonymní značka.</small>';
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
  return String(text||"").replace(/\[e-mail \d+\]|\[telefon \d+\]|\[rodné číslo \d+\]|\[datum narození \d+\]|\[číslo účtu \d+\]|\[instituce \d+\]|\[místo \d+\]|\[název \d+\]|\[kontakt \d+\]|\[citlivý údaj \d+\]|\[číslo dokladu \d+\]|\b(?:osoba|osoby|osobě|osobu|osobo|osobou) [A-Z]+\b|\[\[PERSON_[A-Z]+(?:\|[1-7])?\]\]|\[podpis\]|\[učitel\]/g," ");
}
const RE_BIRTH_ID_SRC="\\b\\d{2}[0156]\\d[0-3]\\d\\/?\\d{3,4}\\b";
function reBirthId(flags){return new RegExp(RE_BIRTH_ID_SRC,flags||"");}
function numericIdentityFindings(stripped){
  const source=String(stripped||""),phoneScan=maskDocumentNumbers(source.replace(reAccount("g")," ").replace(/\b\d{6}\/\d{3,4}\b/g," "));
  const phones=phoneScan.match(rePhone("gu"))||[],phoneDigits=new Set(phones.map(x=>x.replace(/\D/g,"")));
  const birthIds=source.match(reBirthId("g"))||[],uncoveredBirthIds=birthIds.filter(x=>!phoneDigits.has(x.replace(/\D/g,"")));
  return {phones,birthIds,uncoveredBirthIds};
}
function likelyDocumentNumber(text){
  const stripped=stripSafeTokens(text),scan=maskDocumentNumbers(stripped.replace(reAccount("g")," "));
  const phone=(scan.match(rePhone("gu"))||[])[0];if(phone)return phone;
  // U desetimístného neoznačeného kódu nabídni lokální překlasifikování. Skutečné RČ
  // s lomítkem nebo výslovným popisem „rodné číslo / RČ“ musí zůstat bez ústupové akce.
  if(/(?:rodn[ée]\s+číslo|(?:^|[^\p{L}])r\.?\s*č\.?)(?:[^\p{L}]|$)/iu.test(stripped))return "";
  return (stripped.match(reBirthId("g"))||[]).find(x=>!x.includes("/"))||"";
}
function preflightIssues(text,p){
  const cacheKey=analysisCacheKey(p,text); if(ANALYSIS_CACHE.preflight.has(cacheKey)) return ANALYSIS_CACHE.preflight.get(cacheKey);
  const stripped=stripSafeTokens(text);
  const danger=[], warn=[], names=[];
  const addD=(x)=>{ if(!danger.includes(x)) danger.push(x); };
  const addW=(x)=>{ if(!warn.includes(x)) warn.push(x); };
  if(/[A-Za-z0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}/u.test(stripped)) addD("e-mail");
  const numeric=numericIdentityFindings(stripped);
  if(numeric.phones.length) addD("telefon");
  if(reAccount().test(stripped)) addD("číslo bankovního účtu");
  if(numeric.uncoveredBirthIds.length) addD("rodné číslo / datumový identifikátor");
  if(/\b(nar\.|narozen(?:a|ý)?|datum narození|datum nar\.)\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}\b/i.test(stripped)) addD("datum narození");
  else if(/\b\d{1,2}\.\s*\d{1,2}\.\s*(?:19|20)\d{2}\b/.test(stripped)) addW("datum – ověř, zda nejde o datum narození");
  if(/(?:^|[^\p{L}\d])[1-4]\.\s?\p{Lu}(?!\p{L})/u.test(stripped)) addW("třída – sama o sobě není identifikátor, ale zkontroluj kombinaci údajů");
  if(unicodeWordRegex("(?:ul\\.|ulic\\p{L}*|náměstí|nábřeží|č\\.p\\.|čp\\.|bytem|adresa)","iu").test(stripped)) addW("výraz související s adresou – zkontroluj kontext");
  if(/ob[čc]ansk\S*\s+pr[uů]kaz/i.test(stripped) || /pr[uů]kaz\S*\s+totožnost/i.test(stripped) || /\bOP[\s.:]*\d{6,10}\b/.test(stripped)) addD("doklad totožnosti (OP / pas)");
  const addrW=stripped.match(new RegExp("(?<![\\p{L}\\p{M}])[\\p{Lu}][\\p{Ll}\\p{M}]*(?:ní|ová|ova|ská|cká|ého)\\s+\\d{1,4}(?!\\d)","gu"));
  if(addrW) addW("možná adresa (ulice + číslo, heuristika): "+addrW.slice(0,2).join(", "));
  if(hasSensitiveSchoolTerms(stripped)) addD("citlivé školní/zdravotní nebo kázeňské údaje");
  // Možná jména zobrazuje jediný zdroj pravdy: suggestionData().
  try{suggestionData(p).suggestions.forEach(x=>{if(x&&x.phrase&&!names.includes(x.phrase))names.push(x.phrase);});}catch(_){}
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
  try{if(p&&ST[p]&&ST[p].km.some(k=>k&&k.caseUnresolved))addD("nezkontrolované skloňování osoby");}catch(_){}
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
      action:sensitive?"Neodesílat konkrétní údaje. Zobecni situaci a odstraň identifikátory.":"Neodesílat, nejdřív uprav text."
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
  if(!audit || (audit.level!=="nosend"&&audit.level!=="danger")){
    el.className="safe-fallback";
    el.innerHTML="";
    return;
  }
  const danger=preflightIssues(ST[p].clean||"",p).danger;
  const onlyTermHeuristic=danger.length>0 && danger.every(x=>/citlivé/.test(x));
  const documentCandidate=likelyDocumentNumber(ST[p].clean||"");
  const numericOnly=danger.length>0 && danger.every(x=>/(?:telefon|rodné číslo)/.test(x)) && !!documentCandidate;
  el.className="safe-fallback show";
  el.innerHTML='<div class="sf-head"><b>Další bezpečný krok bez AI:</b> můžeš si vytvořit obecnou odpověď, která neobsahuje konkrétní citlivé údaje.</div><div class="sf-note">Tlačítko níže pouze lokálně zobrazí šablonu. Nevolá AI službu, neodesílá text a nemění původní náhled.</div><div class="sf-actions"><button type="button" class="btn ghost small" data-safe-fallback="'+escAttr(p)+'"><span class="action-icon" data-ic="life"></span>Vytvořit bezpečnou obecnou verzi</button>'+(onlyTermHeuristic?'<button type="button" class="btn ghost small" data-ack-sensitive="'+escAttr(p)+'">Posoudil(a) jsem to — nejde o citlivý údaj, pokračovat</button>':'')+(numericOnly?'<button type="button" class="btn ghost small" data-docnum="'+escAttr(p)+'">Není to telefon, je to číslo dokladu</button>':'')+'</div><div class="sf-output" id="'+escAttr(p)+'_safeFallbackOutput"></div>';
  const btn=el.querySelector("[data-safe-fallback]"); if(btn) btn.onclick=()=>showSafeFallback(p);
  const docBtn=el.querySelector("[data-docnum]");
  if(docBtn)docBtn.onclick=()=>{
    const found=likelyDocumentNumber(ST[p].clean||"");if(!found)return toast("Číslo se nepodařilo určit.");
    addPhraseAs(p,found,"docnum");toast("Číslo bylo anonymizováno jako číslo dokladu.");
  };
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
function preserveInitialCase(source,value){
  if(!source)return value;
  return source[0]===source[0].toLocaleUpperCase("cs-CZ")?value[0].toLocaleUpperCase("cs-CZ")+value.slice(1):value.toLocaleLowerCase("cs-CZ");
}
function czechVocativeWord(word,context){const forms=declineNameWord(word,context||{});return forms[5]||String(word||"");}
function nameParts(real){
  const titles=/^(?:mgr|ing|bc|mudr|rndr|phdr|judr|doc|prof)\.?$/i;
  return String(real||"").replace(/[<>]/g," ").split(/\s+/).map(x=>x.replace(/^[,.;:]+|[,.;:]+$/g,"")).filter(x=>x&&!titles.test(x));
}
function salutationName(values,lead){
  const entries=(values||[]).map(value=>typeof value==="string"?{real:value}:value).filter(value=>value&&value.real);
  const one=entries.filter(entry=>nameParts(entry.real).length===1).sort((a,b)=>String(a.real).length-String(b.real).length)[0];
  const canonical=entries.slice().sort((a,b)=>String(b.real).length-String(a.real).length)[0]||null,selected=one||canonical;
  if(!selected)return "";
  const parts=nameParts(selected.real);if(!parts.length)return String(selected.real||"");
  const useLast=/\b(?:pane|paní)\s*$/i.test(String(lead||""));
  const confirmed=selected.forms&&selected.forms[5]?nameParts(selected.forms[5]):[];
  if(confirmed.length)return useLast?confirmed[confirmed.length-1]:confirmed[0];
  const analysis=generatedPersonForms(selected.real),word=useLast?parts[parts.length-1]:parts[0];
  return czechVocativeWord(word,{gender:analysis.gender,role:useLast?"surname":"given"});
}
function genericPersonCase(word){
  const lo=String(word||"").toLocaleLowerCase("cs-CZ");
  if(lo==="osoby")return 2;if(lo==="osobě")return 3;if(lo==="osobu")return 4;if(lo==="osobo")return 5;if(lo==="osobou")return 7;return 1;
}
function canonicalPersonEntry(entries){return [...(entries||[])].sort((a,b)=>String(b.real||"").length-String(a.real||"").length)[0]||null;}
function normalizeDirectRecipientReference(p,text){
  let t=String(text||"");
  if(p!=="in")return t;
  const sal=t.match(/(?:^|\n)\s*(?:Ahoj|Milý|Milá|Vážený(?:\s+pane)?|Vážená(?:\s+paní)?|Pane|Paní|Dobrý den|Dobrý večer)\s*,?\s*(?:osoba|osoby|osobě|osobu|osobo|osobou)\s+([A-Z][A-Z0-9_-]*)/i);
  if(!sal)return t;
  const label=sal[1],mode=ST[p]&&ST[p].replyAddressingMode||"vykani",dative=mode==="tykani"?"ti":"Vám",accusative=mode==="tykani"?"tě":"Vás";
  const dativeVerb=new RegExp("(\\b(?:dám|dáme|pošlu|pošleme|sdělím|sdělíme|napíšu|napíšeme|potvrdím|potvrdíme|oznámím|oznámíme|připomenu|připomeneme|vysvětlím|vysvětlíme|předám|předáme|řeknu|řekneme|ozvu se|ozveme se)\\s+)osobě\\s+"+escRe(label)+"\\b","gi");
  const accusativeVerb=new RegExp("(\\b(?:kontaktuji|kontaktujeme|oslovím|oslovíme|upozorním|upozorníme)\\s+)osobu\\s+"+escRe(label)+"\\b","gi");
  t=t.replace(dativeVerb,(m,lead)=>lead+dative).replace(accusativeVerb,(m,lead)=>lead+accusative);
  return t;
}
function recompose(p,text){
  let t=normalizeDirectRecipientReference(p,String(text||""));
  const groups=new Map();
  (ST[p].km||[]).forEach(k=>{if(!k||!k.token||!k.real)return;const arr=groups.get(k.token)||[];arr.push(k);groups.set(k.token,arr);});
  [...groups.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([token,entries])=>{
    const canonicalEntry=canonicalPersonEntry(entries),canonical=canonicalEntry&&canonicalEntry.real||"";
    if(/^osoba\b/.test(token)){
      const label=parsePersonToken(token),forms=personFormsForEntry(canonicalEntry||{real:canonical});
      const salRe=new RegExp("((?:(?:Ahoj|Milý|Milá|Vážený|Vážená|Pane|Paní)\\s+|(?:Dobrý den|Dobrý večer)\\s*,?\\s*))"+escRe(token)+"(?=\\s*[,!?.]|\\s|$)","gi");
      t=t.replace(salRe,(m,lead)=>lead+salutationName(entries,lead));
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
    return '<span class="token t-sign visible-signature" contenteditable="false" data-sign-token="[podpis]" title="Podpis se doplňuje lokálně z profilu a neposílá se AI modelu.">'+esc(signature)+'</span>';
  });
  return html;
}

