/*
 * GHRAB AI Core 1.0.0
 * Provider-neutral browser client for AI Studio Gymnazia Ostrava-Hrabuvka.
 * Contract: ghrab-ai-contract-v1.0.0.md
 */
(function (global) {
  "use strict";

  const CORE_VERSION = "1.0.0";
  const CONTRACT_VERSION = "1";
  const BUILD_ID = "ghrab-ai-core-1.0.0-20260802";
  const REQUEST_SCHEMA = "ghrab-ai-request-v1";
  const RESPONSE_SCHEMA = "ghrab-ai-response-v1";
  const ERROR_SCHEMA = "ghrab-ai-error-v1";
  const HEALTH_SCHEMA = "ghrab-ai-health-v1";
  const USAGE_SCHEMA = "ghrab-ai-usage-v1";
  const RUNTIME_SCHEMA = "ghrab-runtime-config-v1";
  const OPERATION_SCHEMA = "ghrab-ai-operations-v1";
  const MODES = Object.freeze(["direct-gemini", "school-gateway"]);
  const MODEL_PROFILES = Object.freeze(["economy", "balanced", "quality"]);
  const ERROR_CODES = Object.freeze([
    "AUTH_REQUIRED", "AUTH_EXPIRED", "ACCESS_DENIED", "API_KEY_MISSING", "API_KEY_INVALID",
    "RATE_LIMITED", "BUDGET_EXCEEDED", "QUOTA_EXCEEDED", "PAYLOAD_TOO_LARGE",
    "UNREGISTERED_OPERATION", "UNSUPPORTED_SCHEMA", "FEATURE_UNSUPPORTED", "REQUEST_IN_PROGRESS",
    "IDEMPOTENCY_CONFLICT", "SERVER_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "NETWORK_ERROR",
    "TIMEOUT", "REQUEST_CANCELLED", "INVALID_REQUEST", "INVALID_OUTPUT", "CONTENT_BLOCKED",
    "CONFIGURATION_ERROR", "PREFLIGHT_REQUIRED", "PREFLIGHT_BLOCKED", "OUTPUT_PRIVACY_BLOCKED",
    "UNKNOWN_ERROR"
  ]);

  const USER_MESSAGES_CS = Object.freeze({
    AUTH_REQUIRED: "Pro použití školní AI služby se znovu přihlaste.",
    AUTH_EXPIRED: "Přihlášení ke školní AI službě vypršelo. Přihlaste se znovu.",
    ACCESS_DENIED: "K této AI operaci nemáte oprávnění.",
    API_KEY_MISSING: "Nejprve zadejte svůj Gemini API klíč.",
    API_KEY_INVALID: "Gemini API klíč není platný nebo nemá potřebné oprávnění.",
    RATE_LIMITED: "AI služba je dočasně vytížená. Počkejte a požadavek zopakujte.",
    BUDGET_EXCEEDED: "Rozpočtový limit AI služby byl vyčerpán.",
    QUOTA_EXCEEDED: "Kvóta AI služby byla vyčerpána. Počkejte a požadavek zopakujte.",
    PAYLOAD_TOO_LARGE: "Vstup je pro AI službu příliš velký. Zkraťte text nebo odeberte část příloh.",
    UNREGISTERED_OPERATION: "Tato AI operace není v aplikaci povolena.",
    UNSUPPORTED_SCHEMA: "Aplikace požaduje nepodporovaný formát odpovědi.",
    FEATURE_UNSUPPORTED: "Požadovaná funkce není v tomto režimu AI služby dostupná.",
    REQUEST_IN_PROGRESS: "Stejný požadavek se už zpracovává.",
    IDEMPOTENCY_CONFLICT: "Požadavek se stejným identifikátorem má jiný obsah. Spusťte novou akci.",
    SERVER_UNAVAILABLE: "Školní AI služba je dočasně nedostupná. Vstup zůstal zachovaný.",
    PROVIDER_UNAVAILABLE: "AI model je dočasně nedostupný. Zkuste požadavek později.",
    NETWORK_ERROR: "Nepodařilo se připojit k AI službě. Zkontrolujte připojení a zkuste to znovu.",
    TIMEOUT: "AI služba neodpověděla včas. Vstup zůstal zachovaný.",
    REQUEST_CANCELLED: "Požadavek byl zrušen.",
    INVALID_REQUEST: "AI služba odmítla neplatný požadavek.",
    INVALID_OUTPUT: "AI služba nevrátila použitelný výstup. Zkuste požadavek zopakovat.",
    CONTENT_BLOCKED: "AI služba tento obsah z bezpečnostních důvodů nezpracovala.",
    CONFIGURATION_ERROR: "Připojení k AI službě není správně nastavené. Informujte správce.",
    PREFLIGHT_REQUIRED: "Před odesláním je nutná bezpečnostní kontrola vstupu.",
    PREFLIGHT_BLOCKED: "Odeslání zastavila bezpečnostní kontrola. Zkontrolujte anonymizaci.",
    OUTPUT_PRIVACY_BLOCKED: "Výstup byl zablokován, protože mohl obsahovat nechráněný osobní údaj.",
    UNKNOWN_ERROR: "AI požadavek se nepodařilo dokončit. Zkuste to znovu."
  });

  const DEFAULT_RUNTIME = Object.freeze({
    schema: RUNTIME_SCHEMA,
    ai: Object.freeze({
      defaultMode: "direct-gemini",
      allowedModes: Object.freeze(["direct-gemini"]),
      allowUserModeSelection: false,
      automaticFallback: false,
      gatewayUrl: "/api/v1/ai/generate",
      healthUrl: "/api/v1/ai/health",
      requestTimeoutMs: 45000,
      gatewayMaxRetries: 0,
      maxRequestBytes: 10 * 1024 * 1024,
      maxPartBytes: 8 * 1024 * 1024,
      directGemini: Object.freeze({
        endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
        profileModels: Object.freeze({
          economy: "gemini-3.5-flash-lite",
          balanced: "gemini-3.6-flash",
          quality: "gemini-3.6-flash"
        }),
        fallbackModels: Object.freeze(["gemini-3.5-flash-lite"]),
        useResponseSchema: false,
        maxOutputTokens: 32768
      })
    }),
    telemetry: Object.freeze({ enabled: true })
  });

  let state = null;
  let lastUsage = null;

  function now() { return Date.now(); }
  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function finiteInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  function positiveInt(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  function bool(value, fallback) { return typeof value === "boolean" ? value : fallback; }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      const out = {};
      for (const [key, item] of Object.entries(value)) out[key] = clone(item);
      return out;
    }
    return value;
  }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
    return value;
  }
  function uuid(prefix) {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    } catch (_) {}
    return (prefix || "id") + "-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }
  function textEncoder() {
    if (typeof global.TextEncoder === "function") return new global.TextEncoder();
    if (typeof TextEncoder === "function") return new TextEncoder();
    return null;
  }
  function byteLength(text) {
    const value = String(text || "");
    const encoder = textEncoder();
    if (encoder) return encoder.encode(value).byteLength;
    return unescape(encodeURIComponent(value)).length;
  }
  function base64Bytes(data) {
    const clean = String(data || "").replace(/\s+/g, "");
    return Math.floor(clean.length * 3 / 4);
  }
  function safeUrl(value, fallback) {
    const raw = String(value || fallback || "").trim();
    try {
      const base = global.location && global.location.href ? global.location.href : "https://invalid.local/";
      const parsed = new URL(raw, base);
      if (!/^https?:$/.test(parsed.protocol)) return fallback;
      if (raw.startsWith("/")) return parsed.pathname + parsed.search + parsed.hash;
      if (raw.startsWith("./") || raw.startsWith("../")) return raw;
      return parsed.href;
    } catch (_) { return fallback; }
  }
  function majorSchema(schema, expectedPrefix) {
    return typeof schema === "string" && schema === expectedPrefix + "-v1";
  }

  function createError(code, extra, internalMessage) {
    const normalized = ERROR_CODES.includes(code) ? code : "UNKNOWN_ERROR";
    const error = new Error(internalMessage || USER_MESSAGES_CS[normalized] || USER_MESSAGES_CS.UNKNOWN_ERROR);
    error.name = "GhrabAiError";
    error.code = normalized;
    error.retryable = !!(extra && extra.retryable);
    error.retryAfterMs = positiveInt(extra && extra.retryAfterMs) || 0;
    error.budgetResetAt = extra && extra.budgetResetAt ? String(extra.budgetResetAt) : null;
    error.diagnosticId = extra && extra.diagnosticId ? String(extra.diagnosticId) : "";
    error.details = isObject(extra && extra.details) ? clone(extra.details) : {};
    error.status = positiveInt(extra && extra.status);
    error.clientRequestId = extra && extra.clientRequestId ? String(extra.clientRequestId) : "";
    error.attemptId = extra && extra.attemptId ? String(extra.attemptId) : "";
    error.requestId = extra && extra.requestId ? String(extra.requestId) : "";
    error.providerRequests = positiveInt(extra && extra.providerRequests);
    error.retryRequests = positiveInt(extra && extra.retryRequests);
    if (extra && extra.cause) error.cause = extra.cause;
    return error;
  }

  function normalizeError(raw, context) {
    if (raw && ERROR_CODES.includes(raw.code)) {
      if (context) {
        if (!raw.clientRequestId) raw.clientRequestId = context.clientRequestId || "";
        if (!raw.attemptId) raw.attemptId = context.attemptId || "";
      }
      return raw;
    }
    const status = positiveInt(raw && raw.status);
    let code = "UNKNOWN_ERROR";
    if (raw && raw.name === "AbortError") code = "REQUEST_CANCELLED";
    else if (status === 400) code = "INVALID_REQUEST";
    else if (status === 401) code = "AUTH_REQUIRED";
    else if (status === 403) code = "ACCESS_DENIED";
    else if (status === 408) code = "TIMEOUT";
    else if (status === 409) code = "REQUEST_IN_PROGRESS";
    else if (status === 413) code = "PAYLOAD_TOO_LARGE";
    else if (status === 422) code = "INVALID_OUTPUT";
    else if (status === 429) code = "RATE_LIMITED";
    else if (status === 502) code = "PROVIDER_UNAVAILABLE";
    else if (status === 503) code = "SERVER_UNAVAILABLE";
    else if (status === 504) code = "TIMEOUT";
    return createError(code, {
      status,
      cause: raw,
      clientRequestId: context && context.clientRequestId,
      attemptId: context && context.attemptId
    });
  }

  function formatUserError(raw, locale) {
    const error = normalizeError(raw);
    const lang = String(locale || "cs").toLowerCase();
    let message = USER_MESSAGES_CS[error.code] || USER_MESSAGES_CS.UNKNOWN_ERROR;
    if (!lang.startsWith("cs")) message = USER_MESSAGES_CS[error.code] || USER_MESSAGES_CS.UNKNOWN_ERROR;
    if (error.retryAfterMs && ["RATE_LIMITED", "SERVER_UNAVAILABLE", "PROVIDER_UNAVAILABLE"].includes(error.code)) {
      const seconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
      message += " Doporučené čekání: " + seconds + " s.";
    }
    if (error.budgetResetAt && ["BUDGET_EXCEEDED", "QUOTA_EXCEEDED"].includes(error.code)) {
      try {
        const date = new Date(error.budgetResetAt);
        if (!Number.isNaN(date.getTime())) message += " Limit se obnoví " + date.toLocaleString("cs-CZ") + ".";
      } catch (_) {}
    }
    return message;
  }

  function normalizeRuntime(raw) {
    raw = isObject(raw) ? raw : {};
    const ai = isObject(raw.ai) ? raw.ai : {};
    const telemetry = isObject(raw.telemetry) ? raw.telemetry : {};
    const directRaw = isObject(ai.directGemini) ? ai.directGemini : {};
    const defaultMode = MODES.includes(ai.defaultMode) ? ai.defaultMode : DEFAULT_RUNTIME.ai.defaultMode;
    let allowedModes = Array.isArray(ai.allowedModes) ? ai.allowedModes.filter(mode => MODES.includes(mode)) : [...DEFAULT_RUNTIME.ai.allowedModes];
    allowedModes = [...new Set(allowedModes)];
    if (!allowedModes.length) allowedModes = [defaultMode];
    if (!allowedModes.includes(defaultMode)) allowedModes.unshift(defaultMode);
    const selected = MODES.includes(ai.selectedMode) && allowedModes.includes(ai.selectedMode) ? ai.selectedMode : defaultMode;
    const profileModels = {};
    const rawModels = isObject(directRaw.profileModels) ? directRaw.profileModels : DEFAULT_RUNTIME.ai.directGemini.profileModels;
    for (const profile of MODEL_PROFILES) {
      const value = String(rawModels[profile] || DEFAULT_RUNTIME.ai.directGemini.profileModels[profile] || "").trim();
      if (value) profileModels[profile] = value;
    }
    const fallbackModels = Array.isArray(directRaw.fallbackModels)
      ? directRaw.fallbackModels.map(item => String(item || "").trim()).filter(Boolean)
      : [...DEFAULT_RUNTIME.ai.directGemini.fallbackModels];
    return deepFreeze({
      schema: RUNTIME_SCHEMA,
      ai: {
        defaultMode,
        selectedMode: selected,
        allowedModes,
        allowUserModeSelection: bool(ai.allowUserModeSelection, DEFAULT_RUNTIME.ai.allowUserModeSelection),
        automaticFallback: false,
        gatewayUrl: safeUrl(ai.gatewayUrl, DEFAULT_RUNTIME.ai.gatewayUrl),
        healthUrl: safeUrl(ai.healthUrl, DEFAULT_RUNTIME.ai.healthUrl),
        requestTimeoutMs: finiteInt(ai.requestTimeoutMs, DEFAULT_RUNTIME.ai.requestTimeoutMs, 5000, 180000),
        gatewayMaxRetries: finiteInt(ai.gatewayMaxRetries, DEFAULT_RUNTIME.ai.gatewayMaxRetries, 0, 2),
        maxRequestBytes: finiteInt(ai.maxRequestBytes, DEFAULT_RUNTIME.ai.maxRequestBytes, 1024, 50 * 1024 * 1024),
        maxPartBytes: finiteInt(ai.maxPartBytes, DEFAULT_RUNTIME.ai.maxPartBytes, 1024, 25 * 1024 * 1024),
        directGemini: {
          endpointBase: safeUrl(directRaw.endpointBase, DEFAULT_RUNTIME.ai.directGemini.endpointBase),
          profileModels,
          fallbackModels,
          useResponseSchema: bool(directRaw.useResponseSchema, DEFAULT_RUNTIME.ai.directGemini.useResponseSchema),
          maxOutputTokens: finiteInt(directRaw.maxOutputTokens, DEFAULT_RUNTIME.ai.directGemini.maxOutputTokens, 256, 65536)
        }
      },
      telemetry: { enabled: bool(telemetry.enabled, DEFAULT_RUNTIME.telemetry.enabled) }
    });
  }

  function normalizeOperations(raw, appId) {
    if (!isObject(raw) || raw.schema !== OPERATION_SCHEMA || String(raw.appId || "") !== appId || !isObject(raw.operations)) {
      throw createError("CONFIGURATION_ERROR", {}, "Neplatny manifest AI operaci.");
    }
    const operations = new Map();
    for (const [name, value] of Object.entries(raw.operations)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !isObject(value)) {
        throw createError("CONFIGURATION_ERROR", {}, "Neplatna AI operace: " + name);
      }
      const outputSchemaId = String(value.outputSchemaId || "").trim();
      const defaultModelProfile = MODEL_PROFILES.includes(value.defaultModelProfile) ? value.defaultModelProfile : "balanced";
      let allowedModelProfiles = Array.isArray(value.allowedModelProfiles)
        ? value.allowedModelProfiles.filter(item => MODEL_PROFILES.includes(item))
        : [defaultModelProfile];
      allowedModelProfiles = [...new Set(allowedModelProfiles)];
      if (!allowedModelProfiles.includes(defaultModelProfile)) allowedModelProfiles.unshift(defaultModelProfile);
      const inputTypes = Array.isArray(value.inputTypes) ? value.inputTypes.filter(item => ["text", "image", "document"].includes(item)) : ["text"];
      operations.set(name, deepFreeze({
        outputSchemaId,
        defaultModelProfile,
        allowedModelProfiles,
        inputTypes: inputTypes.length ? [...new Set(inputTypes)] : ["text"],
        streaming: !!value.streaming,
        requiredCapabilities: Array.isArray(value.requiredCapabilities) ? value.requiredCapabilities.map(String) : [],
        expectedOutputs: finiteInt(value.expectedOutputs, 1, 0, 1000),
        maxOutputTokensHint: finiteInt(value.maxOutputTokensHint, 8192, 256, 65536)
      }));
    }
    return operations;
  }

  function normalizeSchemas(raw) {
    if (!isObject(raw)) throw createError("CONFIGURATION_ERROR", {}, "Chybi registr vystupnich schemat.");
    const schemas = new Map();
    for (const [id, schema] of Object.entries(raw)) {
      if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/.test(id) || !isObject(schema)) {
        throw createError("CONFIGURATION_ERROR", {}, "Neplatne vystupni schema: " + id);
      }
      schemas.set(id, deepFreeze(clone(schema)));
    }
    return schemas;
  }

  function dispatchRuntimeChanged() {
    try {
      global.dispatchEvent(new CustomEvent("ghrab:runtime-config-changed", { detail: { state: getState() } }));
    } catch (_) {}
  }

  function configure(appConfiguration) {
    if (!isObject(appConfiguration) || !isObject(appConfiguration.app)) {
      throw createError("CONFIGURATION_ERROR", {}, "Chybi konfigurace aplikace.");
    }
    const app = {
      id: String(appConfiguration.app.id || "").trim(),
      version: String(appConfiguration.app.version || "0.0.0").trim()
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.id)) throw createError("CONFIGURATION_ERROR", {}, "Neplatne appId.");
    const runtime = normalizeRuntime(appConfiguration.runtimeConfig);
    const operations = normalizeOperations(appConfiguration.operations, app.id);
    const outputSchemas = normalizeSchemas(appConfiguration.outputSchemas);
    for (const [name, operation] of operations.entries()) {
      if (!operation.outputSchemaId || !outputSchemas.has(operation.outputSchemaId)) {
        throw createError("CONFIGURATION_ERROR", {}, "Operace " + name + " odkazuje na nezname schema.");
      }
    }
    state = {
      app: deepFreeze(app),
      runtime,
      activeMode: runtime.ai.selectedMode,
      operations,
      outputSchemas,
      credentialProvider: typeof appConfiguration.credentialProvider === "function" ? appConfiguration.credentialProvider : async () => null,
      authProvider: typeof appConfiguration.authProvider === "function" ? appConfiguration.authProvider : async () => null,
      telemetrySink: typeof appConfiguration.telemetrySink === "function" ? appConfiguration.telemetrySink : null,
      providerEventSink: typeof appConfiguration.providerEventSink === "function" ? appConfiguration.providerEventSink : null,
      testHooks: isObject(appConfiguration.testHooks) ? appConfiguration.testHooks : {},
      configuredAt: now()
    };
    lastUsage = null;
    dispatchRuntimeChanged();
    return getState();
  }

  function requireState() {
    if (!state) throw createError("CONFIGURATION_ERROR", {}, "GHRAB AI Core neni nakonfigurovan.");
    return state;
  }

  function setMode(mode) {
    const current = requireState();
    const selected = String(mode || "");
    if (!current.runtime.ai.allowedModes.includes(selected)) throw createError("CONFIGURATION_ERROR", {}, "Rezim neni povolen runtime konfiguraci.");
    if (!current.runtime.ai.allowUserModeSelection && selected !== current.runtime.ai.defaultMode) {
      throw createError("ACCESS_DENIED", {}, "Uzivatelska volba rezimu neni povolena.");
    }
    current.activeMode = selected;
    dispatchRuntimeChanged();
    return selected;
  }

  function getState() {
    if (!state) {
      return deepFreeze({
        configured: false,
        coreVersion: CORE_VERSION,
        contractVersion: CONTRACT_VERSION,
        buildId: BUILD_ID,
        modes: [...MODES],
        modelProfiles: [...MODEL_PROFILES]
      });
    }
    return deepFreeze({
      configured: true,
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION,
      buildId: BUILD_ID,
      app: clone(state.app),
      runtimeConfig: clone(state.runtime),
      activeMode: state.activeMode,
      allowedModes: [...state.runtime.ai.allowedModes],
      transports: [...MODES],
      modelProfiles: [...MODEL_PROFILES],
      operations: [...state.operations.keys()]
    });
  }

  function normalizeInputParts(input, operation, runtime) {
    const source = Array.isArray(input.inputParts)
      ? input.inputParts
      : isObject(input.input) && Array.isArray(input.input.parts) ? input.input.parts : null;
    if (!source || !source.length) throw createError("INVALID_REQUEST", {}, "Chybi input.parts.");
    const parts = [];
    let total = 0;
    for (const raw of source) {
      if (!isObject(raw) || !operation.inputTypes.includes(raw.type)) throw createError("FEATURE_UNSUPPORTED", {}, "Nepovoleny typ vstupu.");
      if (raw.type === "text") {
        const text = String(raw.text || "");
        const size = byteLength(text);
        if (size > runtime.ai.maxPartBytes) throw createError("PAYLOAD_TOO_LARGE");
        total += size;
        parts.push({ type: "text", text });
        continue;
      }
      const mimeType = String(raw.mimeType || "").trim();
      const name = raw.name ? String(raw.name) : undefined;
      const sourceInfo = isObject(raw.source) ? raw.source : {};
      if (!mimeType || !["inline-base64", "gateway-asset"].includes(sourceInfo.kind)) throw createError("INVALID_REQUEST");
      if (sourceInfo.kind === "inline-base64") {
        const data = String(sourceInfo.data || "");
        const size = base64Bytes(data);
        if (!data || size > runtime.ai.maxPartBytes) throw createError("PAYLOAD_TOO_LARGE");
        total += size;
        parts.push({ type: raw.type, mimeType, name, source: { kind: "inline-base64", data } });
      } else {
        const assetId = String(sourceInfo.assetId || "").trim();
        if (!assetId) throw createError("INVALID_REQUEST");
        total += byteLength(assetId);
        parts.push({ type: raw.type, mimeType, name, source: { kind: "gateway-asset", assetId } });
      }
    }
    if (total > runtime.ai.maxRequestBytes) throw createError("PAYLOAD_TOO_LARGE");
    return parts;
  }

  function validateRequest(input, streaming) {
    const current = requireState();
    if (!isObject(input)) throw createError("INVALID_REQUEST");
    const operationName = String(input.operation || "").trim();
    const operation = current.operations.get(operationName);
    if (!operation) throw createError("UNREGISTERED_OPERATION");
    if (!!streaming !== !!operation.streaming) {
      if (streaming) throw createError("FEATURE_UNSUPPORTED", {}, "Operace neni registrovana jako streamovaci.");
      if (operation.streaming) throw createError("FEATURE_UNSUPPORTED", {}, "Streamovaci operace musi pouzit stream().");
    }
    const modelProfile = input.modelProfile || operation.defaultModelProfile;
    if (!operation.allowedModelProfiles.includes(modelProfile)) throw createError("INVALID_REQUEST", {}, "Modelovy profil neni pro operaci povolen.");
    const schemaId = String(input.outputSchemaId || (isObject(input.output) && input.output.schemaId) || operation.outputSchemaId || "");
    if (schemaId !== operation.outputSchemaId || !current.outputSchemas.has(schemaId)) throw createError("UNSUPPORTED_SCHEMA");
    const inputParts = normalizeInputParts(input, operation, current.runtime);
    const optionsRaw = isObject(input.options) ? input.options : {};
    const clientRequestId = String(input.clientRequestId || uuid("req"));
    const attemptId = uuid("attempt");
    const locale = String((isObject(input.client) && input.client.locale) || (global.document && global.document.documentElement.lang) || "cs-CZ");
    return {
      schema: REQUEST_SCHEMA,
      clientRequestId,
      attemptId,
      workflowId: input.workflowId ? String(input.workflowId) : "",
      appId: current.app.id,
      appVersion: current.app.version,
      operation: operationName,
      operationDefinition: operation,
      modelProfile,
      instructions: String(input.instructions || ""),
      input: { parts: inputParts },
      output: { schemaId },
      options: {
        stream: !!streaming,
        reasoningHint: String(optionsRaw.reasoningHint || "medium"),
        maxOutputTokensHint: finiteInt(optionsRaw.maxOutputTokensHint, operation.maxOutputTokensHint, 1, operation.maxOutputTokensHint)
      },
      privacy: {
        clientAnonymized: !!(isObject(input.privacy) && input.privacy.clientAnonymized),
        preflightPassed: !!(isObject(input.privacy) && input.privacy.preflightPassed)
      },
      client: { locale, coreVersion: CORE_VERSION },
      usageContext: {
        userActions: finiteInt(isObject(input.usageContext) && input.usageContext.userActions, 1, 0, 1000),
        expectedOutputs: finiteInt(isObject(input.usageContext) && input.usageContext.expectedOutputs, operation.expectedOutputs, 0, 1000)
      },
      localContext: isObject(input.localContext) ? input.localContext : {},
      signal: input.signal || null
    };
  }

  function publicRequest(request, attemptId) {
    return {
      schema: REQUEST_SCHEMA,
      clientRequestId: request.clientRequestId,
      attemptId: attemptId || request.attemptId,
      workflowId: request.workflowId || undefined,
      appId: request.appId,
      appVersion: request.appVersion,
      operation: request.operation,
      modelProfile: request.modelProfile,
      instructions: request.instructions,
      input: clone(request.input),
      output: clone(request.output),
      options: clone(request.options),
      privacy: clone(request.privacy),
      client: clone(request.client)
    };
  }

  function parseJsonText(text) {
    let source = String(text || "").trim();
    source = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try { return JSON.parse(source); } catch (_) {}
    const objectStart = source.indexOf("{");
    const objectEnd = source.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try { return JSON.parse(source.slice(objectStart, objectEnd + 1)); } catch (_) {}
    }
    const arrayStart = source.indexOf("[");
    const arrayEnd = source.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try { return JSON.parse(source.slice(arrayStart, arrayEnd + 1)); } catch (_) {}
    }
    throw createError("INVALID_OUTPUT");
  }

  function schemaTypeOk(value, type) {
    if (type === "object") return isObject(value);
    if (type === "array") return Array.isArray(value);
    if (type === "string") return typeof value === "string";
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "boolean") return typeof value === "boolean";
    if (type === "null") return value === null;
    return true;
  }

  function validateSchema(value, schema, path) {
    const where = path || "$";
    if (!isObject(schema)) return;
    if (schema.type && !schemaTypeOk(value, schema.type)) throw createError("INVALID_OUTPUT", { details: { path: where } });
    if (Array.isArray(schema.enum) && !schema.enum.some(item => Object.is(item, value))) throw createError("INVALID_OUTPUT", { details: { path: where } });
    if (schema.type === "object" && isObject(value)) {
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) throw createError("INVALID_OUTPUT", { details: { path: where + "." + key } });
      if (isObject(schema.properties)) {
        for (const [key, childSchema] of Object.entries(schema.properties)) {
          if (Object.prototype.hasOwnProperty.call(value, key)) validateSchema(value[key], childSchema, where + "." + key);
        }
      }
    }
    if (schema.type === "array" && Array.isArray(value) && schema.items) {
      value.forEach((item, index) => validateSchema(item, schema.items, where + "[" + index + "]"));
    }
  }

  function normalizeUsage(raw) {
    raw = isObject(raw) ? raw : {};
    const inputTokens = positiveInt(raw.inputTokens);
    const outputTokens = positiveInt(raw.outputTokens);
    return {
      providerRequests: positiveInt(raw.providerRequests),
      retryRequests: positiveInt(raw.retryRequests),
      inputTokens,
      outputTokens,
      totalTokens: positiveInt(raw.totalTokens) || inputTokens + outputTokens,
      generatedOutputs: positiveInt(raw.generatedOutputs)
    };
  }

  function normalizeSuccess(raw, request, started, mode) {
    if (!isObject(raw) || (raw.schema && raw.schema !== RESPONSE_SCHEMA)) throw createError("INVALID_OUTPUT", { clientRequestId: request.clientRequestId });
    let result = Object.prototype.hasOwnProperty.call(raw, "result") ? raw.result : raw;
    const schema = state.outputSchemas.get(request.output.schemaId);
    validateSchema(result, schema);
    if (typeof request.localContext.validateResult === "function") result = request.localContext.validateResult(result);
    const usage = normalizeUsage(raw.usage);
    if (!usage.generatedOutputs) usage.generatedOutputs = request.usageContext.expectedOutputs;
    return {
      schema: RESPONSE_SCHEMA,
      requestId: String(raw.requestId || ""),
      clientRequestId: request.clientRequestId,
      result,
      usage,
      meta: {
        modelProfile: request.modelProfile,
        latencyMs: positiveInt(raw.meta && raw.meta.latencyMs) || Math.max(0, now() - started),
        cached: !!(raw.meta && raw.meta.cached),
        transport: mode
      }
    };
  }

  function publishUsage(request, response, error, started, mode) {
    if (!state || !state.runtime.telemetry.enabled) return;
    const usage = response ? response.usage : normalizeUsage(error || {});
    const event = deepFreeze({
      schema: USAGE_SCHEMA,
      appId: request.appId,
      appVersion: request.appVersion,
      operation: request.operation,
      workflowId: request.workflowId || "",
      clientRequestId: request.clientRequestId,
      requestId: response ? response.requestId : (error && error.requestId) || "",
      modelProfile: request.modelProfile,
      mode,
      userActions: request.usageContext.userActions,
      generatedOutputs: response ? usage.generatedOutputs : 0,
      providerRequests: usage.providerRequests,
      retryRequests: usage.retryRequests,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      latencyMs: response ? response.meta.latencyMs : Math.max(0, now() - started),
      success: !!response,
      errorCode: response ? "" : String(error && error.code || "UNKNOWN_ERROR")
    });
    lastUsage = event;
    try { if (state.telemetrySink) state.telemetrySink(event); } catch (_) {}
    try { global.dispatchEvent(new CustomEvent("ghrab:ai-usage", { detail: event })); } catch (_) {}
  }

  function providerEvent(type, detail) {
    try { if (state && state.providerEventSink) state.providerEventSink({ type, ...clone(detail || {}) }); } catch (_) {}
  }

  function isTestEnabled() {
    try { return !!(state && state.testHooks && typeof state.testHooks.isEnabled === "function" && state.testHooks.isEnabled()); }
    catch (_) { return false; }
  }

  function mapGeminiPart(part) {
    if (part.type === "text") return { text: part.text };
    if (part.source.kind !== "inline-base64") throw createError("FEATURE_UNSUPPORTED");
    return { inlineData: { mimeType: part.mimeType, data: part.source.data } };
  }

  async function fetchWithTimeout(url, options, timeoutMs, externalSignal) {
    const controller = new AbortController();
    let reason = "";
    const timer = setTimeout(() => { reason = "timeout"; controller.abort(); }, timeoutMs);
    const cancel = () => { reason = "cancelled"; controller.abort(); };
    if (externalSignal && typeof externalSignal.addEventListener === "function") externalSignal.addEventListener("abort", cancel, { once: true });
    try {
      return await global.fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw createError(reason === "timeout" ? "TIMEOUT" : "REQUEST_CANCELLED", { cause: error });
      throw createError("NETWORK_ERROR", { cause: error });
    } finally {
      clearTimeout(timer);
      if (externalSignal && typeof externalSignal.removeEventListener === "function") externalSignal.removeEventListener("abort", cancel);
    }
  }

  async function directGemini(request) {
    const credentials = await state.credentialProvider({ mode: "direct-gemini", operation: request.operation, modelProfile: request.modelProfile });
    const apiKey = String(credentials && credentials.apiKey || "").replace(/[^\x21-\x7E]/g, "");
    if (!apiKey && !(isTestEnabled() && typeof state.testHooks.directGemini === "function")) throw createError("API_KEY_MISSING", { clientRequestId: request.clientRequestId });
    const runtime = state.runtime.ai.directGemini;
    const schema = state.outputSchemas.get(request.output.schemaId);
    if (isTestEnabled() && typeof state.testHooks.directGemini === "function") {
      const mocked = await state.testHooks.directGemini({
        request: publicRequest(request),
        prompt: request.input.parts.filter(p => p.type === "text").map(p => p.text).join("\n"),
        system: request.instructions,
        schemaId: request.output.schemaId,
        reasoningHint: request.options.reasoningHint,
        operation: request.operation,
        modelProfile: request.modelProfile
      });
      return {
        schema: RESPONSE_SCHEMA,
        requestId: "mock-direct",
        result: typeof mocked === "string" ? parseJsonText(mocked) : mocked,
        usage: { providerRequests: 1, retryRequests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, generatedOutputs: request.usageContext.expectedOutputs },
        meta: { latencyMs: 0 }
      };
    }
    const override = String(credentials && credentials.modelOverride || "").trim();
    const firstModel = override || runtime.profileModels[request.modelProfile];
    const models = [firstModel, ...runtime.fallbackModels.filter(model => model && model !== firstModel)];
    let providerRequests = 0;
    let lastUsageData = {};
    let lastError = null;
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      let thinkingEnabled = !!request.options.reasoningHint;
      for (let thinkingAttempt = 0; thinkingAttempt < 2; thinkingAttempt++) {
        providerRequests++;
        const started = now();
        providerEvent(providerRequests === 1 ? "start" : "retry", {
          transport: "direct-gemini", operation: request.operation, modelProfile: request.modelProfile,
          model, attempt: providerRequests, clientRequestId: request.clientRequestId
        });
        const generationConfig = {
          maxOutputTokens: Math.min(request.options.maxOutputTokensHint, runtime.maxOutputTokens),
          responseMimeType: "application/json"
        };
        if (runtime.useResponseSchema) generationConfig.responseSchema = schema;
        if (thinkingEnabled) generationConfig.thinkingConfig = { thinkingLevel: request.options.reasoningHint };
        const body = {
          contents: [{ role: "user", parts: request.input.parts.map(mapGeminiPart) }],
          systemInstruction: { parts: [{ text: request.instructions }] },
          generationConfig
        };
        let response;
        let data;
        try {
          const url = runtime.endpointBase.replace(/\/$/, "") + "/" + encodeURIComponent(model) + ":generateContent";
          response = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            cache: "no-store"
          }, state.runtime.ai.requestTimeoutMs, request.signal);
          data = await response.json().catch(() => ({}));
        } catch (raw) {
          const error = normalizeError(raw, request);
          error.providerRequests = providerRequests;
          error.retryRequests = Math.max(0, providerRequests - 1);
          lastError = error;
          if (!["NETWORK_ERROR", "TIMEOUT", "PROVIDER_UNAVAILABLE"].includes(error.code)) throw error;
          break;
        }
        if (!response.ok) {
          const status = response.status;
          const providerStatus = String(data && data.error && data.error.status || "");
          const providerMessage = String(data && data.error && data.error.message || "");
          const thinkingRejected = thinkingEnabled && status === 400 && /thinking/i.test(providerMessage);
          if (thinkingRejected) {
            thinkingEnabled = false;
            continue;
          }
          let code = "INVALID_REQUEST";
          if (status === 401 || status === 403) code = "API_KEY_INVALID";
          else if (status === 429 || /RESOURCE_EXHAUSTED/i.test(providerStatus)) code = "QUOTA_EXCEEDED";
          else if (status >= 500 || status === 404) code = "PROVIDER_UNAVAILABLE";
          const error = createError(code, {
            status,
            providerRequests,
            retryRequests: Math.max(0, providerRequests - 1),
            clientRequestId: request.clientRequestId
          });
          lastError = error;
          if (["QUOTA_EXCEEDED", "PROVIDER_UNAVAILABLE"].includes(code)) break;
          throw error;
        }
        const candidate = data.candidates && data.candidates[0];
        const blockReason = data.promptFeedback && data.promptFeedback.blockReason;
        const finishReason = candidate && candidate.finishReason;
        if (blockReason) throw createError("CONTENT_BLOCKED", { providerRequests, retryRequests: Math.max(0, providerRequests - 1), clientRequestId: request.clientRequestId });
        if (finishReason && finishReason !== "STOP") {
          throw createError(finishReason === "MAX_TOKENS" ? "INVALID_OUTPUT" : "CONTENT_BLOCKED", {
            providerRequests, retryRequests: Math.max(0, providerRequests - 1), clientRequestId: request.clientRequestId,
            details: { finishReason }
          });
        }
        const text = (((candidate && candidate.content && candidate.content.parts) || []).map(part => part.text || "").join("")).trim();
        const usage = data.usageMetadata || {};
        lastUsageData = {
          providerRequests,
          retryRequests: Math.max(0, providerRequests - 1),
          inputTokens: positiveInt(usage.promptTokenCount),
          outputTokens: positiveInt(usage.candidatesTokenCount),
          totalTokens: positiveInt(usage.totalTokenCount),
          generatedOutputs: request.usageContext.expectedOutputs
        };
        providerEvent("success", {
          transport: "direct-gemini", operation: request.operation, modelProfile: request.modelProfile,
          model, attempt: providerRequests, latencyMs: now() - started, clientRequestId: request.clientRequestId,
          inputTokens: lastUsageData.inputTokens, outputTokens: lastUsageData.outputTokens
        });
        return {
          schema: RESPONSE_SCHEMA,
          requestId: String(data.responseId || ""),
          result: parseJsonText(text),
          usage: lastUsageData,
          meta: { latencyMs: 0 }
        };
      }
    }
    if (lastError) throw lastError;
    throw createError("PROVIDER_UNAVAILABLE", { providerRequests, retryRequests: Math.max(0, providerRequests - 1), clientRequestId: request.clientRequestId });
  }

  function gatewayErrorCode(status, payload) {
    const provided = payload && payload.error && payload.error.code;
    if (ERROR_CODES.includes(provided)) return provided;
    if (status === 400) return "INVALID_REQUEST";
    if (status === 401) return "AUTH_REQUIRED";
    if (status === 403) return "ACCESS_DENIED";
    if (status === 409) return "REQUEST_IN_PROGRESS";
    if (status === 413) return "PAYLOAD_TOO_LARGE";
    if (status === 422) return "INVALID_OUTPUT";
    if (status === 429) return "RATE_LIMITED";
    if (status === 502) return "PROVIDER_UNAVAILABLE";
    if (status === 503) return "SERVER_UNAVAILABLE";
    if (status === 504) return "TIMEOUT";
    return status >= 500 ? "SERVER_UNAVAILABLE" : "INVALID_REQUEST";
  }

  async function authHeaders() {
    let context = null;
    try { context = await state.authProvider({ mode: "school-gateway", app: clone(state.app) }); } catch (_) {}
    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (context && context.token) headers.Authorization = "Bearer " + String(context.token);
    return headers;
  }

  function errorFromGateway(status, payload, request, attemptId) {
    const raw = isObject(payload && payload.error) ? payload.error : {};
    return createError(gatewayErrorCode(status, payload), {
      status,
      retryable: !!raw.retryable,
      retryAfterMs: raw.retryAfterMs,
      budgetResetAt: raw.budgetResetAt,
      diagnosticId: raw.diagnosticId,
      details: isObject(raw.details) ? raw.details : {},
      requestId: payload && payload.requestId,
      clientRequestId: request.clientRequestId,
      attemptId,
      providerRequests: payload && payload.usage && payload.usage.providerRequests,
      retryRequests: payload && payload.usage && payload.usage.retryRequests
    });
  }

  async function schoolGateway(request) {
    if (isTestEnabled() && typeof state.testHooks.schoolGateway === "function") {
      const payload = publicRequest(request);
      const raw = await state.testHooks.schoolGateway(payload);
      return raw;
    }
    const maxAttempts = 1 + state.runtime.ai.gatewayMaxRetries;
    let lastError = null;
    for (let index = 0; index < maxAttempts; index++) {
      const attemptId = index === 0 ? request.attemptId : uuid("attempt");
      const payload = publicRequest(request, attemptId);
      let response;
      let data;
      try {
        response = await fetchWithTimeout(state.runtime.ai.gatewayUrl, {
          method: "POST",
          headers: await authHeaders(),
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(payload)
        }, state.runtime.ai.requestTimeoutMs, request.signal);
        data = await response.json().catch(() => null);
      } catch (raw) {
        const error = normalizeError(raw, { clientRequestId: request.clientRequestId, attemptId });
        lastError = error;
        if (index + 1 < maxAttempts && ["NETWORK_ERROR", "TIMEOUT", "SERVER_UNAVAILABLE", "PROVIDER_UNAVAILABLE"].includes(error.code)) continue;
        throw error;
      }
      if (!response.ok) {
        const error = errorFromGateway(response.status, data, request, attemptId);
        lastError = error;
        if (index + 1 < maxAttempts && error.retryable && ["RATE_LIMITED", "SERVER_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "TIMEOUT"].includes(error.code)) continue;
        throw error;
      }
      if (!isObject(data) || data.schema !== RESPONSE_SCHEMA || String(data.clientRequestId || request.clientRequestId) !== request.clientRequestId) {
        throw createError("INVALID_OUTPUT", { status: response.status, clientRequestId: request.clientRequestId, attemptId });
      }
      return data;
    }
    throw lastError || createError("SERVER_UNAVAILABLE", { clientRequestId: request.clientRequestId });
  }

  async function generate(input) {
    const current = requireState();
    const request = validateRequest(input, false);
    const mode = current.activeMode;
    if (!current.runtime.ai.allowedModes.includes(mode)) throw createError("CONFIGURATION_ERROR");
    const started = now();
    try {
      const raw = mode === "direct-gemini" ? await directGemini(request) : await schoolGateway(request);
      const response = normalizeSuccess(raw, request, started, mode);
      publishUsage(request, response, null, started, mode);
      return response;
    } catch (raw) {
      const error = normalizeError(raw, request);
      publishUsage(request, null, error, started, mode);
      throw error;
    }
  }

  async function* parseSse(response, request) {
    if (!response.body || typeof response.body.getReader !== "function") throw createError("INVALID_OUTPUT", { clientRequestId: request.clientRequestId });
    const reader = response.body.getReader();
    const decoder = typeof TextDecoder === "function" ? new TextDecoder() : new global.TextDecoder();
    let buffer = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let eventType = "message";
        const dataLines = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let data;
        try { data = JSON.parse(dataLines.join("\n")); } catch (_) { throw createError("INVALID_OUTPUT"); }
        if (!data.clientRequestId) data.clientRequestId = request.clientRequestId;
        yield { type: eventType, ...data };
      }
    }
  }

  async function* stream(input) {
    const current = requireState();
    const request = validateRequest(input, true);
    if (current.activeMode !== "school-gateway") throw createError("FEATURE_UNSUPPORTED", { clientRequestId: request.clientRequestId });
    if (isTestEnabled() && typeof state.testHooks.schoolGatewayStream === "function") {
      const iterable = state.testHooks.schoolGatewayStream(publicRequest(request));
      for await (const event of iterable) yield event;
      return;
    }
    const attemptId = request.attemptId;
    let response;
    try {
      response = await fetchWithTimeout(state.runtime.ai.gatewayUrl, {
        method: "POST",
        headers: { ...(await authHeaders()), "Accept": "text/event-stream" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(publicRequest(request, attemptId))
      }, state.runtime.ai.requestTimeoutMs, request.signal);
    } catch (raw) { throw normalizeError(raw, request); }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw errorFromGateway(response.status, payload, request, attemptId);
    }
    for await (const event of parseSse(response, request)) yield event;
  }

  async function health(options) {
    const current = requireState();
    const mode = options && options.mode ? String(options.mode) : current.activeMode;
    if (mode === "direct-gemini") {
      return deepFreeze({
        schema: HEALTH_SCHEMA,
        status: "local",
        coreVersion: CORE_VERSION,
        supportedRequestSchemas: [REQUEST_SCHEMA],
        supportedResponseSchemas: [RESPONSE_SCHEMA],
        modelProfiles: [...MODEL_PROFILES],
        capabilities: { streaming: false, inputTypes: ["text", "image", "document"] },
        limits: { maxRequestBytes: current.runtime.ai.maxRequestBytes }
      });
    }
    if (isTestEnabled() && typeof state.testHooks.health === "function") return state.testHooks.health();
    let response;
    try {
      response = await fetchWithTimeout(current.runtime.ai.healthUrl, {
        method: "GET",
        headers: { ...(await authHeaders()), "Accept": "application/json" },
        credentials: "include",
        cache: "no-store"
      }, current.runtime.ai.requestTimeoutMs, options && options.signal);
    } catch (raw) { throw normalizeError(raw); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw errorFromGateway(response.status, data, { clientRequestId: "" }, "");
    if (!isObject(data) || data.schema !== HEALTH_SCHEMA) throw createError("INVALID_OUTPUT");
    return data;
  }

  function getLastUsage() { return lastUsage; }

  const testing = Object.freeze({
    snapshot: () => ({ state, lastUsage }),
    restore: snapshot => { state = snapshot && snapshot.state || null; lastUsage = snapshot && snapshot.lastUsage || null; dispatchRuntimeChanged(); },
    replaceRuntimeConfig: raw => {
      const current = requireState();
      current.runtime = normalizeRuntime(raw);
      current.activeMode = current.runtime.ai.selectedMode;
      dispatchRuntimeChanged();
      return getState();
    },
    setTestHooks: hooks => { requireState().testHooks = isObject(hooks) ? hooks : {}; },
    validateSchema,
    publicRequest: input => publicRequest(validateRequest(input, false))
  });

  const api = {
    coreVersion: CORE_VERSION,
    contractVersion: CONTRACT_VERSION,
    buildId: BUILD_ID,
    requestSchema: REQUEST_SCHEMA,
    responseSchema: RESPONSE_SCHEMA,
    errorSchema: ERROR_SCHEMA,
    healthSchema: HEALTH_SCHEMA,
    usageSchema: USAGE_SCHEMA,
    errorCodes: ERROR_CODES,
    modelProfiles: MODEL_PROFILES,
    modes: MODES,
    configure,
    setMode,
    generate,
    stream,
    health,
    getState,
    getLastUsage,
    formatUserError,
    createError,
    normalizeError,
    __testing: testing
  };

  Object.defineProperty(global, "GHRAB_AI", { value: Object.freeze(api), configurable: false, writable: false });
})(window);
