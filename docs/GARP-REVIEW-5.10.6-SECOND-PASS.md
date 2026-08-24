# GARP 2 — nezávislé posouzení ověření oprav 5.10.5

Datum: 2026-08-23  
Revize: P5-R8-SECURITY-GARP-SECOND-PASS  
Vstup: `OVERENI-OPRAV-KORESPONDENCNI-ASISTENT-5.10.5.txt`

## Verdikt

| ID | Verdikt | Rozhodnutí ve verzi 5.10.6 |
|---|---|---|
| N1 | Potvrzeno | Koncovková heuristika nyní testuje původní NFC tvar s diakritikou. `Nováková`, `Kučerové`, `Novákovi` a `Novákovou` jsou pokryté regresí. |
| N2 | Potvrzeno | Zvolena navržená varianta B. Hromadné ponechání dostává stav `keep-bulk` a neotevře bránu. Pouze samostatné rozhodnutí nad konkrétním jednoslovným výrazem vytvoří `keep-explicit`; víceslovný kandidát takto propustit nelze. |
| N3 | Potvrzeno | Společný JSON obal `untrusted-email-data` používá rozbor i tvorba tří odpovědí. Příchozí text už v reply promptu není mezi trojitými uvozovkami. |
| N4 | Jako regrese nepotvrzeno | Opravy 5.10.5 ani 5.10.6 nepřidaly žádný `innerHTML` ani `insertAdjacentHTML`. Verzovaná baseline 5.10.4 byla 100, skutečný sjednocený scan ukázal 99; dvě použití `insertAdjacentHTML` existovala již před opravami. Číslo 94 z prvního auditu vzniklo jinou metodikou a nelze je s ratchetem přímo porovnat. |

## Bezpečnostní pravidlo pro jednoslovné výrazy

Preflight rozlišuje tři stavy:

- `keep-bulk`: hromadné ponechání; pro jednoslovný návrh není bezpečnostním souhlasem a odeslání se zastaví;
- `keep-explicit`: jednotlivé ponechání konkrétního jednoslovného výrazu; může odstranit falešný poplach;
- starý stav `keep`: kvůli zpětné kompatibilitě se zobrazení považuje za vyřešené, ale bezpečnostně se chová jako hromadné ponechání.

Víceslovná pravděpodobná jména zůstávají blokující bez ohledu na ponechání. Uživatel je musí anonymizovat nebo správně zařadit jako instituci, místo či jinou kategorii.

## Regresní pokrytí

- hromadné ponechání: `Petr Svoboda`, `Tereza Marková`, `Dvořákova`, `Nováku`, `Nováková`, `Kučerové`, `Halama`, `Nguyen`, `Müller` — vždy blokace;
- jednotlivé ponechání konkrétního jednoslovného výrazu — povolená, auditovatelná výjimka;
- desetičlenný hostile corpus pro `incoming-analysis` i `reply-draft`;
- JSON round-trip, nemožnost předčasně uzavřít datový obal a zákaz návratu trojitých uvozovek v obou cestách;
- stávající aplikační a GHRAB AI Core conformance sada.

## Zbytkové riziko

Detekce vlastních jmen je heuristická. Jednotlivá volba `Ponechat` je vědomé rozhodnutí uživatele, nikoli automatické potvrzení, že výraz není osobní údaj. Před odesláním je proto stále nutné přečíst náhled. CSP `unsafe-inline` a postupná redukce HTML sinků zůstávají samostatným architektonickým úkolem; ratchet nepovoluje jejich další nárůst.

## Release rozhodnutí

N1–N3 jsou uzavřené ve verzi 5.10.6. N4 neblokuje toto vydání, protože nevznikla nová XSS regrese. Produkční nasazení je nadále podmíněno zeleným repozitářovým Chromium/axe/runtime workflow a následným live Pages/PWA smoke testem.
