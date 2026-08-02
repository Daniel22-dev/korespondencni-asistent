/*
 * AI Studio GHRAB — veřejná runtime konfigurace Korespondenčního asistenta.
 * Neobsahuje a nikdy nesmí obsahovat API klíče, hesla ani jiné tajné údaje.
 *
 * Výchozí stav: pouze serverless Direct Gemini.
 * Budoucí řízená migrace může povolit oba režimy bez automatického fallbacku:
 *   defaultMode: "school-gateway"
 *   allowedModes: ["school-gateway", "direct-gemini"]
 *   allowUserModeSelection: true
 */
window.__GHRAB_RUNTIME_CONFIG__ = {
  schema: "ghrab-runtime-config-v1",
  ai: {
    defaultMode: "direct-gemini",
    allowedModes: ["direct-gemini"],
    allowUserModeSelection: false,
    automaticFallback: false,
    gatewayUrl: "/api/v1/ai/generate",
    healthUrl: "/api/v1/ai/health",
    requestTimeoutMs: 45000,
    gatewayMaxRetries: 0,
    maxRequestBytes: 10485760,
    maxPartBytes: 8388608,
    directGemini: {
      profileModels: {
        economy: "gemini-3.5-flash-lite",
        balanced: "gemini-3.6-flash",
        quality: "gemini-3.6-flash"
      },
      fallbackModels: ["gemini-3.5-flash-lite"],
      useResponseSchema: false,
      maxOutputTokens: 32768
    }
  },
  telemetry: {
    enabled: true
  }
};
