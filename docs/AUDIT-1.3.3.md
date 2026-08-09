# Audit Diferenciátoru 1.3.3 — implementační komentář

Audit 1.3.2 byl v hlavních nálezech potvrzen. Opraveno bylo zachování hotových stupňů při dalším generování, průběžné zobrazení rozpracovaných karet, potvrzení před smazáním práce, rozpoznávání úředních názvů jazykových předmětů, dělení tiskových bloků, plný název školy v PDF, živé CEFR štítky, telemetrie, modely Gemini a manuál.

## Zpřesnění proti doslovnému zadání

- Při neúspěšném přegenerování stejného stupně se obnoví původní karta. Doslovná náhrada z auditu ji při chybě nevracela.
- Informace o používání dat Googlem je formulována podle regionu: pro EHP, Švýcarsko a Spojené království se pravidla práce s daty liší a veřejně zpřístupněný klient má používat projekt s aktivní fakturací.
- Současná interní sada je podrobnější než počet uvedený v auditu; po doplnění regresí prošlo 77/77 položek.

## Verifikace

- release gate a build: OK
- interní testy v headless Chromiu: 77/77
- 118 unikátních HTML ID, bez duplicity
- modely `gemini-3.6-flash` a `gemini-3.5-flash-lite`: stabilní ID
