/* ===================== NÁSTROJE + CHANGELOG ===================== */
const toolsActions=[];
function footBtn(label, icon, title, fn){ toolsActions.push({label,icon,title,fn}); }
function buildFooterTools(){
  const foot=document.querySelector(".foot"); if(!foot) return;
  foot.innerHTML="";

  const panel=document.createElement("div"); panel.className="footer-tools-panel";
  const meta=document.createElement("span"); meta.className="app-meta";
  meta.textContent='Korespondenční asistent · v'+RELEASE.version;

  const row=document.createElement("div"); row.className="footer-tools-row";
  const title=document.createElement("span"); title.className="footer-tools-title"; title.textContent="Další možnosti";
  const wrap=document.createElement("span"); wrap.className="tools-wrap";
  const btn=document.createElement("button"); btn.id="footerToolsToggle"; btn.className="tools-btn"; btn.type="button"; btn.textContent="Otevřít nabídku ▴"; btn.title="Profil, uložené výstupy, šablony a správa dat"; btn.setAttribute("aria-expanded","false");
  const menu=document.createElement("div"); menu.className="tools-menu"; menu.setAttribute("role","menu");
  toolsActions.forEach(a=>{ const b=document.createElement("button"); b.type="button"; b.dataset.footerTool=a.label; b.title=a.title||a.label; b.innerHTML='<span class="action-icon">'+esc(a.icon||"•")+'</span><span><b>'+esc(a.label)+'</b><small>'+esc(a.title||"")+'</small></span>'; b.onclick=()=>{ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); a.fn&&a.fn(); }; menu.appendChild(b); });
  btn.onclick=(e)=>{ e.stopPropagation(); const open=!menu.classList.contains("open"); menu.classList.toggle("open",open); btn.setAttribute("aria-expanded",open?"true":"false"); };
  document.addEventListener("click",(e)=>{ if(!wrap.contains(e.target)){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  wrap.appendChild(btn); wrap.appendChild(menu);
  row.appendChild(title); row.appendChild(wrap);

  panel.appendChild(meta); panel.appendChild(row);
  foot.appendChild(panel);

  const divider=document.createElement("div"); divider.className="legal-divider"; divider.setAttribute("aria-hidden","true"); foot.appendChild(divider);
  foot.insertAdjacentHTML("beforeend",'<span class="owner-lines"><span class="owner-main"><strong>Vlastník aplikace:</strong> Daniel Baláž · Gymnázium, Ostrava-Hrabůvka</span><br><span class="copyright">© 2026 Daniel Baláž. Všechna práva vyhrazena.</span></span>');
}
function openChangelog(){
  const last10=RELEASE.changes.slice(0,10);
  openModal("Co je nového",
    '<ul style="margin:0;padding-left:18px;color:var(--ink-soft);font-size:13px;line-height:1.55">'+
      last10.map(c=>"<li style='margin:6px 0'>"+esc(c)+"</li>").join("")+
    '</ul>', {label:"Co je nového"});
}

/* ===================== DEBUG PROMPT + AUTOMATICKÉ TESTY ===================== */
function openLastPromptDebug(){
  const rec=loadLastPromptDebug();
  const body=rec?('<p class="hint">Uloženo lokálně: '+esc(new Date(rec.d).toLocaleString("cs-CZ"))+' · profil AI '+esc(rec.modelProfile||rec.model||"—")+' · schéma '+esc(rec.schema)+'</p><textarea class="mono" style="width:100%;min-height:280px" readonly>'+esc("SYSTEM:\n"+rec.system+"\n\nPROMPT:\n"+rec.prompt)+'</textarea>'):'<p class="empty">Zatím není uložený žádný anonymizovaný prompt.</p>';
  const m=openModal("Debug prompt", body+'<div class="row"><button class="btn ghost small" id="dbgClear">Smazat debug prompt</button></div>', {label:"Debug prompt"});
  const clr=m.body.querySelector("#dbgClear"); if(clr) clr.onclick=()=>{ try{sessionStorage.removeItem(LAST_PROMPT_SK);localStorage.removeItem(LAST_PROMPT_SK);}catch(_){} m.close(); toast("Debug prompt smazán"); };
}
