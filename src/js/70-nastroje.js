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
  foot.insertAdjacentHTML("beforeend",'<span class="owner-lines"><span class="owner-main"><strong>Autor a vývojový garant:</strong> Daniel Baláž · <strong>Školní projekt:</strong> Gymnázium, Ostrava-Hrabůvka</span><br><span class="copyright">© 2026 Daniel Baláž. Všechna práva vyhrazena.</span></span>');
}
function aboutChangeMarkup(){
  return RELEASE.changes.map((entry,index)=>{
    const text=String(entry||"");
    const match=text.match(/^([^:]+):\s*(.*)$/);
    const version=match?match[1].trim():(index===0?RELEASE.version:"");
    const body=match?match[2].trim():text;
    return '<article class="ks-about-change"><div class="ks-about-change-head"><span class="ks-about-version">v'+esc(version)+'</span>'+(index===0?'<span class="ks-about-current">aktuální</span>':'')+'</div><p>'+esc(body)+'</p></article>';
  }).join("");
}
function openAboutApp(openHistory){
  const html=`<div class="ks-about">
    <div class="ks-about-overview">
      <article class="ks-about-card ks-about-identity">
        <div class="ks-about-mark" aria-hidden="true">KS</div>
        <p class="ks-about-eyebrow">KORESPONDENČNÍ ASISTENT</p>
        <h2>Bezpečnější školní komunikace s podporou AI</h2>
        <p>Pomáhá analyzovat přijaté e-maily, připravovat odpovědi a vytvářet nebo upravovat vlastní zprávy. Před odesláním k AI vede uživatele přes anonymizaci a povinnou kontrolu náhledu.</p>
      </article>
      <div class="ks-about-facts">
        <article class="ks-about-card"><p class="ks-about-eyebrow">AUTOR A VÝVOJOVÝ GARANT</p><h3>Daniel Baláž</h3><p>Koncepce, návrh funkcí, metodické vedení a vývoj Korespondenčního asistenta.</p></article>
        <article class="ks-about-card"><p class="ks-about-eyebrow">ŠKOLNÍ PROJEKT</p><h3>Gymnázium, Ostrava-Hrabůvka</h3><p>Interní školní nástroj pro každodenní pracovní komunikaci učitelů a bezpečnější využívání AI při přípravě e-mailů.</p></article>
        <article class="ks-about-card"><p class="ks-about-eyebrow">TECHNICKÝ STAV</p><h3>v${esc(RELEASE.version)} · PWA</h3><p>GHRAB Platform 1.1.2 · GHRAB AI Core 1.0.0 · GARP 2.7 r2 / G-02 · ${esc(RELEASE.status)}.</p></article>
        <article class="ks-about-card"><p class="ks-about-eyebrow">ÚČEL A ODPOVĚDNOST</p><h3>AI připravuje návrh, člověk rozhoduje</h3><p>Aplikace sama e-mail neodesílá. Finální text, oslovení, fakta i případné citlivé údaje vždy před použitím kontroluje uživatel.</p></article>
      </div>
    </div>
    <section class="ks-about-principles" aria-labelledby="ksAboutPrinciplesTitle">
      <div class="ks-about-section-head"><p class="ks-about-eyebrow">PROVOZNÍ ZÁSADY</p><h2 id="ksAboutPrinciplesTitle">Co je dobré vědět</h2></div>
      <div class="ks-about-principle-grid">
        <article class="ks-about-card ks-about-principle"><span>01</span><div><h3>Kontrola před odesláním k AI</h3><p>Skutečná jména, kontakty a další citlivé údaje mají být nahrazeny. Do AI se odesílá až ručně zkontrolovaný anonymizovaný obsah.</p></div></article>
        <article class="ks-about-card ks-about-principle"><span>02</span><div><h3>Výstup je pracovní návrh</h3><p>Asistent pomáhá s formulací a rozborem, ale nenahrazuje úsudek autora zprávy. Před kopírováním je třeba ověřit význam, tón i konkrétní údaje.</p></div></article>
      </div>
    </section>
    <details class="ks-about-changelog" id="ksAboutChangelog">
      <summary><span><span class="ks-about-eyebrow">HISTORIE VYDÁNÍ</span><strong>Katalog změn</strong><small>Rozbal úplnou uživatelskou historii změn Korespondenčního asistenta.</small></span><span class="ks-about-toggle" aria-hidden="true"></span></summary>
      <div class="ks-about-changelog-body"><p class="ks-about-note">Zobrazeny jsou hlavní uživatelsky důležité změny. Podrobná technická a bezpečnostní evidence zůstává ve vývojové dokumentaci.</p><div class="ks-about-change-list">${aboutChangeMarkup()}</div></div>
    </details>
  </div>`;
  return openModal("O aplikaci",html,{className:"ks-about-dialog",label:"O aplikaci Korespondenční asistent",onMount(body){
    const details=body.querySelector("#ksAboutChangelog");
    if(openHistory&&details){ details.open=true; requestAnimationFrame(()=>details.scrollIntoView({block:"nearest"})); }
  }});
}
function openChangelog(){ return openAboutApp(true); }

/* ===================== DEBUG PROMPT + AUTOMATICKÉ TESTY ===================== */
function openLastPromptDebug(){
  const rec=loadLastPromptDebug();
  const body=rec?('<p class="hint">Uloženo lokálně: '+esc(new Date(rec.d).toLocaleString("cs-CZ"))+' · profil AI '+esc(rec.modelProfile||rec.model||"—")+' · schéma '+esc(rec.schema)+'</p><textarea class="mono" style="width:100%;min-height:280px" readonly>'+esc("SYSTEM:\n"+rec.system+"\n\nPROMPT:\n"+rec.prompt)+'</textarea>'):'<p class="empty">Zatím není uložený žádný anonymizovaný prompt.</p>';
  const m=openModal("Debug prompt", body+'<div class="row"><button class="btn ghost small" id="dbgClear">Smazat debug prompt</button></div>', {label:"Debug prompt"});
  const clr=m.body.querySelector("#dbgClear"); if(clr) clr.onclick=()=>{ try{sessionStorage.removeItem(LAST_PROMPT_SK);localStorage.removeItem(LAST_PROMPT_SK);}catch(_){} m.close(); toast("Debug prompt smazán"); };
}
