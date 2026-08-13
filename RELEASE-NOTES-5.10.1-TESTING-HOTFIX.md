# Korespondenční asistent 5.10.1 — opravy podle reálného testování

Datum: 13. 8. 2026

## Hlavní změny

- Neplatný záznam `<b>šablona</b>` pocházející z bezpečnostního regresního testu se už nemůže uložit mezi uživatelské šablony. Případný starý záznam se při načtení automaticky odstraní, platné vlastní šablony zůstanou zachované.
- Import šablon ověřuje název i skutečné uložené parametry. Poškozenou šablonu nelze použít a HTML značky se nepřijímají jako její název.
- Tlačítka „Zkrátit“, „Zmírnit“, „Zpřesnit“ a „Přirozeněji“ správně pracují s bezpečně vygenerovaným konceptem. Běžné slovo s velkým písmenem v předmětu, například `Informace`, už není mylně považováno za jméno.
- Po ruční úpravě konceptu nebo vložení vlastního textového bloku se znovu spustí úplná kontrola možných jmen, kontaktů a citlivých údajů.
- Delší chyby a bezpečnostní upozornění zůstávají zobrazené, dokud je uživatel nezavře. Mají tlačítko „Zavřít“, větší šířku, nepřekrývají spodní ovládací lištu a používají přístupné stavové role.
- Krátká potvrzení se nadále zavírají automaticky, ale zůstávají viditelná nejméně čtyři sekundy; přesná doba se přizpůsobuje délce textu.

## Zachované funkce 5.10.0

- volitelné zapracování jednotlivých připomínek z kontroly „Jak text působí?“;
- oslovení kolegy nebo vedení při tykání pouze křestním jménem;
- neformální lokální podpis, například `S pozdravem` a `Dan`;
- vytvoření odpovědi pouze z poznámky bez vybraného automatického požadavku;
- vlastní předmět výsledného e-mailu a opravy sekce Další možnosti.

## Ověření

- build a platformní konformita: 124/124;
- interní regresní testy: 148/148;
- GHRAB AI Core konformita: 17/17;
- bezpečnostní XSS kontrola: úspěšná;
- kontrola kvality a výkonových rozpočtů: 31/31;
- fyzické Chromium kontroly zůstávají součástí GitHub Actions; lokální prostředí nemá dostupný prohlížeč Chromium.

Zdrojový ZIP neobsahuje `node_modules`, generovanou složku `dist` ani lokální výsledky testů. GitHub Actions vytvoří čistý produkční build.
