# Korespondenční asistent 5.10.13 — GARP 2.3 AI-RED hardening

Datum: 2026-08-29

## Účel

Toto vydání vzniklo v novém GARP 2.3 cyklu zaměřeném na prompt injection, jailbreak a nepřímé instrukce vložené do e-mailů. Všechny testy používají výhradně syntetická data.

## Potvrzené hardening body

1. Odstraněny prosté trojité/uvozovkové hranice u AI cest s uživatelským obsahem; data jsou JSON serializována v explicitní trust-zóně.
2. Požadavky vytěžené modelem z nedůvěryhodného e-mailu se při tvorbě odpovědi znovu nevkládají jako instrukce, ale jako `<untrusted-data>`.
3. Synonymní pomocník používá stejnou trust hierarchii a pravidla proti prompt injection jako hlavní AI operace.
4. Poznámky, vlastní adresát a dlouhodobé stylistické preference jsou `<user-directive>` nižší priority a nemohou legitimně měnit systémovou roli, bezpečnost ani schéma.
5. HTML import odstraňuje zjevně skrytý obsah před vytvořením modelového vstupu.
6. Systémové instrukce výslovně zakazují extrakci hidden/system instrukcí, interních canary, cross-context dat a aktivní exfiltrační HTML/Markdown/URL výstup.

## Performance budget

AI-RED hardening zvětšil produkční `index.html` proti 5.10.12 o 7 489 B (přibližně 0,96 %). Pět statických size limitů proto bylo úzce přebaselinováno s přibližně 2,7–3,2 kB rezervou; runtime budget ani limit celkové velikosti distribuce se nemění. Původní budget nad 5.10.13 reprodukovatelně selhal v 5/31 size kontrolách.

## Evidence

- interní test build: 168/168 + GHRAB AI Core 17/17;
- GARP 2.3 AI-RED structural harness: AIR-01 až AIR-12, 32/32 kontrol PASS;
- AIR-12: 24 strukturálních mutací / 6 mutation families;
- negative control: nebezpečná raw trust hranice FAIL, hardened varianta PASS;
- live behaviorální AIR test proti produkčně používanému externímu modelu: NOT TESTED v auditním prostředí bez credentialu.

## Release status

Toto vydání není samo o sobě důkazem GREEN pro reálná studentská data. Povinné behaviorální AIR scénáře a externí GARP lifecycle / RT-16 body musí být dokončeny samostatně.

REÁLNÁ STUDENTSKÁ DATA: NEPOUŽÍVAT
TESTOVACÍ PROVOZ POUZE SE SYNTETICKÝMI DATY
