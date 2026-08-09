/* ===================== SDÍLENÝ STAV AI RUNTIME ===================== */
/*
 * Tento stav musí být inicializovaný před 28-ai-integration.js.
 * GHRAB Platform může být při spuštění přes AI Studio připravena ještě před
 * odemčením aplikačního skriptu; integrace pak vytváří runtime konfiguraci
 * okamžitě. Lexikální bindingy proto nesmějí vznikat až v pozdějším modulu.
 */
const KEY_SK="rozbor_gemini_key", KEY_SESSION_SK="rozbor_gemini_key_session", MODEL_SK="rozbor_gemini_model";
const MODEL_DEFAULT="gemini-3.6-flash", QUALITY_MODEL="gemini-3.5-flash", FALLBACK_MODELS=["gemini-3.5-flash-lite"];
let geminiApiKey="", geminiKeyScope="", geminiModel=MODEL_DEFAULT;
let TEST_RUN_ACTIVE=false;
