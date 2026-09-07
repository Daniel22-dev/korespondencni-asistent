# KS 5.10.25 – binární deployment artefakty a původ

Audit inventarizuje PNG soubory v `src/icons/` a `src/assets/brand/school-logo.png`.

- app icon set: součást dodaného source snapshotu projektu; hash se sleduje v release inventory;
- `school-logo.png`: školní brand asset distribuovaný přes GHRAB Platform release manifest a kopírovaný do aplikace;
- auditní prostředí nemá samostatné licenční/majetkové dokumenty dokazující práva k těmto obrazovým souborům.

Proto je **GH-12 právní čistota externě NOT TESTED**, nikoli automatický PASS. Před veřejným/školním release je třeba mít interně doloženo, že škola/projekt smí logo a ikony distribuovat. Žádný externí font ani binární knihovna se do kandidáta nově nepřidává.
