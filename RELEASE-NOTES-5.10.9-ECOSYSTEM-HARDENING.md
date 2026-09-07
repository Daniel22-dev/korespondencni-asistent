# Korespondenční asistent 5.10.9 — ecosystem hardening

Tato patch verze nemění pedagogické funkce ani vzhled. Opravuje průřezové odchylky z ekosystémového auditu GARP.

- School-server bootstrap je deployment-aware a používá `/ai-studio/` podle školního profilu.
- School-server build failuje při návratu standalone cesty `/AI-Studio-GHRAB/`.
- `sharedAccessVersion` je sjednocena s aktuálním AI Studio bundle.
- GitHub Actions jsou pinované na plné SHA.
- P5 gate obsahuje povinný `qa:school-profile`.

Současný GitHub Pages režim zůstává záměrně beze změny a dál používá `/AI-Studio-GHRAB/`.
