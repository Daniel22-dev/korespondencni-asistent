# Korespondenční asistent 5.10.2

Vydání dokončuje opravy z uživatelského testování po verzi 5.10.1.

## Uživatelské změny

- při startu se nezobrazují dvě souběžná oznámení o stejné aktualizaci;
- režim sestavení nového e-mailu je popsaný tak, aby bylo zřejmé, že přijímá souvislé zadání i body;
- načítání Gmail `.eml` podporuje běžné varianty MIME zpráv, kódované hlavičky, HTML fallback, quoted-printable, base64 a středoevropská kódování;
- formulář hlášení chyby připraví ZIP ke skutečnému ručnímu stažení a Gmail zpřístupní až v navazujícím kroku;
- Gmail API se nepoužívá: ZIP se z bezpečnostních důvodů přikládá ručně a aplikace to uvádí v rozhraní i v předvyplněné zprávě.

## Zachované opravy

Zůstávají všechny opravy šablon, rychlých úprav, bezpečnostních hlášení, profilu, vlastního předmětu, přirozeného oslovení a podpisu i volitelného zapracování hodnocení textu z verzí 5.9.22 až 5.10.1.

## Ověření

- build a platformní kontrola;
- 151 interních regresních testů;
- samostatná kontrola reportéru včetně přípravy ZIP, odemčení Gmailu a textu upozornění;
- kontrola kvality a release gate.

Balíček pro GitHub neobsahuje generované složky `dist/`, `node_modules/` ani testovací výstupy. `dist/` vytvoří GitHub Actions.
