/* ===================== KS 5.0 — PRACOVNÍ STŮL UČITELE ===================== */
(function(){
"use strict";
const LS={
  drafts:"ks5_workbench_drafts",followups:"ks5_followups",blocks:"ks5_blocks",
  signatures:"ks5_signatures",selectedSignature:"ks5_selected_signature",
  desk:"ks5_desk_collapsed",recentScenarios:"ks5_recent_scenarios"
};
const jget=(k,f)=>{try{const raw=localStorage.getItem(k);if(raw===null)return f;const v=JSON.parse(raw);return v===null?f:v;}catch(_){return f;}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}};
const clean=s=>String(s||"").trim();
const safeText=t=>clean(t).replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n");
const uid=p=>(p||"id")+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
let activeDraft=null,activePaneName="in";

const defaultBlocks=[
  {id:"confirm",name:"Žádost o potvrzení",category:"Organizace",text:"Prosím o potvrzení, že jste zprávu obdrželi."},
  {id:"consult",name:"Nabídka konzultace",category:"Schůzka",text:"V případě potřeby se můžeme domluvit na osobní nebo telefonické konzultaci."},
  {id:"thanks",name:"Poděkování za spolupráci",category:"Zakončení",text:"Děkuji za spolupráci a za Vaši odpověď."},
  {id:"deadline",name:"Jasný termín",category:"Organizace",text:"Prosím o vyřízení nejpozději do [datum]."},
  {id:"received",name:"Potvrzení přijetí",category:"Reakce",text:"Děkuji za zprávu. Potvrzuji její přijetí a budu se jí zabývat."},
  {id:"phone",name:"Nabídka telefonické domluvy",category:"Schůzka",text:"Pokud by bylo snazší věc probrat telefonicky, můžeme si domluvit vhodný termín hovoru."},
  {id:"decline",name:"Zdvořilé odmítnutí",category:"Reakce",text:"V této podobě bohužel nemohu žádosti vyhovět. Mohu však navrhnout jiné možné řešení."},
  {id:"agreement",name:"Potvrzení domluvy",category:"Organizace",text:"Pro jistotu shrnuji naši domluvu: [doplňte body, odpovědnosti a termíny]."}
];
function getCustomBlocks(){const a=jget(LS.blocks,[]);return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name&&x.text):[];}
function getBlocks(){return defaultBlocks.concat(getCustomBlocks());}
function profileSignature(){
  const p=typeof loadProfile==="function"?loadProfile():{};const name=clean(p.name);if(!name)return "";
  if(p.sign==="vlastni"&&clean(p.custom))return clean(p.custom);
  if(p.sign==="jmeno")return name;
  if(p.sign==="funkce")return "S pozdravem\n"+name+((p.role||p.school)?"\n"+[p.role,p.school].filter(Boolean).join(", "):"");
  return "S pozdravem\n"+name;
}
function getSignatures(){
  const custom=jget(LS.signatures,[]);const out=Array.isArray(custom)?custom.filter(x=>x&&x.id&&x.name&&x.text):[];
  const profile=profileSignature();if(profile)out.unshift({id:"profile",name:"Podpis z profilu",text:profile,system:true});
  return out;
}
window.getSelectedSignatureText=function(){
  const a=getSignatures();if(!a.length)return "";const id=localStorage.getItem(LS.selectedSignature)||"profile";return (a.find(x=>x.id===id)||a[0]).text||"";
};
function containsAny(t,arr){t=String(t||"").toLowerCase();return arr.some(x=>t.includes(x));}
function extractDates(t){
  const text=String(t||""),out=[];
  const add=x=>{x=String(x||"").toLocaleLowerCase("cs-CZ");if(x&&!out.includes(x))out.push(x);};
  (text.match(/(?<!\d)\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?(?!\d)|(?<!\d)\d{1,2}:\d{2}(?!\d)/g)||[]).forEach(add);
  const days=[
    [/ponděl(?:í|ní)/giu,"pondělí"],[/úter(?:ý|ní)/giu,"úterý"],[/střed(?:a|u|y|eční)/giu,"středa"],
    [/čtvrt(?:ek|ka|ku|eční)/giu,"čtvrtek"],[/pát(?:ek|ku|eční)/giu,"pátek"],[/sobot(?:a|u|y|ní)/giu,"sobota"],[/neděl(?:e|i|ní)/giu,"neděle"]
  ];
  days.forEach(([re,label])=>{if(re.test(text))add(label);});
  [[/zítra/giu,"zítra"],[/pozítří/giu,"pozítří"],[/příští\s+týden/giu,"příští týden"],[/do\s+konce\s+týdne/giu,"do konce týdne"]].forEach(([re,label])=>{if(re.test(text))add(label);});
  return out;
}
window.extractDraftDates=extractDates;
const TEMPLATE_PHRASE_RULES=[
  {re:unicodeWordRegex("touto cestou","iu"),label:"touto cestou"},
  {re:unicodeWordRegex("dovolte mi,? abych","iu"),label:"dovolte mi, abych"},
  {re:unicodeWordRegex("je důležité (?:zdůraznit|podotknout|zmínit)","iu"),label:"je důležité zdůraznit"},
  {re:unicodeWordRegex("věřím,? že společně","iu"),label:"věřím, že společně"},
  {re:unicodeWordRegex("neváhejte (?:mě|mne|nás) kontaktovat","iu"),label:"neváhejte mě kontaktovat"},
  {re:unicodeWordRegex("v dnešní (?:uspěchané |rychlé )?době","iu"),label:"v dnešní době"},
  {re:/\bi hope this (?:email|message) finds you well\b/i,label:"I hope this email finds you well"},
  {re:/\bplease do not hesitate to contact (?:me|us)\b/i,label:"please do not hesitate to contact me"},
  {re:/\bit is important to (?:emphasize|highlight|note)\b/i,label:"it is important to emphasize"},
  {re:/\bpor medio de la presente\b/i,label:"por medio de la presente"},
  {re:/\bno dude en (?:ponerse en contacto|contactarme|contactarnos)\b/i,label:"no dude en ponerse en contacto"},
  {re:unicodeWordRegex("es importante (?:destacar|señalar|mencionar)","iu"),label:"es importante destacar"}
];
function findTemplatePhrases(text){const t=String(text||"");return TEMPLATE_PHRASE_RULES.filter(x=>x.re.test(t)).map(x=>x.label);}
window.findTemplatePhrases=findTemplatePhrases;

window.evaluateDraftReadiness=function(p,text,source,cover){
  const t=safeText(text),src=safeText(source),items=[];
  const add=(ok,label,level,detail)=>items.push({ok:!!ok,label,level:ok?"ok":(level||"warn"),detail:detail||""});
  add(t.length>0,"Text není prázdný","danger");
  add(!t.length||t.length>=15,"Text není neobvykle krátký","warn",t.length&&t.length<15?"Krátké potvrzení může být v pořádku; ověř, že nechybí podstata.":"");
  const finalText=typeof recompose==="function"?safeText(recompose(p,t)):t;
  const bezPodpisu=finalText.replace(/\[u[čc]itel\]/g," ");
  add(typeof hasLeftoverToken!=="function"||!hasLeftoverToken(bezPodpisu),"Nezůstala nevyplněná anonymizační značka","danger");
  add(!/\[u[čc]itel\]/.test(finalText),"Podpis je vyplněný v profilu odesílatele","warn");
  add(/^((?:předmět|subject|asunto):.*\n+)?\s*(dobrý den|dobrý večer|vážen|ahoj|mil[ýáé]|dear|hello|hola|buenos)/im.test(t),"Zpráva obsahuje vhodné oslovení","warn");
  add(/(s pozdravem|děkuji|hezký den|kind regards|best regards|saludos|atentamente|\[podpis\])/i.test(t),"Zpráva má zakončení nebo podpis","warn");
  if((p==="in"||p==="my") && ST[p] && ST[p].replySenderMode==="jednotlivec"){
    const actionPlural=unicodeWordRegex(String.raw`(?:vážíme si|děkujeme|potvrzujeme|ozveme se|kontaktujeme|zvážíme|vyhodnotíme|projednáme|domluvíme|budeme Vás informovat)`,"iu").test(t);
    add(!actionPlural,"Odpověď je psána za jednotlivce v 1. osobě jednotného čísla","warn",actionPlural?"Zkontroluj, zda skutečně píšeš za tým, nebo změň sloveso na jednotné číslo.":"");
    const lang=typeof outLangCode==="function"?outLangCode(p):"cs",profile=typeof loadProfile==="function"?loadProfile():{},savedGender=String(profile.gender||"");
    if(lang==="cs" && typeof resolvedProfileGender==="function" && ["male","female","neutral"].includes(savedGender)){
      const gender=resolvedProfileGender(profile);
      const male=unicodeWordRegex(String.raw`(?:(?:musel|předal|byl|mohl|chtěl|odeslal|připravil|upravil|doplnil|zpracoval|obdržel|rozhodl|navrhl|provedl|zkontroloval|poslal|potvrdil|informoval|omluvil)\s+(?:jsem|bych)|(?:jsem|bych)\s+(?:musel|předal|byl|mohl|chtěl|odeslal|připravil|upravil|doplnil|zpracoval|obdržel|rozhodl|navrhl|provedl|zkontroloval|poslal|potvrdil|informoval|omluvil)|rád bych)`,"iu").test(t);
      const female=unicodeWordRegex(String.raw`(?:(?:musela|předala|byla|mohla|chtěla|odeslala|připravila|upravila|doplnila|zpracovala|obdržela|rozhodla|navrhla|provedla|zkontrolovala|poslala|potvrdila|informovala|omluvila)\s+(?:jsem|bych)|(?:jsem|bych)\s+(?:musela|předala|byla|mohla|chtěla|odeslala|připravila|upravila|doplnila|zpracovala|obdržela|rozhodla|navrhla|provedla|zkontrolovala|poslala|potvrdila|informovala|omluvila)|ráda bych)`,"iu").test(t);
      const mismatch=gender==="female"?male:gender==="male"?female:(male||female);
      const detail=gender==="female"?"Profil je nastaven na ženský rod.":gender==="male"?"Profil je nastaven na mužský rod.":"Profil výslovně požaduje bezrodové formulace.";
      add(!mismatch,"Gramatický rod pisatele odpovídá profilu","warn",mismatch?detail:"");
    }
  }
  const srcDates=extractDates(src),outDates=extractDates(t),missingDates=srcDates.filter(x=>!outDates.includes(x));
  add(!missingDates.length,"Data a časy ze zadání jsou zachovány","warn",missingDates.join(", "));
  const sourceAttachment=containsAny(src,["příloha","v příloze","přikládám","soubor","attached","adjunto"]),outputAttachment=containsAny(t,["příloha","v příloze","přikládám","soubor","attached","adjunto"]);
  add(!sourceAttachment||outputAttachment,"Nezapomnělo se na zmíněnou přílohu","warn");add(!outputAttachment||sourceAttachment,"Text neslibuje přílohu, která nebyla v zadání","warn");
  const misses=cover&&Array.isArray(cover.vynechava)?cover.vynechava.filter(Boolean):[];add(!misses.length,"Pokryty jsou všechny zvolené požadavky","warn",misses.join(" · "));
  const harsh=/(je nepřijatelné|okamžitě musíte|vaše vina|selhal(?:a|i)? jste|vaše selhání|osobní selhání|neschopn|absurdní|odmítám se o tom bavit|tohle nebudu tolerovat)/i.test(t);
  add(!harsh,"Tón není zbytečně útočný nebo osobní","warn");
  const labels=/(líný|problémový|nevychovaný|nezodpovědný žák|špatný rodič)/i.test(t);add(!labels,"Text popisuje jednání, nehodnotí člověka","warn");
  const commitments=/(zaručuji|garantuji|určitě zajistím|bez výjimky|stoprocentně|slibuji, že)/i.test(t);add(!commitments,"Text nevytváří nechtěný absolutní závazek","warn");
  const vague=/(někdy|co nejdříve|brzy|snad|asi bychom mohli)/i.test(t)&&!extractDates(t).length;add(!vague,"Termín nebo další krok není zbytečně neurčitý","warn");
  const templatePhrases=findTemplatePhrases(t);add(!templatePhrases.length,"Text nepůsobí zbytečně šablonovitě","warn",templatePhrases.length?"Zvaž úpravu obratů: "+templatePhrases.join(" · "):"");
  const questions=(src.match(/\?/g)||[]).length;add(questions===0||containsAny(t,["odpov","potvr","prosím","navrh","termín","domluv","inform","souhlas","nemohu"]),"Text reaguje na otázky nebo jasně říká další krok","warn");
  const danger=items.some(x=>!x.ok&&x.level==="danger"),warn=items.some(x=>!x.ok);return {level:danger?"danger":warn?"warn":"ok",items};
};
function readinessLabel(level){return level==="ok"?"Připraveno":level==="warn"?"Zkontrolovat":"Chybí důležitá informace";}
window.refreshDraftReadiness=function(el,p){
  if(!el)return null;const text=el.__getSrc?el.__getSrc():clean(el.querySelector(".body")&&el.querySelector(".body").innerText);
  const r=evaluateDraftReadiness(p,text,el._sourceText||"",el._cover||{}),label=readinessLabel(r.level);
  const badge=el.querySelector(".draft-check-badge"),box=el.querySelector(".check-list");
  if(badge){badge.textContent=label;badge.className="status-badge draft-check-badge "+r.level;}
  if(box)box.innerHTML=r.items.map(x=>'<div class="check-item '+(x.ok?'ok':'check-'+x.level)+'"><span>'+(x.ok?'✓':x.level==='danger'?'!':'○')+'</span><span>'+esc(x.label)+(x.detail?'<small>'+esc(x.detail)+'</small>':'')+'</span></div>').join("");
  const rb=$("railCheckBadge"),rl=$("railChecklist");if(activeDraft===el&&rb&&rl){rb.textContent=label;rb.className="status-badge "+r.level;rl.innerHTML=box?box.innerHTML:"";}
  return r;
};
window.setActiveDraftCard=function(el,p){
  activeDraft=el;activePaneName=p||"in";document.querySelectorAll(".draft").forEach(x=>x.classList.toggle("active-draft",x===el));
  refreshDraftReadiness(el,activePaneName);syncBar();markWorkspaceStage("draft");
};
window.renderLockedSnippets=function(el){
  const box=el.querySelector(".locked-list");if(!box)return;const locked=Array.isArray(el._locked)?el._locked:[];
  box.innerHTML=locked.map((t,i)=>'<span class="locked-chip" title="Tato formulace musí zůstat při AI úpravě beze změny">🔒 '+esc(t)+' <button type="button" data-unlock="'+i+'" aria-label="Odemknout formulaci">×</button></span>').join("");box.style.display=locked.length?"flex":"none";
  box.querySelectorAll("[data-unlock]").forEach(b=>b.onclick=()=>{el._locked.splice(+b.dataset.unlock,1);renderLockedSnippets(el);toast("Formulace odemčena");});
};
window.openDraftVersions=function(el,p){
  const revisions=el._revisions||[];
  const rows=revisions.map((r,i)=>'<button class="version-row'+(i===el._revisionIndex?' current':'')+'" data-ver="'+i+'"><b>'+esc(r.label||"Verze")+'</b><span>'+new Date(r.at).toLocaleString("cs-CZ")+'</span><small>'+esc((r.text||"").slice(0,180))+'</small></button>').reverse().join("");
  openModal("Historie verzí",rows||'<p class="empty">Zatím není žádná další verze.</p>',{onMount(body,close){body.querySelectorAll("[data-ver]").forEach(b=>b.onclick=()=>{const r=revisions[+b.dataset.ver];if(r&&el.__setSrc){el.__setSrc(r.text,"Obnovená verze");close();toast("Verze obnovena ✓");}});}});
};
function insertBlock(el,text){
  const current=el.__getSrc?el.__getSrc():clean(el.querySelector(".body")&&el.querySelector(".body").innerText);
  const next=safeText(current+(current?"\n\n":"")+text);if(el.__setSrc)el.__setSrc(next,"Vložený textový blok");
}
function addCustomBlock(done){
  const html='<label class="dialog-label">Název</label><input id="blockName" class="dialog-input" maxlength="80" autofocus placeholder="např. Potvrzení termínu"><label class="dialog-label">Text formulace</label><textarea id="blockText" class="dialog-input" style="min-height:130px" placeholder="Hotový text, který chceš vkládat jedním kliknutím"></textarea><div class="dialog-actions"><button class="btn ghost dialog-cancel">Zrušit</button><button class="btn" id="saveBlock">Uložit</button></div>';
  openModal("Nová oblíbená formulace",html,{onMount(body,close){body.querySelector(".dialog-cancel").onclick=close;body.querySelector("#saveBlock").onclick=()=>{const name=clean(body.querySelector("#blockName").value),text=clean(body.querySelector("#blockText").value);if(!name||!text){toast("Doplň název i text formulace.");return;}const a=getCustomBlocks();a.unshift({id:uid("block"),name,category:"Vlastní",text});jset(LS.blocks,a.slice(0,40));close();if(done)done();toast("Formulace uložena ✓");};}});
}
function manageSignatures(done){
  const list=getSignatures(),selected=localStorage.getItem(LS.selectedSignature)||"profile";
  const html='<p class="hintline">Aktivní podpis se automaticky dosadí za značku <b>[podpis]</b>.</p><div id="sigList">'+(list.length?list.map(x=>'<article class="saved-item"><label class="signature-choice"><input type="radio" name="sig" value="'+escAttr(x.id)+'" '+(x.id===selected?'checked':'')+'><span><b>'+esc(x.name)+'</b><small>'+esc(x.text)+'</small></span></label>'+(x.system?'':'<button class="btn ghost small" data-del-sig="'+escAttr(x.id)+'">Smazat</button>')+'</article>').join(""):'<p class="empty">Zatím není uložen žádný podpis.</p>')+'</div><div class="dialog-actions"><button class="btn ghost" id="newSignature">＋ Nový podpis</button><button class="btn" id="sigDone">Hotovo</button></div>';
  openModal("Podpisy",html,{onMount(body,close){body.querySelectorAll('input[name="sig"]').forEach(r=>r.onchange=()=>{localStorage.setItem(LS.selectedSignature,r.value);toast("Výchozí podpis změněn ✓");});body.querySelectorAll("[data-del-sig]").forEach(b=>b.onclick=()=>{const a=jget(LS.signatures,[]).filter(x=>x.id!==b.dataset.delSig);jset(LS.signatures,a);if(localStorage.getItem(LS.selectedSignature)===b.dataset.delSig)localStorage.removeItem(LS.selectedSignature);close();manageSignatures(done);});body.querySelector("#newSignature").onclick=()=>{close();const form='<label class="dialog-label">Název podpisu</label><input id="sigName" class="dialog-input" placeholder="např. Třídní učitel" autofocus><label class="dialog-label">Celý podpis</label><textarea id="sigText" class="dialog-input" style="min-height:120px" placeholder="S pozdravem&#10;Jméno&#10;role"></textarea><div class="dialog-actions"><button class="btn" id="sigSave">Uložit podpis</button></div>';openModal("Nový podpis",form,{onMount(bb,cc){bb.querySelector("#sigSave").onclick=()=>{const name=clean(bb.querySelector("#sigName").value),text=clean(bb.querySelector("#sigText").value);if(!name||!text)return toast("Doplň název i text podpisu.");const a=jget(LS.signatures,[]),id=uid("sig");a.unshift({id,name,text});jset(LS.signatures,a.slice(0,12));localStorage.setItem(LS.selectedSignature,id);cc();manageSignatures(done);toast("Podpis uložen ✓");};}});};body.querySelector("#sigDone").onclick=()=>{close();if(done)done();};}});
}
window.openBlocksManager=function(el,p){
  const render=()=>{
    const blocks=getBlocks(),sigs=getSignatures(),selected=localStorage.getItem(LS.selectedSignature)||"profile";
    const active=sigs.find(x=>x.id===selected)||sigs[0];
    const phraseCards=blocks.map(x=>'<article class="phrase-card">'+
      '<div class="phrase-card-copy"><div class="phrase-card-title"><b>'+esc(x.name)+'</b><span class="phrase-category">'+esc(x.category||"Formulace")+'</span></div><p>'+esc(x.text)+'</p></div>'+
      '<div class="phrase-card-actions"><button type="button" class="btn small" data-block="'+escAttr(x.id)+'">Vložit</button>'+
      (String(x.id).startsWith("block-")?'<button type="button" class="btn ghost small" data-del-block="'+escAttr(x.id)+'">Smazat</button>':'')+'</div></article>').join("");
    const sigCards=sigs.length?sigs.map(x=>'<article class="signature-card'+(x.id===(active&&active.id)?' is-active':'')+'"><div><span class="signature-state">'+(x.id===(active&&active.id)?'Aktivní podpis':'Podpis')+'</span><b>'+esc(x.name)+'</b><pre>'+esc(x.text)+'</pre></div><button type="button" class="btn '+(x.id===(active&&active.id)?'ghost':'small')+'" data-signature="'+escAttr(x.id)+'">'+(x.id===(active&&active.id)?'Vložit':'Použít a vložit')+'</button></article>').join(""):'<p class="empty">Podpis nastavíš v profilu nebo si zde vytvoříš vlastní.</p>';
    const html='<div class="blocks-layout">'+
      '<section class="blocks-section"><div class="dialog-section-head"><div><p class="eyebrow">Rychlé vložení</p><h3>Oblíbené formulace</h3><p>Vyber hotovou větu. Každá karta jasně odděluje název, kategorii a skutečný text.</p></div><button type="button" class="btn ghost small" id="newBlock">＋ Přidat vlastní</button></div><div class="phrase-grid">'+phraseCards+'</div></section>'+
      '<section class="blocks-section signatures-section"><div class="dialog-section-head"><div><p class="eyebrow">Zakončení zprávy</p><h3>Podpisy</h3><p>Aktivní podpis se z profilu doplňuje lokálně za značku <b>[podpis]</b>.</p></div><button type="button" class="btn ghost small" id="manageSignatures">Spravovat podpisy</button></div><div class="signature-grid">'+sigCards+'</div></section></div>';
    openModal("Formulace a podpisy",html,{className:"modal-wide blocks-dialog",onMount(body,close){
      body.querySelectorAll("[data-block]").forEach(b=>b.onclick=()=>{const x=getBlocks().find(y=>y.id===b.dataset.block);if(x){insertBlock(el,x.text);close();toast("Formulace vložena ✓");}});
      body.querySelectorAll("[data-signature]").forEach(b=>b.onclick=()=>{const x=getSignatures().find(y=>y.id===b.dataset.signature);if(x){localStorage.setItem(LS.selectedSignature,x.id);insertBlock(el,"[podpis]");close();toast("Podpis nastaven a vložen ✓");}});
      body.querySelectorAll("[data-del-block]").forEach(b=>b.onclick=()=>{jset(LS.blocks,getCustomBlocks().filter(x=>x.id!==b.dataset.delBlock));close();render();});
      body.querySelector("#newBlock").onclick=()=>{close();addCustomBlock(render);};
      body.querySelector("#manageSignatures").onclick=()=>{close();manageSignatures(render);};
    }});
  };
  render();
};

window.saveWorkbenchDraft=function(el,p,opts){
  let text=el.__getSrc?el.__getSrc():clean(el.querySelector(".body")&&el.querySelector(".body").innerText);if(!text)return toast("Není co uložit.");
  try{text=applyKeyToText(p,text);}catch(_){}
  let audit={level:"danger"};try{audit=safetyAudit(text,p);}catch(_){}
  if(!text||audit.level==="danger"||audit.level==="nosend"||hasSensitiveSchoolTerms(text)){toast("Koncept se neuložil: obsahuje údaj, který není bezpečné ukládat. Uložení je dovoleno jen pro anonymizovanou verzi.");return;}
  const a=jget(LS.drafts,[]),item={id:uid("draft"),at:Date.now(),pane:p,label:(opts&&opts.styl)||"Rozpracovaný e-mail",text:safeText(text),variant:(opts&&opts.variantType)||"",safe:true,format:1};
  a.unshift(item);jset(LS.drafts,a.filter(x=>x&&x.safe===true).slice(0,20));el.classList.add("is-saved");refreshDeskStatus();toast("Anonymizovaný koncept uložen ✓");
};
function icsEscape(s){return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");}
function downloadIcs(title,date,note){
  const d=new Date(date);if(Number.isNaN(d.getTime()))return toast("Vyber platné datum a čas.");const pad=n=>String(n).padStart(2,"0"),fmt=x=>x.getUTCFullYear()+pad(x.getUTCMonth()+1)+pad(x.getUTCDate())+"T"+pad(x.getUTCHours())+pad(x.getUTCMinutes())+"00Z";
  const end=new Date(d.getTime()+30*60000),ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//KS//Pracovni stul//CS","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:"+uid("ks")+"@local","DTSTAMP:"+fmt(new Date()),"DTSTART:"+fmt(d),"DTEND:"+fmt(end),"SUMMARY:"+icsEscape(title),"DESCRIPTION:"+icsEscape(note||"Vytvořeno v Korespondenčním asistentovi"),"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="pripominka.ics";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
window.openFollowupDialog=function(el,p){
  const html='<div class="quick-dates"><button class="chip on" data-days="2">Za 2 dny</button><button class="chip" data-days="7">Za týden</button><button class="chip" data-days="0">Vlastní datum</button></div><label class="dialog-label">Co pohlídat</label><input id="fuTitle" class="dialog-input" value="Čekám na odpověď"><label class="dialog-label">Datum a čas</label><input id="fuDate" class="dialog-input" type="datetime-local"><label class="review-check"><input id="fuWaiting" type="checkbox" checked><span>Označit jako „čekám na odpověď“</span></label><div class="dialog-actions"><button class="btn ghost" id="fuIcs">Stáhnout .ics</button><button class="btn" id="fuSave">Uložit připomínku</button></div>';
  openModal("Navazující krok",html,{onMount(body,close){const dt=body.querySelector("#fuDate");const setDate=days=>{if(!days)return;const d=new Date(Date.now()+days*86400000);dt.value=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"T09:00";};setDate(2);body.querySelectorAll("[data-days]").forEach(b=>b.onclick=()=>{body.querySelectorAll("[data-days]").forEach(x=>x.classList.toggle("on",x===b));setDate(+b.dataset.days);if(+b.dataset.days===0)dt.focus();});const get=()=>({id:uid("follow"),title:clean(body.querySelector("#fuTitle").value)||"Čekám na odpověď",date:dt.value,waiting:body.querySelector("#fuWaiting").checked,note:"Vytvořeno v Korespondenčním asistentovi",created:Date.now()});body.querySelector("#fuIcs").onclick=()=>{const x=get();downloadIcs(x.title,x.date,x.note);};body.querySelector("#fuSave").onclick=()=>{const x=get();if(!x.date)return toast("Vyber datum.");const a=jget(LS.followups,[]);a.unshift(x);jset(LS.followups,a.slice(0,40));refreshDeskStatus();close();toast("Připomínka uložena ✓");};}});
};
window.updateAssistantRail=function(ctx){
  const d=(ctx&&ctx.analysis)||{},r=$("railOverview");if(!r)return;const req=Array.isArray(d.pozadavky)?d.pozadavky:[],terms=Array.isArray(d.terminy)?d.terminy:[];
  r.innerHTML='<div class="rail-priority '+escAttr((ctx&&ctx.priorityMeta&&ctx.priorityMeta.cls)||"week")+'">'+esc((ctx&&ctx.priorityMeta&&ctx.priorityMeta.label)||"Vyřídit tento týden")+'</div><dl><dt>Požadavky</dt><dd>'+esc(req.length?req.slice(0,4).join(" · "):"Bez jasného požadavku")+'</dd><dt>Termíny</dt><dd>'+esc(terms.length?terms.join(" · "):"Bez výslovného termínu")+'</dd><dt>Další krok</dt><dd>'+esc(d.dalsiKrok||"Připravit odpověď a zkontrolovat fakta.")+'</dd></dl>';
};
window.markWorkspaceStage=function(stage){document.querySelectorAll("#workspaceNav button").forEach(b=>b.classList.toggle("is-current",b.dataset.jump===stage));};

function scenarioEntries(){return Object.entries(SCHOOL_SCENARIOS).filter(([k])=>k!=="none");}
function rememberScenario(key){let a=jget(LS.recentScenarios,[]);a=[key].concat(a.filter(x=>x!==key)).slice(0,6);jset(LS.recentScenarios,a);}
function activateScenario(key){if(!SCHOOL_SCENARIOS[key])return;switchTab("my");setChip("my_flow","guided");syncSchoolScenario(key,true);rememberScenario(key);updateMyMode();const sc=SCHOOL_SCENARIOS[key],effects=typeof scenarioEffects==="function"?scenarioEffects(sc):[];toast("Scénář „"+sc.label+"“ použit"+(effects.length?" — "+effects.join(" · "):""));const raw=$("my_raw");if(raw){raw.focus();raw.scrollIntoView({behavior:"smooth",block:"center"});}renderQuickScenarios();}
function renderQuickScenarios(){
  const defaults=["grade_parent","consultation","complaint_reply","class_info","meeting_change","proposal"],recent=jget(LS.recentScenarios,[]),keys=[...new Set(recent.concat(defaults))].filter(k=>SCHOOL_SCENARIOS[k]).slice(0,6),q=$("quickScenarios");
  if(q)q.innerHTML=keys.map(k=>'<button class="quick-scenario" type="button" data-quick="'+k+'">'+esc(SCHOOL_SCENARIOS[k].label)+'</button>').join("");
}
function openScenarioLibrary(){
  const cats={};scenarioEntries().forEach(([key,x])=>{const c=x.category||"Další";(cats[c]||(cats[c]=[])).push([key,x]);});
  const html='<label class="dialog-label" for="scenarioSearch">Hledat situaci</label><input id="scenarioSearch" class="dialog-input" type="search" placeholder="např. rodič, termín, známka, porada" autofocus><div id="scenarioLibrary">'+Object.entries(cats).map(([cat,rows])=>'<section class="scenario-category"><h4>'+esc(cat)+'</h4>'+rows.map(([key,x])=>'<button class="scenario-card" data-scenario="'+key+'" data-search="'+escAttr((x.label+" "+x.hint+" "+cat).toLowerCase())+'"><b>'+esc(x.label)+'</b><span>'+esc(x.hint||"")+'</span>'+(x.strict?'<small>Přísný bezpečnostní režim</small>':'')+'</button>').join("")+'</section>').join("")+'</div>';
  openModal("Scénáře školní komunikace",html,{onMount(body,close){const input=body.querySelector("#scenarioSearch");input.oninput=()=>{const q=input.value.toLowerCase().trim();body.querySelectorAll("[data-scenario]").forEach(b=>b.hidden=q&&!b.dataset.search.includes(q));body.querySelectorAll(".scenario-category").forEach(s=>s.hidden=![...s.querySelectorAll("[data-scenario]")].some(b=>!b.hidden));};body.querySelectorAll("[data-scenario]").forEach(b=>b.onclick=()=>{activateScenario(b.dataset.scenario);close();});}});
}
window.openScenarioLibrary=openScenarioLibrary;
function refreshDeskStatus(){
  const drafts=jget(LS.drafts,[]).filter(x=>x&&x.safe===true),follow=jget(LS.followups,[]).filter(x=>x&&x.date).sort((a,b)=>new Date(a.date)-new Date(b.date)),s=$("deskStatus");
  if(s){s.innerHTML=((drafts.length?'<button class="desk-mini" data-open-draft><b>'+drafts.length+' konceptů</b><small>Poslední: '+new Date(drafts[0].at).toLocaleString("cs-CZ")+'</small></button>':"")+(follow.length?'<button class="desk-mini" data-open-follow><b>'+follow.length+' připomínek</b><small>Nejbližší: '+new Date(follow[0].date).toLocaleString("cs-CZ")+'</small></button>':""))||"Zatím žádný uložený koncept ani připomínka.";s.querySelector("[data-open-draft]")&&s.querySelector("[data-open-draft]").addEventListener("click",openDraftsManager);s.querySelector("[data-open-follow]")&&s.querySelector("[data-open-follow]").addEventListener("click",openFollowupsManager);}
  const rf=$("railFollowups");if(rf)rf.innerHTML=follow.length?follow.slice(0,3).map(x=>'<button class="follow-mini" data-open-follow><b>'+esc(x.title)+'</b><small>'+new Date(x.date).toLocaleString("cs-CZ")+'</small></button>').join(""):"Žádné aktivní připomínky.";if(rf)rf.querySelectorAll("[data-open-follow]").forEach(b=>b.onclick=openFollowupsManager);
}
function openDraftsManager(){
  const a=jget(LS.drafts,[]).filter(x=>x&&x.safe===true);
  openModal("Rozpracované koncepty",a.length?a.map((x,i)=>'<article class="saved-item"><b>'+esc(x.label)+'</b><small>'+new Date(x.at).toLocaleString("cs-CZ")+'</small><p>'+esc(x.text.slice(0,260))+'</p><button class="btn small" data-load="'+i+'">Načíst k úpravě</button><button class="btn ghost small" data-copy-draft="'+i+'">Kopírovat značky</button><button class="btn ghost small" data-del="'+i+'">Smazat</button></article>').join(""):'<p class="empty">Žádné uložené koncepty.</p>',{onMount(body,close){body.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{const x=a[+b.dataset.load];switchTab(x.pane||"my");const raw=E(x.pane||"my","raw");if(raw){raw.value=x.text;raw.dispatchEvent(new Event("input",{bubbles:true}));}close();toast("Anonymizovaný koncept načten");});body.querySelectorAll("[data-copy-draft]").forEach(b=>b.onclick=e=>copyText(a[+b.dataset.copyDraft].text,e.currentTarget));body.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const id=a[+b.dataset.del].id;jset(LS.drafts,a.filter(x=>x.id!==id));close();refreshDeskStatus();openDraftsManager();});}});
}
function openFollowupsManager(){
  const a=jget(LS.followups,[]).filter(x=>x&&x.date).sort((x,y)=>new Date(x.date)-new Date(y.date));
  openModal("Připomínky a čekání na odpověď",a.length?a.map((x,i)=>'<article class="saved-item"><b>'+esc(x.title)+'</b><small>'+new Date(x.date).toLocaleString("cs-CZ")+(x.waiting?' · čekám na odpověď':'')+'</small><button class="btn ghost small" data-ics="'+i+'">Stáhnout .ics</button><button class="btn ghost small" data-done="'+i+'">Hotovo</button></article>').join(""):'<p class="empty">Žádné aktivní připomínky.</p>',{onMount(body,close){body.querySelectorAll("[data-ics]").forEach(b=>b.onclick=()=>{const x=a[+b.dataset.ics];downloadIcs(x.title,x.date,x.note);});body.querySelectorAll("[data-done]").forEach(b=>b.onclick=()=>{const id=a[+b.dataset.done].id;jset(LS.followups,a.filter(x=>x.id!==id));close();refreshDeskStatus();openFollowupsManager();});}});
}
window.openFollowupsManager=openFollowupsManager;
function downloadJson(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);}
function openSchoolLibraryManager(){
  const html='<p>Vytvoř přenositelný balíček vlastních šablon a formulací pro kolegy. Balíček neobsahuje API klíč, historii, osobní profil, podpisy ani texty e-mailů.</p><div class="library-summary"><b>Součást balíčku</b><span>Vlastní šablony nastavení · vlastní textové bloky</span></div><div class="dialog-actions"><button class="btn" id="libExport">Exportovat školní balíček</button><button class="btn ghost" id="libImport">Importovat balíček</button><input type="file" id="libFile" accept="application/json,.json" hidden></div><div class="info">Centrální automatická synchronizace pro celou školu vyžaduje přihlášení a školní backend. Tato verze proto používá bezpečný export/import bez účtů a bez odesílání dat.</div>';
  openModal("Sdílená školní knihovna",html,{onMount(body,close){body.querySelector("#libExport").onclick=()=>downloadJson("KS-skolni-knihovna.json",{app:"Korespondencni asistent",format:1,created:new Date().toISOString(),templates:loadTpls(),blocks:getCustomBlocks()});const f=body.querySelector("#libFile");body.querySelector("#libImport").onclick=()=>f.click();f.onchange=()=>{const file=f.files&&f.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(String(r.result||"{}"));if(d.app!=="Korespondencni asistent"||d.format!==1)throw new Error("Neplatný formát");if(Array.isArray(d.templates))saveTpls(d.templates.slice(0,30));if(Array.isArray(d.blocks))jset(LS.blocks,d.blocks.filter(x=>x&&x.name&&x.text).slice(0,40));renderTemplates();close();toast("Školní knihovna importována ✓");}catch(e){toast("Soubor není platný balíček Korespondenčního asistenta.");}};r.readAsText(file,"utf-8");};}});
}
window.openSchoolLibraryManager=openSchoolLibraryManager;
function syncBar(){const enabled=!!activeDraft;["barSave","barCheck","barCopy"].forEach(id=>{const b=$(id);if(b)b.disabled=!enabled;});}
function renderWorkspaceNav(p){
  const nav=$("workspaceNav"); if(!nav)return;
  const steps=p==="my"?[["source","Zdroj"],["privacy","Anonymizace"],["draft","Text"],["check","Kontrola"]]:[["source","Zdroj"],["privacy","Anonymizace"],["analysis","Rozbor"],["draft","Odpověď"],["check","Kontrola"]];
  nav.innerHTML=steps.map((x,i)=>'<button type="button" data-jump="'+x[0]+'" class="'+(i===0?'is-current':'')+'"><span>'+(i+1)+'</span>'+x[1]+'</button>').join("");
}
window.renderWorkspaceNav=renderWorkspaceNav;
function initDesk(){
  renderWorkspaceNav(activePane()); renderQuickScenarios();const q=$("quickScenarios");if(q)q.addEventListener("click",e=>{const b=e.target.closest("[data-quick]");if(b)activateScenario(b.dataset.quick);});
  document.querySelectorAll('[data-start="scenario"]').forEach(b=>b.onclick=openScenarioLibrary);
  document.querySelectorAll('[data-start="in"]').forEach(b=>b.onclick=()=>{renderWorkspaceNav("in");switchTab("in");});
  document.querySelectorAll('[data-start="my"]').forEach(b=>b.onclick=()=>{renderWorkspaceNav("my");switchTab("my");});
  $("my_startOwn")&&$("my_startOwn").addEventListener("click",()=>{$("my_raw")?.focus();});
  $("my_startScenario")&&$("my_startScenario").addEventListener("click",openScenarioLibrary);
  $("openScenarioLibrary")&&$("openScenarioLibrary").addEventListener("click",openScenarioLibrary);$("openFollowups")&&$("openFollowups").addEventListener("click",openFollowupsManager);$("railFollowupsOpen")&&$("railFollowupsOpen").addEventListener("click",openFollowupsManager);
  $("workspaceNav")&&$("workspaceNav").addEventListener("click",e=>{const b=e.target.closest("[data-jump]");if(!b)return;const map={source:".tabpane.active textarea",privacy:'.tabpane.active [id$="_step2"]',analysis:"#in_results .action-overview",draft:".tabpane.active .draft",check:".tabpane.active .draft-check"};const target=document.querySelector(map[b.dataset.jump]);if(target)target.scrollIntoView({behavior:"smooth",block:"center"});else toast("Tento krok ještě není připraven.");markWorkspaceStage(b.dataset.jump);});
  $("barNew")&&$("barNew").addEventListener("click",()=>confirmActionModal({title:"Nová zpráva",message:"Vyčistit aktuální pracovní plochu? Uložené koncepty a připomínky zůstanou zachovány.",confirmText:"Vyčistit",onConfirm(){const p=activePane(),raw=E(p,"raw");if(raw){raw.value="";raw.dispatchEvent(new Event("input",{bubbles:true}));raw.focus();}activeDraft=null;syncBar();markWorkspaceStage("source");}}));
  $("barSave")&&$("barSave").addEventListener("click",()=>activeDraft&&saveWorkbenchDraft(activeDraft,activePaneName,{}));
  $("barCheck")&&$("barCheck").addEventListener("click",()=>{if(!activeDraft)return;refreshDraftReadiness(activeDraft,activePaneName);const d=activeDraft.querySelector(".draft-check");if(d){d.open=true;d.scrollIntoView({behavior:"smooth",block:"center"});}markWorkspaceStage("check");});
  $("barCopy")&&$("barCopy").addEventListener("click",()=>activeDraft&&activeDraft.querySelector(".act-copy")&&activeDraft.querySelector(".act-copy").click());
  refreshDeskStatus();syncBar();
}

/* Nástroje se registrují ještě před buildFooterTools() v 80-pwa-start.js. */
if(typeof footBtn==="function"){
  footBtn("Uložené koncepty","⌑","Rozpracované anonymizované e-maily uložené v tomto prohlížeči",openDraftsManager);
  footBtn("Formulace a podpisy","✍","Opakované věty, závěry a podpisy pro rychlé vložení",()=>{if(activeDraft)openBlocksManager(activeDraft,activePaneName);else manageSignatures();});
  footBtn("Scénáře školní komunikace","⚡","Přednastavené komunikační scénáře pro běžné školní situace",openScenarioLibrary);
  footBtn("Čekám na odpověď","◷","Lokální přehled e-mailů, u kterých chceš hlídat navazující termín",openFollowupsManager);
  footBtn("Školní balíček šablon","⇄","Export nebo import společných formulací a šablon pro kolegy",openSchoolLibraryManager);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initDesk);else initDesk();
})();
