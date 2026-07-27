# Korespondenční asistent 5.4.1

## Opravy

- Kontrola před odesláním už nepoužívá obecnou CSS třídu `warn`, která přidávala druhou ikonu a rozbíjela grid do úzkého sloupce.
- Varovné a chybové položky používají izolované třídy `check-warn` a `check-danger`.
- Text kontroly se zobrazuje v celé dostupné šířce a doplňující detail se bezpečně zalamuje.
- Tři varianty odpovědi automaticky nepřebírají emoji, emotikony ani dekorativní symboly z přijatého e-mailu.
- Emoji se zachovají pouze při výslovném požadavku v poli Poznámka pro odpověď.

## Regresní testy

- kontrola oddělené třídy varovných položek,
- odstranění emoji z výsledku,
- výslovné povolení a zákaz emoji v poznámce.
