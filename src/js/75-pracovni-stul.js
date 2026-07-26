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
  {id:"received",name:"Potvrzení přijetí",category:"Reakce",text:"Děkuji za zprávu. Potvrzuji, že jsem ji obdržel a budu se jí zabývat."},
  {id:"phone",name:"Nabídka telefonické domluvy",category:"Schůzka",text:"Pokud by bylo snazší věc probrat telefonicky, můžeme si domluvit vhodný termín hovoru."},
  {id:"decline",name:"Zdvořilé odmítnutí",category:"Reakce",text:"V této podobě bohužel nemohu žádosti vyhovět. Rád však navrhnu jiné možné řešení."},
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
function extractDates(t){return [...new Set((String(t||"").match(/\b(?:\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?|\d{1,2}:\d{2}|ponděl[íia]?|úter[ýí]|střed[auy]|čtvrt(?:ek|ka|ku)|pát(?:ek|ku)|sobot[auy]|neděl[ei]|zítra|pozítří|příští týden|do konce týdne)\b/gi)||[]).map(x=>x.toLowerCase()))];}

window.evaluateDraftReadiness=function(p,text,source,cover){
  const t=safeText(text),src=safeText(source),items=[];
  const add=(ok,label,level,detail)=>items.push({ok:!!ok,label,level:ok?"ok":(level||"warn"),detail:detail||""});
  add(t.length>=45,"Text není prázdný ani příliš krátký","danger");
  // Pracovní koncept záměrně obsahuje bezpečné značky (např. „osoba A“).
  // Kontrola před odesláním proto musí posuzovat až finální rekomponovanou verzi,
  // ve které se známé značky vrátí na skutečné údaje a [podpis] na profilový podpis.
  const finalText=typeof recompose==="function"?safeText(recompose(p,t)):t;
  const bezPodpisu=finalText.replace(/\[u[čc]itel\]/g," ");
  add(typeof hasLeftoverToken!=="function"||!hasLeftoverToken(bezPodpisu),"Nezůstala nevyplněná anonymizační značka","danger");
  add(!/\[u[čc]itel\]/.test(finalText),"Podpis je vyplněný v profilu odesílatele","warn");
  add(/^(předmět:.*\n+)?\s*(dobrý den|vážen|ahoj|mil[ýáé]|dear|hello|hola|buenos)/im.test(t),"Zpráva obsahuje vhodné oslovení","warn");
  add(/(s pozdravem|děkuji|hezký den|kind regards|best regards|saludos|atentamente|\[podpis\])/i.test(t),"Zpráva má zakončení nebo podpis","warn");
  const srcDates=extractDates(src),outDates=extractDates(t),missingDates=srcDates.filter(x=>!outDates.includes(x));
  add(!missingDates.length,"Data a časy ze zadání jsou zachovány",missingDates.length?"danger":"warn",missingDates.join(", "));
  const sourceAttachment=containsAny(src,["příloha","v příloze","přikládám","soubor","attached","adjunto"]);
  const outputAttachment=containsAny(t,["příloha","v příloze","přikládám","soubor","attached","adjunto"]);
  add(!sourceAttachment||outputAttachment,"Nezapomnělo se na zmíněnou přílohu","warn");
  add(!outputAttachment||sourceAttachment,"Text neslibuje přílohu, která nebyla v zadání","warn");
  const misses=cover&&Array.isArray(cover.vynechava)?cover.vynechava.filter(Boolean):[];
  add(!misses.length,"Pokryty jsou všechny zvolené požadavky",misses.length>1?"danger":"warn",misses.join(" · "));
  const harsh=/(je nepřijatelné|okamžitě musíte|vaše vina|selhání|neschopn|absurdní|odmítám se o tom bavit|tohle nebudu tolerovat)/i.test(t);
  add(!harsh,"Tón není zbytečně útočný nebo osobní","danger");
  const labels=/(líný|problémový|nevychovaný|nezodpovědný žák|špatný rodič)/i.test(t);
  add(!labels,"Text popisuje jednání, nehodnotí člověka","danger");
  const commitments=/(zaručuji|garantuji|určitě zajistím|bez výjimky|stoprocentně|slibuji, že)/i.test(t);
  add(!commitments,"Text nevytváří nechtěný absolutní závazek","warn");
  const vague=/(někdy|co nejdříve|brzy|snad|asi bychom mohli)/i.test(t)&&!extractDates(t).length;
  add(!vague,"Termín nebo další krok není zbytečně neurčitý","warn");
  const questions=(src.match(/\?/g)||[]).length;
  add(questions===0||containsAny(t,["odpov","potvr","prosím","navrh","termín","domluv","inform","souhlas","nemohu"]),"Text reaguje na otázky nebo jasně říká další krok","warn");
  const danger=items.some(x=>!x.ok&&x.level==="danger"),warn=items.some(x=>!x.ok);
  return {level:danger?"danger":warn?"warn":"ok",items};
};
function readinessLabel(level){return level==="ok"?"Připraveno":level==="warn"?"Zkontrolovat":"Chybí důležitá informace";}
window.refreshDraftReadiness=function(el,p){
  if(!el)return null;const text=el.__getSrc?el.__getSrc():clean(el.querySelector(".body")&&el.querySelector(".body").innerText);
  const r=evaluateDraftReadiness(p,text,el._sourceText||"",el._cover||{}),label=readinessLabel(r.level);
  const badge=el.querySelector(".draft-check-badge"),box=el.querySelector(".check-list");
  if(badge){badge.textContent=label;badge.className="status-badge draft-check-badge "+r.level;}
  if(box)box.innerHTML=r.items.map(x=>'<div class="check-item '+(x.ok?'ok':x.level)+'"><span>'+(x.ok?'✓':x.level==='danger'?'!':'○')+'</span><span>'+esc(x.label)+(x.detail?'<small>'+esc(x.detail)+'</small>':'')+'</span></div>').join("");
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
  const render=()=>{const blocks=getBlocks(),sigs=getSignatures();const selected=localStorage.getItem(LS.selectedSignature)||"profile";
    const html='<div class="block-tabs"><div class="dialog-section-head"><h4>Oblíbené formulace</h4><button class="link-btn" id="newBlock">Přidat vlastní</button></div>'+blocks.map(x=>'<article class="insert-block"><button class="insert-main" data-block="'+escAttr(x.id)+'"><b>'+esc(x.name)+'</b><small>'+esc(x.category||"Formulace")+'</small><span>'+esc(x.text)+'</span></button>'+(String(x.id).startsWith("block-")?'<button class="mini-delete" data-del-block="'+escAttr(x.id)+'" title="Smazat">×</button>':'')+'</article>').join("")+'<div class="dialog-section-head"><h4>Podpisy</h4><button class="link-btn" id="manageSignatures">Spravovat</button></div>'+(sigs.length?sigs.map(x=>'<button class="insert-block insert-signature" data-signature="'+escAttr(x.id)+'"><b>'+esc(x.name)+(x.id===selected?' · aktivní':'')+'</b><span>'+esc(x.text)+'</span></button>').join(""):'<p class="empty">Podpis nastavíš v profilu nebo zde vytvoříš vlastní.</p>')+'</div>';
    openModal("Textové bloky a podpisy",html,{onMount(body,close){body.querySelectorAll("[data-block]").forEach(b=>b.onclick=()=>{const x=getBlocks().find(y=>y.id===b.dataset.block);if(x){insertBlock(el,x.text);close();toast("Formulace vložena ✓");}});body.querySelectorAll("[data-signature]").forEach(b=>b.onclick=()=>{const x=getSignatures().find(y=>y.id===b.dataset.signature);if(x){localStorage.setItem(LS.selectedSignature,x.id);insertBlock(el,x.text);close();toast("Podpis vložen a nastaven jako výchozí ✓");}});body.querySelectorAll("[data-del-block]").forEach(b=>b.onclick=()=>{jset(LS.blocks,getCustomBlocks().filter(x=>x.id!==b.dataset.delBlock));close();render();});body.querySelector("#newBlock").onclick=()=>{close();addCustomBlock(render);};body.querySelector("#manageSignatures").onclick=()=>{close();manageSignatures(render);};}});
  };render();
};

window.saveWorkbenchDraft=function(el,p,opts){
  let text=el.__getSrc?el.__getSrc():clean(el.querySelector(".body")&&el.querySelector(".body").innerText);if(!text)return toast("Není co uložit.");
  try{text=applyKeyToText(p,text);}catch(_){}
  let audit={level:"danger"};try{audit=safetyAudit(text,p);}catch(_){}
  if(!text||audit.level==="danger"||hasSensitiveSchoolTerms(text)){toast("Koncept se neuložil: obsahuje údaj, který není bezpečné ukládat. Uložení je dovoleno jen pro anonymizovanou verzi.");return;}
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
function uniqueWordMarkup(text,other){
  const otherSet=new Set(String(other||"").toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
  return String(text||"").split(/(\s+|[^\p{L}\p{N}]+)/u).map(tok=>{const w=tok.toLowerCase();return /^[\p{L}\p{N}]+$/u.test(tok)&&!otherSet.has(w)?'<mark>'+esc(tok)+'</mark>':esc(tok);}).join("");
}
window.openDraftComparison=function(cards){
  const arr=cards.filter(Boolean);if(arr.length<2)return toast("Pro porovnání jsou potřeba alespoň dvě varianty.");
  const labels=arr.map((c,i)=>({strucna:"Stručná",standardni:"Standardní",diplomaticka:"Diplomatická"}[c.dataset.variant]||("Varianta "+(i+1))));
  const html='<div class="compare-controls"><label>Vlevo <select id="cmpA">'+labels.map((x,i)=>'<option value="'+i+'">'+esc(x)+'</option>').join("")+'</select></label><label>Vpravo <select id="cmpB">'+labels.map((x,i)=>'<option value="'+i+'" '+(i===1?'selected':'')+'>'+esc(x)+'</option>').join("")+'</select></label></div><p class="hintline">Zvýrazněna jsou slova, která se v druhé zvolené variantě nevyskytují.</p><div class="comparison-grid" id="cmpGrid"></div>';
  openModal("Porovnání variant",html,{onMount(body,close){const a=body.querySelector("#cmpA"),b=body.querySelector("#cmpB"),grid=body.querySelector("#cmpGrid");const render=()=>{if(a.value===b.value)b.value=String((+a.value+1)%arr.length);const ca=arr[+a.value],cb=arr[+b.value],ta=ca.__getSrc?ca.__getSrc():ca.innerText,tb=cb.__getSrc?cb.__getSrc():cb.innerText;grid.innerHTML='<section><h4>'+esc(labels[+a.value])+'</h4><div>'+uniqueWordMarkup(ta,tb)+'</div><button class="btn small" data-use="'+a.value+'">Použít tuto variantu</button></section><section><h4>'+esc(labels[+b.value])+'</h4><div>'+uniqueWordMarkup(tb,ta)+'</div><button class="btn small" data-use="'+b.value+'">Použít tuto variantu</button></section>';grid.querySelectorAll("[data-use]").forEach(x=>x.onclick=()=>{const c=arr[+x.dataset.use];setActiveDraftCard(c,"in");c.scrollIntoView({behavior:"smooth",block:"center"});close();});};a.onchange=render;b.onchange=render;render();}});
};
window.updateAssistantRail=function(ctx){
  const d=(ctx&&ctx.analysis)||{},r=$("railOverview");if(!r)return;const req=Array.isArray(d.pozadavky)?d.pozadavky:[],terms=Array.isArray(d.terminy)?d.terminy:[];
  r.innerHTML='<div class="rail-priority '+escAttr((ctx&&ctx.priorityMeta&&ctx.priorityMeta.cls)||"week")+'">'+esc((ctx&&ctx.priorityMeta&&ctx.priorityMeta.label)||"Vyřídit tento týden")+'</div><dl><dt>Požadavky</dt><dd>'+esc(req.length?req.slice(0,4).join(" · "):"Bez jasného požadavku")+'</dd><dt>Termíny</dt><dd>'+esc(terms.length?terms.join(" · "):"Bez výslovného termínu")+'</dd><dt>Další krok</dt><dd>'+esc(d.dalsiKrok||"Připravit odpověď a zkontrolovat fakta.")+'</dd></dl>';
};
window.markWorkspaceStage=function(stage){document.querySelectorAll("#workspaceNav button").forEach(b=>b.classList.toggle("is-current",b.dataset.jump===stage));};

function scenarioEntries(){return Object.entries(SCHOOL_SCENARIOS).filter(([k])=>k!=="none");}
function rememberScenario(key){let a=jget(LS.recentScenarios,[]);a=[key].concat(a.filter(x=>x!==key)).slice(0,6);jset(LS.recentScenarios,a);}
function activateScenario(key){if(!SCHOOL_SCENARIOS[key])return;switchTab("my");setChip("my_flow","guided");syncSchoolScenario(key,true);rememberScenario(key);updateMyMode();const raw=$("my_raw");if(raw){raw.focus();raw.scrollIntoView({behavior:"smooth",block:"center"});}renderQuickScenarios();}
function renderQuickScenarios(){
  const defaults=["grade_parent","consultation","complaint_reply","class_info","meeting_change","proposal"],recent=jget(LS.recentScenarios,[]),keys=[...new Set(recent.concat(defaults))].filter(k=>SCHOOL_SCENARIOS[k]).slice(0,6),q=$("quickScenarios");
  if(q)q.innerHTML=keys.map(k=>'<button class="quick-scenario" type="button" data-quick="'+k+'">'+esc(SCHOOL_SCENARIOS[k].label)+'</button>').join("");
}
function openScenarioLibrary(){
  const cats={};scenarioEntries().forEach(([key,x])=>{const c=x.category||"Další";(cats[c]||(cats[c]=[])).push([key,x]);});
  const html='<label class="dialog-label" for="scenarioSearch">Hledat situaci</label><input id="scenarioSearch" class="dialog-input" type="search" placeholder="např. rodič, termín, známka, porada" autofocus><div id="scenarioLibrary">'+Object.entries(cats).map(([cat,rows])=>'<section class="scenario-category"><h4>'+esc(cat)+'</h4>'+rows.map(([key,x])=>'<button class="scenario-card" data-scenario="'+key+'" data-search="'+escAttr((x.label+" "+x.hint+" "+cat).toLowerCase())+'"><b>'+esc(x.label)+'</b><span>'+esc(x.hint||"")+'</span>'+(x.strict?'<small>Přísný bezpečnostní režim</small>':'')+'</button>').join("")+'</section>').join("")+'</div>';
  openModal("Knihovna školních situací",html,{onMount(body,close){const input=body.querySelector("#scenarioSearch");input.oninput=()=>{const q=input.value.toLowerCase().trim();body.querySelectorAll("[data-scenario]").forEach(b=>b.hidden=q&&!b.dataset.search.includes(q));body.querySelectorAll(".scenario-category").forEach(s=>s.hidden=![...s.querySelectorAll("[data-scenario]")].some(b=>!b.hidden));};body.querySelectorAll("[data-scenario]").forEach(b=>b.onclick=()=>{activateScenario(b.dataset.scenario);close();});}});
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
function initDesk(){
  renderQuickScenarios();const q=$("quickScenarios");if(q)q.addEventListener("click",e=>{const b=e.target.closest("[data-quick]");if(b)activateScenario(b.dataset.quick);});
  document.querySelectorAll('[data-start="scenario"]').forEach(b=>b.onclick=openScenarioLibrary);
  const collapsed=!!jget(LS.desk,false),lower=$("deskLower"),actions=$("deskActions"),cb=$("deskCollapse");const paint=v=>{if(lower)lower.hidden=v;if(actions)actions.hidden=v;if(cb){cb.textContent=v?"Zobrazit úvod":"Skrýt úvod";cb.setAttribute("aria-expanded",String(!v));}};paint(collapsed);if(cb)cb.onclick=()=>{const v=!lower.hidden;jset(LS.desk,v);paint(v);};
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
  footBtn("Pracovní koncepty","⌑","Bezpečně uložené anonymizované koncepty",openDraftsManager);
  footBtn("Textové bloky a podpisy","✍","Oblíbené formulace a více podpisů",()=>{if(activeDraft)openBlocksManager(activeDraft,activePaneName);else manageSignatures();});
  footBtn("Školní situace","⚡","Knihovna každodenních školních scénářů",openScenarioLibrary);
  footBtn("Připomínky","◷","Čekám na odpověď a navazující termíny",openFollowupsManager);
  footBtn("Sdílená školní knihovna","⇄","Export a import šablon pro kolegy",openSchoolLibraryManager);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initDesk);else initDesk();
})();
