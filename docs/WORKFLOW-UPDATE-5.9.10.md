# Korespondenční asistent 5.9.10 – zavření a životní cyklus hlášení

## Nalezená příčina

Základní reportér měl správnou logiku pro volby **Ponechat rozepsané** a **Smazat hlášení**. Doplňková KS vrstva pro plovoucí snímání však během aktivního sdílení zachytávala křížek, tlačítko Zavřít, kliknutí mimo dialog i Escape. Místo skutečného zavření pouze schovala dialog a přešla zpět do aplikace. Proto se při novém otevření zobrazil stejný text i screenshoty a uživatel nedostal očekávanou volbu.

## Oprava

- Doplňková vrstva už žádnou zavírací akci nepřebírá.
- Křížek, tlačítko Zavřít, kliknutí mimo dialog a Escape vždy obslouží základní reportér.
- Aktivní snímání se před dotazem bezpečně zastaví.
- **Smazat hlášení a zavřít** odstraní text, screenshoty, připravený ZIP, stav výsledku i ID rozpracovaného reportu.
- **Ponechat rozepsané a zavřít** zachová celý koncept.
- Přechod do aplikace bez zavření je dostupný pouze přes výslovné tlačítko **Přejít do aplikace**.

## Regresní test

Nový test `scripts/test-reporter-draft.mjs` spouští Chromium a ověřuje skutečný integrovaný scénář:

1. otevření reportéru;
2. vložení textu a testovacího screenshotu;
3. simulaci aktivního snímání;
4. návrat do hlášení a kliknutí na zavření;
5. zobrazení volby Ponechat / Smazat;
6. úplné vymazání po volbě Smazat;
7. zachování konceptu po volbě Ponechat.
