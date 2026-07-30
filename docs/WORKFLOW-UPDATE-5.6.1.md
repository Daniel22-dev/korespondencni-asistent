# Korespondenční asistent 5.6.1 — jména a gramatický rod pisatele

Datum: 30. 7. 2026

## 1. Přesnější anonymizace jmen

- Do seznamu výrazů, které se nesmějí připojit ke jménu, byly doplněny časté předložky a spojovací výrazy (`Mimochodem`, `Podle`, `Kvůli`, `Před`, `Za` aj.).
- Výrazy typu **Mimochodem Kamča** a **Podle Adély** se proto už nenabízejí jako celé jméno; aplikace pracuje jen s částí **Kamča** nebo **Adély**.
- Při ručním označení osoby se z kontextu a české koncovky odhadne pád. Skloňovaný tvar se lokálně převede na základní podobu, například **Adélou Kulovou → Adéla Kulová**.
- Pozorovaný tvar zůstává jako lokální alias. Gemini stále dostává pouze technickou značku osoby a skutečné jméno se doplňuje až v prohlížeči.
- Všechny rozpoznané tvary jedné osoby se ukládají pod jedinou značkou; nevznikají samostatné položky pro nominativ, dativ a instrumentál.
- Neobvyklé nebo chybně odhadnuté tvary lze nadále ručně opravit v klíči náhrad a editoru pádů.

## 2. Gramatický rod odesílatele

Profil odesílatele nově obsahuje volbu:

- **Mužský**
- **Ženský**
- **Bezrodové formulace**

Jméno se modelu neposílá a rod se z něj neodhaduje. U starších profilů bez uložené volby se provede pouze dočasná migrace podle jednoznačného názvu role; uživatel může volbu kdykoli změnit.

Zvolený rod se propisuje do:

- generování tří variant odpovědi,
- režimu Můj e-mail,
- následných AI úprav již vytvořeného konceptu.

Kontrola před exportem u českého textu zachytí běžné opačné tvary, například mužské **musel jsem / předal jsem / rád bych** u ženského profilu. U bezrodové volby stejná kontrola vyžaduje přeformulování rodově příznakových vět.

## 3. Regresní kontrola

Interní sada má **89/89 úspěšných testů**. Nové testy ověřují:

- oddělení spojovacích slov od jmen,
- převod genitivu a instrumentálu na základní tvar,
- anonymizaci skloňovaného celého jména v poznámce,
- jedinou značku pro více pádů stejné osoby,
- přenos mužského, ženského a bezrodového profilu do promptu,
- blokaci zjevně nesprávného rodu před exportem.
