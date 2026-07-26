/* ===================== JEDNOTNÉ SVG IKONY (#6) ===================== */
const ICON_PATHS={
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  clip:'<path d="M21 11l-8.6 8.6a4 4 0 0 1-5.7-5.7L14.5 5.4a3 3 0 0 1 4.2 4.2l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1L15.3 7.6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  redo:'<path d="M3 11a9 9 0 0 1 15-6.4L21 7"/><path d="M21 3v4h-4"/><path d="M21 13a9 9 0 0 1-15 6.4L3 17"/><path d="M3 21v-4h4"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3z"/>',
  spark:'<path d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6z"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  download:'<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  chat:'<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z"/>',
  flask:'<path d="M9 3h6M10 3v6l-5.2 9.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3"/>',
  broom:'<path d="M19 4l-8 8"/><path d="M12 11l-7 7a3 3 0 0 0 4.2 4.2l7-7"/><path d="M4 21l2.5-1"/>',
  bug:'<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M12 8V5M5 9l3 1M19 9l-3 1M4.5 14H8M16 14h3.5M6 19l2.2-2M18 19l-2.2-2"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  fs:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  fsexit:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  warn:'<path d="M12 3l9.5 16.5H2.5z"/><path d="M12 9v5M12 17.5h.01"/>',
  cross:'<path d="M6 6l12 12M18 6L6 18"/>',
  phone:'<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.4.55 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .55 3.4 1 1 0 0 1-.25 1z"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v15"/><path d="M8 7h8"/>',
  life:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M19.1 4.9l-4.3 4.3M9.2 14.8l-4.3 4.3"/>',
  stack:'<path d="M4 9l8-4 8 4-8 4z"/><path d="M4 13l8 4 8-4"/>',
  bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  swap:'<path d="M4 8h13M14 5l3 3-3 3"/><path d="M20 16H7M10 13l-3 3 3 3"/>',
};
const EMOJI_TO_ICON={ "🔒":"lock","📎":"clip","➕":"plus","🔁":"redo","💾":"save","🔎":"search","🧭":"compass",
  "✨":"spark","🛠️":"edit","🛠":"edit","👁️":"eye","👁":"eye","📋":"copy","✉️":"mail","✉":"mail",
  "⬇️":"download","⬇":"download","🎭":"chat","👤":"user","🕘":"clock","🛡️":"shield","🛡":"shield",
  "🧪":"flask","🧹":"broom","🐞":"bug","📘":"book","🛟":"life","⌑":"stack","◷":"clock","✍":"edit","⚡":"bolt","⇄":"swap" };
function svgIcon(name){ const p=ICON_PATHS[name]; return p?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>':""; }
function paintIcon(el){
  if(!el || el.querySelector("svg")) return;
  const raw=(el.getAttribute("data-ic")||el.textContent||"").trim();
  const name=ICON_PATHS[raw]?raw:EMOJI_TO_ICON[raw];
  if(name) el.innerHTML=svgIcon(name);
}
function paintIcons(root){ (root||document).querySelectorAll(".action-icon").forEach(paintIcon); }
(function(){
  try{
    const mo=new MutationObserver(muts=>{ muts.forEach(m=>m.addedNodes && m.addedNodes.forEach(n=>{
      if(n.nodeType!==1) return;
      if(n.classList && n.classList.contains("action-icon")) paintIcon(n);
      if(n.querySelectorAll) n.querySelectorAll(".action-icon").forEach(paintIcon);
    })); });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(_){}
})();

/* ===================== SJEDNOCENÉ MODÁLNÍ OKNO (#3) ===================== */
function openModal(title, html, opts){
  opts=opts||{};
  const previousFocus=document.activeElement;
  const overlay=document.createElement("div"); overlay.className="modal-overlay open";
  overlay.innerHTML='<div class="modal-card" role="dialog" aria-modal="true"'+(opts.label?(' aria-label="'+escAttr(opts.label)+'"'):'')+'>'+
    '<div class="modal-head"><b>'+esc(title)+'</b><button class="modal-close" title="Zavřít" aria-label="Zavřít">×</button></div>'+
    '<div class="modal-body">'+html+'</div></div>';
  let closed=false;
  const close=()=>{ if(closed)return; closed=true; overlay.remove(); document.removeEventListener("keydown",onKey); if(previousFocus&&previousFocus.focus)try{previousFocus.focus();}catch(_){} if(opts.onClose) opts.onClose(); };
  function onKey(e){
    if(e.key==="Escape"){ close(); return; }
    if(e.key==="Tab"){
      const focusable=[...overlay.querySelectorAll('button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent!==null);
      if(!focusable.length) return;
      const first=focusable[0], last=focusable[focusable.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(); });
  overlay.querySelector(".modal-close").onclick=close;
  document.addEventListener("keydown",onKey);
  document.body.appendChild(overlay);
  const body=overlay.querySelector(".modal-body");
  if(opts.onMount) opts.onMount(body, close);
  setTimeout(()=>{const f=overlay.querySelector("[autofocus],input,textarea,select,button:not(.modal-close)");if(f&&f.focus)f.focus();},0);
  return {overlay, close, body};
}
function askTextModal(opts){
  opts=opts||{};
  const html='<label class="dialog-label">'+esc(opts.label||"Název")+'</label><input class="dialog-input" type="text" maxlength="80" placeholder="'+escAttr(opts.placeholder||"")+'" autofocus><div class="dialog-actions"><button type="button" class="btn ghost dialog-cancel">Zrušit</button><button type="button" class="btn dialog-ok">'+esc(opts.confirmText||"Uložit")+'</button></div>';
  return openModal(opts.title||"Zadat text",html,{onMount(body,close){
    const input=body.querySelector(".dialog-input"), ok=body.querySelector(".dialog-ok");
    const submit=()=>{const value=(input.value||"").trim();if(!value){input.focus();return;}if(opts.onConfirm)opts.onConfirm(value);close();};
    body.querySelector(".dialog-cancel").onclick=close; ok.onclick=submit; input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submit();}});
  }});
}
function confirmActionModal(opts){
  opts=opts||{};
  const html='<p class="dialog-text">'+esc(opts.message||"")+'</p><div class="dialog-actions"><button type="button" class="btn ghost dialog-cancel">Zrušit</button><button type="button" class="btn '+(opts.danger?"danger":"")+' dialog-ok">'+esc(opts.confirmText||"Potvrdit")+'</button></div>';
  return openModal(opts.title||"Potvrzení",html,{onMount(body,close){body.querySelector(".dialog-cancel").onclick=close;body.querySelector(".dialog-ok").onclick=()=>{if(opts.onConfirm)opts.onConfirm();close();};}});
}

/* ===================== DENNÍ / NOČNÍ REŽIM ===================== */
function applyModeIcon(){ $("btnMode").innerHTML = document.body.classList.contains("dark") ? svgIcon("sun") : svgIcon("moon"); }
function toggleMode(){
  document.body.classList.toggle("dark");
  try { localStorage.setItem("rozbor_mode", document.body.classList.contains("dark") ? "dark" : "light"); } catch(_){}
  applyModeIcon();
}
(function initMode(){
  let m = null; try { m = localStorage.getItem("rozbor_mode"); } catch(_){}
  if (m === "dark") document.body.classList.add("dark");
  else if (!m && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) document.body.classList.add("dark");
  applyModeIcon();
})();

/* ===================== CELÁ OBRAZOVKA ===================== */
function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){ (document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen||function(){}).call(document.documentElement); }
    else { (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document); }
  }catch(_){}
}
function applyFsIcon(){
  const on=!!(document.fullscreenElement||document.webkitFullscreenElement);
  const b=$("btnFs"); if(!b) return;
  b.innerHTML=on?svgIcon("fsexit"):svgIcon("fs");
  b.title=on?"Zpět z celé obrazovky":"Celá obrazovka";
}
document.addEventListener("fullscreenchange",applyFsIcon);
document.addEventListener("webkitfullscreenchange",applyFsIcon);

function bindShellControls(){
  const tabIn=$("tabIn"), tabMy=$("tabMy"), mode=$("btnMode"), fs=$("btnFs");
  if(tabIn) tabIn.addEventListener("click",()=>switchTab("in"));
  if(tabMy) tabMy.addEventListener("click",()=>switchTab("my"));
  if(mode) mode.addEventListener("click",toggleMode);
  if(fs) fs.addEventListener("click",toggleFullscreen);
  [tabIn,tabMy].filter(Boolean).forEach(tab=>tab.addEventListener("keydown",e=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
    e.preventDefault();
    const target=(e.key==="ArrowLeft"||e.key==="Home")?tabIn:tabMy;
    if(target){ target.focus(); switchTab(target===tabIn?"in":"my"); }
  }));
}

/* ===================== ZÁLOŽKY ===================== */
function switchTab(p){
  $("tabIn").classList.toggle("active", p === "in");
  $("tabMy").classList.toggle("active", p === "my");
  $("tabIn").setAttribute("aria-selected",p==="in"?"true":"false");
  $("tabMy").setAttribute("aria-selected",p==="my"?"true":"false");
  $("tabIn").tabIndex=p==="in"?0:-1; $("tabMy").tabIndex=p==="my"?0:-1;
  $("pane-in").classList.toggle("active", p === "in");
  $("pane-my").classList.toggle("active", p === "my");
  hideSyn();
  updateProgress(p);
}
function activePane(){ return $("pane-my") && $("pane-my").classList.contains("active") ? "my" : "in"; }
function updateProgress(p){
  p=p||activePane();
  const raw=E(p,"raw");
  const hasRaw=!!(raw && raw.value && raw.value.trim());
  const hasClean=!!(window.ST && ST[p] && ST[p].clean && ST[p].clean.trim());
  const cb=E(p,"reviewOk");
  const checked=!!(cb && cb.checked);
  let safe=false;
  try{ const a=safetyAudit(ST[p].clean||"",p); safe=checked && (a.level==="ok" || a.level==="warn"); }catch(_){ safe=false; }
  const outputReady=!!(window.ST&&ST[p]&&ST[p].outputReady);
  const done={1:hasRaw,2:hasClean,3:safe,4:outputReady};
  const current=outputReady?4:(safe?4:(hasClean?3:(hasRaw?2:1)));
  document.querySelectorAll("#appProgress .progress-step").forEach(step=>{
    const n=Number(step.dataset.step||0);
    step.classList.toggle("is-done", !!done[n] && (n!==current || (n===4&&outputReady)));
    step.classList.toggle("is-current", n===current);
  });
}

