# Korespondenční asistent 5.10.4 — referenční modelové profily

Tato verze sjednocuje Korespondenčního asistenta s kontraktem GHRAB AI Core pro profily `economy`, `balanced`, `quality`.

## Referenční pravidlo pro ostatní aplikace

- UI nabízí pouze **◇ Úsporný**, **⚡ Doporučený**, **★ Důkladný**.
- Aplikační stav ukládá pouze `economy`, `balanced`, `quality`.
- Aplikační AI request posílá pouze `modelProfile`.
- Direct Gemini mapuje profil na konkrétní model výhradně v `runtime-config.js`.
- School Gateway dostává stejný `modelProfile`; provider a konkrétní model vybírá server.
- `credentialProvider` nesmí používat `modelOverride`.
- Každá uživatelsky volitelná úroveň musí být povolená v `allowedModelProfiles` dané operace.

## Migrace

Staré lokálně uložené Gemini modely jsou při načtení jednorázově převedeny na odpovídající profil. Nové nastavení už providerové ID neukládá ani neexportuje.
- Referenční gate: `npm run qa:profiles`.
- School-server build navíc odstraňuje z CSP přímý Gemini endpoint; klientský síťový kontrakt zůstává pouze same-origin.

