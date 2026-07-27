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
footBtn("Profil odesílatele", "👤", "Jméno, role a podpis doplňované do hotových e-mailů", ()=>{ if(window.__openProfile) window.__openProfile(); });
footBtn("Poslední výstupy", "🕘", "Anonymizované výstupy uložené v tomto prohlížeči", ()=>{ if(window.__openHistory) window.__openHistory(); });
footBtn("Přehled změn", "✨", "Co se změnilo v aktuálních verzích aplikace", openChangelog);
footBtn("Správa dat", "🧹", "Historie, export nastavení a smazání lokálních dat", openDataManager);
const ADMIN_ACCESS=!!(window.__GHRAB_STUDIO_ACCESS__&&window.__GHRAB_STUDIO_ACCESS__.permit&&window.__GHRAB_STUDIO_ACCESS__.permit.role==="admin");
const LOCAL_DEV=(location.hostname==="localhost"||location.hostname==="127.0.0.1")&&new URLSearchParams(location.search).has("dev");
const DEV_MODE=ADMIN_ACCESS||LOCAL_DEV;
if(DEV_MODE) footBtn("Vývojářské nástroje", "🧪", "Automatické testy, debug prompt a technický log", openDeveloperTools);
compactAdvancedParams();
buildFooterTools();
paintIcons(); applyFsIcon();
updateProgress("in");
openOnboardingTour(false);
if(new URLSearchParams(location.search).get("test")==="1") openTestRunner(true);

if(typeof initAccessibleTooltips==="function") initAccessibleTooltips();
