# Korespondenční asistent 5.4.2

## Opravy anonymizačního našeptávače

- Panel **Výrazy ke kontrole** nabízí akci **Ponechat všechny zbývající**.
- Hromadná akce vyžaduje potvrzení, že uživatel seznam přečetl a neobsahuje skutečné jméno, instituci, místo ani jiný identifikující údaj.
- Po hromadném ponechání se návrhy považují za vyřešené a pole **Zkontrolováno** se odemkne; závěrečné přečtení celého textu zůstává povinné.
- Jednotlivé návrhy lze nadále označit jako osobu, instituci, místo nebo ponechat samostatně.

## Slučování jmen a iniciál

- Kliknutí na `Petr` v podpisu `Mává Petr H.` nabídne celý celek `Petr H`.
- Funguje také iniciála bez tečky: `Mává Petr H`.
- Když uživatel označí nejprve `Petr` a potom sousední `H.`, aplikace původní záznam rozšíří na `Petr H` a zachová značku `osoba A`; nevytvoří `osoba B`.
- Běžné slovo před jménem, například `Mává`, se do anonymizace nepřipojí.
- Tříslovné sloučení je omezeno na typické kombinace s titulem nebo iniciálou, aby se omylem nespojovaly dvě různé osoby.

## Zachované opravy 5.4.1

- Varovné položky kontroly před odesláním mají normální šířku a bezpečné zalamování.
- Emoji a emotikony z původního e-mailu se do tří variant odpovědi automaticky nepřenášejí; povolí se pouze výslovným pokynem.

## Regresní testy

- `Mává Petr H.` → `Mává osoba A.`
- `Mává Petr H` → nabídka celého jména i bez tečky.
- postupné označení `Petr` a `H.` → jediná položka klíče a jediná značka `osoba A`,
- hromadné ponechání více bezpečných návrhů odemkne závěrečnou kontrolu,
- stávající testy českých pádů, bezpečnostních značek, emoji a kontroly konceptu zůstávají aktivní.
