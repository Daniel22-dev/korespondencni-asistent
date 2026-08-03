# Korespondenční asistent 5.9.7 – umístění panelu snímání

## Změna

Plovoucí ovládání aktivního snímání obrazovky je ukotveno **vpravo dole**.

- desktop: pravý a spodní odstup 18 px;
- menší displeje: pravý a spodní odstup 8 px;
- spodní okraj respektuje `env(safe-area-inset-bottom)`;
- panel si zachovává kompaktní maximální šířku a neroztahuje se přes celou obrazovku.

Funkce panelu zůstávají stejné: pořízení snímku, návrat k hlášení a ukončení snímání.
