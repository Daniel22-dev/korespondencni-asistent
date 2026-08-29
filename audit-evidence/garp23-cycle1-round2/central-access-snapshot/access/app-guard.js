import {
  initialiseAccess,
  hasAppAccess,
  requiredTraining,
  formatReason,
} from "./access-control.js?v=0.21.35";

const LIVE_LAUNCHES_KEY = "ghrab.pilot.launches";
const LIVE_EVENTS_KEY = "ghrab.pilot.events.v2";
const TEST_LAUNCHES_KEY = "ghrab.pilot.test.launches";
const TEST_EVENTS_KEY = "ghrab.pilot.test.events.v2";
const TELEMETRY_MODE_KEY = "ghrab.pilot.telemetry.mode";
const ACTIVE_IDLE_MS = 5 * 60 * 1000;
const ACTIVE_TICK_MS = 15 * 1000;
const ACTIVE_MAX_CREDIT_MS = 20 * 1000;
const ACTIVE_LOCK_TTL_MS = 35 * 1000;
const MAX_EVENTS = 2000;
const MAX_MONTHLY_PERIODS = 24;

export const OUTPUT_KINDS = Object.freeze({
  generator: new Set(["test-package"]),
  ludus: new Set(["game", "content-pack", "class-quiz", "lesson-pack"]),
  differentiator: new Set(["worksheet-variant"]),
  correspondence: new Set([
    "incoming-analysis",
    "reply-draft",
    "outgoing-email",
  ]),
  "essay-evaluator": new Set(["essay-evaluation"]),
  "activity-builder": new Set(["activity-pack"]),
  sortio: new Set(["class-import", "grouping", "seating-plan", "roles"]),
  "lesson-hub": new Set([
    "lesson-plan",
    "lesson-record",
    "material-record",
    "material-import",
    "backup-export",
  ]),
});

function language() {
  return document.documentElement.lang === "en" ? "en" : "cs";
}
function text(cs, en) {
  return language() === "cs" ? cs : en;
}
function studioHref(options) {
  return new URL(options.studioUrl || "../", location.href).href;
}

function makeTopLevelLink(link) {
  if (window.top !== window.self) link.target = "_top";
  return link;
}

export function startErrorReporterBestEffort(appId, options = {}) {
  if (!appId || options.errorReporter === false) return Promise.resolve(null);
  const timeoutMs = Math.max(250, Number(options.reporterTimeoutMs || 4000));
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error("Časový limit načtení diagnostického reportéru.");
      error.name = "ReporterTimeoutError";
      reject(error);
    }, timeoutMs);
  });
  const reporterModuleUrl = options.reporterModuleUrl
    ? new URL(options.reporterModuleUrl, import.meta.url).href
    : new URL("./error-reporter.js", import.meta.url).href;
  return Promise.race([import(reporterModuleUrl), timeout])
    .then(({ setupErrorReporter }) => setupErrorReporter({
      appId,
      appName: options.appName,
      appVersion: options.appVersion,
      studioUrl: studioHref(options),
      supportEmail: options.supportEmail,
      guideUrl: options.guideUrl,
      themeResolver: options.themeResolver,
      launcherRight: options.launcherRight,
      launcherBottom: options.launcherBottom,
      captureRight: options.captureRight,
      captureBottom: options.captureBottom,
    }))
    .catch((error) => {
      console.warn(`GHRAB reportér (${appId}) nebyl načten; přístupová brána i aplikace pokračují.`, error);
      return null;
    })
    .finally(() => window.clearTimeout(timer));
}
function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
function showStorageWarning(error) {
  if (document.getElementById("ghrab-storage-warning")) return;
  const warning = document.createElement("div");
  warning.id = "ghrab-storage-warning";
  warning.className = "ghrab-storage-warning";
  warning.setAttribute("role", "alert");
  warning.textContent =
    error?.name === "QuotaExceededError"
      ? text(
          "Místní úložiště je plné. Exportujte důležité materiály a odstraňte starší data; nové statistiky se nyní neukládají.",
          "Local storage is full. Export important resources and remove older data; new statistics are not being saved.",
        )
      : text(
          "Prohlížeč nepovolil uložení místních statistik. Zkontrolujte režim soukromého prohlížení a nastavení úložiště.",
          "The browser did not allow local statistics to be saved. Check private browsing and storage settings.",
        );
  (document.body || document.documentElement).append(warning);
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`AI Studio telemetry: zápis selhal pro ${key}`, error);
    showStorageWarning(error);
    return false;
  }
}
function pruneMonthlyBuckets(monthly) {
  const entries = Object.entries(monthly || {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(entries.slice(-MAX_MONTHLY_PERIODS));
}
function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}
function eventId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function quantity(value) {
  return Math.max(0, Math.min(10000, Math.round(Number(value || 0))));
}
function modeForSnapshot(snapshot) {
  const requested =
    localStorage.getItem(TELEMETRY_MODE_KEY) === "test" ? "test" : "live";
  return snapshot?.permit?.role === "admin" && requested === "test"
    ? "test"
    : "live";
}
function keysForMode(mode) {
  return mode === "test"
    ? { launches: TEST_LAUNCHES_KEY, events: TEST_EVENTS_KEY }
    : { launches: LIVE_LAUNCHES_KEY, events: LIVE_EVENTS_KEY };
}
function derivedOutcome(successful, failed, cancelled) {
  if (failed > 0 && successful > 0) return "partial";
  if (failed > 0) return "error";
  if (successful > 0) return "success";
  if (cancelled > 0) return "cancelled";
  return "cancelled";
}

function recordOutput(appId, keys, payload = {}) {
  const allowedKinds = OUTPUT_KINDS[appId] || new Set();
  const outputKind = String(payload.outputKind || "").trim();
  if (!allowedKinds.has(outputKind)) {
    console.warn(
      `AI Studio telemetry: nepovolený typ výstupu ${appId}/${outputKind}`,
    );
    return false;
  }
  let successfulQuantity = quantity(payload.successfulQuantity);
  let failedQuantity = quantity(payload.failedQuantity);
  let cancelledQuantity = quantity(payload.cancelledQuantity);
  let attemptedQuantity = quantity(payload.attemptedQuantity);
  const suppliedOutcome = ["success", "error", "partial", "cancelled"].includes(
    payload.outcome,
  )
    ? payload.outcome
    : "";
  if (!attemptedQuantity)
    attemptedQuantity = successfulQuantity + failedQuantity + cancelledQuantity;
  if (!attemptedQuantity && suppliedOutcome) {
    attemptedQuantity = 1;
    if (suppliedOutcome === "success") successfulQuantity = 1;
    else if (suppliedOutcome === "error") failedQuantity = 1;
    else if (suppliedOutcome === "cancelled") cancelledQuantity = 1;
  }
  if (!attemptedQuantity) return false;
  const accounted = successfulQuantity + failedQuantity + cancelledQuantity;
  if (accounted > attemptedQuantity) attemptedQuantity = accounted;
  const events = readJson(keys.events, []);
  const list = Array.isArray(events) ? events : [];
  list.push({
    id: eventId(),
    at: new Date().toISOString(),
    type: "output",
    appId,
    outputKind,
    attemptedQuantity,
    successfulQuantity,
    failedQuantity,
    cancelledQuantity,
    outcome:
      suppliedOutcome ||
      derivedOutcome(successfulQuantity, failedQuantity, cancelledQuantity),
  });
  return writeJson(keys.events, list.slice(-MAX_EVENTS));
}

function exposeTelemetry(appId, keys, mode) {
  const existing =
    window.GHRABTelemetry && typeof window.GHRABTelemetry === "object"
      ? window.GHRABTelemetry
      : {};
  const api = {
    ...existing,
    appId,
    mode,
    recordOutput: (payload) => recordOutput(appId, keys, payload),
    recordGeneration: (outcome) =>
      recordOutput(appId, keys, {
        outputKind:
          appId === "generator"
            ? "test-package"
            : [...(OUTPUT_KINDS[appId] || [])][0],
        attemptedQuantity: 1,
        successfulQuantity: outcome === "success" ? 1 : 0,
        failedQuantity: outcome === "error" ? 1 : 0,
        cancelledQuantity: outcome === "cancelled" ? 1 : 0,
        outcome,
      }),
  };
  window.GHRABTelemetry = Object.freeze(api);
  document.documentElement.dataset.ghrabTelemetryMode = mode;
}

function recordApplicationOpen(appId, keys) {
  if (!appId || document.documentElement.dataset.ghrabLaunchRecorded === "true")
    return;
  document.documentElement.dataset.ghrabLaunchRecorded = "true";
  const launches = readJson(keys.launches, {});
  const safeLaunches =
    launches && typeof launches === "object" && !Array.isArray(launches)
      ? launches
      : {};
  const current =
    safeLaunches[appId] && typeof safeLaunches[appId] === "object"
      ? safeLaunches[appId]
      : {};
  const now = new Date();
  const timestamp = now.toISOString();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  current.count = Math.max(0, Number(current.count || 0)) + 1;
  current.lastOpened = timestamp;
  current.activeSeconds = Math.max(0, Number(current.activeSeconds || 0));
  current.activeSessions = Math.max(0, Number(current.activeSessions || 0));
  current.lastActiveAt = current.lastActiveAt || null;
  current.monthly =
    current.monthly &&
    typeof current.monthly === "object" &&
    !Array.isArray(current.monthly)
      ? current.monthly
      : {};
  const bucket =
    current.monthly[period] && typeof current.monthly[period] === "object"
      ? current.monthly[period]
      : {};
  bucket.count = Math.max(0, Number(bucket.count || 0)) + 1;
  bucket.lastOpened = timestamp;
  bucket.activeSeconds = Math.max(0, Number(bucket.activeSeconds || 0));
  bucket.activeSessions = Math.max(0, Number(bucket.activeSessions || 0));
  bucket.lastActiveAt = bucket.lastActiveAt || null;
  current.monthly[period] = bucket;
  current.monthly = pruneMonthlyBuckets(current.monthly);
  safeLaunches[appId] = current;
  writeJson(keys.launches, safeLaunches);
}

function startActiveTimeTracker(appId, keys) {
  if (!appId || document.documentElement.dataset.ghrabActiveTracker === "ready")
    return;
  document.documentElement.dataset.ghrabActiveTracker = "ready";
  const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const lockKey = `${keys.launches}.active-lock.${appId}`;
  let lastInteractionAt = Date.now();
  let lastTickAt = performance.now();
  const creditedPeriods = new Set();
  let timer = 0;

  const markInteraction = () => {
    lastInteractionAt = Date.now();
  };
  const isEligible = () =>
    document.visibilityState === "visible" &&
    document.hasFocus() &&
    Date.now() - lastInteractionAt <= ACTIVE_IDLE_MS;
  const acquireLock = () => {
    const now = Date.now();
    const lock = readJson(lockKey, null);
    if (lock && lock.owner !== tabId && Number(lock.expiresAt || 0) > now)
      return false;
    if (
      !writeJson(lockKey, { owner: tabId, expiresAt: now + ACTIVE_LOCK_TTL_MS })
    )
      return false;
    return readJson(lockKey, null)?.owner === tabId;
  };
  const releaseLock = () => {
    const lock = readJson(lockKey, null);
    if (lock?.owner === tabId) removeStorage(lockKey);
  };
  const addActiveSeconds = (seconds) => {
    if (!(seconds > 0)) return;
    const launches = readJson(keys.launches, {});
    const safeLaunches =
      launches && typeof launches === "object" && !Array.isArray(launches)
        ? launches
        : {};
    const current =
      safeLaunches[appId] && typeof safeLaunches[appId] === "object"
        ? safeLaunches[appId]
        : {};
    current.count = Number(current.count || 0);
    current.lastOpened = current.lastOpened || null;
    const now = new Date();
    const timestamp = now.toISOString();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    current.activeSeconds =
      Math.max(0, Number(current.activeSeconds || 0)) + seconds;
    current.activeSessions =
      Math.max(0, Number(current.activeSessions || 0)) +
      (creditedPeriods.has("all") ? 0 : 1);
    current.lastActiveAt = timestamp;
    current.monthly =
      current.monthly &&
      typeof current.monthly === "object" &&
      !Array.isArray(current.monthly)
        ? current.monthly
        : {};
    const bucket =
      current.monthly[period] && typeof current.monthly[period] === "object"
        ? current.monthly[period]
        : {};
    bucket.count = Math.max(0, Number(bucket.count || 0));
    bucket.lastOpened = bucket.lastOpened || null;
    bucket.activeSeconds =
      Math.max(0, Number(bucket.activeSeconds || 0)) + seconds;
    bucket.activeSessions =
      Math.max(0, Number(bucket.activeSessions || 0)) +
      (creditedPeriods.has(period) ? 0 : 1);
    bucket.lastActiveAt = timestamp;
    current.monthly[period] = bucket;
    creditedPeriods.add("all");
    creditedPeriods.add(period);
    safeLaunches[appId] = current;
    writeJson(keys.launches, safeLaunches);
  };
  const tick = () => {
    const now = performance.now();
    const elapsedMs = Math.max(
      0,
      Math.min(now - lastTickAt, ACTIVE_MAX_CREDIT_MS),
    );
    lastTickAt = now;
    if (!isEligible()) {
      releaseLock();
      return;
    }
    if (!acquireLock()) return;
    addActiveSeconds(Math.max(1, Math.round(elapsedMs / 1000)));
  };
  const resetTick = () => {
    lastTickAt = performance.now();
    if (!isEligible()) releaseLock();
  };

  ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(
    (type) => {
      document.addEventListener(type, markInteraction, {
        passive: true,
        capture: true,
      });
    },
  );
  window.addEventListener(
    "focus",
    () => {
      markInteraction();
      resetTick();
    },
    { passive: true },
  );
  window.addEventListener("blur", resetTick, { passive: true });
  document.addEventListener("visibilitychange", resetTick, { passive: true });
  window.addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      releaseLock();
    },
    { once: true },
  );
  timer = window.setInterval(tick, ACTIVE_TICK_MS);
}


async function copyGateDiagnostics(appId, access) {
  const payload = [
    "AI Studio GHRAB – diagnostika přístupové brány",
    `Aplikace: ${appId}`,
    `Důvod: ${access?.reason || "unknown"}`,
    `Stránka: ${location.href}`,
    `Čas: ${new Date().toISOString()}`,
    `Online: ${navigator.onLine ? "ano" : "ne"}`,
    `Prohlížeč: ${navigator.userAgent}`,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(payload);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = payload;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand?.("copy") === true;
    textarea.remove();
    return copied;
  }
}

function renderGate(appId, access, options = {}) {
  const training = requiredTraining(appId);
  const appName = training?.label?.[language()] || training?.label?.cs || appId;
  document.documentElement.dataset.ghrabAccess = "denied";
  document.body.replaceChildren();
  document.body.className = "ghrab-access-gate-body";
  const main = document.createElement("main");
  main.className = "ghrab-access-gate";
  const mark = document.createElement("div");
  mark.className = "ghrab-access-gate-mark";
  mark.textContent = "⬡";
  const eyebrow = document.createElement("p");
  eyebrow.className = "ghrab-access-gate-eyebrow";
  eyebrow.textContent = "AI STUDIO GHRAB";
  const title = document.createElement("h1");
  title.textContent = text(
    "Tato aplikace je uzamčena",
    "This application is locked",
  );
  const description = document.createElement("p");
  description.textContent = text(
    `${appName} se odemkne po aktivaci platného přístupu vydaného správcem AI Studia.`,
    `${appName} is unlocked after activating valid access issued by the AI Studio administrator.`,
  );
  const reason = document.createElement("p");
  reason.className = "ghrab-access-gate-reason";
  reason.textContent = formatReason(access.reason, language());
  if (training?.trainingRequired) {
    const trainingLine = document.createElement("p");
    trainingLine.className = "ghrab-access-gate-training";
    trainingLine.textContent = text(
      `Požadované školení: ${training.trainingCode} · verze ${training.trainingVersion}`,
      `Required training: ${training.trainingCode} · version ${training.trainingVersion}`,
    );
    main.append(mark, eyebrow, title, description, reason, trainingLine);
  } else main.append(mark, eyebrow, title, description, reason);
  const actions = document.createElement("div");
  actions.className = "ghrab-access-gate-actions";
  const back = makeTopLevelLink(document.createElement("a"));
  back.href = studioHref(options);
  back.textContent = text("Otevřít AI Studio", "Open AI Studio");
  back.className = "ghrab-access-gate-primary";
  const accessPage = makeTopLevelLink(document.createElement("a"));
  accessPage.href = new URL("access/", studioHref(options)).href;
  accessPage.textContent = text("Aktivovat přístup", "Activate access");
  accessPage.className = "ghrab-access-gate-secondary";
  const copyDiagnostics = document.createElement("button");
  copyDiagnostics.type = "button";
  copyDiagnostics.className = "ghrab-access-gate-secondary";
  copyDiagnostics.textContent = text(
    "Zkopírovat diagnostiku",
    "Copy diagnostics",
  );
  copyDiagnostics.addEventListener("click", async () => {
    const copied = await copyGateDiagnostics(appId, access);
    copyDiagnostics.textContent = copied
      ? text("Diagnostika zkopírována", "Diagnostics copied")
      : text("Kopírování se nezdařilo", "Copy failed");
  });
  actions.append(back, accessPage, copyDiagnostics);
  main.append(actions);
  document.body.append(main);
}


function renderPlatformCompatibilityGate(platform) {
  document.documentElement.dataset.ghrabAccess = "denied";
  document.body.replaceChildren();
  document.body.className = "ghrab-access-gate-body";
  const main = document.createElement("main");
  main.className = "ghrab-access-gate";
  const mark = document.createElement("div");
  mark.className = "ghrab-access-gate-mark";
  mark.textContent = "⬡";
  const eyebrow = document.createElement("p");
  eyebrow.className = "ghrab-access-gate-eyebrow";
  eyebrow.textContent = "AI STUDIO GHRAB";
  const title = document.createElement("h1");
  title.textContent = "Aplikace vyžaduje aktualizaci platformy";
  const message = document.createElement("p");
  message.textContent = `Požadována je platforma ${platform.compatibility.requiredRange}; načtena je verze ${platform.compatibility.platformVersion}. Nejprve aktualizujte AI Studio GHRAB a poté tuto aplikaci.`;
  main.append(mark, eyebrow, title, message);
  document.body.append(main);
  platform.mountFooter?.();
}

function localPlatformUnlockReady() {
  return typeof globalThis.GHRAB_PLATFORM?.unlockProtectedScripts === "function";
}

export async function waitForLocalPlatformUnlock(options = {}) {
  const protectedScripts = document.querySelectorAll("script[data-ghrab-protected]");
  if (!protectedScripts.length || localPlatformUnlockReady())
    return globalThis.GHRAB_PLATFORM || null;

  const loader = document.querySelector("script[data-ghrab-platform-loader]");
  if (!loader) {
    throw new Error(
      "GHRAB platform loader is missing for a protected application.",
    );
  }

  const timeoutMs = Math.max(500, Number(options.platformReadyTimeoutMs || 8000));
  document.documentElement.dataset.ghrabPlatformUnlockWait = "waiting";

  return new Promise((resolve, reject) => {
    let timer = 0;
    let poll = 0;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener("ghrab:platform-ready", checkReady);
      loader.removeEventListener("load", checkReady);
      loader.removeEventListener("error", onLoaderError);
    };
    const finish = (platform) => {
      if (settled) return;
      settled = true;
      cleanup();
      document.documentElement.dataset.ghrabPlatformUnlockWait = "ready";
      resolve(platform);
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      document.documentElement.dataset.ghrabPlatformUnlockWait = "failed";
      reject(new Error(message));
    };
    const checkReady = () => {
      if (localPlatformUnlockReady()) finish(globalThis.GHRAB_PLATFORM);
    };
    const onLoaderError = () =>
      fail("GHRAB platform loader failed before protected application startup.");

    document.addEventListener("ghrab:platform-ready", checkReady);
    loader.addEventListener("load", checkReady);
    loader.addEventListener("error", onLoaderError);
    poll = window.setInterval(checkReady, 25);
    timer = window.setTimeout(
      () =>
        fail(
          `GHRAB platform unlock helper was not ready within ${timeoutMs} ms.`,
        ),
      timeoutMs,
    );
    checkReady();
  });
}

export function unlockProtectedScripts(options = {}) {
  const helper = globalThis.GHRAB_PLATFORM?.unlockProtectedScripts;
  if (typeof helper !== "function") {
    throw new Error("GHRAB platform unlock helper is unavailable or incompatible.");
  }
  return helper(options);
}

export async function protectApp(appId, options = {}) {
  document.documentElement.dataset.ghrabAccess = "checking";
  await waitForLocalPlatformUnlock(options);
  const localPlatform = globalThis.GHRAB_PLATFORM;
  if (localPlatform?.contract === "ghrab-platform-v1" && localPlatform.compatibility?.ok === false) {
    renderPlatformCompatibilityGate(localPlatform);
    return false;
  }
  const snapshot = await initialiseAccess(options);
  const access = hasAppAccess(appId);
  if (snapshot.ready && access.enabled) {
    document.documentElement.dataset.ghrabAccess = "granted";
    const mode = modeForSnapshot(snapshot);
    const keys = keysForMode(mode);
    if (options.telemetry !== false) {
      exposeTelemetry(appId, keys, mode);
      recordApplicationOpen(appId, keys);
      startActiveTimeTracker(appId, keys);
    }
    if (options.errorReporter !== false)
      void startErrorReporterBestEffort(appId, options);
    if (options.platformRuntime !== false) {
      try {
        const { initialisePlatformRuntime } = await import("./platform-runtime.js?v=0.21.35");
        await initialisePlatformRuntime({
          appId,
          appVersion: options.appVersion || document.documentElement.dataset.appVersion || "unknown",
          accessSnapshot: snapshot,
          mountControls: options.privacyControls !== false,
        });
      } catch (error) {
        console.warn(`GHRAB platform runtime (${appId}) nebyl načten.`, error);
        document.documentElement.dataset.ghrabPlatformRuntime = "unavailable";
      }
    }
    document.dispatchEvent(
      new CustomEvent("ghrab:app-access-granted", {
        detail: { appId, permit: access.permit, telemetryMode: mode },
      }),
    );
    return true;
  }
  renderGate(appId, access, options);
  if (options.errorReporterOnDenied !== false) {
    void startErrorReporterBestEffort(appId, {
      ...options,
      errorReporter: true,
      launcherBottom: options.deniedReporterBottom || "24px",
    });
  }
  return false;
}
