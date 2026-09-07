# GARP — ověření opravy jmen na začátku věty

Datum: 2026-08-23  
Revize: P5-R9-SECURITY-SENTENCE-START-GATE  
Vstup: `ZADANI-OPRAVY-KS-5.10.7.txt`

## Nezávislý verdikt

Nález byl potvrzen. Ve verzi 5.10.6 sdílel našeptávač i odesílací brána stejné potlačení jednoslovných výrazů na začátku věty. Proto vstupy `Nguyen dnes chyběl na hodině.`, `Halama zase nepřinesl úkol.`, `Svobodou byla podána stížnost.` a `Nováková se omluvila.` nevrátily jmenného kandidáta a prošly do modelové vrstvy.

## Důkaz před opravou

Přejímací T1 a T2 byly vloženy před změnou produkčního kódu. Oba selhaly na prvním příkladu `Nguyen dnes chyběl na hodině.`. T3 zůstal zelený, což potvrzuje původní chování našeptávače.

## Realizace

| Oblast | Rozhodnutí |
|---|---|
| UI našeptávač | Nadále potlačuje neznámý jednoslovný výraz na začátku věty. |
| Přísný preflight | Výslovně zahrnuje kandidáty na začátku věty a ignoruje pouze jednotlivý stav `keep-explicit`. |
| Hromadné ponechání | Stav `keep-bulk` bezpečnostní bránu neotevře. |
| Cache | Klíč obsahuje `includeReviewed` i `includeSentenceStart`. |
| Tvorba odpovědí | Přísná jmenná větev čte uživatelský text, poznámku a osobní styl; AI vytvořené body se kontrolují standardním úplným preflightem. |

## Výsledek

- T1, T2 a T3 prošly;
- 158/158 interních testů prošlo;
- 17/17 GHRAB AI Core conformance testů prošlo;
- našeptávač nezískal nové návrhy u slov `Prosím` a `Zítra`;
- performance ratchet byl řízeně posunut o 5 kB, nejvýše o 0,83 %, kvůli doloženému přírůstku vstupního HTML 4 468 B;
- XSS baseline se nezvýšila.

## Zbytkové riziko a odklad

Přísná kontrola je záměrně konzervativnější než panel návrhů. Případný bezpečný jednoslovný výraz lze po ručním výběru ponechat jednotlivě; hromadné ponechání nestačí. Detekce jmen napsaných malými písmeny a postupné snižování HTML sinků jsou zaznamenané pro samostatná další vydání, nikoli skrytě zahrnuté do 5.10.7.

Produkční verdikt zůstává podmíněný zeleným browser/runtime/UI/axe workflow v CI a následným live smoke testem.
