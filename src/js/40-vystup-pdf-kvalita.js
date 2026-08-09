const OutputParser={
  parse(raw){
    const src=String(raw||'').trim();
    const jsonParts=tryParseWorksheetJson(src);
    if(jsonParts){
      const worksheet=[jsonParts.title,jsonParts.instructions,jsonParts.tasks].map(x=>String(x||'').trim()).filter(Boolean).join('\n\n');
      return {worksheet:worksheet||jsonParts.tasks||src,answerKey:jsonParts.answerKey||'',parts:jsonParts,structured:true,structureType:'json',raw:src};
    }
    const hasStructured=/<<<\s*(?:WORKSHEET_TITLE|STUDENT_INSTRUCTIONS|TASKS|ANSWER_KEY|TEACHER_NOTE)\s*>>>/i.test(src);
    if(hasStructured){
      const parts={
        title:getMarkedSection(src,'WORKSHEET_TITLE'),
        instructions:getMarkedSection(src,'STUDENT_INSTRUCTIONS'),
        tasks:getMarkedSection(src,'TASKS'),
        answerKey:getMarkedSection(src,'ANSWER_KEY'),
        teacherNote:getMarkedSection(src,'TEACHER_NOTE')
      };
      const worksheet=[parts.title,parts.instructions,parts.tasks].map(x=>String(x||'').trim()).filter(Boolean).join('\n\n');
      return {worksheet:worksheet||parts.tasks||src,answerKey:parts.answerKey||'',parts,structured:true,structureType:'markers',raw:src};
    }
    const m=src.match(/<<<\s*WORKSHEET\s*>>>([\s\S]*?)(?:<<<\s*ANSWER_KEY\s*>>>([\s\S]*))?$/i);
    const worksheet=m?((m[1]||'').trim()):src;
    const answerKey=m?((m[2]||'').trim()):'';
    return {worksheet,answerKey,parts:{title:'',instructions:'',tasks:worksheet,answerKey,teacherNote:''},structured:false,structureType:'fallback',raw:src};
  }
};
const OutputValidator={
  validate(parsed){
    const issues=[];
    const p=(parsed&&parsed.parts)||{};
    if(!parsed||!String(parsed.worksheet||'').trim())issues.push('Model nevrátil použitelný text pracovního listu.');
    if(!parsed||!parsed.structured)issues.push('Model nedodržel JSON strukturu výstupu; aplikace použila záložní zpracování.');
    if(parsed&&parsed.structured&&parsed.structureType!=='json')issues.push('Model použil starší značkovací strukturu místo nového JSON schématu; výstup zkontroluj.');
    if(parsed&&parsed.structured&&!String(p.tasks||'').trim())issues.push('Chybí samostatná položka tasks; zkontroluj, zda jsou úlohy v listu úplné.');
    if(parsed&&parsed.structured&&!String(p.answerKey||'').trim())issues.push('Chybí samostatný klíč answer_key; tlačítko Řešení ho může dogenerovat.');
    if(parsed&&/<<<\s*(?:WORKSHEET_TITLE|STUDENT_INSTRUCTIONS|TASKS|ANSWER_KEY|TEACHER_NOTE|WORKSHEET)\s*>>>/i.test(String(parsed.worksheet||'')))issues.push('Technické značky se dostaly do viditelného pracovního listu.');
    return {ok:issues.length===0,issues};
  },
  render(validation){
    if(!validation||validation.ok)return '';
    return '<div class="kh"><span class="teacher-kicker">Učitelská část</span> Upozornění ke struktuře výstupu</div><div>Materiál byl vytvořen, ale před použitím zkontroluj tyto body:</div><ul>'+validation.issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
  }
};
function parseWorksheetResponse(raw){return OutputParser.parse(raw)}
function validateWorksheetResponse(parsed){return OutputValidator.validate(parsed)}
function renderStructureWarning(validation){return OutputValidator.render(validation)}
function showStructureWarning(sheet,validation){
  const box=sheet.querySelector('.structurebox'); if(!box)return;
  const html=renderStructureWarning(validation);
  box.innerHTML=html; box.classList.toggle('show',!!html);
}

/* Opak funkce render(): vrátí z upraveného HTML čistý text i s markery **tučného**. */
function editableToText(el){
  const walk=node=>{
    if(node.nodeType===3)return node.nodeValue;
    if(node.nodeType!==1)return '';
    const inner=[...node.childNodes].map(walk).join('');
    const tag=node.tagName;
    if(tag==='B'||tag==='STRONG')return inner.trim()?'**'+inner.trim()+'**':inner;
    if(tag==='BR')return '\n';
    if(tag==='DIV'||tag==='P')return inner+'\n';
    return inner;
  };
  return [...el.childNodes].map(walk).join('').replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').trim();
}
function toggleEdit(sheet,btn){
  const body=sheet.querySelector('.body');
  const editing=body.isContentEditable||body.getAttribute('contenteditable')==='true';
  if(editing){
    const original=String(sheet._text||'').trim(),txt=editableToText(body);
    body.contentEditable='false';body.removeAttribute('contenteditable');
    if(txt===original){body.innerHTML=render(original);attachSheetTools(sheet);return}
    sheet._text=txt;
    sheet._key='';
    sheet._quality='';
    sheet._parts={...(sheet._parts||{}),tasks:txt,answerKey:'',teacherNote:''};
    sheet._validation={ok:true,issues:[]};sheet._pdfWarningSkipped=false;
    const sbox=sheet.querySelector('.structurebox');if(sbox){sbox.innerHTML='';sbox.classList.remove('show')}
    const box=sheet.querySelector('.keybox');box.innerHTML='';box.classList.remove('show');delete box.dataset.filled;
    const qbox=sheet.querySelector('.qualitybox');if(qbox){qbox.innerHTML='';qbox.classList.remove('show')}
    body.innerHTML=render(txt);renderTeacherNote(sheet);attachSheetTools(sheet);
    setSheetStatus(sheet,'upraveno · zkontroluj','needcheck');
  }else{
    body.contentEditable='true';body.setAttribute('contenteditable','true');btn.textContent='Hotovo';body.focus();
  }
}

let pendingPdfSheet=null;
let pendingPdfTitle='';
let pendingPdfText='';
function closePdfCheck(){
  const ov=$('#pdfCheckOverlay'); if(ov)ov.classList.remove('show');
}
const PrintPdf={
  request(sheet,title,text){
    const hasStructureIssues=!!(sheet&&sheet._validation&&!sheet._validation.ok&&!sheet._pdfWarningSkipped);
    const needsQuality=!!(sheet&&!sheet._quality);
    if(sheet && (needsQuality||hasStructureIssues)){
      pendingPdfSheet=sheet; pendingPdfTitle=title; pendingPdfText=text||'';
      const tier=TIERS[sheet._tierKey]||{name:'Verze'};
      const msg=$('#pdfCheckText');
      const extra=hasStructureIssues?' Navíc je u výstupu upozornění ke struktuře: '+sheet._validation.issues[0]:' ';
      if(msg)msg.textContent=tier.name+' verze ještě '+(needsQuality?'neprošla kontrolou kvality.':'má strukturální upozornění.')+' Před stažením PDF je vhodné zkontrolovat věcnou správnost, jazyk, zadání i řešení.'+extra;
      const ov=$('#pdfCheckOverlay'); if(ov)ov.classList.add('show');
      return;
    }
    downloadPdf(title,text||'',{});
  }
};
function requestPdfForSheet(sheet,title,text){PrintPdf.request(sheet,title,text)}

let pendingPrintHtml='';
let pendingPrintFileName='';
let previousDocumentTitle='';
function downloadPdf(title,rawText,opts){
  opts=opts||{};
  const splitBody = opts.split===false
    ? '<div class="pa-ex">'+render(rawText)+'</div>'
    : buildPrintBody(rawText);
  const keyTag = opts.isKey ? '<div class="pa-keytag">Řešení / klíč — nedávat studentům</div>' : '';
  const head=printHead()+metaLine(opts.isKey)+keyTag+'<h2>'+esc(title)+'</h2>';
  const body='<div class="pa-body">'+splitBody+'</div>';
  pendingPrintHtml=head+body;
  pendingPrintFileName=filenameSafe(title)+(opts.isKey?'-reseni':'');
  $('#printArea').innerHTML=pendingPrintHtml;
  $('#printPreview').innerHTML=head+'<div class="pa-body">'+splitBody+'</div>';
  const pf=$('#printFileName'); if(pf){pf.textContent='Doporučený název souboru: '+pendingPrintFileName+'.pdf';pf.classList.add('show')}
  const teacherConfirm=$('#printTeacherConfirmed'); if(teacherConfirm)teacherConfirm.checked=false;
  const printConfirm=$('#printConfirm'); if(printConfirm)printConfirm.disabled=true;
  $('#printOverlay').classList.add('show');
}
$('#printCancel').addEventListener('click',()=>$('#printOverlay').classList.remove('show'));
$('#printOverlay').addEventListener('click',e=>{if(e.target.id==='printOverlay')$('#printOverlay').classList.remove('show')});
$('#pdfCheckOverlay').addEventListener('click',e=>{if(e.target.id==='pdfCheckOverlay')closePdfCheck()});
const printTeacherConfirmed=$('#printTeacherConfirmed');
if(printTeacherConfirmed)printTeacherConfirmed.addEventListener('change',()=>{const b=$('#printConfirm');if(b)b.disabled=!printTeacherConfirmed.checked});
$('#pdfCheckContinue').addEventListener('click',()=>{
  const title=pendingPdfTitle, text=pendingPdfText;
  if(pendingPdfSheet)pendingPdfSheet._pdfWarningSkipped=true;
  closePdfCheck(); pendingPdfSheet=null; pendingPdfTitle=''; pendingPdfText='';
  downloadPdf(title||'Verze',text||'',{});
});
$('#pdfCheckRun').addEventListener('click',()=>{
  const sheet=pendingPdfSheet;
  closePdfCheck();
  if(sheet){
    const btn=sheet.querySelector('[data-act="quality"]');
    checkQuality(sheet,btn||{disabled:false,innerHTML:''});
  }
});
$('#printConfirm').addEventListener('click',()=>{
  if(printTeacherConfirmed&&!printTeacherConfirmed.checked)return;
  $('#printOverlay').classList.remove('show');
  if(pendingPrintHtml)$('#printArea').innerHTML=pendingPrintHtml;
  previousDocumentTitle=document.title;
  if(pendingPrintFileName)document.title=pendingPrintFileName;
  document.body.classList.add('do-print');
  window.print();
});
window.addEventListener('afterprint',()=>{document.body.classList.remove('do-print');if(previousDocumentTitle){document.title=previousDocumentTitle;previousDocumentTitle=''}});
document.addEventListener('click',e=>{
  const b=e.target.closest('.key-pdf-btn');
  if(!b)return;
  const sheet=b.closest('.sheet');
  if(sheet&&sheet._key)downloadKeyPdf(sheet);
});

function keyHeaderHtml(){
  return '<div class="kh kh-row"><span>Řešení</span>'
    +'<span><span class="teacher-kicker">Učitelská část</span></span><button class="btn tiny soft key-pdf-btn" title="Stáhne samostatné PDF s klíčem (bez řádku Jméno, s upozorněním „nedávat studentům").">Stáhnout řešení (PDF)</button></div>';
}
function downloadKeyPdf(sheet){
  const tier=TIERS[sheet._tierKey]||{name:'Verze'};
  downloadPdf(tier.name+' verze — řešení', sheet._key||'', {isKey:true, split:false});
}
async function toggleKey(sheet,btn){
  const box=sheet.querySelector('.keybox');
  if(sheet._key){
    // klíč už máme — jen přepneme zobrazení a (poprvé) vyplníme obsah
    if(!box.dataset.filled){box.innerHTML=keyHeaderHtml()+render(sheet._key);box.dataset.filled='1'}
    box.classList.toggle('show');
    return;
  }
  if(!requireApiKeyForAction('vytvoření řešení'))return;
  btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<span class="mini"></span>';
  try{
    const out=await callGemini([{text:"Ke každé úloze v tomto pracovním listu napiš stručné správné řešení / klíč. Vycházej výhradně z pracovního listu níže a zachovej jazyk úloh. Pouze klíč, očíslovaně podle úloh, bez úvodu.\n\nPRACOVNÍ LIST:\n"+sheet._text}],{thinking:THINKING_CHEAP,operation:'answer-key-generation'});
    sheet._key=out;
    box.innerHTML=keyHeaderHtml()+render(out);box.dataset.filled='1';
    box.classList.add('show');attachSheetTools(sheet);
  }catch(err){box.innerHTML='<div class="err">'+esc(friendlyApiMessage(err))+'</div>';box.classList.add('show')}
  finally{btn.disabled=false;btn.innerHTML=old}
}


function getOptionState(){return {
  useCefr:!!($('#cefr')&&$('#cefr').checked&&subjectAllowsCefr())
}}
function filenameSafe(s){return String(s||'pracovni-list').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'pracovni-list'}
const UiState={
  setSheetStatus(sheet,text,state){const el=sheet.querySelector('.sheet-status');if(!el)return;el.textContent=text||'';el.className='sheet-status '+(state||'')}
};
function setSheetStatus(sheet,text,state){UiState.setSheetStatus(sheet,text,state)}
const PromptBuilder={
  makeTierPrompt(key,base,batch=1){
    const t=TIERS[key], opt=getOptionState();
    const tierInstruction=(key==='core'&&batch>1)?'Vytvoř NORMÁLNÍ referenční verzi celé sady: zachovej původní obsah, příklady, data, počet položek, pořadí, formát odpovědí, strukturu i obtížnost. Nepřidávej ani neubírej oporu; měň jen to, co je nezbytné pro čisté a použitelné zpracování.':t.instr;
    const subject=getSubjectValue()||"daný předmět / obor";
    const add=[
      variantModePromptLine(key,batch),
      'U otevřených úloh ponech přiměřené místo na odpověď žáka.',
      opt.useCefr?'CEFR použij pouze jako jazykovou obtížnost; u nejazykových předmětů CEFR nepoužívej.':'CEFR nepoužívej; pracuj jen s obecnou úrovní obtížnosti.',
      ...advancedPromptLines()
    ];
    const jsonSchema=[
      'VNITŘNÍ STRUKTURA VÝSTUPU: Odpověz pouze platným JSON objektem bez Markdownu, bez komentáře před/po a bez code fence. Použij přesně tyto klíče. Hodnoty piš jako textové řetězce; pokud poznámka pro učitele není nutná, nech teacher_note prázdné.',
      '{',
      '  "worksheet_title": "krátký název pracovního listu nebo testu",',
      '  "student_instructions": "instrukce pro žáky, které mají být vidět v pracovním listu",',
      '  "tasks": "samotné očíslované úlohy / cvičení v čisté podobě pro žáky",',
      '  "answer_key": "stručný klíč/řešení podle úloh, ve stejném pořadí",',
      '  "teacher_note": "volitelná krátká poznámka pro učitele; nevkládej sem nic, co má být v žákovské verzi"',
      '}'
    ].join('\n');
    return [
      'Jsi zkušený učitel ('+subject+'). Z následujícího zadání vytvoř jeho odstupňovanou verzi.',
      tierInstruction+(opt.useCefr?' '+t.cefr:''),
      add.length?'DOPLŇUJÍCÍ NASTAVENÍ:\n- '+add.join('\n- '):'',
      'JAZYK A ODBORNOST: Zachovej přesně jazyk nebo kombinaci jazyků původního zadání u každé úlohy. Nepřekládej žádný cizojazyčný ani odborný text do češtiny. Diferencuj obtížnost, oporu a formulaci, ne předmětovou pravdivost. Zachovej odbornou terminologii, symboly, vzorce, jednotky, značky, data, tabulky a standardní zápis daného předmětu. Pokud je některá část česky nebo přidáváš českou instrukci, čeština musí být bezchybná: gramaticky, stylisticky i lexikálně, bez hovorových neobratností, bez kalků, bez pravopisných a interpunkčních chyb. Tučně (**takto**) zvýrazni jen nadpisy a názvy úloh.',
      jsonSchema,
      'PŮVODNÍ ZADÁNÍ:',
      base
    ].filter(Boolean).join('\n\n');
  }
};
function makePromptForTier(key,base,batch=1){return PromptBuilder.makeTierPrompt(key,base,batch)}

const ZAP='<span class="zap-cost">⚡ 1</span>';
const ZAP_GENERATE='<span class="zap-cost">⚡ 1+</span>';
function renderTeacherNote(sheet){
  const box=sheet&&sheet.querySelector('.teacherbox');if(!box)return;
  const note=sheet._parts&&String(sheet._parts.teacherNote||'').trim();
  box.innerHTML=note?'<div class="kh"><span class="teacher-kicker">Učitelská část</span> Poznámka pro učitele</div>'+render(note):'';
  box.classList.toggle('show',!!note);
}
function snapshotSheet(sheet){return {tierKey:sheet._tierKey,text:sheet._text,key:sheet._key,quality:sheet._quality,parts:JSON.parse(JSON.stringify(sheet._parts||{})),structured:sheet._structured,validation:JSON.parse(JSON.stringify(sheet._validation||{ok:true,issues:[]})),html:sheet.innerHTML,statusClass:sheet.className,pdfWarningSkipped:sheet._pdfWarningSkipped}}
function restoreSheetSnapshot(sheet,snap){sheet._tierKey=snap.tierKey;sheet._text=snap.text;sheet._key=snap.key;sheet._quality=snap.quality;sheet._parts=snap.parts;sheet._structured=snap.structured;sheet._validation=snap.validation;sheet._pdfWarningSkipped=snap.pdfWarningSkipped;sheet.className=snap.statusClass;sheet.innerHTML=snap.html;attachSheetTools(sheet)}
function makeSheet(key,loading){
  const t=TIERS[key];
  const sheet=document.createElement('div');
  sheet.className='sheet';sheet.dataset.t=t.color;sheet._tierKey=key;sheet._text='';sheet._key='';sheet._quality='';sheet._parts={title:'',instructions:'',tasks:'',answerKey:'',teacherNote:''};sheet._structured=false;sheet._validation={ok:true,issues:[]};sheet._pdfWarningSkipped=false;
  sheet.innerHTML='<div class="hd"><div class="tier-head"><span class="tier-icon">'+(t.icon||'📄')+'</span><span class="tier-text"><span class="nm">'+t.name+'</span>'+(t.cefrLbl?'<span class="level-badge">'+t.cefrLbl+'</span>':'')+'</span></div><span class="sheet-status '+(loading?'busy':'')+'">'+(loading?'generuji…':'připraveno')+'</span><span class="tools"></span></div><div class="student-section-head">Žákovská verze</div><div class="body">'+(loading?'<span class="muted"><span class="mini"></span> generuji…</span>':'')+'</div><div class="teacherbox"></div><div class="structurebox"></div><div class="keybox"></div><div class="qualitybox"></div>';
  attachSheetTools(sheet);
  return sheet;
}
function attachSheetTools(sheet){
  const tools=sheet.querySelector('.tools'); if(!tools)return; tools.innerHTML='';
  const tier=TIERS[sheet._tierKey]||{name:'Verze'};
  const mk=(label,fn,kind='',tip='',act='')=>{const b=document.createElement('button');b.className='btn tiny '+kind;b.innerHTML=label;if(tip)b.title=tip;if(act)b.dataset.act=act;b.onclick=()=>fn(b);return b};
  const main=document.createElement('span');main.className='tool-group primary';main.dataset.label='Doporučený postup';
  const more=document.createElement('span');more.className='tool-group secondary';more.dataset.label='Další úpravy';
  const qualityReady=!!sheet._quality,keyReady=!!sheet._key;
  main.append(
    mk('1 '+(qualityReady?'Zobrazit kontrolu':'Kontrola '+ZAP),b=>checkQuality(sheet,b),'soft',qualityReady?'Zobrazí již hotový audit bez dalšího API dotazu.':'Model zkontroluje věcnou a jazykovou správnost a úplnost řešení. Stojí 1 dotaz.','quality'),
    mk('2 '+(keyReady?'Zobrazit řešení':'Vytvořit řešení '+ZAP),b=>toggleKey(sheet,b),'soft',keyReady?'Zobrazí nebo skryje již vytvořený klíč bez dalšího API dotazu.':'Vytvoří klíč správných odpovědí. Stojí 1 dotaz.'),
    mk('3 Stáhnout PDF',()=>requestPdfForSheet(sheet,tier.name+' verze',sheet._text||''),'primary','Před PDF připomene kontrolu kvality. Potom otevře náhled a systémový dialog pro uložení nebo tisk.')
  );
  more.append(
    mk('Upravit',b=>toggleEdit(sheet,b),'soft','Umožní ručně přepsat text listu. Po skutečné změně se zahodí řešení, kontrola kvality i poznámka pro učitele.'),
    mk('Kopírovat',b=>copyText(sheet._text,b,'Zkopírováno','Kopírovat'),'soft','Zkopíruje celý text listu do schránky.'),
    mk('Export .md',b=>exportSheetMarkdown(sheet,b),'soft','Stáhne kompletní materiál v Markdownu včetně řešení, poznámky pro učitele a kontroly kvality. Nesdílej ho se žáky.'),
    mk('Regenerovat '+ZAP_GENERATE,b=>regenerateSheet(sheet,b),'soft','Vytvoří tentýž stupeň obtížnosti znovu. Obvykle stojí 1 dotaz; při automatické opravě struktury může použít ještě jeden.')
  );
  tools.append(main,more);
}

async function repairWorksheetJson(raw,validation,base,key){
  const t=TIERS[key]||TIERS.core;
  const issues=(validation&&validation.issues||[]).join('\n- ');
  const prompt=[
    'Převeď následující odpověď modelu na čistý platný JSON podle přesného schématu. Neměň věcný obsah, jen oprav strukturu. Pokud chybí answer_key, vytvoř stručný klíč podle úloh. Odpověz pouze JSONem, bez Markdownu a bez komentáře.',
    'Schéma: worksheet_title, student_instructions, tasks, answer_key, teacher_note. Všechny hodnoty musí být textové řetězce.',
    'Cílová verze: '+(t.name||'Normální')+'.',
    issues?'Zjištěné problémy:\n- '+issues:'',
    'PŮVODNÍ ZADÁNÍ:\n'+String(base||'').slice(0,8000),
    'ODPOVĚĎ K OPRAVĚ:\n'+String(raw||'')
  ].filter(Boolean).join('\n\n');
  return callGemini([{text:prompt}],{json:true,schema:WORKSHEET_RESPONSE_SCHEMA,operation:'worksheet-structure-repair'});
}

async function generateIntoSheet(sheet,key,base,idx,total){
  const t=TIERS[key];
  setSheetStatus(sheet,'generuji…','busy');
  sheet.querySelector('.body').innerHTML='<span class="muted"><span class="mini"></span> generuji…</span>';
  sheet.querySelector('.keybox').innerHTML='';sheet.querySelector('.keybox').classList.remove('show');delete sheet.querySelector('.keybox').dataset.filled;
  sheet.querySelector('.qualitybox').innerHTML='';sheet.querySelector('.qualitybox').classList.remove('show');
  const structureBox=sheet.querySelector('.structurebox');if(structureBox){structureBox.innerHTML='';structureBox.classList.remove('show')}
  setProgress((total>1?'Verze '+(idx+1)+' z '+total+': ':'Generuji ')+t.name.toLowerCase()+' verzi…',true);
  const out=await callGemini([{text:makePromptForTier(key,base,total)}],{json:true,schema:WORKSHEET_RESPONSE_SCHEMA,operation:'worksheet-generation'});
  let parsed=parseWorksheetResponse(out);
  let validation=validateWorksheetResponse(parsed);
  if(!validation.ok){
    try{
      setProgress('Opravuji strukturu výstupu…',true);
      const fixed=await repairWorksheetJson(out,validation,base,key);
      const fixedParsed=parseWorksheetResponse(fixed);
      const fixedValidation=validateWorksheetResponse(fixedParsed);
      if(fixedParsed&&String(fixedParsed.worksheet||'').trim()&&(fixedValidation.ok||fixedValidation.issues.length<validation.issues.length)){
        parsed=fixedParsed;validation=fixedValidation;
      }
    }catch(_){/* původní výstup zůstane zachovaný a zobrazí se varování */}
  }
  if(!String(parsed&&parsed.worksheet||'').trim())throw makeAppError('Model nevrátil použitelný pracovní list. Původní výstup zůstává zachovaný.','INCOMPLETE_RESPONSE');
  sheet._tierKey=key;sheet._text=parsed.worksheet;sheet._key=parsed.answerKey;sheet._quality='';sheet._parts=parsed.parts||{title:'',instructions:'',tasks:parsed.worksheet,answerKey:parsed.answerKey,teacherNote:''};sheet._structured=!!parsed.structured;sheet._validation=validation;sheet._pdfWarningSkipped=false;
  sheet.querySelector('.body').innerHTML=render(sheet._text);
  renderTeacherNote(sheet);
  showStructureWarning(sheet,validation);
  attachSheetTools(sheet);
  setSheetStatus(sheet,validation.ok?'hotovo · zkontroluj':'hotovo · ověř strukturu',validation.ok?'needcheck':'warn');
}
function recordDifferentiatorTelemetry(attempted,successful,failed,cancelled=0){
  if(IS_TEST_MODE)return;
  if(!window.GHRABTelemetry){try{console.info('Telemetrie není dostupná mimo AI Studio.')}catch(_){}return}
  try{
    window.GHRABTelemetry?.recordOutput({
      outputKind:'worksheet-variant',
      attemptedQuantity:attempted,
      successfulQuantity:successful,
      failedQuantity:failed,
      cancelledQuantity:cancelled,
      outcome:failed&&successful?'partial':failed?'error':successful?'success':'cancelled'
    });
  }catch(error){console.warn('Telemetrie Diferenciátoru se nezapsala.',error);}
}
async function regenerateSheet(sheet,btn){
  const base=$('#baseText').value.trim();
  if(!base){showMessage('Chybí základní zadání','Nejdřív načti nebo vlož zadání, ze kterého se má verze znovu vytvořit.');return}
  if(!requireApiKeyForAction('regeneraci verze'))return;
  const oldLabel=btn.innerHTML,snapshot=snapshotSheet(sheet);btn.disabled=true;btn.innerHTML='<span class="mini"></span>';
  try{await generateIntoSheet(sheet,sheet._tierKey,base,0,1);recordDifferentiatorTelemetry(1,1,0);setProgress('Hotovo. Zkontroluj vytvořenou verzi.',false)}
  catch(err){recordDifferentiatorTelemetry(1,0,1);restoreSheetSnapshot(sheet,snapshot);setSheetStatus(sheet,'původní verze zachována','warn');setProgress('Regenerace se nepodařila. Původní verze zůstala zachovaná.',false);showMessage('Regenerace se nepodařila',friendlyApiMessage(err)+' Původní hotová verze zůstala beze změny.')}
  finally{btn.disabled=false;btn.innerHTML=oldLabel;attachSheetTools(sheet)}
}
function renderQualityAudit(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.replace(/^\s*[-*•]\s*/,'').trim()).filter(Boolean);
  const cls=l=>{const s=l.toLowerCase();
    if(/^ok\b|^v pořádku|^✓/.test(s))return 'qa-ok';
    if(/^oprav|^chyb|^opravit/.test(s))return 'qa-fix';
    if(/^doporuč|^zváž|^zvaž/.test(s))return 'qa-rec';
    return 'qa-plain'};
  const tag=k=>k==='qa-ok'?'OK':k==='qa-fix'?'Opravit':k==='qa-rec'?'Doporučení':'';
  return lines.map(l=>{const k=cls(l);const t=tag(k);
    const labelled=/^(?:ok|oprav\w*|doporuč\w*|zváž|zvaž)\s*[:：]\s*/i.test(l);
    const body=labelled?l.replace(/^[^:：]{1,14}[:：]\s*/,''):l;
    return '<div class="qa-item '+k+'">'+(t?'<span class="qa-tag">'+t+'</span>':'')+esc(body||l)+'</div>'}).join('');
}
const QualityCheck={
  makePrompt(sheet){
    const parts=sheet._parts||{};
    const structuredContext=sheet._structured?([
      '',
      'VNITŘNÍ ČÁSTI PRO KONTROLU:',
      'NÁZEV:', parts.title||'',
      '',
      'INSTRUKCE PRO ŽÁKY:', parts.instructions||'',
      '',
      'ÚLOHY:', parts.tasks||'',
      '',
      'POZNÁMKA PRO UČITELE:', parts.teacherNote||''
    ].join('\n')):'';
    const validationContext=(sheet._validation&&!sheet._validation.ok)?([
      '',
      'STRUKTURNÍ UPOZORNĚNÍ APLIKACE:',
      '- '+sheet._validation.issues.join('\n- '),
      'Při kontrole výslovně ověř, zda tento problém neohrožuje použitelnost materiálu.'
    ].join('\n')):'';
    return [
      'Zkontroluj tento pracovní list nebo test před použitím ve škole. Ber kontrolu jako pomocný audit, ne jako definitivní garanci správnosti.',
      'Zaměř se na: 1) věcnou správnost a zachování odborného zápisu, 2) soulad s požadovanou diferenciací a zvolenou variantou, 3) jazykovou správnost, 4) úplnost a použitelnost řešení, 5) rizika nejasného zadání, 6) přiměřenost rozsahu a času, 7) zachování formátu, počtu úloh a bodovatelnosti tam, kde to má být zachováno, 8) přítomnost hlavního pedagogického cíle a ověřovaných dovedností, 9) možná citlivá data, jména žáků nebo údaje, které je vhodné anonymizovat.',
      'Pokud jsou v textu české pasáže, uplatni nulovou toleranci ke gramatickým, stylistickým a lexikálním chybám.',
      'Vrať krátký audit v češtině, každý bod na samostatném řádku, každý řádek začni jedním ze štítků OK: / Opravit: / Doporučení: podle závažnosti. Bez úvodu a bez závěru.',
      structuredContext,
      validationContext,
      'PRACOVNÍ LIST:',
      sheet._text||'',
      'ŘEŠENÍ:',
      sheet._key||''
    ].filter(x=>x!==null&&x!==undefined&&String(x).length).join('\n\n');
  }
};
let qualityActiveSheet=null;
function openQuality(sheet){
  qualityActiveSheet=sheet;
  const tier=TIERS[sheet._tierKey]||{name:'Verze'};
  $('#qualityTierLbl').textContent=tier.name+' verze · audit před použitím ve škole.';
  $('#qualityBody').innerHTML=renderQualityAudit(sheet._quality);
  $('#qualityOverlay').classList.add('show');
}
async function checkQuality(sheet,btn){
  if(sheet._quality){openQuality(sheet);return}
  if(!requireApiKeyForAction('kontrolu kvality'))return;
  btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<span class="mini"></span>';
  try{
    const prompt=QualityCheck.makePrompt(sheet);
    const out=await callGemini([{text:prompt}],{thinking:THINKING_CHEAP,operation:'worksheet-quality-audit'});
    sheet._quality=out;setSheetStatus(sheet,'zkontrolováno','ok');attachSheetTools(sheet);openQuality(sheet);
  }catch(err){sheet._quality='';showMessage('Kontrola se nepodařila',friendlyApiMessage(err))}
  finally{btn.disabled=false;btn.innerHTML=old}
}
$('#qualityClose').addEventListener('click',()=>$('#qualityOverlay').classList.remove('show'));
$('#qualityOverlay').addEventListener('click',e=>{if(e.target.id==='qualityOverlay')$('#qualityOverlay').classList.remove('show')});
$('#qualityInsert').addEventListener('click',()=>{
  if(!qualityActiveSheet||!qualityActiveSheet._quality)return;
  const box=qualityActiveSheet.querySelector('.qualitybox');
  box.innerHTML='<div class="kh"><span class="teacher-kicker">Učitelská část</span> Kontrola kvality</div>'+render(qualityActiveSheet._quality);
  box.classList.add('show');
  $('#qualityOverlay').classList.remove('show');
});


