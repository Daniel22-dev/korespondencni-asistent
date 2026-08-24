# GARP 2 — nezávislé ověření bezpečnostního auditu 5.10.4

Datum revize: 2026-08-23  
Revize: P5-R7-SECURITY-GARP  
Vstupní audit: `AUDIT-BEZPECNOST-KORESPONDENCNI-ASISTENT-5.10.4.txt`

## Rozsah

Druhé kolo ověřilo nálezy K1–K4 proti zdrojovému balíčku 5.10.4. Součástí byly relevantní datové toky, odesílací preflight, konstrukce promptů, request do GHRAB AI Core, CSP profily, XSS sink baseline a automatické testy. Nešlo o audit živé GitHub/School Gateway infrastruktury ani o nový kryptografický audit vydaného vendor Core.

## Nezávislý verdikt

| ID | Verdikt | Skutečný dopad | Náprava v 5.10.5 |
|---|---|---|---|
| K1 | Potvrzeno | `Ponechat` a `Ponechat všechny` vyřadily návrhy jmen z UI, zatímco původní tvrdá brána blokovala jen `danger`. Osobní jméno tak mohlo po potvrzení náhledu projít do promptu. | Preflight znovu analyzuje přesný prompt a všechny kontextové texty bez ohledu na stav UI. Silní kandidáti osobních jmen jsou blokující. |
| K2 | Částečně potvrzeno | Příchozí e-mail byl vložen do promptu prostým zřetězením. Audit však opomenul existující systémové pravidlo, které už označovalo e-mail a importovaný obsah za nedůvěryhodný. Chyběla strukturální datová hranice. | E-mail je vložen mezi značky `untrusted-email-data` jako jeden JSON řetězec; znaky `<`, `>` a `&` se Unicode-escapují. Systémové instrukce určují jediné povolené zacházení s touto zónou. |
| K3 | Konkrétní zranitelnost nepotvrzena; dluh potvrzen | CSP skutečně povoluje `unsafe-inline`, což oslabuje druhou obrannou vrstvu. Nebyl však doložen tok neescapovaného vstupu do spustitelného sinku. Tvrzení, že statický CSP profil nepovoluje Gemini endpoint, bylo nepravdivé: endpoint v něm už byl. | Baseline je zpřesněna na skutečných 99 `innerHTML` a 2 `insertAdjacentHTML`; jakýkoli nárůst release gate zastaví. Odstranění `unsafe-inline` zůstává samostatnou modulární migrací. |
| K4 | Potvrzeno jako nízké technické riziko | Privacy příznaky byly zapisované jako konstanty `true`, avšak až po úspěšném preflightu, takže samy nevytvářely bypass. Mohly být zavádějící při budoucí změně kódu. | `assertGeminiSafety()` vrací neměnný bezpečnostní důkaz a request odvozuje oba příznaky pouze z něj. Server je nadále nesmí považovat za autoritativní oprávnění. |

## Bezpečnostní invarianty 5.10.5

1. Žádná AI operace neodešle request bez `safetyContext.texts`.
2. Přesný finální prompt a všechny doplňkové kontexty se kontrolují bez uznání UI stavu `Ponechat`.
3. Známé, víceslovné, slovníkové a pravděpodobně skloňované osobní jméno je před odesláním tvrdá stopka.
4. Příchozí e-mail je data, nikoli instrukce; datová zóna zachovává přesný obsah přes JSON round-trip.
5. Klientské privacy příznaky vzniknou pouze po úspěšné bezpečnostní bráně.
6. XSS sink count nesmí proti verzované baseline vzrůst.

## Regresní důkazy

- čtyři scénáře K1 po skutečném použití `Ponechat všechny`: celé jméno, známé jméno, rodinný tvar a vokativ příjmení;
- deset hostile-corpus vstupů K2 včetně „ignore previous“, falešné role `SYSTEM`, pokusu ukončit datovou zónu a vynucení jiného JSON výstupu;
- kontrola JSON round-trip a nepřítomnosti doslovné ukončovací značky v datovém payloadu;
- kontrola, že privacy příznaky odpovídají návratové hodnotě úspěšného preflightu;
- existující regresní a Core conformance sada.

## Lokální release gate

| Kontrola | Výsledek |
|---|---:|
| Standardní build / school-server build | prošlo / prošlo |
| Interní aplikační testy | 154/154 |
| GHRAB AI Core conformance | 17/17 |
| GHRAB Platform conformance | 124/124 |
| AI profile gate | 15/15 |
| Statická quality/performance brána | 31/31 |
| XSS sink regression | prošlo; 99 `innerHTML`, 2 `insertAdjacentHTML`, ostatní sledované sinky 0 |
| Lockfile audit | prošlo; 67 uzamčených balíčků |
| Syntax změněných JS souborů | prošlo |

Fyzické Chromium UI, runtime reflow a axe kontroly nebyly v lokálním runneru spuštěny, protože neobsahuje systémovou binárku Chromium a síťová politika zabránila jejímu stažení. Repo obsahuje blokující workflow, které před nasazením instaluje Chromium a spouští `qa:p5:ci`. Lokální `qa-p5-acceptance` proto správně zůstává červená kvůli chybějícím prohlížečovým reportům; tento krok není prominut.

## Zbytkové riziko

- Detekce jmen je heuristická. V bezpečnostní bráně je záměrně fail-closed pro silné kandidáty, takže může vyžádat dodatečnou anonymizaci i u některých bezpečných vlastních názvů.
- Promptové oddělení významně omezuje instruction injection, ale žádný přirozenojazykový prompt není formální bezpečnostní hranice. Modelový výstup se proto nadále validuje podle schématu a bezpečně zpracovává.
- `unsafe-inline` zůstává CSP kompatibilitní výjimkou. Další krok je přesun inline skriptů a stylů do hashovaných nebo nonce modulů a postupné odstranění HTML sinků.
- Živý School Gateway, retenční politika a pravidla infrastruktury vyžadují samostatné serverové ověření při zapojení školního profilu.

## Release rozhodnutí

Zdrojová oprava je vhodná jako verze 5.10.5. Upload a produkční nasazení musí stejně jako u předchozích verzí projít repozitářovým Chromium/axe CI a následným live Pages/PWA smoke testem.
