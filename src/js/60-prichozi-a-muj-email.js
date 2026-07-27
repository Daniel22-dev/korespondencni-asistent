function replyAllowsEmoji(note){
  const s=String(note||"").toLowerCase();
  if(!/(?:emoji|emotikon|smajl)/i.test(s)) return false;
  return !/(?:bez|žádn|zadn|nepouž|nepouz|vynech|odstraň|odstran)/i.test(s);
}
function stripReplyEmoji(text){
  return String(text||"")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D]/gu,"")
    .replace(/[ \t]+([,.;:!?])/g,"$1")
    .replace(/[ \t]{2,}/g," ")
    .replace(/^[ \t]+|[ \t]+$/gm,"")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function recordCorrespondenceTelemetry(outputKind,attempted,successful,failed,cancelled=0){
  if(IS_TEST_MODE||TEST_RUN_ACTIVE)return;
  if(!window.GHRABTelemetry){ try{ logOp("telemetry","unavailable",{outputKind}); }catch(_){} return; }
  try{
    window.GHRABTelemetry.recordOutput({
      outputKind,
      attemptedQuantity:attempted,
      successfulQuantity:successful,
      failedQuantity:failed,
      cancelledQuantity:cancelled,
      outcome:failed&&successful?'partial':failed?'error':successful?'success':'cancelled'
    });
  }catch(error){console.warn('Telemetrie Korespondenčního asistenta se nezapsala.',error);}
}

/* ===================== PŘÍCHOZÍ: ROZBOR ===================== */
$("in_analyzeBtn").onclick=async()=>{
  if(isBusy($("in_analyzeBtn"))) return;
  const text=(ST.in.clean||"").trim(); const state=$("in_apiState"); state.innerHTML="";
  if(!text){ state.innerHTML='<div class="error">Není co rozebrat — nejdřív vlož a anonymizuj e-mail.</div>'; return; }
  if(!$("in_reviewOk").checked){ state.innerHTML='<div class="error">Nejdřív potvrď finální kontrolu náhledu pod semaforem anonymizace.</div>'; flashPreview("in"); return; }
  if(!enforcePreflight("in", state)) return;
  if(!geminiApiKey && !testMockAvailable()){ $("apiPanel").classList.add("open"); state.innerHTML='<div class="error">Chybí klíč k API. Vlož ho nahoře a zvol „Použít jen pro relaci“.</div>'; return; }
  const done=setBusy($("in_analyzeBtn"),"Rozebírám…");
  try{ const d=await callGemini(text, SYS_ANALYZE, "analyze", {pane:"in",texts:[text],ackSensitive:!!(ST.in&&ST.in.sensitiveAck)}); ST.in.clean=text; ST.in.pozadavky=Array.isArray(d.pozadavky)?d.pozadavky:[]; ST.in.outputReady=true; state.innerHTML=""; renderAnalysis(d); recordCorrespondenceTelemetry('incoming-analysis',1,1,0); updateProgress("in"); $("in_results").scrollIntoView({behavior:"smooth",block:"start"}); }
  catch(err){ recordCorrespondenceTelemetry('incoming-analysis',1,0,1); setApiError(state, err, ()=>$("in_analyzeBtn").click()); }
  finally{ done(); updateSendGate("in"); }
};
const MOOD={klid:"Klid",neutral:"Neutrální",napeti:"Napětí"};
function renderAnalysis(d){
  const wrap=$("in_results"); wrap.innerHTML=""; wrap.className="ai-results-stage"; ST.in.analysis=d||{};
  const stageHead=document.createElement("div"); stageHead.className="ai-stage-divider reveal";
  stageHead.innerHTML='<span class="ai-stage-kicker">1 request dokončen</span><div><p class="eyebrow">Nový pracovní blok</p><h2>Výsledek z Gemini: rozbor e-mailu</h2><p>Anonymizovaný text už byl odeslán a níže vidíš pouze jeho analýzu. Teď vyber, co má budoucí odpověď skutečně vyřídit.</p></div>';
  wrap.appendChild(stageHead);
  const st=(d.naladeni&&d.naladeni.stupen)||"neutral";
  const priority=(d.priorita||"tyden").toLowerCase();
  const priorityMeta={
    dnes:{label:"Odpovědět dnes",cls:"today",desc:"Zpráva obsahuje naléhavý požadavek, blízký termín nebo napětí."},
    tyden:{label:"Vyřídit tento týden",cls:"week",desc:"Běžná zpráva, která vyžaduje odpověď nebo konkrétní krok."},
    fyi:{label:"Pouze na vědomí",cls:"fyi",desc:"Není nutná přímá odpověď, stačí informaci zaznamenat."},
    delegovat:{label:"Odložit / delegovat",cls:"delegate",desc:"Vhodnější je předání jiné osobě nebo pozdější zpracování."}
  }[priority]||{label:"Vyřídit tento týden",cls:"week",desc:"Zpráva vyžaduje běžné zpracování."};
  const top=document.createElement("section"); top.className="res-card reveal action-overview"; top.dataset.workspaceStage="analysis";
  const terms=Array.isArray(d.terminy)?d.terminy.filter(Boolean):[];
  const unanswered=Array.isArray(d.nezodpovezene)?d.nezodpovezene.filter(Boolean):[];
  const agreed=Array.isArray(d.dohodnuto)?d.dohodnuto.filter(Boolean):[];
  const thread=d.vlakno&&typeof d.vlakno==="object"?d.vlakno:{};
  top.innerHTML='<div class="action-hero"><div class="action-class '+priorityMeta.cls+'">'+esc(priorityMeta.label)+'</div><div><p class="eyebrow">Akční rozbor</p><h3>'+esc(d.shrnuti||"Rozbor zprávy")+'</h3><p>'+esc(d.dalsiKrok||priorityMeta.desc)+'</p></div></div>'+
    '<div class="analysis-grid">'+
      '<div class="analysis-mini"><h4>Kdo píše a jak</h4><p><b>' + esc(d.odesilatelRole||"Role není jistá") + '</b> · <span class="mood" data-s="'+esc(st)+'">'+(MOOD[st]||"Naladění")+'<span class="mtxt">'+esc((d.naladeni&&d.naladeni.popis)||"")+'</span></span></p></div>'+
      '<div class="analysis-mini"><h4>Naléhavost a konflikt</h4><p><b>'+esc(d.nalehavost||"běžná")+'</b>'+(d.konflikt?' · možné napětí nebo konflikt':' · bez zjevného konfliktu')+'</p></div>'+
      '<div class="analysis-mini"><h4>Termíny</h4>'+(terms.length?'<ul>'+terms.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':'<p>Žádný výslovný termín.</p>')+'</div>'+
      '<div class="analysis-mini"><h4>Doporučený další krok</h4><p>'+esc(d.dalsiKrok||"Připravit věcnou odpověď a zkontrolovat všechny požadavky.")+'</p></div>'+
    '</div>'+
    (thread.jeVlakno?'<details class="thread-summary" open><summary><b>E-mailové vlákno · '+esc(thread.pocetZprav||"více")+' zpráv</b></summary><div class="thread-timeline">'+((Array.isArray(thread.vyvoj)?thread.vyvoj:[]).map(x=>'<div class="thread-event">'+esc(x)+'</div>').join("")||'<div class="thread-event">Vlákno bylo rozpoznáno. Odpověď se zaměří na poslední relevantní zprávu.</div>')+'</div></details>':'');
  wrap.appendChild(top);

  if(Array.isArray(d.pozadavky)&&d.pozadavky.length){
    const c=document.createElement("div"); c.className="res-card reveal";
    c.innerHTML='<h3 title="Zaškrtnuté body do odpovědi zahrnu, odškrtnuté ne.">Co je potřeba vyřídit</h3><div id="in_asks">'+d.pozadavky.map((x,i)=>'<label style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px;cursor:pointer"><input type="checkbox" data-ask="'+i+'" checked style="margin-top:4px"><span>'+esc(x)+'</span></label>').join("")+'</div><p class="hintline" style="margin-top:8px">Odškrtni bod, který do odpovědi zahrnout nechceš.</p>';
    wrap.appendChild(c);
  }
  if(agreed.length||unanswered.length){
    const c=document.createElement("div"); c.className="res-card reveal";
    c.innerHTML='<div class="analysis-grid">'+
      '<div class="analysis-mini"><h4>Už dohodnuto</h4>'+(agreed.length?'<ul>'+agreed.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':'<p>Zatím nic potvrzeného.</p>')+'</div>'+
      '<div class="analysis-mini"><h4>Stále bez odpovědi</h4>'+(unanswered.length?'<ul>'+unanswered.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':'<p>Žádná otevřená otázka navíc.</p>')+'</div></div>';
    wrap.appendChild(c);
  }
  if(Array.isArray(d.upozorneni)&&d.upozorneni.length){ const c=document.createElement("div"); c.className="res-card reveal"; c.innerHTML='<h3>Na co si dát pozor</h3>'+d.upozorneni.map(x=>'<div class="warn">'+esc(x)+'</div>').join(""); wrap.appendChild(c); }

  const sug=ZAMER[d.doporucenyZamer]?d.doporucenyZamer:"vysvetlit";
  const replyHead=document.createElement("div"); replyHead.className="reply-setup-divider reveal";
  replyHead.innerHTML='<p class="eyebrow">Další pracovní blok</p><h2>Nastavení odpovědi</h2><p>Zvol adresáta, záměr a další parametry. Poznámka pro odpověď se skutečně přidá do promptu a aplikace v ní před odesláním nahradí známá jména značkami.</p>';
  wrap.appendChild(replyHead);
  const pc=document.createElement("div"); pc.className="res-card reveal params reply-setup-card"; pc.dataset.workspaceStage="draft";
  pc.innerHTML='<h3>Vytvořit tři varianty odpovědi</h3><p class="hintline">Dostaneš stručnou, standardní a diplomatickou variantu. Všechny reagují na stejné zaškrtnuté body.</p>'+
    '<div class="pgroup simple-hide"><div class="plabel" title="Komu odpovídáš. Předvolí oslovení i tón.">Adresát</div>'+chipGroup("in_adresat",ADRESAT,"rodic")+'<div class="custom-recipient" id="in_adresatJinyWrap" hidden><label for="in_adresatJiny">Komu odpovídáte?</label><input id="in_adresatJiny" type="text" maxlength="80" placeholder="např. nakladatelství, knihovna, externí partner"><small>Popis se použije pro tón a formálnost odpovědi.</small></div></div>'+
    '<div class="pgroup advanced-only"><div class="plabel" title="Určuje, zda má odpověď mluvit v jednotném, nebo množném čísle.">Píšu jako</div>'+chipGroup("in_pisujako",PISU_JAKO,"jednotlivec")+'<p class="hintline">Výchozí je jednotlivec. Zmínka o kolezích nebo předmětové komisi sama o sobě nepřepne odpověď na „my“.</p></div>'+
    '<div class="pgroup simple-hide"><div class="plabel">Záměr</div>'+chipGroup("in_zamer",ZAMER,sug)+'</div>'+
    '<div class="pgroup advanced-only"><div class="plabel">Výchozí tón</div>'+chipGroup("in_ton",TON,(d.konflikt||st==="napeti")?"vstricny":"vecny")+'</div>'+
    '<div class="pgroup advanced-only"><div class="plabel">Orientační délka standardní varianty</div>'+chipGroup("in_delka",DELKA,"stredni")+'</div>'+
    '<div class="pgroup simple-hide"><div class="plabel" title="Vykání nebo tykání ve výsledné odpovědi.">Oslovení</div>'+chipGroup("in_oslov",OSLOV,"vykani")+'</div>'+
    '<div class="pgroup advanced-only"><div class="plabel" title="V jakém jazyce má být odpověď.">Jazyk odpovědi</div>'+chipGroup("in_lang",LANG,(readChip("outlang")||"cs"))+'</div>'+
    '<div class="pgroup advanced-only note-field"><div class="plabel" title="Cokoli navíc — třeba na co nereagovat nebo co zmínit.">Poznámka pro odpověď</div><input id="in_note" type="text" title="Poznámka je součástí promptu. Před odesláním se znovu anonymizuje a kontroluje." placeholder="např. napiš, že školy neznám; navrhni telefonickou domluvu"><p class="field-safety-note">Poznámka se skutečně promítne do návrhu. Před odesláním se znovu anonymizuje; známé jméno se nahradí značkou a neznámý citlivý údaj odeslání zastaví.</p></div>'+
    '<div class="simple-action-note simple-only"><b>Jednoduchý režim:</b> použije doporučený záměr a bezpečné výchozí nastavení.</div>'+
    '<div class="choice-summary advanced-only" id="in_choiceSummary"></div>'+
    '<div class="row actsticky"><button class="btn primary" id="in_replyBtn" title="Vytvoří stručnou, standardní a diplomatickou variantu."><span class="action-icon">✉️</span>Vytvořit 3 varianty <span class="req">1 ⚡</span></button></div>'+
    '<div id="in_replyState"></div><div id="in_replies"></div>';
  wrap.appendChild(pc);
  const sc=pc.querySelector('.chips[data-group="in_zamer"] .chip[data-v="'+sug+'"]'); if(sc) sc.classList.add("suggested");
  wireChips(pc); renderChoiceSummary("in");
  pc.querySelector('.chips[data-group="in_adresat"]').addEventListener("click",(e)=>{ const c=e.target.closest(".chip"); if(c){ applyAdresat(c.dataset.v); syncCustomRecipient("in"); } });
  const inOther=$("in_adresatJiny"); if(inOther) inOther.addEventListener("input",()=>renderChoiceSummary("in"));
  syncCustomRecipient("in");
  pc.querySelector('.chips[data-group="in_lang"]').addEventListener("click",(e)=>{ const c=e.target.closest(".chip"); if(c) setChip("outlang",c.dataset.v); });
  $("in_replyBtn").onclick=genReplies;
  if(typeof updateAssistantRail==="function") updateAssistantRail({analysis:d,priorityMeta});
  if(typeof markWorkspaceStage==="function") markWorkspaceStage("analysis");
}
function setChip(group,val){
  const g=document.querySelector('.chips[data-group="'+group+'"]'); if(!g) return;
  // Neznámou hodnotou nesmaž platnou volbu; scénář nebo import se tak neztratí tiše z promptu.
  const safeVal=String(val).replace(/"/g,"");
  if(!g.querySelector('.chip[data-v="'+safeVal+'"]')){ console.warn("setChip: skupina "+group+" nezná hodnotu "+val); return; }
  g.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.v===val));
  if(group==="in_adresat") syncCustomRecipient("in");
  if(group==="my_adresat") syncCustomRecipient("my");
  renderChoiceSummary("in"); renderChoiceSummary("my");
}
function applyAdresat(a){
  if(a==="rodic"){ setChip("in_oslov","vykani"); setChip("in_ton","vstricny"); }
  else if(a==="kolega"){ setChip("in_oslov","tykani"); setChip("in_ton","vecny"); }
  else if(a==="vedeni"){ setChip("in_oslov","vykani"); setChip("in_ton","vecny"); }
  else if(a==="zak"){ setChip("in_oslov","tykani"); setChip("in_ton","vstricny"); }
  else if(a==="jiny"){ setChip("in_oslov","vykani"); setChip("in_ton","vecny"); }
}
async function genReplies(){
  if(isBusy($("in_replyBtn"))) return;
  const state=$("in_replyState"); state.innerHTML="";
  if(!$("in_reviewOk").checked){ state.innerHTML='<div class="error">Nejdřív potvrď finální kontrolu náhledu pod semaforem anonymizace.</div>'; flashPreview("in"); return; }
  if(!geminiApiKey && !testMockAvailable()){ $("apiPanel").classList.add("open"); state.innerHTML='<div class="error">Chybí klíč k API. Vlož ho nahoře.</div>'; return; }
  const zamer=readChip("in_zamer"),ton=readChip("in_ton"),delka=readChip("in_delka"),oslov=readChip("in_oslov"),adr=readChip("in_adresat"),pisuJako=readChip("in_pisujako")||"jednotlivec";
  ST.in.replySenderMode=pisuJako;
  if(adr==="jiny"&&!customRecipientValue("in")){ state.innerHTML='<div class="error"><b>Upřesni adresáta.</b> Do pole „Komu odpovídáte?“ napiš například nakladatelství nebo externí partner.</div>'; $("in_adresatJiny")?.focus(); return; }
  const allEls=[...document.querySelectorAll('#in_asks input[data-ask]')];
  const checked=allEls.filter(c=>c.checked).map(c=>ST.in.pozadavky[+c.dataset.ask]).filter(Boolean);
  const unchecked=allEls.filter(c=>!c.checked).map(c=>ST.in.pozadavky[+c.dataset.ask]).filter(Boolean);
  if(allEls.length && !checked.length){ state.innerHTML='<div class="error"><b>Není vybrán žádný požadavek.</b> Zaškrtni alespoň jeden bod, na který má odpověď reagovat.</div>'; return; }
  const noteRaw=($("in_note")&&$("in_note").value.trim())||"";
  const note=safeAuxiliaryText("in",noteRaw,state,"Poznámka pro odpověď");
  if(note===null || !enforcePreflight("in",state,note?[note]:[])) return;
  const threadLine=ST.in.analysis&&ST.in.analysis.vlakno&&ST.in.analysis.vlakno.jeVlakno?"\nJde o e-mailové vlákno. Odpověz na poslední relevantní zprávu a neopakuj již uzavřené části.":"";
  const prompt="Přijatý e-mail nebo vlákno (se značkami):\n\"\"\"\n"+ST.in.clean+"\n\"\"\"\n\n"+
    "Napiš přesně 3 varianty: STRUČNOU, STANDARDNÍ a DIPLOMATICKOU. Všechny musí reagovat na stejné vybrané body.\n"+
    "Adresát: "+recipientLabel("in")+"\nPíšu jako: "+(PISU_JAKO[pisuJako]||"Jednotlivec")+"\n"+senderPerspectivePrompt(pisuJako)+"\nZáměr: "+(ZAMER[zamer]||zamer)+"\nVýchozí tón: "+(TON[ton]||ton)+"\nOrientační délka standardní varianty: "+(DELKA[delka]||delka)+"\nOslovení: "+(OSLOV[oslov]||oslov)+"\n"+
    (note?"Další pokyn: "+note+"\n":"")+
    "Reaguj POUZE na tyto požadavky: "+JSON.stringify(checked.length?checked:ST.in.pozadavky)+
    (unchecked.length?"\nTyto body ani osoby, kterých se týkají, v odpovědi VŮBEC nezmiňuj: "+JSON.stringify(unchecked):"")+
    threadLine+profileLine()+langLine();
  const done=setBusy($("in_replyBtn"),"Skládám tři varianty…");
  try{
    const d=await callGemini(prompt,SYS_REPLY+langSystem(),"reply", {pane:"in",texts:[ST.in.clean,note,...checked,...unchecked],ackSensitive:!!(ST.in&&ST.in.sensitiveAck)}); mergeSyn("in",d.synonyma);
    state.innerHTML=""; const box=$("in_replies"); box.innerHTML="";
    let navrhy=Array.isArray(d&&d.navrhy)?d.navrhy:[];
    if(!navrhy.length){ recordCorrespondenceTelemetry('reply-draft',3,0,3); box.innerHTML='<p class="empty">Model nevrátil návrh — zkus to znovu.</p>'; return; }
    const types=["strucna","standardni","diplomaticka"];
    const pouzite=new Set();
    navrhy=types.map(type=>{
      let idx=navrhy.findIndex((n,j)=>n&&n.typ===type&&!pouzite.has(j));
      if(idx<0) idx=navrhy.findIndex((n,j)=>n&&!pouzite.has(j));
      if(idx<0) return null;
      pouzite.add(idx); return navrhy[idx];
    }).filter(Boolean);
    const allowEmoji=replyAllowsEmoji(noteRaw);
    navrhy=navrhy.map(n=>({...n,text:normalizeReplySignature(allowEmoji?String(n&&n.text||""):stripReplyEmoji(n&&n.text))}));
    const toolbar=document.createElement("div"); toolbar.className="reply-toolbar reply-choice-head";
    toolbar.innerHTML='<div><p class="eyebrow">Hotové návrhy</p><h3>Nejdřív pouze vyber jednu variantu</h3><p>Přečti si tři návrhy vedle sebe. Úpravy, kontrola a finální akce se zobrazí až u zvolené varianty.</p></div>';
    const grid=document.createElement("div"); grid.className="reply-grid variant-choice-grid";
    const cards=[];
    const selectVariant=(card)=>{
      cards.forEach(c=>{
        const selected=c===card;
        c.hidden=!selected;
        c.classList.toggle("selected-variant",selected);
        c.querySelectorAll(".selection-hidden").forEach(x=>x.hidden=!selected);
        const body=c.querySelector(".body"); if(body) body.contentEditable=selected?"true":"false";
      });
      grid.classList.add("has-selection");
      toolbar.innerHTML='<div><p class="eyebrow">Vybraná varianta</p><h3>'+esc(({strucna:"Stručná",standardni:"Standardní",diplomaticka:"Diplomatická"}[card.dataset.variant]||"Vybraná"))+'</h3><p>Teď ji můžeš ručně upravit, zadat jeden vlastní pokyn, zkontrolovat a použít.</p></div><button class="btn ghost small" type="button" id="backToVariants">← Zpět ke třem variantám</button>';
      toolbar.querySelector("#backToVariants").onclick=()=>{
        cards.forEach(c=>{c.hidden=false;c.classList.remove("selected-variant");c.querySelectorAll(".selection-hidden").forEach(x=>x.hidden=true);const b=c.querySelector(".body");if(b)b.contentEditable="false";});
        grid.classList.remove("has-selection");
        toolbar.innerHTML='<div><p class="eyebrow">Hotové návrhy</p><h3>Nejdřív pouze vyber jednu variantu</h3><p>Přečti si tři návrhy vedle sebe. Úpravy, kontrola a finální akce se zobrazí až u zvolené varianty.</p></div>';
      };
      if(typeof setActiveDraftCard==="function") setActiveDraftCard(card,"in");
      card.scrollIntoView({behavior:"smooth",block:"start"});
    };
    navrhy.forEach((n,i)=>{
      const type=n.typ||types[i]||"standardni";
      const card=draftCard("in",{styl:n.styl||({strucna:"Rychlá věcná odpověď",standardni:"Vyvážená profesionální odpověď",diplomaticka:"Citlivější diplomatická odpověď"}[type]),variantType:type,text:n.text||"",cover:{pokryva:n.pokryva,vynechava:n.vynechava},sourceText:ST.in.clean,hint:"Text můžeš po výběru přímo upravit nebo zadat jeden vlastní pokyn k úpravě.",deferActive:true});
      card.classList.add("variant-choice-card");
      const editor=card.querySelector(".editor-toolbar"); if(editor) editor.remove();
      const locked=card.querySelector(".locked-list"); if(locked) locked.remove();
      const chooser=document.createElement("div"); chooser.className="variant-pick"; chooser.innerHTML='<button class="btn primary act-pick-variant" type="button">Vybrat tuto variantu</button>';
      const body=card.querySelector(".body"); if(body) body.contentEditable="false";
      const firstFinal=card.querySelector(".tweakrow"); if(firstFinal) card.insertBefore(chooser,firstFinal); else card.appendChild(chooser);
      const finalActions=card.querySelector(".actions"); if(finalActions&&firstFinal) card.insertBefore(finalActions,firstFinal);
      card.querySelectorAll(".tweakrow,.draft-check,.tone-wrap,.actions,.hintline").forEach(x=>{x.classList.add("selection-hidden");x.hidden=true;});
      const tweak=card.querySelector(".tweak-in"); if(tweak) tweak.placeholder="Napiš jednu konkrétní úpravu, např. doplň termín nebo změkči závěr";
      chooser.querySelector(".act-pick-variant").onclick=()=>selectVariant(card);
      cards.push(card); grid.appendChild(card);
    });
    box.appendChild(toolbar); box.appendChild(grid);
    ST.in.outputReady=true; updateProgress("in"); if(typeof markWorkspaceStage==="function") markWorkspaceStage("draft");
    recordCorrespondenceTelemetry('reply-draft',3,navrhy.length,Math.max(0,3-navrhy.length));
  }catch(err){ recordCorrespondenceTelemetry('reply-draft',3,0,3); setApiError(state,err,()=>$("in_replyBtn").click()); }
  finally{ done(); }
}

/* ===================== JAZYK / ŠABLONY / HISTORIE ===================== */
function langLine(){ const l=readChip("outlang"); if(l==="en") return "\nCelou odpověď napiš v ANGLIČTINĚ, bezchybně a přirozeně."; if(l==="es") return "\nCelou odpověď napiš ve ŠPANĚLŠTINĚ, bezchybně a přirozeně."; return ""; }
function outLangCode(p){
  if(p==="in"){ const l=readChip("in_lang")||readChip("outlang")||"cs"; return (l==="en"||l==="es")?l:"cs"; }
  const l=readChip("my_lang")||"cs"; return (l==="en"||l==="es")?l:"cs";
}
function langSystem(){ const l=readChip("outlang");
  if(l==="en") return " NADŘAZENÝ POKYN: Text e-mailu (hodnoty „text“/„navrhy“ v JSON) napiš celý v bezchybné, přirozené ANGLIČTINĚ, i kdyby výše stálo psát česky. Značky (osoba A, [e-mail 1], [podpis]) ponech přesně. Klíče a struktura JSON zůstávají.";
  if(l==="es") return " NADŘAZENÝ POKYN: Text e-mailu napiš celý v bezchybné, přirozené ŠPANĚLŠTINĚ, i kdyby výše stálo psát česky. Značky (osoba A, [e-mail 1], [podpis]) ponech přesně. Klíče a struktura JSON zůstávají.";
  return ""; }
function myLangLine(){
  const l=readChip("my_lang")||"cs";
  if(l==="en") return "\nJazyk výstupu: celý výsledný e-mail napiš v přirozené, bezchybné ANGLIČTINĚ.";
  if(l==="es") return "\nJazyk výstupu: celý výsledný e-mail napiš v přirozené, bezchybné ŠPANĚLŠTINĚ.";
  if(l==="keep") return "\nJazyk výstupu: zachovej jazyk vstupu. Pokud je vstup vícejazyčný, zachovej dominantní jazyk a nemíchej jazyky zbytečně.";
  if(l==="translate_style") return "\nJazyk výstupu: přelož text a současně uprav styl podle ostatních voleb. Pokud není jasný cílový jazyk, použij češtinu.";
  return "\nJazyk výstupu: celý výsledný e-mail napiš v přirozené, bezchybné ČEŠTINĚ.";
}
function myLangSystem(){
  const l=readChip("my_lang")||"cs";
  if(l==="en") return " NADŘAZENÝ POKYN: Hodnotu „text“ v JSON napiš celou v bezchybné, přirozené ANGLIČTINĚ, i kdyby výše stálo psát česky. Značky ponech přesně.";
  if(l==="es") return " NADŘAZENÝ POKYN: Hodnotu „text“ v JSON napiš celou v bezchybné, přirozené ŠPANĚLŠTINĚ, i kdyby výše stálo psát česky. Značky ponech přesně.";
  if(l==="keep") return " NADŘAZENÝ POKYN: Zachovej jazyk vstupu. Pokud je vstup anglicky, piš anglicky; pokud španělsky, piš španělsky; pokud česky, piš česky. Značky ponech přesně.";
  if(l==="translate_style") return " NADŘAZENÝ POKYN: Výsledný text přelož a stylisticky uprav podle voleb uživatele; pokud není explicitně zvolen cílový jazyk, použij češtinu. Značky ponech přesně.";
  return "";
}
wireChips($("apiPanel"));

function loadTpls(){ try{ return JSON.parse(localStorage.getItem("rozbor_templates")||"[]"); }catch(_){ return []; } }
function saveTpls(a){ try{ localStorage.setItem("rozbor_templates", JSON.stringify(a)); }catch(_){} }
const TPL_KEYS=["my_flow","my_mode","my_adresat","my_oslov","my_prepis","my_ucel","my_cton","my_cdelka","my_subj","my_lang","my_scenario"];
function renderTemplates(){
  const box=$("my_tpls"); if(!box) return; box.innerHTML="";
  loadTpls().forEach((t,i)=>{
    const b=document.createElement("button"); b.className="chip"; b.textContent=t.name; b.title="Použít šablonu (dlouhý stisk = smazat)";
    b.onclick=()=>applyTemplate(t.vals);
    let timer=null;
    b.addEventListener("pointerdown",()=>{ timer=setTimeout(()=>{ const a=loadTpls(); a.splice(i,1); saveTpls(a); renderTemplates(); toast("Šablona smazána"); },650); });
    ["pointerup","pointerleave","pointercancel"].forEach(ev=>b.addEventListener(ev,()=>{ if(timer){clearTimeout(timer);timer=null;} }));
    b.oncontextmenu=(e)=>e.preventDefault();
    box.appendChild(b);
  });
  const add=document.createElement("button"); add.className="chip"; add.style.borderStyle="dashed"; add.textContent="+ uložit aktuální"; add.title="Uloží současné volby jako šablonu";
  add.onclick=saveCurrentTemplate; box.appendChild(add);
}
function saveCurrentTemplate(){
  askTextModal({title:"Uložit šablonu",label:"Název šablony",placeholder:"např. Rodič – omluva",confirmText:"Uložit šablonu",onConfirm(name){
    const vals={}; TPL_KEYS.forEach(k=>vals[k]=readChip(k));
    const a=loadTpls().filter(t=>t.name!==name); a.unshift({name, vals}); saveTpls(a.slice(0,12)); renderTemplates(); toast("Šablona uložena ✓");
  }});
}
function applyTemplate(vals){
  TPL_KEYS.forEach(k=>{ if(vals[k]) setChip(k, vals[k]); });
  syncSchoolScenario(vals.my_scenario||readChip("my_scenario")||"none", false);
  updateMyMode(); toast("Šablona použita");
}
renderTemplates();

function loadHistory(){
  let raw=[];try{raw=JSON.parse(localStorage.getItem("rozbor_history")||"[]");}catch(_){raw=[];}
  const safe=Array.isArray(raw)?raw.filter(it=>it&&it.safe===true&&it.format===2&&typeof it.text==="string").slice(0,10):[];
  if(safe.length!==raw.length)try{localStorage.setItem("rozbor_history",JSON.stringify(safe));}catch(_){}
  return safe;
}
loadHistory();
(function(){
  const overlay=document.createElement("div"); overlay.id="histOverlay";
  overlay.className="modal-overlay";
  function render(){
    const h=loadHistory();
    overlay.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" aria-label="Posledn\u00ed v\u00fdstupy">'+
      '<div class="modal-head"><b>Posledn\u00ed v\u00fdstupy</b><button id="histClose" class="modal-close" title="Zav\u0159\u00edt" aria-label="Zav\u0159\u00edt">\u00d7</button></div>'+
      (h.length? h.map((it,i)=>'<div style="border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:10px"><div style="font:600 12px var(--sans);color:var(--ink-soft);margin-bottom:6px">'+esc(it.label||"E-mail")+' · '+new Date(it.d).toLocaleString("cs-CZ")+'</div><div style="font:13px/1.5 var(--sans);color:var(--ink);white-space:pre-wrap;max-height:120px;overflow:auto">'+esc(it.text)+'</div><div style="margin-top:8px"><button class="btn small" data-copy="'+i+'"><span class="action-icon">📋</span>Zkopírovat</button></div></div>').join("")
        : '<p class="empty">Zatím nic. Po použití výstupu se sem může uložit pouze anonymizovaná verze se značkami; text se skutečnými jmény se do historie neukládá.</p>')+
      '</div>';
    overlay.querySelector("#histClose").onclick=close;
    overlay.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{ const it=loadHistory()[+b.dataset.copy]; if(it){ copyText(it.text, b); toast("Zkopírováno ✓"); } });
  }
  function open(){ render(); overlay.classList.add("open"); }
  function close(){ overlay.classList.remove("open"); }
  overlay.addEventListener("click",(e)=>{ if(e.target===overlay) close(); });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && overlay.classList.contains("open")) close(); });
  document.body.appendChild(overlay);
  window.__openHistory=open;
})();

/* ===================== PROFIL ODESÍLATELE ===================== */
(function(){
  const overlay=document.createElement("div"); overlay.id="profOverlay";
  overlay.className="modal-overlay";
  const inS="width:100%;font:13px var(--sans);padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);margin-top:4px";
  const lbl="font:600 12px var(--sans);color:var(--ink-soft);display:block;margin-top:12px";
  function render(){
    const p=loadProfile();
    overlay.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" aria-label="Profil odes\u00edlatele">'+
      '<div class="modal-head"><b>Profil odes\u00edlatele</b><button id="profClose" class="modal-close" title="Zav\u0159\u00edt" aria-label="Zav\u0159\u00edt">\u00d7</button></div>'+
      '<p class="hint" style="margin:0 0 6px">Zůstává jen v tomhle prohlížeči. Jméno se k modelu neposílá — dosadí se až do hotového e-mailu místo značky [podpis].</p>'+
      '<label style="'+lbl+'">Jméno (a příjmení)</label><input id="pf_name" type="text" style="'+inS+'" value="'+escAttr(p.name||"")+'" placeholder="Jan Novák">'+
      '<label style="'+lbl+'">Role / funkce</label><input id="pf_role" type="text" style="'+inS+'" value="'+escAttr(p.role||"")+'" placeholder="učitel angličtiny">'+
      '<label style="'+lbl+'">Škola</label><input id="pf_school" type="text" style="'+inS+'" value="'+escAttr(p.school||"")+'" placeholder="Gymnázium …">'+
      '<label style="'+lbl+'">Styl podpisu</label><div class="chips" data-group="pf_sign" style="margin-top:6px">'+
        '<button class="chip" data-v="jmeno">Jen jméno</button><button class="chip" data-v="pozdrav">S pozdravem + jméno</button><button class="chip" data-v="funkce">Funkce + jméno</button><button class="chip" data-v="vlastni">Vlastní</button></div>'+
      '<div id="pf_customWrap" style="display:none"><label style="'+lbl+'">Vlastní podpis</label><textarea id="pf_custom" style="'+inS+';min-height:70px;font-family:var(--sans)" placeholder="S pozdravem\nJan Novák\nučitel angličtiny">'+esc(p.custom||"")+'</textarea></div>'+
      '<div style="margin-top:16px;display:flex;gap:8px"><button class="btn" id="pf_save">Uložit profil</button><button class="btn ghost" id="pf_clear">Smazat profil</button></div>'+
      '</div>';
    wireChips(overlay);
    const sign=p.sign||"pozdrav"; setChip("pf_sign", sign);
    const customWrap=overlay.querySelector("#pf_customWrap");
    const upd=()=>{ customWrap.style.display = readChip("pf_sign")==="vlastni"?"block":"none"; };
    overlay.querySelector('.chips[data-group="pf_sign"]').addEventListener("click",(e)=>{ if(e.target.closest(".chip")) upd(); });
    upd();
    overlay.querySelector("#profClose").onclick=close;
    overlay.querySelector("#pf_save").onclick=()=>{
      const prof={ name:overlay.querySelector("#pf_name").value.trim(), role:overlay.querySelector("#pf_role").value.trim(), school:overlay.querySelector("#pf_school").value.trim(), sign:readChip("pf_sign"), custom:overlay.querySelector("#pf_custom").value };
      try{ localStorage.setItem("rozbor_profile", JSON.stringify(prof)); }catch(_){}
      toast("Profil uložen ✓"); close();
    };
    overlay.querySelector("#pf_clear").onclick=()=>{ try{ localStorage.removeItem("rozbor_profile"); }catch(_){} toast("Profil smazán"); render(); };
  }
  function open(){ render(); overlay.classList.add("open"); }
  function close(){ overlay.classList.remove("open"); }
  overlay.addEventListener("click",(e)=>{ if(e.target===overlay) close(); });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && overlay.classList.contains("open")) close(); });
  document.body.appendChild(overlay);
  window.__openProfile=open;
})();

/* ===================== MŮJ E-MAIL: KOREKTURA + PŘEPIS ===================== */
wireChips($("pane-my"));
function inferQuickComposeSettings(text, apply){
  const t=String(text||"").toLowerCase();
  let adresat="zak", ucel="oznameni", ton="vecny", delka="stredni", oslov="tykani";
  if(/rodič|zákonn|mamink|tatín|otec|matk/.test(t)){ adresat="rodic"; oslov="vykani"; }
  else if(/ředitel|zástup|vedení školy/.test(t)){ adresat="vedeni"; oslov="vykani"; }
  else if(/koleg|kabinet|komis|porad/.test(t)){ adresat="kolega"; oslov="tykani"; }
  if(/omluv|nemohu se zúčastnit/.test(t)) ucel="omluva";
  else if(/pozv|konzultac|schůzk|setkání/.test(t)) ucel="pozvanka";
  else if(/prosím|žádám|žádost|potřebuji/.test(t)) ucel="zadost";
  else if(/připom|termín|odevzdat/.test(t)) ucel="pripominka";
  else if(/děkuj|poděkov/.test(t)) ucel="podekovani";
  else if(/odmít|nemohu vyhovět|nevyhovím/.test(t)) ucel="odmitnuti";
  if(/stížnost|konflikt|nespokojen|citliv|kázeň|chování/.test(t)) ton="vstricny";
  if(t.length<140) delka="strucna"; else if(t.length>700) delka="podrobna";
  if(apply){ setChip("my_adresat",adresat); setChip("my_oslov",oslov); setChip("my_ucel",ucel); setChip("my_cton",ton); setChip("my_cdelka",delka); }
  return {adresat,ucel,ton,delka,oslov,label:(ADRESAT[adresat]||adresat)+" · "+(UCEL[ucel]||ucel)+" · "+(TON[ton]||ton)+" · "+(DELKA[delka]||delka)};
}
function updateMyMode(){
  const m=readChip("my_mode"), flow=readChip("my_flow")||"quick";
  $("my_fixGroup").style.display=(m==="opravit")?"block":"none";
  $("my_styleGroup").style.display=(m==="prepsat")?"block":"none";
  $("my_ucelGroup").style.display=(m==="prepsat"||m==="sestavit")?"block":"none";
  $("my_toneGroup").style.display=(m==="sestavit")?"block":"none";
  $("my_lenGroup").style.display=(m==="sestavit")?"block":"none";
  $("my_subjGroup").style.display=(m==="prepsat"||m==="sestavit")?"block":"none";
  const pane=$("pane-my"); if(pane) pane.classList.toggle("quick-compose",flow==="quick");
  const fh=$("my_flowHint"); if(fh) fh.innerHTML=flow==="quick"?"<b>Rychlý režim:</b> při sestavení z bodů aplikace rozpozná adresáta, účel, tón a doporučenou délku. Před odesláním uvidíš zvolené hodnoty.":"<b>Řízený režim:</b> všechny parametry nastavíš ručně a uložíš je jako vlastní šablonu.";
  $("my_goHint").textContent = m==="opravit" ? "Opraví text podle míry zásahu. Význam zachová."
    : m==="prepsat" ? "Přepíše tvůj text do zvoleného stylu a účelu."
    : flow==="quick" ? "Z bodů složí e-mail a předem rozpozná praktické parametry." : "Z textu výše (jako odrážky) složí hotový e-mail.";
  renderChoiceSummary("my");
}
function applyMyAdresat(a){ setChip("my_oslov", (a==="rodic"||a==="vedeni"||a==="jiny")?"vykani":"tykani"); syncCustomRecipient("my"); }
function syncSchoolScenario(v, applyDefaults){
  const sc=SCHOOL_SCENARIOS[v]||SCHOOL_SCENARIOS.none;
  if(document.querySelector('.chips[data-group="my_scenario"]')) setChip("my_scenario", SCHOOL_SCENARIOS[v]?v:"none");
  if(applyDefaults!==false && sc.vals) Object.keys(sc.vals).forEach(k=>setChip(k, sc.vals[k]));
  const h=$("my_scenarioHint");
  if(h){
    h.innerHTML=sc.hint?('<b>'+esc(sc.label)+':</b> '+esc(sc.hint)+(sc.strict?'<div class="strict-note">Přísný režim: historie výstupů a debug prompt se vypnou. Výstup má být kratší, obecný a bez identifikujících detailů.</div>':'')):' ';
    h.classList.toggle("data-danger", !!sc.sensitive);
  }
  if(sc.strict) activateStrictScenario(sc);
  updateMyMode();
}
function applySchoolScenario(v){ syncSchoolScenario(v, true); }
(function(){
  const gf=document.querySelector('.chips[data-group="my_flow"]'); if(gf) gf.addEventListener("click",(e)=>{ if(e.target.closest(".chip")) updateMyMode(); });
  const gm=document.querySelector('.chips[data-group="my_mode"]'); if(gm) gm.addEventListener("click",(e)=>{ if(e.target.closest(".chip")) updateMyMode(); });
  const ga=document.querySelector('.chips[data-group="my_adresat"]'); if(ga) ga.addEventListener("click",(e)=>{ const c=e.target.closest(".chip"); if(c) applyMyAdresat(c.dataset.v); });
  const myOther=$("my_adresatJiny"); if(myOther) myOther.addEventListener("input",()=>renderChoiceSummary("my"));
  const gs=document.querySelector('.chips[data-group="my_scenario"]'); if(gs) gs.addEventListener("click",(e)=>{ const c=e.target.closest(".chip"); if(c) applySchoolScenario(c.dataset.v); });
  updateMyMode();
  applySchoolScenario(readChip("my_scenario")||"none");
  syncCustomRecipient("my");
  renderChoiceSummary("my");
})();
$("my_goBtn").onclick=async()=>{
  if(isBusy($("my_goBtn"))) return;
  const text=(ST.my.clean||"").trim(); const state=$("my_apiState"); state.innerHTML="";
  if(!text){ state.innerHTML='<div class="error">Není co zpracovat — nejdřív vlož text a dej Pokračovat.</div>'; return; }
  if(!$("my_reviewOk").checked){ state.innerHTML='<div class="error">Nejdřív potvrď finální kontrolu náhledu pod semaforem anonymizace.</div>'; flashPreview("my"); return; }
  if(!geminiApiKey && !testMockAvailable()){ $("apiPanel").classList.add("open"); state.innerHTML='<div class="error">Chybí klíč k API. Vlož ho nahoře.</div>'; return; }
  const mode=readChip("my_mode"), flow=readChip("my_flow")||"quick";
  let inferred=null;
  if(mode==="sestavit" && flow==="quick") inferred=inferQuickComposeSettings(text,true);
  const oslov=readChip("my_oslov"), adr=readChip("my_adresat");
  if(adr==="jiny"&&!customRecipientValue("my")){ state.innerHTML='<div class="error"><b>Upřesni adresáta.</b> Do pole „Komu píšete?“ napiš například nakladatelství nebo externí partner.</div>'; $("my_adresatJiny")?.focus(); return; }
  const oslovTxt = oslov==="beze"?"ponech oslovení beze změny":(oslov==="tykani"?"používej tykání":"používej vykání");
  if(inferred) state.innerHTML='<div class="info"><b>Rozpoznáno:</b> '+esc(inferred.label)+'. Hodnoty můžeš kdykoli upravit v řízeném režimu.</div>';
  const scenarioKey=readChip("my_scenario")||"none";
  const scenario=SCHOOL_SCENARIOS[scenarioKey]||SCHOOL_SCENARIOS.none;
  const scenarioLine=scenarioKey!=="none"?("\nŠkolní scénář: "+scenario.label+". Bezpečnostní upozornění: "+(scenario.hint||"dodrž obecnou anonymizaci a školní citlivost.")+strictScenarioPrompt()):"";
  const note=safeAuxiliaryText("my", ($("my_note")&&$("my_note").value.trim())||"", state, "Doplňující pokyn");
  if(note===null || !enforcePreflight("my", state, note?[note]:[])) return;
  const subj=readChip("my_subj")==="ano";
  const common="\nAdresát: "+recipientLabel("my")+"\nOslovení: "+oslovTxt+(note?"\nDalší pokyn: "+note:"")+(subj?"\nNa první řádek napiš „Předmět: …“ a pod něj samotný e-mail.":"")+scenarioLine+profileLine()+myLangLine();
  let sys, prompt, styl;
  if(mode==="prepsat"){
    const s=readChip("my_prepis"), u=readChip("my_ucel"); styl="Přepsáno: "+(PREPIS[s]||s); sys=SYS_PREPIS;
    prompt="Přepiš tento e-mail jako: "+(PREPIS[s]||s)+".\nÚčel: "+(UCEL[u]||u)+"."+common+"\n\n\"\"\"\n"+text+"\n\"\"\"";
  } else if(mode==="sestavit"){
    const ton=readChip("my_cton"), delka=readChip("my_cdelka"), u=readChip("my_ucel"); styl="Sestaveno z bodů"; sys=SYS_COMPOSE;
    prompt="Sestav e-mail z těchto bodů (se značkami místo jmen):\n\"\"\"\n"+text+"\n\"\"\"\n\nÚčel: "+(UCEL[u]||u)+"\nTón: "+(TON[ton]||ton)+"\nDélka: "+(DELKA[delka]||delka)+common;
  } else {
    const fix=readChip("my_fix"); styl="Opravená verze"; sys=SYS_KOREKTURA;
    prompt="Oprav tento e-mail. Míra zásahu: "+(fix==="sloh"?"oprav chyby a vylepši i sloh a formulace":"oprav jen pravopis, gramatiku a interpunkci, sloh a formulace neměň")+"."+common+"\n\n\"\"\"\n"+text+"\n\"\"\"";
  }
  const done=setBusy($("my_goBtn"),"Pracuji…");
  try{
    const d=await callGemini(prompt, sys+myLangSystem(), "text", {pane:"my",texts:[text,note],ackSensitive:!!(ST.my&&ST.my.sensitiveAck)}); mergeSyn("my", d.synonyma);
    state.innerHTML=""; const wrap=$("my_results"); wrap.innerHTML="";
    const card=draftCard("my",{ styl, text:d.text||"", sourceText:text, hint:"Dvojklik na slovo nabídne synonyma. Označenou formulaci můžeš uzamknout a zbytek dále upravovat." });
    if(mode==="opravit" && Array.isArray(d.zmeny)&&d.zmeny.length){ const cv=document.createElement("div"); cv.innerHTML='<h3 style="margin:14px 0 6px">Co se změnilo</h3><div class="cover">'+d.zmeny.map(z=>'<span class="ok">• '+esc(z)+'</span>').join("<br>")+'</div>'; card.insertBefore(cv, card.querySelector(".actions")); }
    wrap.appendChild(card); ST.my.outputReady=true; recordCorrespondenceTelemetry('outgoing-email',1,1,0); updateProgress("my"); if(typeof markWorkspaceStage==="function") markWorkspaceStage("draft"); if(typeof setActiveDraftCard==="function") setActiveDraftCard(card,"my"); wrap.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(err){ recordCorrespondenceTelemetry('outgoing-email',1,0,1); setApiError(state, err, ()=>$("my_goBtn").click()); }
  finally{ done(); updateSendGate("my"); }
};

/* ===================== NAHRÁNÍ SOUBORU (.eml/.txt/.html) ===================== */
function stripHtml(html){
  try{ const doc=new DOMParser().parseFromString(html,"text/html"); doc.querySelectorAll("style,script").forEach(n=>n.remove()); return (doc.body?doc.body.innerText||doc.body.textContent:doc.textContent||"").replace(/\n{3,}/g,"\n\n").trim(); }
  catch(_){ return html.replace(/<[^>]+>/g," ").replace(/\s+\n/g,"\n").trim(); }
}
function mimeCharset(headers){
  const m=/charset\s*=\s*["']?([^\s;"']+)/i.exec(headers||"");
  return (m&&m[1]||"utf-8").toLowerCase();
}
function decodeBytes(bytes, charset){
  const cs=String(charset||"utf-8").replace(/^utf8$/i,"utf-8").toLowerCase();
  const arr=Array.from(bytes||[]);
  if(cs==="utf-8" || cs==="utf8"){
    try{ return decodeURIComponent(arr.map(b=>"%"+(b&255).toString(16).padStart(2,"0")).join("")); }catch(_){}
  }
  try{ return new TextDecoder(cs,{fatal:false}).decode(Uint8Array.from(arr)); }
  catch(_){
    try{ return new TextDecoder("utf-8",{fatal:false}).decode(Uint8Array.from(arr)); }
    catch(__){ return String.fromCharCode(...arr); }
  }
}
function qpBytes(s){
  s=String(s||"").replace(/=\r?\n/g,""); const bytes=[];
  for(let i=0;i<s.length;i++){
    if(s[i]==="=" && /^[0-9A-Fa-f]{2}$/.test(s.substr(i+1,2))){ bytes.push(parseInt(s.substr(i+1,2),16)); i+=2; }
    else bytes.push(s.charCodeAt(i)&0xff);
  }
  return bytes;
}
function qpDecode(s, charset){ return decodeBytes(qpBytes(s),charset); }
function b64Decode(s, charset){
  try{ const bin=atob(String(s||"").replace(/\s+/g,"")); return decodeBytes(Array.from(bin,c=>c.charCodeAt(0)),charset); }
  catch(_){ return String(s||""); }
}
function decodeMimeHeader(value){
  return String(value||"").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,(_,cs,enc,data)=>{
    if(String(enc).toLowerCase()==="b") return b64Decode(data,cs);
    return qpDecode(String(data).replace(/_/g," "),cs);
  }).replace(/\s{2,}/g," ").trim();
}
function decodePart(headers, body){
  const charset=mimeCharset(headers);
  const cte=(/content-transfer-encoding:\s*([^\r\n;]+)/i.exec(headers)||[])[1];
  if(cte && /base64/i.test(cte)) body=b64Decode(body,charset);
  else if(cte && /quoted-printable/i.test(cte)) body=qpDecode(body,charset);
  const ct=(/content-type:\s*([^\r\n;]+)/i.exec(headers)||[])[1]||"text/plain";
  if(/text\/html/i.test(ct)) body=stripHtml(body);
  return String(body||"").trim();
}
function splitMimeParts(body,boundary){
  const marker="--"+boundary;
  return String(body||"").split(marker).slice(1).map(x=>x.replace(/^\r?\n/,"").replace(/--\s*$/,"").trim()).filter(Boolean);
}
function collectMimeText(headers, body, out, depth){
  if(depth>8) return;
  const ct=(/content-type:\s*([^\r\n;]+)/i.exec(headers)||[])[1]||"text/plain";
  const disposition=(/content-disposition:\s*([^\r\n;]+)/i.exec(headers)||[])[1]||"";
  if(/attachment/i.test(disposition)) return;
  const bnd=(/boundary\s*=\s*"?([^"\r\n;]+)"?/i.exec(headers)||[])[1];
  if(/^multipart\//i.test(ct) && bnd){
    splitMimeParts(body,bnd).forEach(part=>{
      const sep=part.search(/\r?\n\r?\n/); if(sep<0) return;
      const match=part.slice(sep).match(/^\r?\n\r?\n/); const breakLen=match?match[0].length:2;
      collectMimeText(part.slice(0,sep).replace(/\r?\n[ \t]+/g," "),part.slice(sep+breakLen),out,depth+1);
    });
    return;
  }
  if(/text\/plain/i.test(ct)) out.plain.push(decodePart(headers,body));
  else if(/text\/html/i.test(ct)) out.html.push(decodePart(headers,body));
}
function parseEml(raw){
  raw=String(raw||"").replace(/\r\n/g,"\n");
  const sep=raw.indexOf("\n\n"); const head=sep<0?raw:raw.slice(0,sep); const rest=sep<0?"":raw.slice(sep+2);
  const unfold=head.replace(/\n[ \t]+/g," ");
  const from=decodeMimeHeader((/^from:\s*(.+)$/im.exec(unfold)||[])[1]||"");
  const subj=decodeMimeHeader((/^subject:\s*(.+)$/im.exec(unfold)||[])[1]||"");
  const outParts={plain:[],html:[]}; collectMimeText(unfold,rest,outParts,0);
  const bodyText=(outParts.plain.filter(Boolean).join("\n\n")||outParts.html.filter(Boolean).join("\n\n")).trim();
  let out="";
  if(from) out+="Od: "+from+"\n";
  if(subj) out+="Předmět: "+subj+"\n";
  if(out) out+="\n";
  return (out+bodyText).trim();
}
function readFileInto(p, file){
  const name=(file.name||"").toLowerCase();
  if(file.size>5*1024*1024){ toast("Soubor je příliš velký. Maximum je 5 MB."); return; }
  const reader=new FileReader();
  reader.onload=()=>{
    const bytes=new Uint8Array(reader.result||[]);
    // Hlavičku načti v jednobajtovém kódování, aby šlo zjistit deklarovaný charset těla.
    const head=new TextDecoder("windows-1252",{fatal:false}).decode(bytes.slice(0,4096));
    const cs=name.endsWith(".eml") ? mimeCharset(head) : "utf-8";
    let txt="";
    try{ txt=new TextDecoder(cs,{fatal:false}).decode(bytes); }
    catch(_){ txt=new TextDecoder("utf-8",{fatal:false}).decode(bytes); }
    if(name.endsWith(".eml")) txt=parseEml(txt);
    else if(name.endsWith(".html")||name.endsWith(".htm")) txt=stripHtml(txt);
    if(txt.length>250000){ txt=txt.slice(0,250000); toast("Soubor byl zkrácen na 250 000 znaků."); }
    E(p,"raw").value=txt;
    doAnon(p);
  };
  reader.onerror=()=>toast("Soubor se nepovedlo načíst.");
  reader.readAsArrayBuffer(file);
}
["in","my"].forEach(p=>{
  E(p,"fileBtn").onclick=()=>E(p,"file").click();
  E(p,"file").addEventListener("change",(e)=>{ const f=e.target.files&&e.target.files[0]; if(f) readFileInto(p,f); e.target.value=""; });
});

