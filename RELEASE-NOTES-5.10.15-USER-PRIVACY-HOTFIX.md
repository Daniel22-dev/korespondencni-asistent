# Korespondenční asistent 5.10.15 — user privacy hotfix

Datum: 2026-08-29

## Důvod
Reálné uživatelské testování odhalilo dvě falešně pozitivní cesty: běžný Gmail `.eml` nesl do pracovního textu identitu odesílatele a obecný seznam preventivních témat byl vyhodnocen stejně jako konkrétní citlivý údaj.

## Oprava
- `.eml` parser ponechává předmět a tělo, ale hlavičku odesílatele převádí lokálně na `[odesílatel]` a stejnou identitu odstraňuje z přesného podpisového výskytu.
- Široký detektor citlivých termínů zůstává aktivní pro bezpečný režim bez historie/debugu.
- Hard-stop preflight nově vyžaduje konkrétní osobní/případový/incidentní kontext, nebo jinak zachovává konzervativní blokaci, pokud není jasný obecný vzdělávací/preventivní rámec.
- Obecné preventivní/kurikulární seznamy jsou pouze kontrolní varování.

## Co zůstává blokováno
Jména a přímé identifikátory, telefon/e-mail mimo bezpečné značky, rodná čísla, účty, konkrétní zdravotní/poradenské/kázeňské případy a známé zbytky skrytých jmen.

## Testovací data
Regresní scénáře používají pouze syntetické osoby a domény `example.cz`.
