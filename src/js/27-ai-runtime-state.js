/* ===================== SDÍLENÝ STAV AI RUNTIME ===================== */
/*
 * Tento stav musí být inicializovaný před 28-ai-integration.js.
 * GHRAB Platform může být při spuštění přes AI Studio připravena ještě před
 * odemčením aplikačního skriptu; integrace pak vytváří runtime konfiguraci
 * okamžitě. Lexikální bindingy proto nesmějí vznikat až v pozdějším modulu.
 */
const KEY_SK="rozbor_gemini_key", KEY_SESSION_SK="rozbor_gemini_key_session", MODEL_PROFILE_SK="rozbor_gemini_model";
const MODEL_PROFILE_DEFAULT="balanced", MODEL_PROFILES=Object.freeze(["economy","balanced","quality"]);
let geminiApiKey="", geminiKeyScope="", selectedModelProfile=MODEL_PROFILE_DEFAULT;
let TEST_RUN_ACTIVE=false;
