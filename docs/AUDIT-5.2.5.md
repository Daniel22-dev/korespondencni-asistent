# Korespondenční asistent 5.2.5 — vyhodnocení auditu a provedené změny

**Datum:** 25. 7. 2026  
**Výchozí verze:** 5.2.4  
**Výsledná verze:** 5.2.5

## Závěr

Audit je nadstandardně kvalitní: uvádí reprodukční scénáře, příčinu, konkrétní místa ve zdrojích i očekávané ověření. Se všemi hlavními nálezy souhlasím. Potvrdil jsem čtyři kritické chyby, falešné bezpečnostní blokace, nesoulad CSS s novým Pracovním stolem i funkční drobnosti.

Změny jsem však nepřevzal mechanicky. Na třech místech jsem návrh zpřesnil, protože jeho doslovná implementace by vytvořila další problém nebo neodpovídala aktuálním podmínkám:

1. **Citlivé slovo „poradna“.** Navržený výraz `poradna pro…` by stále blokoval nevinnou větu „Soutěž pořádá poradna pro volbu povolání.“ Detekce nyní vyžaduje skutečně citlivý kontext, například doporučení, zprávu nebo vyšetření z poradny.
2. **Krátká jména.** Pouhé vypnutí prefixové shody pro jména kratší než pět znaků opravilo „Jan → Jana“, ale rozbilo již podporované pády jména „Anna“. Doplnil jsem úzkou, explicitní podporu bezpečných tvarů typu Anna/Anně/Annu bez návratu k nebezpečné obecné prefixové shodě.
3. **Podmínky Gemini API.** Obecná věta „free tier používá data“ není pro české/EHP nasazení úplná. Text v aplikaci nyní rozlišuje region a fakturaci, upozorňuje na požadavek placené služby pro aplikace dostupné v EHP a stále trvá na ručně zkontrolované anonymizaci.

## Provedené změny

### A. Kritické chyby

- **A1 — prázdný profil odesílatele:** `[učitel]` se už neposuzuje jako nevyplněná anonymizační značka. Kontrola konceptu ukáže samostatné varování a export otevře Profil odesílatele s přesnou instrukcí.
- **A2 — prefixová shoda jmen:** `Jan` už nemění `Janu`, `Janáka` ani `Januše`. Zachována je bezpečná podpora českých tvarů delších jmen a explicitních tvarů typu Anna.
- **A3 — školní scénáře:** „Reakce na stížnost“, „Vysvětlení hodnocení“ a „Shrnutí domluvy“ nyní používají existující účely `vysvetleni` a `potvrzeni`. `setChip()` neznámou hodnotu odmítne místo tichého zhasnutí všech voleb.
- **A4 — smazání lokálních dat:** mazání pokrývá všechny klíče s prefixy `rozbor_` a `ks5_`, tedy i koncepty, podpisy, vlastní bloky a připomínky.

### B. Bezpečnostní kontrola

- Zúženy příliš široké kmeny citlivých výrazů. Běžné provozní věty s „opatřením“, „nemocí“, „incidentem“, „poradnou“ nebo „alkoholem v laboratoři“ už samy o sobě nevytvářejí tvrdou stopku.
- Skutečně citlivé kontexty, například šikana, podpůrné opatření, lékařská zpráva, závislost nebo alkohol u žáka, zůstávají blokované.
- U stopky vzniklé **výhradně termínovou heuristikou** může učitel po výslovném posouzení pokračovat na vlastní odpovědnost. Strukturální údaje — e-mail, telefon, rodné číslo, účet či doklad — obejít nelze.
- Potvrzení se automaticky zruší po změně vstupu nebo anonymizačního klíče.
- Stejná pravidla používá blokace, centrální API kontrola i barevné zvýraznění v náhledu.

### C. Vzhled Pracovního stolu

- CSS selektory byly přepsány na třídy a ID, které současný JavaScript skutečně generuje.
- Opraveno zobrazení knihovny scénářů, textových bloků, podpisů, konceptů, připomínek, verzí a porovnání rozdílů.
- Stav „Připraveno“ je opět zelený.
- Doplněny chybějící ikony a odstraněna mrtvá CSS pravidla staršího rozhraní.
- Doplněny minimální styly pro dosud neostylované komponenty a responzivní varianty.

### D. Funkční opravy

- Tři návrhy odpovědi se už neopakují, ani když model vrátí shodné hodnoty `typ`.
- Import `.eml` nejdříve čte bajty, zjistí deklarovaný charset a až poté dekóduje obsah. Ověřeno pro UTF-8, Windows-1250 a ISO-8859-2.
- Volba „Co má aplikace udělat?“ zůstává viditelná i v jednoduchém režimu; odstraněny mrtvé větve starých startovacích dlaždic.
- Nedostupná telemetrie mimo AI Studio se zaznamená do technického logu místo tichého ignorování.
- Názvy modelů se propisují z jednoho zdroje pravdy v `updateModelUI()`.
- Upozornění na práci s daty Gemini API bylo zpřesněno podle regionu a fakturace.

### E. Manuál a release

- Manuál sjednocen na verzi **1.0.3** a aplikace na **5.2.5**.
- Opraven postup pro pokročilé volby i vysvětlení zbylých značek.
- Aktualizován changelog, `sw.js` a všechna čísla verze; release gate buildu je zelená.

## Ověření

- `node scripts/build.mjs` — **prošlo**, včetně kontroly shody verze, service workeru a changelogu.
- Syntaxe všech zdrojových JS souborů pomocí `node --check` — **prošla**.
- Interní testovací sada aplikace spuštěná v headless Chromiu — **36/36 testů prošlo**.
- Samostatná regresní kontrola citlivých výrazů, jmen, scénářů, CSS, manuálu a verzí — **prošla**.
- Dekódování raw 8bit `.eml`: **Windows-1250 OK**, **ISO-8859-2 OK**.
- Výsledné HTML: **107 unikátních ID, žádné duplicitní ID**.

### Technická výjimka

Původní obalový příkaz `node scripts/test.mjs` používá balíček `jsdom`, který v dodaném ZIPu nebyl přítomen. Jeho instalaci v pracovním prostředí zablokovala nedostupnost npm registru/mirroru. Proto netvrdím, že tento konkrétní obalový příkaz proběhl. Stejných 36 interních testů však bylo spuštěno přímo v reálném headless Chromiu a všechny prošly.

## Doporučení před nasazením

1. Na počítači s dostupným npm spustit ještě `npm install`, `node scripts/build.mjs` a `node scripts/test.mjs`.
2. Ručně projít: Školní situace → knihovna; Textové bloky a podpisy; Pracovní koncepty; Připomínky; Verze; Porovnat rozdíly.
3. Ověřit v hostovaném AI Studiu telemetrii a případné podmínky projektu Gemini s aktivní fakturací.
4. Při testování nepoužívat skutečné údaje žáků; jména, kontakty, zdravotní a rodinné údaje vždy anonymizovat.
