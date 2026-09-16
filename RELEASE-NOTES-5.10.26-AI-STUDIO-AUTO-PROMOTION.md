# Korespondenční asistent 5.10.26 — AI Studio auto-promotion

Datum: 2026-09-16

## Účel

Tento patch dokončuje provozní cestu, ve které AI Studio automaticky převezme novou **patch** verzi Korespondenčního asistenta po úspěšném nasazení. Nezavádí profil `auto-patch-prep` a neprovádí autonomní změny zdrojového kódu.

## Změny

1. `scripts/apply-ghrab-platform.mjs` už nepřepisuje Studio manifest do historických názvů polí. Výsledný `dist/studio-manifest.json` zachovává kontrakt očekávaný AI Studiem.
2. `scripts/ghrab-platform-conformance.mjs` kontroluje schema, verzi, platform range, bridge, artifact envelope, storage prefix a cache identity veřejného Studio manifestu.
3. `.github/workflows/deploy.yml` vyžaduje `AI_STUDIO_DISPATCH_TOKEN`, po Pages deployi čeká na živý manifest s přesnou verzí a následně odešle `repository_dispatch` typu `app-updated` do `Daniel22-dev/AI-Studio-GHRAB`.
4. Patch verze je 5.10.26. Minor/major změny zůstávají záměrně mimo automatickou promotion politiku Studia.

## Bezpečnostní rozsah

AI logika, anonymizace, prompt assembly, provider/model policy a školní gateway nejsou změněny. GARP 2.5.1 baseline 5.10.25 proto zůstává historickým bezpečnostním podkladem; tento patch mění integrační metadata, platformní postprocessing a release workflow.

## Nutné nastavení GitHubu

Repozitář `korespondencni-asistent` musí obsahovat Actions secret `AI_STUDIO_DISPATCH_TOKEN` s oprávněním vytvořit repository dispatch v `Daniel22-dev/AI-Studio-GHRAB`. Bez něj je release záměrně fail-closed.
