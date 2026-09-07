/* GHRAB AI Core Conformance Suite 1.0.0 */
(function (global) {
  "use strict";

  const SUITE_VERSION = "1.0.0";
  const EXPECTED_CORE_VERSION = "1.0.0";

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  async function expectCode(fn, code) {
    let caught = null;
    try { await fn(); } catch (error) { caught = error; }
    assert(caught && caught.code === code, "Expected " + code + ", got " + (caught && caught.code || "no error"));
    return caught;
  }

  async function run(options) {
    options = options || {};
    const core = global.GHRAB_AI;
    if (!core) throw new Error("GHRAB_AI is not loaded");
    const snapshot = core.__testing.snapshot();
    const results = [];
    const test = async (name, fn) => {
      const started = Date.now();
      try {
        await fn();
        results.push({ name, ok: true, ms: Date.now() - started });
      } catch (error) {
        results.push({ name, ok: false, ms: Date.now() - started, message: error && error.message || String(error) });
      }
    };

    let directCaptured = null;
    let gatewayCaptured = [];
    let gatewayResult = { text: "gateway" };
    let gatewayUsage = { providerRequests: 2, retryRequests: 1, inputTokens: 10, outputTokens: 4, totalTokens: 14, generatedOutputs: 1 };
    let gatewayFailure = null;
    const streamEvents = [
      { type: "start", clientRequestId: "stream-client" },
      { type: "delta", clientRequestId: "stream-client", text: "A" },
      { type: "result", clientRequestId: "stream-client", result: { text: "A" } },
      { type: "usage", clientRequestId: "stream-client", usage: { providerRequests: 1 } },
      { type: "done", clientRequestId: "stream-client" }
    ];

    try {
      global.__GHRAB_AI_CONFORMANCE_TEST__ = true;
      core.configure({
        app: { id: "core-conformance", version: SUITE_VERSION },
        runtimeConfig: {
          schema: "ghrab-runtime-config-v1",
          ai: {
            defaultMode: "direct-gemini",
            allowedModes: ["direct-gemini", "school-gateway"],
            allowUserModeSelection: true,
            automaticFallback: false,
            gatewayUrl: "/api/v1/ai/generate",
            healthUrl: "/api/v1/ai/health",
            requestTimeoutMs: 5000,
            gatewayMaxRetries: 0,
            directGemini: {
              profileModels: { economy: "test-economy", balanced: "test-balanced", quality: "test-quality" },
              fallbackModels: [],
              useResponseSchema: true,
              maxOutputTokens: 2048
            }
          },
          telemetry: { enabled: true }
        },
        operations: {
          schema: "ghrab-ai-operations-v1",
          appId: "core-conformance",
          operations: {
            "echo": {
              outputSchemaId: "core.echo.v1",
              defaultModelProfile: "balanced",
              allowedModelProfiles: ["economy", "balanced"],
              inputTypes: ["text"],
              streaming: false,
              expectedOutputs: 1,
              maxOutputTokensHint: 512
            },
            "multimodal": {
              outputSchemaId: "core.echo.v1",
              defaultModelProfile: "balanced",
              allowedModelProfiles: ["balanced"],
              inputTypes: ["text", "image", "document"],
              streaming: false,
              expectedOutputs: 1,
              maxOutputTokensHint: 512
            },
            "stream-echo": {
              outputSchemaId: "core.echo.v1",
              defaultModelProfile: "balanced",
              allowedModelProfiles: ["balanced"],
              inputTypes: ["text"],
              streaming: true,
              expectedOutputs: 1,
              maxOutputTokensHint: 512
            }
          }
        },
        outputSchemas: {
          "core.echo.v1": {
            type: "object",
            required: ["text"],
            properties: { text: { type: "string" } }
          }
        },
        credentialProvider: async () => ({ apiKey: "conformance-key", modelOverride: "test-model" }),
        authProvider: async () => ({ token: "conformance-token" }),
        testHooks: {
          isEnabled: () => true,
          directGemini: async input => {
            directCaptured = input;
            return { text: "direct" };
          },
          schoolGateway: async payload => {
            gatewayCaptured.push(payload);
            if (gatewayFailure) throw gatewayFailure;
            return {
              schema: "ghrab-ai-response-v1",
              requestId: "gateway-request",
              clientRequestId: payload.clientRequestId,
              result: { ...gatewayResult, ignoredField: "allowed" },
              usage: gatewayUsage,
              meta: { latencyMs: 3, unknown: true },
              unknownTopLevel: true
            };
          },
          schoolGatewayStream: async function* () {
            for (const event of streamEvents) yield event;
          },
          health: async () => ({
            schema: "ghrab-ai-health-v1",
            status: "ok",
            serverVersion: "1.0.0",
            supportedRequestSchemas: ["ghrab-ai-request-v1"],
            supportedResponseSchemas: ["ghrab-ai-response-v1"],
            supportedCoreVersions: [">=1.0.0 <2.0.0"],
            modelProfiles: ["economy", "balanced", "quality"],
            capabilities: { streaming: true, inputTypes: ["text", "image", "document"] },
            limits: { maxRequestBytes: 10485760 },
            futureField: true
          })
        }
      });

      await test("Core metadata is frozen and versioned", async () => {
        assert(core.coreVersion === EXPECTED_CORE_VERSION, "Wrong core version");
        assert(core.contractVersion === "1", "Wrong contract version");
        assert(typeof core.buildId === "string" && core.buildId.length > 5, "Missing buildId");
        assert(Object.isFrozen(core), "Core API is not frozen");
      });

      await test("Runtime separates defaultMode and allowedModes", async () => {
        const state = core.getState();
        assert(state.activeMode === "direct-gemini", "Wrong default mode");
        assert(state.allowedModes.length === 2, "Allowed modes missing");
        assert(state.runtimeConfig.ai.automaticFallback === false, "Automatic fallback must be false");
      });

      await test("Unregistered operation is rejected", async () => {
        await expectCode(() => core.generate({ operation: "missing", inputParts: [{ type: "text", text: "x" }] }), "UNREGISTERED_OPERATION");
      });

      await test("Unsupported schema is rejected locally", async () => {
        await expectCode(() => core.generate({ operation: "echo", outputSchemaId: "other.v1", inputParts: [{ type: "text", text: "x" }] }), "UNSUPPORTED_SCHEMA");
      });

      await test("Direct text request uses registered operation and schema", async () => {
        const response = await core.generate({
          operation: "echo",
          modelProfile: "economy",
          inputParts: [{ type: "text", text: "hello" }],
          outputSchemaId: "core.echo.v1",
          privacy: { clientAnonymized: true, preflightPassed: true }
        });
        assert(response.result.text === "direct", "Direct result mismatch");
        assert(directCaptured.request.input.parts[0].text === "hello", "Text part missing");
        assert(directCaptured.request.output.schemaId === "core.echo.v1", "schemaId missing");
        assert(!JSON.stringify(directCaptured.request).includes("conformance-key"), "API key leaked into public request");
      });

      await test("Multimodal request preserves supported parts", async () => {
        await core.generate({
          operation: "multimodal",
          inputParts: [
            { type: "text", text: "image" },
            { type: "image", mimeType: "image/png", source: { kind: "inline-base64", data: "aGVsbG8=" } },
            { type: "document", mimeType: "application/pdf", name: "x.pdf", source: { kind: "inline-base64", data: "aGVsbG8=" } }
          ]
        });
        const parts = directCaptured.request.input.parts;
        assert(parts.length === 3 && parts[1].type === "image" && parts[2].type === "document", "Multimodal parts changed");
      });

      await test("Gateway payload is neutral and contains no Gemini credentials", async () => {
        core.setMode("school-gateway");
        gatewayCaptured = [];
        const response = await core.generate({ operation: "echo", inputParts: [{ type: "text", text: "gateway" }] });
        const payload = gatewayCaptured[0];
        const serialized = JSON.stringify(payload);
        assert(response.result.text === "gateway", "Gateway result mismatch");
        assert(payload.schema === "ghrab-ai-request-v1", "Wrong request schema");
        assert(payload.output.schemaId === "core.echo.v1", "Gateway schemaId missing");
        assert(!serialized.includes("conformance-key") && !serialized.includes("localContext") && !serialized.includes("outputSchemas"), "Private data leaked to gateway");
      });

      await test("Same logical request gets a new attemptId", async () => {
        gatewayCaptured = [];
        await core.generate({ clientRequestId: "logical-1", operation: "echo", inputParts: [{ type: "text", text: "same" }] });
        await core.generate({ clientRequestId: "logical-1", operation: "echo", inputParts: [{ type: "text", text: "same" }] });
        assert(gatewayCaptured[0].clientRequestId === gatewayCaptured[1].clientRequestId, "clientRequestId changed");
        assert(gatewayCaptured[0].attemptId !== gatewayCaptured[1].attemptId, "attemptId was reused");
      });

      await test("Gateway usage metadata is authoritative", async () => {
        gatewayUsage = { providerRequests: 6, retryRequests: 2, inputTokens: 100, outputTokens: 20, totalTokens: 120, generatedOutputs: 1 };
        const response = await core.generate({ operation: "echo", inputParts: [{ type: "text", text: "usage" }] });
        const usage = core.getLastUsage();
        assert(response.usage.providerRequests === 6 && usage.providerRequests === 6 && usage.totalTokens === 120, "Server usage was not preserved");
      });

      await test("Server message is never used as user-facing text", async () => {
        gatewayFailure = core.createError("RATE_LIMITED", { retryable: true, retryAfterMs: 2500 }, "SERVER SECRET MESSAGE");
        const error = await expectCode(() => core.generate({ operation: "echo", inputParts: [{ type: "text", text: "error" }] }), "RATE_LIMITED");
        const message = core.formatUserError(error);
        assert(!message.includes("SERVER SECRET MESSAGE"), "Server text leaked into UI message");
        assert(error.retryAfterMs === 2500 && message.includes("3 s"), "retryAfterMs missing");
        gatewayFailure = null;
      });

      await test("budgetResetAt is retained", async () => {
        const reset = "2026-08-03T00:00:00.000Z";
        const error = core.createError("BUDGET_EXCEEDED", { budgetResetAt: reset });
        assert(error.budgetResetAt === reset, "budgetResetAt missing");
        assert(core.formatUserError(error).includes("Limit se obnovi") || core.formatUserError(error).includes("Limit se obnoví"), "Budget reset not formatted");
      });

      await test("Unknown response fields are ignored", async () => {
        gatewayResult = { text: "known" };
        const response = await core.generate({ operation: "echo", inputParts: [{ type: "text", text: "unknown" }] });
        assert(response.result.text === "known", "Known result lost");
        assert(!Object.prototype.hasOwnProperty.call(response, "unknownTopLevel"), "Unknown top-level field leaked");
      });

      await test("Local output schema validation rejects invalid result", async () => {
        gatewayResult = { wrong: true };
        await expectCode(() => core.generate({ operation: "echo", inputParts: [{ type: "text", text: "invalid" }] }), "INVALID_OUTPUT");
        gatewayResult = { text: "gateway" };
      });

      await test("Streaming fixture preserves event sequence", async () => {
        const received = [];
        for await (const event of core.stream({ clientRequestId: "stream-client", operation: "stream-echo", inputParts: [{ type: "text", text: "stream" }] })) received.push(event.type);
        assert(received.join(",") === "start,delta,result,usage,done", "Wrong stream events: " + received.join(","));
      });

      await test("Health handshake accepts additive fields", async () => {
        const health = await core.health({ mode: "school-gateway" });
        assert(health.schema === "ghrab-ai-health-v1" && health.capabilities.streaming === true && health.futureField === true, "Health handshake failed");
      });

      await test("Direct mode cannot run registered streaming operation", async () => {
        core.setMode("direct-gemini");
        await expectCode(async () => {
          for await (const _event of core.stream({ operation: "stream-echo", inputParts: [{ type: "text", text: "x" }] })) {}
        }, "FEATURE_UNSUPPORTED");
      });

      await test("Mode outside allowedModes is rejected", async () => {
        const before = core.__testing.snapshot();
        core.__testing.replaceRuntimeConfig({
          schema: "ghrab-runtime-config-v1",
          ai: { defaultMode: "direct-gemini", allowedModes: ["direct-gemini"], allowUserModeSelection: false, automaticFallback: false }
        });
        await expectCode(async () => core.setMode("school-gateway"), "CONFIGURATION_ERROR");
        core.__testing.restore(before);
      });
    } finally {
      core.__testing.restore(snapshot);
      delete global.__GHRAB_AI_CONFORMANCE_TEST__;
    }

    const failed = results.filter(item => !item.ok);
    return {
      schema: "ghrab-ai-conformance-result-v1",
      suiteVersion: SUITE_VERSION,
      coreVersion: core.coreVersion,
      passed: results.length - failed.length,
      failed: failed.length,
      results
    };
  }

  global.GHRAB_AI_CONFORMANCE = Object.freeze({ suiteVersion: SUITE_VERSION, expectedCoreVersion: EXPECTED_CORE_VERSION, run });
})(window);
