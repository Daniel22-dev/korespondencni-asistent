# Korespondenční asistent 5.9.22 — Další možnosti, profil a vlastní předmět

Datum: 12. 8. 2026

## Opravené problémy

- Automatické testy už nezačnou bez zřetelné odezvy. Okno čeká na tlačítko **Spustit testy**, během běhu ukazuje aktuální test a počet dokončených kontrol a po skončení zobrazí stabilní výsledky.
- Dvě hlášená selhání testů byla způsobena migrací úložiště GHRAB Platform. Testy a správa dat pracovaly jen s historickými názvy klíčů, zatímco skutečná data mohla být fyzicky uložena pod `ghrab.correspondence.*`. Snapshot, obnova i mazání nyní zahrnují oba tvary.
- Testovací běh potlačuje dočasné toast zprávy a po skončení obnovuje profil, vstupy, volby, otevřené sekce a původní pracovní obrazovku.
- Profil odesílatele se už nezavře náhodným kliknutím mimo kartu. Ukládání se ověří zpětným načtením a při chybě zůstane formulář otevřený s vysvětlením.
- V režimu Můj e-mail lze vybrat **Vlastní předmět** a napsat až 60 znaků. Předmět se připojí k výstupu lokálně a neposílá se AI modelu.
- „Jak text působí?“ analyzuje pouze tělo e-mailu. U nedotčeného návrhu vytvořeného z potvrzeného bezpečného zdroje už obecný školní nebo kázeňský výraz nevyvolá falešný návrat k původní anonymizaci; tvrdé identifikátory zůstávají blokované.

## Audit Dalších možností

Všechny položky byly ponechány a ověřeny: profil odesílatele, poslední výstupy, přehled změn, prohlídka aplikace, správa lokálních dat a pro administrátora vývojářské nástroje. Vývojářská nabídka obsahuje čtyři odůvodněné diagnostické části: automatické testy, debug anonymizovaného promptu, technický log bez obsahu e-mailů a diagnostiku AI runtime.

## Ověření

- 144/144 vestavěných testů;
- 42/42 fyzických klikacích kontrol v Chromiu;
- fyzicky ověřeno otevření a zavření všech položek Dalších možností a všech čtyř vývojářských nástrojů;
- fyzicky ověřeno vyplnění, uložení a znovuotevření profilu i zadání vlastního předmětu.
