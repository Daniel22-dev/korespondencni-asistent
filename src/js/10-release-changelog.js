const IS_TEST_MODE=new URLSearchParams(window.location.search).has("test")||String(window.location.hash||"").toLowerCase().includes("test");

"use strict";

const RELEASE = {
  version: "5.3.1",
  date: "2026-07-26",
  status: "řízený pilot",
  build: "__BUILD__", // build skript (scripts/build.mjs) nahradí "__BUILD__" za git rev-parse --short HEAD; nenahrazeno = v patičce se nezobrazí
  changes: [
    "5.3.1: testovací úpravy pracovního toku — odstraněn duplicitní bezpečný postup v záhlaví, anonymizace a kontrolní náhled sjednoceny do jednoho klidnějšího bloku, klíč náhrad zůstává sbalený, poznámka pro odpověď výslovně potvrzuje zapojení do promptu a opakovanou anonymizaci, po volbě návrhu se ostatní varianty skutečně skryjí, patička a nabídka nástrojů jsou zjednodušené, vývojářské nástroje jsou dostupné jen přes režim ?dev=1 nebo ?test a interaktivní manuál byl aktualizován.",
    "5.3.0: zjednodušené workflow — nová úvodní volba tří pracovních cest, spojený bezpečnostní blok anonymizace a přesného náhledu pro Gemini, zřetelně oddělený rozbor a nastavení odpovědi, čistý výběr jedné ze tří variant bez duplicitních ovladačů, sbalený pracovní přehled, výraznější finální akce a české oslovení při lokálním vrácení jmen.",
    "5.2.6: zásadní oprava anonymizace — skryjí se i české pádové tvary jmen včetně krátkých, doťukané tvary se spojí do jedné osoby a zbylý tvar už skrytého jména odeslání zastaví; interní testy nemažou lokální data a fungují i mimo testovací adresu; sjednoceno nastavení modelů Gemini, doplněn návrat z manuálu a ošetřen import cizího souboru nastavení.",
    "5.2.5: opraven export při nevyplněném profilu, přesnější shoda tvarů jmen, tři školní scénáře, úplné mazání lokálních dat včetně pracovního stolu, méně blokujících falešných poplachů, bezpečné vědomé pokračování u samotné termínové heuristiky, sjednocené styly pracovního stolu a ikony, import EML ve středoevropských kódováních a zpřesněné informace o bezplatné úrovni Gemini API.",
    "5.2.4: opravena kontrola před odesláním u vygenerovaných variant — bezpečné pracovní značky jako osoba A se nyní posuzují až po lokálním doplnění skutečných údajů; červená stopka zůstává jen pro značku, kterou aplikace skutečně neumí doplnit.",
    "5.2.3: odstraněna zdvojená volba hlavního režimu na pracovním stole; aktualizovány bezplatné modely Gemini; kliknutí na část jména nyní spojí jméno a příjmení do jedné osoby; oranžová upozornění jsou výslovně neblokující a opravena byla i kontrola doplňujících pokynů.",
    "5.2.2: interaktivní manuál byl ověřen proti aktuálním funkcím a při otevření z aplikace uvnitř AI Studia zůstává ve stejném pracovním rámci; nová PWA cache vynutí načtení opravy.",
    "5.2.1: jednotná GHRAB QA 1.0.1 — reprodukovatelný release, bezpečnostní a PWA brány, skutečná Chromium galerie a verdikt vázaný na SHA-256 buildu.",
    "5.2.0: bezpečnostní audit — opravena detekce českých citlivých témat, kolize a recyklace anonymizačních značek, e-maily v lomených závorkách, povinný centrální preflight všech cest k Gemini, synonyma bez skutečných jmen, PWA start a předávka z AI Studia; přechod na Gemini 3.5 Flash / 3.1 Flash-Lite.",
    "5.1.0: anonymní technická telemetrie rozlišuje zpracování příchozí zprávy, návrhy odpovědi a vytvoření vlastního e-mailu. Evidují se pouze počty úspěšných, chybných a zrušených výstupů; obsah zpráv, adresáti ani identita uživatele se neukládají.",
    "5.1.0: integrovaný interaktivní manuál — samostatné tlačítko 📖 v pravém horním rohu otevírá úplnou prohlídku aplikace v nové kartě. Bezpečný postup, průběhová lišta a kontextová pravidla uvnitř aplikace zůstávají nedotčeny; manuál je nadřazená orientace v celém produktu. Přístup dědí z AI Studia a manuál je součástí PWA balíčku.",
    "5.0.0: Pracovní stůl učitele — nový třízónový pracovní prostor, akční rozbor příchozí komunikace, třídění na dnes/tento týden/FYI/delegovat, termíny a další kroky, zpracování e-mailových vláken, tři pojmenované varianty odpovědi, lokální kontrola před odesláním, rozšířená knihovna školních scénářů, rychlé sestavení z bodů, textové bloky a více podpisů, historie verzí, undo/redo, uzamykání přesných formulací, porovnání variant, připomínky a export do kalendáře, bezpečné lokální ukládání konceptů, školní knihovna šablon a nové responzivní prémiové rozhraní.",
    "4.1.0: hloubkový produkční audit — opraven slovník víceslovných a skloňovaných jmen bez kolizí značek, zneplatnění kontroly po změně klíče, bezpečnost doplňujících pokynů, prázdný výběr požadavků, jazyk úprav a synonym, práce s editovatelnými odstavci, scénáře načtené ze šablon, předvolby tykání/vykání a chybové hlášky. Import .eml nyní zvládá vnořené MIME části, kódované hlavičky a běžná středoevropská kódování; doplněny limity souborů, přístupnost a kompaktnější prémiové rozhraní.",
    "4.0.5: sjednocena školní identita celé sady — stejné oficiální logo, výrazný nápis GYMNÁZIUM, OSTRAVA-HRABŮVKA vedle loga a jednotný dvouřádkový autorský blok v zápatí.",

    "4.0.4: oprava centrálního odemykání na mobilu i po přímém otevření. Bezpečnostní politika nyní povoluje ověřovací požadavky na AI Studio; PWA ukládá do cache jen vlastní soubory, nemaže cache ostatních aplikací a nikdy neuchovává centrální revokační seznam.",

    "4.0.3: centrální přístup přes AI Studio GHRAB — aplikace se nespustí, dokud kryptograficky neověří podepsané oprávnění pro Korespondenčního asistenta. Správce aktivovaný ve Studiu má automatický přístup; běžný učitel jen po absolvovaném školení. Přímý odkaz už zámek neobchází a při zamítnutí se zobrazí jednotná obrazovka s návratem do Studia.",
    "4.0.2: napojení na AI Studio GHRAB — asistent umí převzít krátkodobou lokální předávku GHRAB Material v1, sestaví z ní bezpečný komunikační podklad v režimu Můj e-mail a ponechá učiteli kontrolu adresáta, účelu, tónu i anonymizace. Předávka se po načtení smaže a nic se neposílá na server.",
    "4.0.1: oprava nasazení — finální ZIP nyní obsahuje také přímo sestavené soubory v kořeni repozitáře, takže běžné nahrání přes web GitHubu skutečně přepíše nasazenou aplikaci a zobrazí aktuální changelog; současně byla zvýšena verze PWA cache, aby se uživatelům nenačítala stará kopie.",
    "4.0.0: produkční vydání — historie ukládá výhradně anonymizované texty se značkami a staré neověřené záznamy automaticky maže; změna vstupu ruší starou anonymizaci i výsledek; čtyřkrokový postup přesně odpovídá skutečnému toku; nativní systémové dialogy byly nahrazeny přístupnými modály; debug prompt je pouze v paměti relace, historie je ve výchozím stavu vypnutá, ukládání skutečných jmen vyžaduje výslovné potvrzení; doplněny bezpečnostní hlavičky a provozní standard.",
    "3.21.1: zdrojová modularizace — kód aplikace je v repozitáři rozdělen na šablonu index.template.html, styles.css, body.html a osm JS modulů podle stávajících sekcí (release a changelog, vzhled a ovládání, klíč+model a API, anonymizace, koncept a prompty, příchozí a můj e-mail, nástroje/testy/data, PWA a start). Nasazený soubor zůstává jediné sestavené HTML; build části skládá v pevném pořadí a hlídá release gate.",
    "3.21.0: kvalitní audit a modularizace repozitáře — odstraněny dvě nepoužívané funkce (keyMap, removeWord) z anonymizační vrstvy, repozitář převeden na strukturu src/ + scripts/build.mjs + GitHub Actions (build hlídá shodu verze aplikace a service workeru a doplňuje číslo commitu do patičky přes pole build), do kořene webu přibyl rozcestník obou školních aplikací a přesměrování starých odkazů je sjednocené pro obě velikosti počátečního písmene.",
    "3.20.1: oprava nasazení na GitHub Pages — do kořene repozitáře vráceny přesměrovací soubory pro staré odkazy na Korespondenčního asistenta a upřesněn start aplikace z adresy /korespondencni-asistent/.",
    "3.20.0: PWA instalace pro mobil — doplněn manifest, service worker, vlastní ikony ve stylu LifeHubu, apple-touch-icon, theme color a relativní cesty vhodné pro GitHub Pages; aplikaci lze přidat/instalovat do telefonu jako samostatnou aplikaci s vlastní ikonou.",
    "3.19.0: funkční průchod (anonymizace a detekce) — preflight teď chytí i uložená jména napsaná malými písmeny (ze slovníku jmen, nezávisle na velikosti), citlivé termíny rozpozná i anglicky a španělsky (diagnosis, ADHD, bullying, diagnóstico, acoso…), přibyly nové kategorie rizik (číslo bankovního účtu ve tvaru 123456789/0800, doklad totožnosti/OP, a ulice s číslem jako oranžové upozornění), 9místná čísla účtů se už chybně neoznačují jako „telefon“ (maskují se před detekcí telefonu, lomítkový telefon 777/123/456 ale dál funguje), e-mailová detekce zvládne i diakritiku v doméně (petr@škola.cz), a do patičky lze z buildu doplnit číslo commitu (pole build) vedle automaticky braného čísla verze.",
    "3.18.0: designový průchod (2. část) — semafor anonymizace se na mobilu „přilepí“ nahoře, takže stav (zelená/oranžová/STOP) zůstává vidět i při scrollování k náhledu a odeslání; zóna „Toto by odešlo do Gemini“ má teď i jiné, chladnější pozadí (ne jen popisek a čáru), aby byla hranice na první pohled; v hlavičce je stálý odznak „klíč: relace / trvale / nezadán“ i bez rozbalení panelu; běžící požadavek má spinner přímo v tlačítku a je ošetřené dvojí odeslání; a sjednotily se prázdné stavy — pracovní plochy (text k ťukání a náhled) ukazují stejný placeholder, kontextové karty se prázdné skrývají.",
    "3.17.0: designový průchod — semafor možných jmen ztišen (zobrazí max 3 + popisek „heuristika, ne jistota“, ať zelená/oranžová neztrácí váhu), tlačítko pod hranicí přejmenováno na „Přejít na náhled“ a z odkazu se stala viditelná akce (sjede k náhledu a krátce ho zvýrazní), karta konceptu se na mobilu vejde na jeden screenshot (omezená výška těla se scrollem a kompaktnější řada akcí), nevratné „Smazat všechna data“ má červený rám i ikonu, a první spuštění nabídne krátkou prohlídku aplikace (klíč k API, dvě zóny, ťukání na jména) místo jen bezpečnostního okna.",
    "3.16.15: vizuální průchod — zkrácené záhlaví, mikroindikátor postupu, výraznější pracovní karta, lidsky pojmenovaná bezpečná část vs. výstup do Gemini, kompaktnější blok po anonymizaci, jednoznačný STOP stav, vyšší kontrast drobných popisků, sbalené skupiny pokročilých voleb a mobilní zklidnění náhledu.",
    "3.16.14: školní návod doplněn o tři zakázané příklady: co neposílat, jak formulaci bezpečně zobecnit a které citlivé situace raději řešit mimo AI.",
    "3.16.13: při stavu Raději neposílat se zobrazí lokální tlačítko Vytvořit bezpečnou obecnou verzi; bez volání API nabídne obecnou šablonu pro přesun citlivé školní záležitosti na osobní nebo telefonickou domluvu.",
    "3.16.12: zklidněn krok po anonymizaci — klíč náhrad je v jednoduchém režimu sbalený do rozbalovacího bloku, opakované počítadlo je skryté v pokročilých údajích a hlavní pokyn po anonymizaci je kratší.",
    "3.16.11: bezpečnostní balík — přidány testy škodlivých/importovaných vstupů, prompt-injection obrana, citlivý režim podle scénáře i obsahu, technický provozní log bez textů, samostatné Vývojářské nástroje a školní návod pro kolegy.",
    "3.16.10: historie výstupů je u nového prohlížeče výchozím stavem vypnutá; ukládání hotových e-mailů je možné jen po vědomém povolení ve správě dat a po smazání dat se vrací bezpečný default.",
    "3.16.9: delší bezpečný náhled zvýrazňuje problematická místa přímo v textu, nad náhledem je seznam rizik, bezpečnostní modal je kratší a po anonymizaci se zobrazí zelené potvrzení připravenosti ke kontrole.",
    "3.16.8: rozlišeny režimy pomocí krátkých vysvětlovacích štítků (Jednoduchý = minimum voleb, Pokročilý = tón, délka, jazyk, šablony). Semafor dostal krátký akční pokyn a nad delším náhledem se zobrazuje mini-souhrn skrytých údajů a rizik.",
    "3.16.7: zmenšeno úvodní zahlcení v jednoduchém režimu — horní bezpečnostní text se schová a zůstává jasný tok Vlož text → Anonymizuj → Zkontroluj náhled. Primární akce jsou vizuálně dominantnější, sekundární nástroje, nápověda, synonyma a debug jsou ztlumené. Právní patička zůstává oddělená od funkčního bloku nástrojů.",
    "3.16.6: jednoduchý režim zhuštěn do bezpečného tříkrokového průvodce; méně časté volby jsou skryté. Citlivé školní scénáře zapínají přísný režim: historie a debug prompt se vypnou, upozornění je výraznější a model dostane pokyn psát stručně bez identifikujících detailů.",
    "3.16.5: patička rozdělena na samostatný funkční blok Nástroje a nápověda a oddělený právní/vlastnický blok; vlastnické označení zůstává viditelné, ale už nesplývá s pracovními tlačítky.",
    "3.16.4: zachováno spodní menu Nástroje po vzoru KS a Diferenciátoru, přejmenováno na Nástroje a nápověda a výstup pojmenován KS.html.",
    "3.16.3: sloučeny obě rozjeté větve patičky — ponecháno vlastnické označení a copyright, vráceno číslo verze a praktická nápověda k synonymům.",
    "3.16.2: vyčištěna spodní patička — odstraněn název aplikace a číslo verze, ponecháno pouze vlastnické označení a copyright.",
    "3.16.1: doplněno vlastnické označení aplikace v patičce: Daniel Baláž · Gymnázium, Ostrava-Hrabůvka a copyright.",
    "3.16.0: funkční průchod — anonymizace po celých slovech (konec „osoba Aovi“), skloňování i víceslovných jmen, výběr fráze jako jedné osoby, volitelné zvýraznění možných jmen, automatické skrytí rodného čísla a data narození, klávesová obsluha náhledu, robustnější hlídání zbylých značek, číslování osob i nad 26 (AA, AB…), širší detekce telefonů a export/import nastavení.",
    "3.15.0: designový průchod — semafor s ikonou a tvarem, počítadlo skrytých údajů u semaforu, zřetelná hranice „co odejde k modelu“, výzva k ťuknutí nad textem, jednotné SVG ikony, výraznější primární tlačítka, sjednocené modální okno, jednotná typografie a označení jazyka výstupu.",
    "3.14.0: jazykové režimy i pro Můj e-mail, školní scénáře, režim raději neposílat, neukládat historii a správa lokálních dat.",
    "3.13.0: automatické testy, robustnější JSON, timeout, retry a lokální debug prompt.",
    "3.12.0 — P0 bezpečnost: robustní anonymizace víceslovných telefonů, povinný preflight před každým API voláním a lepší skrytí českých jmen i pádů",
    "3.11.0 — mobilní menu Nástroje, jednoduchý/pokročilý režim, přehlednější volby, ikonky akcí a panel skrytých náhrad",
    "3.10.0 — bezpečnostní průvodce při prvním spuštění, přesnější hlavní claim, povinně viditelný náhled před odesláním a semafor anonymizace",
    "3.9.3 — oprava: obě varianty odpovědi teď drží zadaný tón a délku (model je nesmí měnit mezi variantami); varianty se liší jen formulací a důrazem; labely variant popisují čím se liší, ne genericky „Návrh 1/2“",
    "3.9.2 — anonymizace poznámky přes explicitní sadu českých přípon, tooltip na poli Poznámka",
    "3.8.3 — volba jazyka odpovědi přímo v Příchozí u parametrů odpovědi",
    "3.8.2 — „Složit zpět / Zpět na značky“ přejmenováno na „Ukázat se jmény / Ukázat se značkami“",
    "3.8.1 — oprava pádu po startu (pořadí v kódu u „Jak to vyzní“)",
    "3.8.0 — kontextová úprava (Uprav), profil odesílatele, kontrola „Jak to vyzní“",
    "3.7.0 — deset vylepšení vzhledu a funkcí (toasty, šablony, jazyk, historie…)",
    "3.6.0 — průvodce v Můj e-mail rozšířen o adresáta, účel, poznámku, předmět, míru zásahu",
    "3.5.0 — Můj e-mail jako klikací průvodce (jeden request)",
    "3.4.x — anonymizace na ťukání, jen e-maily a telefony automaticky, opravy",
    "3.0–3.3 — dva režimy, denní/noční, synonyma, celá obrazovka, changelog, logo",
  ],
};
const $ = (id) => document.getElementById(id);
const versionEl=$("ver"); if(versionEl) versionEl.textContent=RELEASE.version;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]));
const escAttr = (s) => esc(s).replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const EMPTY_MARK = '<span class="empty empty-mark">— prázdné —</span>';
// Číslo bankovního účtu: [předčíslí-]základ/kód banky. Jeden zdroj, čerstvá instance při každém užití.
const RE_ACCOUNT_SRC = "\\b(?:\\d{1,6}-\\d{2,10}|\\d{7,10})\\/\\d{3,4}\\b";
function reAccount(flags){ return new RegExp(RE_ACCOUNT_SRC, flags||""); }
function toast(msg){
  const c=$("toasts"); if(!c) return;
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg; c.appendChild(t);
  requestAnimationFrame(()=>t.classList.add("show"));
  setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(),300); }, 2600);
}
const SECURITY_GUIDE_SK="rozbor_security_guide_seen_v1";
function openSecurityGuide(force){
  if(!force){ try{ if(localStorage.getItem(SECURITY_GUIDE_SK)==="1") return; }catch(_){} }
  const overlay=document.createElement("div"); overlay.className="guide-overlay";
  overlay.innerHTML='<div class="guide-card" role="dialog" aria-modal="true" aria-label="Bezpečný začátek">'+
    '<h2>Než odešleš text k modelu</h2>'+
    '<div class="guide-bigline">Bez anonymizace neposílej studentské údaje.</div>'+
    '<div class="guide-quick" aria-label="Tři bezpečné kroky">'+
      '<div class="guide-quick-card"><b>1) Vlož text</b>Zatím zůstává jen v prohlížeči.</div>'+
      '<div class="guide-quick-card"><b>2) Anonymizuj</b>Skryj jména, kontakty a citlivé údaje.</div>'+
      '<div class="guide-quick-card"><b>3) Zkontroluj náhled</b>Odešli až po ruční kontrole.</div>'+
    '</div>'+
    '<p>Asistent pomůže s kontrolou, ale odpovědnost za očištěný náhled zůstává na uživateli.</p>'+
    '<div class="row"><button class="btn primary" id="sg_ok">Rozumím, začít bezpečně</button><button class="btn ghost" id="sg_later">Zavřít</button></div>'+
    '</div>';
  document.body.appendChild(overlay);
  const close=(remember)=>{ if(remember){ try{ localStorage.setItem(SECURITY_GUIDE_SK,"1"); }catch(_){} } overlay.remove(); };
  overlay.querySelector("#sg_ok").onclick=()=>close(true);
  overlay.querySelector("#sg_later").onclick=()=>close(false);
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(false); });
}
const TOUR_SK="rozbor_tour_seen_v1";
const TOUR_STEPS=[
  { t:"Vítej v Korespondenčním asistentovi",
    h:'<p>Pomůže ti připravit zdvořilý školní e-mail — rozbor přijaté zprávy a návrh odpovědi, nebo opravu, přepis a sestavení vlastního textu.</p><div class="tour-line">Bezpečný tok je vždy stejný: <b>vlož text → anonymizuj → zkontroluj náhled → odešli</b>. Prohlídka zabere půl minuty.</div>' },
  { t:"1 · Klíč k API",
    h:'<p>Generování běží přes Gemini. Klíč zadáš nahoře v panelu <b>„Klíč k API“</b> (rozbalíš ho ťuknutím).</p><div class="tour-line">Na <b>sdíleném nebo školním počítači</b> zvol „Použít jen pro relaci“ — klíč se po zavření prohlížeče sám zapomene. Trvalé uložení používej jen na vlastním zařízení.</div>' },
  { t:"2 · Dvě zóny",
    h:'<p>Aplikace jasně odděluje, co zůstává u tebe a co by teprve odešlo modelu.</p><div class="tour-zones"><div class="tour-zone desk"><b>Tvůj stůl</b>Vložený text i klíč náhrad zůstávají jen v prohlížeči. Nikam se neposílají.</div><div class="tour-zone out"><b>Za hranicí bezpečnosti</b>Teprve náhled pod přerušovanou čarou by se po tvém potvrzení poslal do Gemini.</div></div>' },
  { t:"3 · Ťukni na jména",
    h:'<p>E-maily a telefony aplikace skryje sama. <b>Jména a vlastní názvy ale musíš skrýt ťuknutím</b> — klikni na slovo v textu a změní se na značku „osoba A“. Dalším ťuknutím ho zase odkryješ.</p><div class="tour-line">Semafor a povinný náhled pod čarou ukážou, co ještě zkontrolovat. Odeslat jde teprve po zaškrtnutí kontroly náhledu.</div>' }
];
function openOnboardingTour(force){
  if(!force){
    let sg=false,tour=false;
    try{ sg=localStorage.getItem(SECURITY_GUIDE_SK)==="1"; }catch(_){}
    try{ tour=localStorage.getItem(TOUR_SK)==="1"; }catch(_){}
    if(sg||tour) return;
  }
  let i=0;
  const overlay=document.createElement("div"); overlay.className="guide-overlay";
  const markSeen=()=>{ try{ localStorage.setItem(TOUR_SK,"1"); }catch(_){} try{ localStorage.setItem(SECURITY_GUIDE_SK,"1"); }catch(_){} };
  function onKey(e){ if(e.key==="Escape") close(false); }
  const close=(seen)=>{ if(seen) markSeen(); overlay.remove(); document.removeEventListener("keydown",onKey); };
  function render(){
    const s=TOUR_STEPS[i], last=i===TOUR_STEPS.length-1;
    const dots=TOUR_STEPS.map((_,k)=>'<span class="tour-dot'+(k===i?" on":"")+'"></span>').join("");
    overlay.innerHTML='<div class="guide-card tour-card" role="dialog" aria-modal="true" aria-label="Prohlídka aplikace">'+
      '<div class="tour-head"><span class="tour-step-of">Prohlídka · '+(i+1)+'/'+TOUR_STEPS.length+'</span><button class="tour-skip" type="button">Přeskočit</button></div>'+
      '<h2>'+esc(s.t)+'</h2>'+s.h+
      '<div class="tour-nav"><div class="tour-dots" aria-hidden="true">'+dots+'</div><div class="tour-btns">'+
        (i>0?'<button class="btn ghost small tour-back" type="button">Zpět</button>':'')+
        '<button class="btn primary small tour-next" type="button">'+(last?"Začít":"Další →")+'</button>'+
      '</div></div></div>';
    const back=overlay.querySelector(".tour-back"); if(back) back.onclick=()=>{ i=Math.max(0,i-1); render(); };
    overlay.querySelector(".tour-next").onclick=()=>{ if(last) close(true); else { i++; render(); } };
    overlay.querySelector(".tour-skip").onclick=()=>close(true);
  }
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(false); });
  document.addEventListener("keydown",onKey);
  document.body.appendChild(overlay);
  render();
}
function tokenClass(tok){ if(/^\[e-mail/.test(tok)) return "t-email"; if(/^\[telefon/.test(tok)) return "t-phone"; return "t-osoba"; }
function hasLeftoverToken(text){ return /osoba\s+[A-Z]|\[e-mail\s*\d|\[telefon\s*\d|\[rodné číslo|\[datum narození|\[číslo účtu|\[podpis\]|\[u[čc]itel\]/.test(text); }
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

