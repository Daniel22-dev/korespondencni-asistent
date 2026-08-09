const IS_TEST_MODE=new URLSearchParams(window.location.search).has('test')||String(window.location.hash||'').toLowerCase().includes('test');

const CEFR_PREF_SK='dpl_cefr_language_pref';

const WORKSHEET_RESPONSE_SCHEMA={
  type:'OBJECT',
  properties:{
    worksheet_title:{type:'STRING'},
    student_instructions:{type:'STRING'},
    tasks:{type:'STRING'},
    answer_key:{type:'STRING'},
    teacher_note:{type:'STRING'}
  },
  required:['worksheet_title','student_instructions','tasks','answer_key','teacher_note']
};
const PROJECT_SCHEMA_VERSION=1;

const TIERS = {
  support:{name:"Jednodušší",color:"support",icon:"🧩",
    instr:"Vytvoř JEDNODUŠŠÍ verzi pro slabší žáky. Přidej oporu: u úloh nabídni slovní banku nebo výběr z možností, doplň krátkou nápovědu, zjednoduš a zkrať formulace, u otevřených otázek nech předvyplněný začátek odpovědi. Stejné téma i počet hlavních úloh, jen snazší cesta k řešení.",
    cefr:"",cefrLbl:""},
  core:{name:"Normální",color:"core",icon:"📘",
    instr:"Vytvoř NORMÁLNÍ verzi: zachovej stejný typ úloh, stejný formát odpovědí, stejný počet položek, stejné pořadí a stejnou celkovou strukturu jako originál. Obtížnost má zůstat stejná. Změň konkrétní obsah úloh (např. jiná čísla, jiné věty, jiné otázky, jiný krátký text nebo jiná data), aby nešlo o doslovnou parafrázi, ale o plnohodnotnou novou variantu se stejnou náročností. Žádnou oporu nepřidávej ani neubírej a nevymýšlej nový typ cvičení.",
    cefr:"",cefrLbl:""},
  extend:{name:"Obtížnější",color:"extend",icon:"🚀",
    instr:"Vytvoř OBTÍŽNĚJŠÍ verzi pro nadané žáky. Uber oporu, otevřené otázky místo výběru, náročnější formulace a na závěr přidej jednu úlohu navíc, která vyžaduje aplikaci, srovnání nebo vlastní úsudek.",
    cefr:"",cefrLbl:""}
};
const CEFR_SCALE=["A1","A2","B1","B2","C1","C2"];
const DEFAULT_TIER_DESCRIPTIONS={
  support:'— víc opory: slovní banka, nápověda, výběr z možností',
  core:'— stejná obtížnost; obsah/forma podle pedagogického zpřesnění',
  extend:'— méně opory, otevřené úlohy, úloha navíc na úsudek'
};
function refreshTierBadges(){
  document.querySelectorAll('#results .sheet').forEach(sheet=>{
    const t=TIERS[sheet._tierKey]; if(!t)return;
    const holder=sheet.querySelector('.tier-text'); if(!holder)return;
    const badge=holder.querySelector('.level-badge');
    if(t.cefrLbl){
      if(badge)badge.textContent=t.cefrLbl;
      else holder.insertAdjacentHTML('beforeend','<span class="level-badge">'+esc(t.cefrLbl)+'</span>');
    } else if(badge)badge.remove();
  });
}
function applyCefrLevels(centerLevel){
  const idx=CEFR_SCALE.indexOf(centerLevel);
  const dsS=document.getElementById('dsSupport'), dsC=document.getElementById('dsCore'), dsE=document.getElementById('dsExtend');
  if(idx<0){
    TIERS.support.cefrLbl="";TIERS.core.cefrLbl="";TIERS.extend.cefrLbl="";TIERS.support.cefr="";TIERS.core.cefr="";TIERS.extend.cefr="";
    if(dsS)dsS.textContent=DEFAULT_TIER_DESCRIPTIONS.support;
    if(dsC)dsC.textContent=DEFAULT_TIER_DESCRIPTIONS.core;
    if(dsE)dsE.textContent=DEFAULT_TIER_DESCRIPTIONS.extend;
    const lvl0=$('#levelDetect'); if(lvl0)lvl0.classList.remove('show');
    refreshTierBadges();updateCefrRunButton();
    return;
  }
  const below=CEFR_SCALE[Math.max(0,idx-1)], at=CEFR_SCALE[idx], above=CEFR_SCALE[Math.min(CEFR_SCALE.length-1,idx+1)];
  TIERS.support.cefrLbl=below; TIERS.support.cefr="Cílová jazyková úroveň: "+below+".";
  TIERS.core.cefrLbl=at;       TIERS.core.cefr="Cílová jazyková úroveň: "+at+" (zachovej stejnou úroveň jako originál).";
  TIERS.extend.cefrLbl=above;  TIERS.extend.cefr="Cílová jazyková úroveň: "+above+".";
  const lvl=$('#levelDetect');
  if(lvl){lvl.classList.add('show');lvl.textContent='Odhadnutá úroveň zadání: '+at+' → Jednodušší '+below+' · Normální '+at+' · Obtížnější '+above;}
  if(dsS)dsS.textContent='— víc opory, cílová úroveň '+below;
  if(dsC)dsC.textContent='— stejná obtížnost, úroveň '+at+'; obsah/forma podle pedagogického zpřesnění';
  if(dsE)dsE.textContent='— méně opory, úloha navíc, úroveň '+above;
  refreshTierBadges();updateCefrRunButton();
}
function updateCefrRunButton(){
  const btn=document.getElementById('cefrRunBtn'),cefr=document.getElementById('cefr');if(!btn)return;
  const showBtn=!!(cefr&&cefr.checked&&subjectAllowsCefr()&&!TIERS.core.cefrLbl);
  btn.classList.toggle('hide',!showBtn);
}

let cefrBusy=false;
function setCefrNote(text,state){
  const n=document.getElementById('cefrNote'); if(!n)return;
  n.textContent=text||''; n.classList.remove('warn','busy','ok'); if(state)n.classList.add(state);
}
async function detectCefrForBase(text){
  const base=String(text||'').trim();
  if(!base){applyCefrLevels(null);setCefrNote('CEFR je zapnutý, ale nejdřív je potřeba načíst zadání.','warn');return}
  if(!requireApiKeyForAction('CEFR odhad')){applyCefrLevels(null);setCefrNote('CEFR odhad se nespustil: chybí API klíč.','warn');return}
  if(cefrBusy)return;
  cefrBusy=true;setCefrNote('Odhaduji CEFR úroveň…','busy');
  try{
    const forcedNote=isCefrForced()?'CEFR je ručně vynucený, protože název předmětu nemusel být rozpoznán. Přesto vrať NEPLATÍ, pokud materiál ve skutečnosti není jazykový. ':'';
    const lvlRaw=await callGemini([{text:forcedNote+"Urči jazykovou úroveň podle CEFR (A1, A2, B1, B2, C1 nebo C2) tohoto materiálu pro výuku jazyka. Pokud materiál NENÍ jazykový (např. matematika, dějepis, fyzika v rodném jazyce), odpověz přesně slovem NEPLATÍ. Odpověz POUZE jedním z těchto kódů, nic jiného: A1 A2 B1 B2 C1 C2 NEPLATÍ\n\nMATERIÁL:\n"+base}],{thinking:THINKING_CHEAP,operation:'cefr-detection'});
    const raw=String(lvlRaw||'').trim().toUpperCase();
    const lvl=raw.match(/A1|A2|B1|B2|C1|C2/);
    applyCefrLevels(lvl?lvl[0]:null);
    setCefrNote(lvl?'CEFR odhad je aktivní: '+lvl[0]+'. Úrovně se propíšou do tří voleb.':'Model nevyhodnotil materiál jako jazykový. CEFR úrovně nejsou použity.',lvl?'ok':'warn');
  }catch(err){applyCefrLevels(null);setCefrNote('CEFR odhad se nepodařil: '+friendlyApiMessage(err),'warn')}
  finally{cefrBusy=false}
}
function normalizeSubjectCode(value){
  return String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
}
function looksLikeLanguageSubject(value){
  const raw=String(value||'').trim();
  const s=normalizeSubjectCode(raw);
  // Kmeny pokrývají podstatné i přídavné jméno: „angličtina“ i „anglický jazyk“, „němčina“ i „německý jazyk“.
  if(/(cestina pro cizince|czech as a foreign language|anglick|anglict|english|spanel|spanish|nemeck|nemcin|german|francouz|french|italsk|italst|italian|rusk|rust|russian|latin|cizi jazyk|foreign language)/i.test(s))return true;
  const tokens=s.split(/[^a-z0-9]+/).filter(Boolean);
  // „čj/cj“ je čeština a „it“ bývá informatika; obě zkratky by dávaly falešné CEFR nálezy.
  const abbrev=new Set(['aj','anj','ang','en','eng','sj','spj','spa','esp','nj','nej','nem','de','ger','fj','frj','fra','fr','ij','itj','ita','rj','ruj','rus','ru','lj','lat']);
  return tokens.some(t=>abbrev.has(t));
}
function getSubjectValue(){return $('#subject')?$('#subject').value.trim():''}
function isCefrForced(){return !!($('#cefrForce')&&$('#cefrForce').checked)}
function subjectAllowsCefr(){
  const subject=getSubjectValue();
  return isCefrForced() || (!!subject && looksLikeLanguageSubject(subject));
}
function saveCefrPreference(enabled){try{localStorage.setItem(CEFR_PREF_SK,enabled?'1':'0')}catch(_){}}
function loadCefrPreference(){try{return localStorage.getItem(CEFR_PREF_SK)==='1'}catch(_){return false}}
function setCefrCheckedState(checked){const c=$('#cefr');if(c)c.checked=!!checked}
function syncCefrHintFromSubject(){
  const cefr=$('#cefr'); if(!cefr)return;
  const subject=getSubjectValue();
  const isLanguage=looksLikeLanguageSubject(subject);
  const forced=isCefrForced();
  if(cefr.checked && subject && !isLanguage && !forced){
    cefr.checked=false;saveCefrPreference(false);applyCefrLevels(null);
    setCefrNote('CEFR byl vypnutý: předmět nevypadá jako jazykový. Použijí se jen úrovně obtížnosti. Pokud jde opravdu o jazyk, zapni ruční vynucení CEFR.','warn');updateCefrRunButton();
    return;
  }
  if(cefr.checked && forced && subject && !isLanguage){
    setCefrNote('CEFR je ručně vynucený. Použij to jen u jazykového materiálu s nerozpoznaným názvem předmětu.','warn');updateCefrRunButton();
    return;
  }
  if(!cefr.checked){
    if(isLanguage)setCefrNote('Vypadá to na jazykový předmět. CEFR můžeš zapnout ručně, pokud chceš odvodit úrovně A1–C2.','warn');
    else if(forced)setCefrNote('CEFR je vypnutý, ale ruční vynucení je připravené. Zapni CEFR jen pokud jde skutečně o jazykový materiál.','warn');
    else setCefrNote('CEFR je vypnutý. U nejazykových předmětů aplikace používá jen úrovně obtížnosti.');
  }
  updateCefrRunButton();
}
function restoreCefrPreference(){
  const shouldRestore=loadCefrPreference();
  setCefrCheckedState(shouldRestore);
  if(shouldRestore)syncCefrHintFromSubject();
}

const toSelector=s=>{s=String(s||'');return /^[A-Za-z][\w:-]*$/.test(s)?'#'+s:s};
const $=s=>document.querySelector(toSelector(s));
const show=el=>el.classList.remove('hide'), hide=el=>el.classList.add('hide');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const render=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
function errBox(t,m){if(t)t.innerHTML='<div class="err" role="alert">'+esc(String(m||''))+'</div>'}
function clearErr(t){t.innerHTML=''}

function selectedTierKey(){const sel=document.querySelector('#tiers input:checked');return sel&&sel.dataset?sel.dataset.tier:'core'}
function setSelectedTierKey(key){const wanted=key||'core';document.querySelectorAll('#tiers input').forEach(i=>{i.checked=(i.dataset.tier===wanted);i.dispatchEvent(new Event('change'))});}
function getAdvancedOptions(){return {
  targetGroup:($('#advTargetGroup')?$('#advTargetGroup').value.trim():''),
  workTime:($('#advWorkTime')?$('#advWorkTime').value.trim():''),
  learningGoal:($('#advLearningGoal')?$('#advLearningGoal').value.trim():''),
  variantMode:($('#advVariantMode')?$('#advVariantMode').value:'auto'),
  structureMode:($('#advStructureMode')?$('#advStructureMode').value:'auto'),
  supportType:($('#advSupportType')?$('#advSupportType').value.trim():''),
  teacherInstruction:($('#advTeacherInstruction')?$('#advTeacherInstruction').value.trim():'')
}}
function resetAdvancedSettings(){['advTargetGroup','advWorkTime','advLearningGoal','advSupportType','advTeacherInstruction'].forEach(id=>{const el=$(id);if(el)el.value=''});const variant=$('#advVariantMode');if(variant)variant.value='auto';const mode=$('#advStructureMode');if(mode)mode.value='auto';const force=$('#cefrForce');if(force)force.checked=false;const det=$('#advancedSettings');if(det)det.open=false}
function variantModePromptLine(key,batch=1){
  const a=getAdvancedOptions();
  const mode=a.variantMode||'auto';
  if(mode==='same_content_diff_difficulty')return 'Režim nové verze: stejný obsah, jiná obtížnost. Zachovej tematický obsah, učivo, konkrétní příklady, data, čísla, texty a výukový cíl co nejvíce; měň hlavně míru opory, složitost formulací, počet mezikroků, typ nápovědy a požadovanou hloubku odpovědi podle zvolené úrovně.';
  if(mode==='same_format_new_content')return 'Režim nové verze: stejný formát, jiný obsah. Vytvoř paralelní variantu: zachovej formát, počet úloh, typy úloh, pořadí, bodovatelnost a srovnatelnou obtížnost podle zvolené úrovně, ale změň konkrétní obsah, věty, příklady, data nebo kontext tak, aby nevznikla kopie původního testu.';
  if(mode==='same_content_same_format')return 'Režim nové verze: stejný obsah i formát. Zachovej obsah, formát, pořadí, počet položek a typ odpovědí; proveď jen nezbytné úpravy formulací, míry opory, nápovědy, členění a nároků na odpověď podle zvolené úrovně.';
  if(mode==='same_goal_flexible')return 'Režim nové verze: stejný výukový cíl, volnější varianta. Zachovej hlavní výukový cíl, téma a ověřované dovednosti, ale můžeš změnit konkrétní obsah i strukturu, pokud výsledná verze zůstane pedagogicky srovnatelná a použitelná pro zvolenou úroveň.';
  if(batch>1){
    if(key==='core')return 'Režim nové verze: automaticky. U Normální verze zachovej původní obsah a strukturu a ponech i stejnou obtížnost; jde o referenční variantu sady.';
    return 'Režim nové verze: automaticky. Při tvorbě celé sady zachovej původní obsah a strukturu co nejvíce a měň hlavně míru opory, složitost formulací, počet mezikroků a hloubku odpovědi podle zvolené úrovně.';
  }
  if(key==='core')return 'Režim nové verze: automaticky. U Normální verze vytvoř paralelní variantu se stejnou obtížností: zachovej typ úloh, formát odpovědí, počet položek, pořadí a strukturu, ale změň konkrétní obsah, aby vznikla nová varianta, ne kopie původního materiálu.';
  return 'Režim nové verze: automaticky. U Jednodušší/Obtížnější verze zachovej původní obsah a strukturu co nejvíce a měň hlavně míru opory, složitost formulací, počet mezikroků a hloubku odpovědi podle zvolené úrovně.';
}
function advancedPromptLines(){
  const a=getAdvancedOptions(), out=[];
  if(a.targetGroup)out.push('Cílová skupina: '+a.targetGroup+'.');
  if(a.workTime)out.push('Přizpůsob rozsah a náročnost času na vypracování: '+a.workTime+'.');
  if(a.learningGoal)out.push('Nadřazený výukový cíl / očekávaný výstup, který musí zachovat všechny varianty: '+a.learningGoal+'.');
  if(a.structureMode==='strict')out.push('Co nejpřesněji zachovej původní strukturu, pořadí, počet položek a formát odpovědí.');
  if(a.structureMode==='flexible')out.push('Strukturu můžeš rozumně upravit, pokud to pedagogicky pomůže diferenciaci, ale zachovej původní cíl materiálu.');
  if(a.supportType)out.push('Preferovaný typ podpory nebo výzvy: '+a.supportType+'.');
  if(a.teacherInstruction)out.push('Vlastní pokyn učitele: '+a.teacherInstruction);
  return out;
}
function downloadTextFile(filename,text,type='text/plain;charset=utf-8'){
  const blob=new Blob([String(text||'')],{type});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=filename||'export.txt';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);
}
function getAppFormState(){return {
  pasteText:$('#pasteText')?$('#pasteText').value:'',
  baseText:$('#baseText')?$('#baseText').value:'',
  subject:$('#subject')?$('#subject').value:'',
  cefr:!!($('#cefr')&&$('#cefr').checked),
  cefrForce:!!($('#cefrForce')&&$('#cefrForce').checked),
  selectedTier:selectedTierKey(),
  meta:{subject:$('#mSubject')?$('#mSubject').value:'',topic:$('#mTopic')?$('#mTopic').value:'',className:$('#mClass')?$('#mClass').value:'',date:$('#mDate')?$('#mDate').value:''},
  advanced:getAdvancedOptions()
}}
function applyAppFormState(s){
  s=s||{};
  if($('#pasteText'))$('#pasteText').value=s.pasteText||'';
  if($('#baseText'))$('#baseText').value=s.baseText||'';
  if($('#subject'))$('#subject').value=s.subject||'';
  if($('#cefr'))$('#cefr').checked=!!s.cefr;
  if($('#cefrForce'))$('#cefrForce').checked=!!s.cefrForce;
  setSelectedTierKey(s.selectedTier||'core');
  const m=s.meta||{};
  if($('#mSubject'))$('#mSubject').value=m.subject||s.subject||'';
  if($('#mTopic'))$('#mTopic').value=m.topic||'';
  if($('#mClass'))$('#mClass').value=m.className||'';
  if($('#mDate'))$('#mDate').value=m.date||'';
  const a=s.advanced||{};
  if($('#advTargetGroup'))$('#advTargetGroup').value=a.targetGroup||'';
  if($('#advWorkTime'))$('#advWorkTime').value=a.workTime||'';
  if($('#advLearningGoal'))$('#advLearningGoal').value=a.learningGoal||'';
  if($('#advVariantMode'))$('#advVariantMode').value=a.variantMode||'auto';
  if($('#advStructureMode'))$('#advStructureMode').value=a.structureMode||'auto';
  if($('#advSupportType'))$('#advSupportType').value=a.supportType||'';
  if($('#advTeacherInstruction'))$('#advTeacherInstruction').value=a.teacherInstruction||'';
  syncCefrHintFromSubject();
}
const PROJECT_APP='Diferenciátor pracovních listů a testů';
const MAX_PROJECT_FILE_BYTES=2*1024*1024;
const MAX_PROJECT_SHEETS=12;
function safeProjectText(value,max=MAX_TEXT_CHARS){return (typeof value==='string'||typeof value==='number')?String(value).slice(0,max):''}
function normalizeProjectForm(form){
  form=(form&&typeof form==='object'&&!Array.isArray(form))?form:{};
  const meta=(form.meta&&typeof form.meta==='object'&&!Array.isArray(form.meta))?form.meta:{};
  const advanced=(form.advanced&&typeof form.advanced==='object'&&!Array.isArray(form.advanced))?form.advanced:{};
  const tier=['support','core','extend'].includes(form.selectedTier)?form.selectedTier:'core';
  return {
    pasteText:safeProjectText(form.pasteText),baseText:safeProjectText(form.baseText),subject:safeProjectText(form.subject,300),
    cefr:!!form.cefr,cefrForce:!!form.cefrForce,selectedTier:tier,
    meta:{subject:safeProjectText(meta.subject,300),topic:safeProjectText(meta.topic,500),className:safeProjectText(meta.className,200),date:safeProjectText(meta.date,100)},
    advanced:{targetGroup:safeProjectText(advanced.targetGroup,500),workTime:safeProjectText(advanced.workTime,200),learningGoal:safeProjectText(advanced.learningGoal,1000),variantMode:['auto','same_content_diff_difficulty','same_format_new_content','same_content_same_format','same_goal_flexible'].includes(advanced.variantMode)?advanced.variantMode:'auto',structureMode:['auto','strict','flexible'].includes(advanced.structureMode)?advanced.structureMode:'auto',supportType:safeProjectText(advanced.supportType,500),teacherInstruction:safeProjectText(advanced.teacherInstruction,2000)}
  };
}
function normalizeProjectSheet(item){
  item=(item&&typeof item==='object'&&!Array.isArray(item))?item:{};
  const tierKey=['support','core','extend'].includes(item.tierKey)?item.tierKey:'core';
  const text=safeProjectText(item.text),answerKey=safeProjectText(item.answerKey),quality=safeProjectText(item.quality);
  const rawParts=(item.parts&&typeof item.parts==='object'&&!Array.isArray(item.parts))?item.parts:{};
  const parts={title:safeProjectText(rawParts.title,1000),instructions:safeProjectText(rawParts.instructions,5000),tasks:safeProjectText(rawParts.tasks||text),answerKey:safeProjectText(rawParts.answerKey||answerKey),teacherNote:safeProjectText(rawParts.teacherNote,5000)};
  const parsed={worksheet:text,answerKey,parts,structured:!!item.structured,structureType:item.structured?'json':'fallback'};
  return {tierKey,text,answerKey,quality,parts,structured:!!item.structured,validation:validateWorksheetResponse(parsed)};
}
function normalizeProject(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||data.app!==PROJECT_APP||Number(data.schemaVersion)!==PROJECT_SCHEMA_VERSION)throw makeAppError('Soubor není kompatibilní projekt této verze Diferenciátoru.','BAD_PROJECT');
  const sheets=(Array.isArray(data.sheets)?data.sheets:[]).slice(0,MAX_PROJECT_SHEETS).map(normalizeProjectSheet);
  return {...data,form:normalizeProjectForm(data.form),sheets};
}
function collectProjectSheets(){return Array.from(document.querySelectorAll('#results .sheet')).map(sheet=>({
  tierKey:sheet._tierKey||'core',text:sheet._text||'',answerKey:sheet._key||'',quality:sheet._quality||'',parts:sheet._parts||{},structured:!!sheet._structured,validation:sheet._validation||{ok:true,issues:[]}
})).filter(x=>x.text||x.answerKey||x.quality)}
function serializeProject(){return {app:PROJECT_APP,schemaVersion:PROJECT_SCHEMA_VERSION,release:RELEASE.version,exportedAt:new Date().toISOString(),note:'Soubor neobsahuje API klíč.',form:getAppFormState(),sheets:collectProjectSheets()}}
async function exportProject(){
  const data=serializeProject();
  const base=filenameSafe((data.form&&data.form.meta&&data.form.meta.topic)||data.form.subject||'diferenciator-projekt');
  try{
    if(window.GHRABArtifact?.download)await window.GHRABArtifact.download({appId:'differentiator',appVersion:RELEASE.version,artifactType:'differentiator-project',sensitivity:'internal',contentManifest:[{kind:'project',schema:PROJECT_APP+'-project-v'+PROJECT_SCHEMA_VERSION}],payload:data,filename:base+'-projekt.ghrab.json'});
    else downloadTextFile(base+'-projekt.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
    showMessage('Projekt exportován','Rozpracovaná práce byla uložena do kontrolovaného JSON souboru. API klíč se do projektu neukládá.');
  }catch(error){showMessage('Projekt se nepodařilo exportovat',friendlyApiMessage(error));}
}
function restoreProjectSheet(item){
  const sheet=makeSheet(item.tierKey||'core',false);
  sheet._tierKey=item.tierKey||'core';sheet._text=item.text||'';sheet._key=item.answerKey||'';sheet._quality=item.quality||'';sheet._parts=item.parts||{title:'',instructions:'',tasks:item.text||'',answerKey:item.answerKey||'',teacherNote:''};sheet._structured=!!item.structured;sheet._validation=item.validation||validateWorksheetResponse({worksheet:sheet._text,structured:true,structureType:'json',parts:sheet._parts});sheet._pdfWarningSkipped=false;
  sheet.querySelector('.body').innerHTML=render(sheet._text||'');
  renderTeacherNote(sheet);
  showStructureWarning(sheet,sheet._validation);
  if(sheet._quality){const q=sheet.querySelector('.qualitybox');if(q){q.innerHTML='<div class="kh"><span class="teacher-kicker">Učitelská část</span> Kontrola kvality</div>'+render(sheet._quality);q.classList.add('show')}}
  attachSheetTools(sheet);
  setSheetStatus(sheet,'obnoveno · zkontroluj','needcheck');
  return sheet;
}
function applyProject(data){
  data=normalizeProject(data);
  uploaded=null;if(typeof fileInput!=='undefined'&&fileInput)fileInput.value='';
  const fc=$('#filechip');if(fc)fc.classList.remove('show');const th=$('#thumb');if(th)th.classList.remove('show');setUploadInfo('');
  applyAppFormState(data.form);
  const results=$('#results');if(results)results.innerHTML='';
  const sheets=data.sheets;
  sheets.forEach(item=>results.appendChild(restoreProjectSheet(item)));
  hide($('#inputPanel'));show($('#configPanel'));
  if(sheets.length){show($('#resultsPanel'));setResultSummary(sheets.length)}else hide($('#resultsPanel'));
  setStatus('statusInput','projekt načten','ok');setStatus('statusFlow','projekt obnoven','ok');
  if($('#progressStrip'))$('#progressStrip').classList.remove('show');
  window.scrollTo({top:0,behavior:'smooth'});
}
function importProjectFile(file){
  if(!file)return;
  if(file.size>MAX_PROJECT_FILE_BYTES){showMessage('Projekt se nepodařilo načíst','Projektový soubor je příliš velký. Bezpečný limit je '+humanBytes(MAX_PROJECT_FILE_BYTES)+'.');return}
  const reader=new FileReader();
  reader.onload=async()=>{try{const raw=String(reader.result||'');const unpacked=window.GHRABArtifact?.unwrapMaybe?await window.GHRABArtifact.unwrapMaybe(raw,{allowLegacy:true,expectedAppId:'differentiator',verifyChecksum:true}):{payload:JSON.parse(raw)};applyProject(unpacked.payload);showMessage('Projekt načten','Rozpracovaná práce byla obnovena. API klíč se z projektu nenačítá.')}catch(e){showMessage('Projekt se nepodařilo načíst',friendlyApiMessage(e))}};
  reader.onerror=()=>showMessage('Projekt se nepodařilo načíst','Soubor se nepodařilo přečíst.');
  reader.readAsText(file);
}
function makeMarkdownDocument(sheet){
  const tier=TIERS[sheet._tierKey]||{name:'Verze'};
  const parts=['> UČITELSKÝ SOUBOR — obsahuje řešení a poznámky. Nedávat studentům.','# '+tier.name+' verze'];
  const meta=[];
  if($('#mSubject')&&$('#mSubject').value.trim())meta.push('**Předmět:** '+$('#mSubject').value.trim());
  if($('#mTopic')&&$('#mTopic').value.trim())meta.push('**Téma:** '+$('#mTopic').value.trim());
  if($('#mClass')&&$('#mClass').value.trim())meta.push('**Třída:** '+$('#mClass').value.trim());
  if($('#mDate')&&$('#mDate').value.trim())meta.push('**Datum:** '+$('#mDate').value.trim());
  if(meta.length)parts.push(meta.join('  \n'));
  parts.push(sheet._text||'');
  if(sheet._key)parts.push('## Řešení\n\n'+sheet._key);
  if(sheet._parts&&sheet._parts.teacherNote)parts.push('## Poznámka pro učitele\n\n'+sheet._parts.teacherNote);
  if(sheet._quality)parts.push('## Kontrola kvality\n\n'+sheet._quality);
  return parts.filter(Boolean).join('\n\n');
}
function exportSheetMarkdown(sheet,btn){
  const tier=TIERS[sheet._tierKey]||{name:'verze'};
  const base=filenameSafe(($('#mTopic')&&$('#mTopic').value.trim())||($('#mSubject')&&$('#mSubject').value.trim())||tier.name||'pracovni-list');
  const name=base+'-ucitelsky.md';
  downloadTextFile(name,makeMarkdownDocument(sheet),'text/markdown;charset=utf-8');
  if(btn){const old=btn.textContent;btn.textContent='Exportováno';setTimeout(()=>btn.textContent=old,1400)}
}
function updateDataSummary(){
  const rows=[];
  const keyState=geminiApiKey?'jen pro relaci':'není uložen';
  rows.push('<div class="data-row"><b>API klíč:</b> '+esc(keyState)+'</div>');
  rows.push('<div class="data-row"><b>Nastavení:</b> model, vzhled, CEFR volba a stav úvodní nápovědy jsou uloženy jen v tomto prohlížeči. Pedagogické zpřesnění je součástí pracovního projektu pouze po ručním exportu.</div>');
  rows.push('<div class="data-row"><b>Rozpracovaná práce:</b> aktuálně je v paměti stránky; pro bezpečné uložení použij Exportovat projekt.</div>');
  const box=$('#dataSummary');if(box)box.innerHTML=rows.join('');
}
function openDataManagement(){updateDataSummary();$('#dataOverlay').classList.add('show')}
function closeDataManagement(){$('#dataOverlay').classList.remove('show')}
function clearPreferenceData(){
  ['dpl_guide_seen',CEFR_PREF_SK,MODEL_SK,THEME_SK].forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
  resetAdvancedSettings();loadModel();loadTheme();restoreCefrPreference();closeDataManagement();showMessage('Nastavení smazáno','Uložené preference byly odstraněny. API klíč zůstal beze změny.');updateDataSummary();
}
function clearWorkingData(){
  uploaded=null;if(typeof fileInput!=='undefined'&&fileInput)fileInput.value='';
  $('#pasteText').value='';$('#baseText').value='';$('#subject').value='';$('#mSubject').value='';$('#mTopic').value='';$('#mClass').value='';$('#mDate').value='';
  resetAdvancedSettings();$('#results').innerHTML='';hide($('#resultsPanel'));hide($('#configPanel'));show($('#inputPanel'));
  const fc=$('#filechip');if(fc)fc.classList.remove('show');const th=$('#thumb');if(th)th.classList.remove('show');setUploadInfo('');
  setStatus('statusInput','čeká na zadání','');setStatus('statusFlow','připraveno','ok');closeDataManagement();showMessage('Pracovní data vyčištěna','Aktuální zadání a výstupy byly vyčištěny. API klíč ani uložené preference se nesmazaly.');updateDataSummary();
}

$('#foot').innerHTML='<div class="footer-tools"><div class="tools-wrap"><button class="footer-tools-btn" id="footerToolsBtn" type="button" aria-expanded="false" aria-controls="footerToolsMenu">Nástroje a nápověda ▴</button><div class="footer-tools-menu" id="footerToolsMenu"><button id="exportProjectBtn" type="button" title="Uloží rozpracovaný stav bez API klíče do souboru JSON">💾 Exportovat projekt</button><button id="importProjectBtn" type="button" title="Načte dříve exportovaný projekt">📂 Načíst projekt</button><button id="dataManageBtn" type="button" title="Správa lokálních dat v tomto prohlížeči">🧹 Správa dat</button><button class="test-toggle" id="testToggle" type="button" title="Otevře interní testovací nástroj" aria-expanded="false">🧪 Testy</button><button id="changelogBtn" type="button" title="Zobrazí poslední změny v aplikaci">📝 Změny</button><button id="helpBtn" type="button">❔ Jak to funguje?</button></div></div><div class="footer-tools-hint">Nápověda, projekty, správa dat a release testy jsou dostupné tady.</div></div><div data-ghrab-footer-branding></div>';
window.GHRAB_PLATFORM?.mountFooter?.($('#foot'));

function parseChangeEntry(entry){
  const text=String(entry||'').trim();
  let m=text.match(/^(.+?)\s*\(([^)]+)\):\s*(.*)$/);
  if(m)return {title:m[1],version:m[2],body:m[3]};
  m=text.match(/^(\d+\.\d+\.\d+):\s*(.*)$/);
  if(m)return {title:'Verze '+m[1],version:m[1],body:m[2]};
  return {title:'Změna',version:'',body:text};
}
function renderChangelog(){
  const list=$('#changelogList'), badge=$('#currentVersionBadge');
  if(badge)badge.textContent='Verze '+RELEASE.version+' · '+RELEASE.date+((RELEASE.build&&RELEASE.build!=='__BUILD__')?(' · build '+RELEASE.build):'');
  if(!list)return;
  list.innerHTML=RELEASE.changes.slice(0,10).map(change=>{
    const item=parseChangeEntry(change);
    return '<article class="change-item"><div class="change-title"><strong>'+esc(item.title)+'</strong>'+(item.version?'<span class="change-version">'+esc(item.version)+'</span>':'')+'</div><p>'+esc(item.body)+'</p></article>';
  }).join('');
}


function closeFooterTools(){
  const menu=$('#footerToolsMenu'), btn=$('#footerToolsBtn');
  if(menu)menu.classList.remove('open');
  if(btn)btn.setAttribute('aria-expanded','false');
}
function initFooterTools(){
  const btn=$('#footerToolsBtn'), menu=$('#footerToolsMenu');
  if(!btn||!menu)return;
  btn.addEventListener('click',e=>{
    e.preventDefault(); e.stopPropagation();
    const open=!menu.classList.contains('open');
    menu.classList.toggle('open',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
  });
  menu.addEventListener('click',()=>closeFooterTools());
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&e.target!==btn)closeFooterTools()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFooterTools()});
}
initFooterTools();

const projectImportInput=document.createElement('input');
projectImportInput.type='file';projectImportInput.accept='application/json,.json';projectImportInput.className='hide';projectImportInput.id='projectImportInput';
document.body.appendChild(projectImportInput);
projectImportInput.addEventListener('change',()=>{const f=projectImportInput.files&&projectImportInput.files[0];projectImportInput.value='';importProjectFile(f)});
$('#exportProjectBtn').addEventListener('click',exportProject);
$('#importProjectBtn').addEventListener('click',()=>projectImportInput.click());
$('#dataManageBtn').addEventListener('click',openDataManagement);
$('#dataClose').addEventListener('click',closeDataManagement);
$('#dataOverlay').addEventListener('click',e=>{if(e.target.id==='dataOverlay')closeDataManagement()});
$('#dataClearKey').addEventListener('click',()=>{clearKey();updateDataSummary();closeDataManagement();showMessage('API klíč smazán','Klíč byl odstraněn z relace a případná stará trvalá kopie byla smazána.')});
$('#dataClearPrefs').addEventListener('click',clearPreferenceData);


function setStatus(id,value,state){
  const el=$(id); if(!el)return;
  const v=el.querySelector('.v'); if(v)v.textContent=value;
  el.classList.remove('ok','warn','busy');
  if(state)el.classList.add(state);
}
function tierWord(n){return n===1?'verze':(n>=2&&n<=4?'verze':'verzí')}
function setProgress(text,showIt=true){
  const strip=$('#progressStrip'), target=$('#progressText');
  if(target)target.textContent=text||'';
  if(strip)strip.classList.toggle('show',!!showIt);
  setStatus('statusFlow',text||'připraveno',showIt?'busy':'ok');
}
function setResultSummary(count){
  const banner=$('#resultBanner'), summary=$('#resultSummary');
  const verb=count===1?'připravena':(count>=2&&count<=4?'připraveny':'připraveno');
  if(summary)summary.textContent=count+' '+tierWord(count)+' '+verb+' ke kontrole';
  if(banner)banner.classList.add('show');
}

const KEY_SK="dpl_gemini_key", KEY_SESSION_SK="dpl_gemini_key_session", MODEL_SK="dpl_gemini_model";
