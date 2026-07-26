/* ===================== PWA INSTALACE ===================== */
function runWhenWindowLoaded(fn){
  if(document.readyState==="complete") fn();
  else window.addEventListener("load",fn,{once:true});
}
function registerPwa(){
  if (!("serviceWorker" in navigator)) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) return;
  runWhenWindowLoaded(() => {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        try { reg.update(); } catch (_) {}
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              try { toast("Je dostupná nová verze aplikace. Po znovuotevření se načte."); } catch (_) {}
            }
          });
        });
      })
      .catch((err) => console.warn("PWA registrace selhala:", err));
  });
}

/* ===================== START ===================== */
bindShellControls();
registerPwa();
loadKey(); loadModel(); initUiMode();
footBtn("Profil odesílatele", "👤", "Tvé jméno, role a podpis", ()=>{ if(window.__openProfile) window.__openProfile(); });
footBtn("Poslední výstupy", "🕘", "Naposledy hotové e-maily", ()=>{ if(window.__openHistory) window.__openHistory(); });
footBtn("Co je nového", "✨", "Přehled změn", openChangelog);
footBtn("Bezpečný začátek", "🛡️", "Znovu zobrazit bezpečnostní průvodce", ()=>openSecurityGuide(true));
footBtn("Prohlídka aplikace", "🧭", "Krátká prohlídka: klíč, zóny, ťukání na jména", ()=>openOnboardingTour(true));
footBtn("Školní návod", "📘", "Jednostránkový návod pro kolegy", openSchoolGuide);
footBtn("Správa dat", "🧹", "Smazání lokálních dat a režim neukládat historii", openDataManager);
footBtn("Vývojářské nástroje", "🧪", "Testy, debug prompt a technický log", openDeveloperTools);
compactAdvancedParams();
buildFooterTools();
paintIcons(); applyFsIcon();
updateProgress("in");
openOnboardingTour(false);
if(new URLSearchParams(location.search).has("test")) openTestRunner(true);
