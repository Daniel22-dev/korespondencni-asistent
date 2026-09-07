# KS 5.10.25 – security exception register

## EX-01 – inline CSP v současném statickém klientu
- Severity: MEDIUM (defense-in-depth)
- Stav: otevřeno / explicitní technický dluh
- Rozsah: statický meta CSP stále používá `script-src 'self' 'unsafe-inline'` a `style-src 'self' 'unsafe-inline'` kvůli současné architektuře single-page buildu.
- Kompenzace: vlastní sanitizace/rendrování, XSS sink QA, produkční stripping test hooks, school build odstraňuje direct-provider origin.
- Podmínka uzavření: school-server hardening zavede served CSP bez `unsafe-inline`, nebo zdokumentovanou nonce/hash variantu a ověří ji na skutečné HTTP odpovědi.
- Cílová fáze: SHIELD-LIVE před produkčním school-server provozem.

Žádná výjimka nepovoluje private key, server credential ani reálná studentská data v auditních artefaktech.
