import { BAKED_DEPLOYMENT_CONFIG } from "../config/deployment-baked.js?v=0.21.35";

const TOKEN_KEY = "ghrab.access.permit.v2";
const TOKEN_PREFIX = "ghrab1";
const LKG_KEY = "ghrab.access.last-known-good.v1";
const CONFIG_BASE = new URL("../config/", import.meta.url);
const DEFAULT_MAX_OFFLINE_AGE_HOURS = 24;
const DEFAULT_MAX_SIGNED_BUNDLE_AGE_DAYS = 30;
const MAX_NEW_PERMIT_DAYS = 90;
const MAX_NEW_PERMIT_DAYS_ENFORCED_AFTER = Date.parse("2026-08-22T00:00:00.000Z") / 1000;
const OPERATOR_ROLE = "operator";
const DEFAULT_OPERATOR_PAGES = Object.freeze([
  "automation",
  "pilot",
  "report",
  "tests",
  "access-registry",
  "deputy-admin",
]);
const ACCESS_BUNDLE_VERIFY_KEY = Object.freeze({
  kty: "EC",
  crv: "P-256",
  x: "bYxfni4Vsy90xRYtk8qdP9oSame-uHavew5XjHgy3K0",
  y: "aEC5jZaXh9Ipj-xrG5_myRsh6T32GhTIfQ9dgFWQJxg",
  kid: "ghrab-access-bundle-20260822195407Z-fxjS8DK9",
  use: "sig",
  alg: "ES256",
});
const accessState = {
  ready: false,
  mode: "signed-permit",
  token: null,
  permit: null,
  valid: false,
  reason: "not-initialised",
  policy: null,
  revocations: null,
  publicKeyInfo: null,
  checkedAt: null,
  fetchedAt: null,
  offlineAgeHours: null,
  maxOfflineAgeHours: DEFAULT_MAX_OFFLINE_AGE_HOURS,
  signedBundleAgeHours: null,
  maxSignedBundleAgeDays: DEFAULT_MAX_SIGNED_BUNDLE_AGE_DAYS,
  connectionState: "checking",
  revocationListUpdatedAt: null,
  revocationCheckMode: null,
  deployment: null,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function safeStorageRemove(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}
function safeJsonParse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}
function fromBase64Url(value) {
  const normalised = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function toBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function decodeJsonSegment(value) {
  return JSON.parse(textDecoder.decode(fromBase64Url(value)));
}
function trailingSlash(value, fallback = "/") {
  const text = String(value || fallback).trim() || fallback;
  return text.endsWith("/") ? text : `${text}/`;
}
async function fetchWithTimeout(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let timer = 0;
  const onAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), Math.max(250, Number(timeoutMs || 5000)));
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", onAbort);
  }
}
async function fetchJson(url, timeoutMs = 5000) {
  const response = await fetchWithTimeout(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }, timeoutMs);
  if (!response.ok) {
    const error = new Error(`${url.pathname}: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
async function deploymentContext() {
  if (globalThis.__GHRAB_DEPLOYMENT_CONFIG__) return globalThis.__GHRAB_DEPLOYMENT_CONFIG__;
  if (BAKED_DEPLOYMENT_CONFIG) {
    const originBase = new URL("/", location.href);
    return {
      ...BAKED_DEPLOYMENT_CONFIG,
      studioBaseUrl: new URL(trailingSlash(BAKED_DEPLOYMENT_CONFIG.studioBaseUrl || "/AI-Studio-GHRAB/"), originBase).href,
      apiBaseUrl: BAKED_DEPLOYMENT_CONFIG.apiBaseUrl
        ? new URL(
            trailingSlash(BAKED_DEPLOYMENT_CONFIG.apiBaseUrl),
            BAKED_DEPLOYMENT_CONFIG.apiBaseUrl.startsWith("/") ? originBase : new URL("../", import.meta.url),
          ).href
        : "",
    };
  }
  try {
    const response = await fetchWithTimeout(new URL("deployment.json", CONFIG_BASE), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }, 3000);
    if (!response.ok) throw new Error(`deployment ${response.status}`);
    const raw = await response.json();
    const originBase = new URL("/", location.href);
    const studioBaseUrl = new URL(trailingSlash(raw.studioBaseUrl || "/AI-Studio-GHRAB/"), originBase).href;
    const apiBaseUrl = raw.apiBaseUrl ? new URL(trailingSlash(raw.apiBaseUrl), raw.apiBaseUrl.startsWith("/") ? originBase : new URL("../", import.meta.url)).href : "";
    return { ...raw, studioBaseUrl, apiBaseUrl };
  } catch {
    return {
      profile: "configuration-unavailable",
      authMode: "disabled",
      aiTransport: "disabled",
      apiBaseUrl: "",
      sharedAccessVersion: "unavailable",
      access: { maxOfflineAgeHours: 0, maxSignedBundleAgeDays: 0, failClosedWhenStale: true },
      features: { allowLocalProviderKeys: false },
    };
  }
}
function endpoint(deployment, name, fallback) {
  const value = deployment?.endpoints?.[name] || fallback;
  if (!deployment?.apiBaseUrl) return new URL(value, location.href);
  return new URL(String(value).replace(/^\/+/, ""), trailingSlash(deployment.apiBaseUrl));
}
function emitChange() {
  document.documentElement.classList.toggle("access-admin", isAdmin());
  document.documentElement.classList.toggle("access-operator", isOperator());
  document.documentElement.classList.toggle("access-ready", accessState.ready);
  document.documentElement.dataset.ghrabAccessConnection = accessState.connectionState;
  document.documentElement.dataset.ghrabAuthMode = accessState.mode;
  document.dispatchEvent(new CustomEvent("ghrab:access-changed", { detail: getAccessSnapshot() }));
}
function resetVerification(reason, token = safeStorageGet(TOKEN_KEY)) {
  accessState.token = token || null;
  accessState.permit = null;
  accessState.valid = false;
  accessState.reason = reason;
  accessState.checkedAt = new Date(Date.now()).toISOString();
}
function nowSeconds() { return Math.floor(Date.now() / 1000); }
function nowIso() { return new Date(Date.now()).toISOString(); }
function normaliseApps(apps) {
  return Array.isArray(apps)
    ? [...new Set(apps.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
    : [];
}
function verificationKeys(publicKeyInfo) {
  if (Array.isArray(publicKeyInfo?.keys) && publicKeyInfo.keys.length) return publicKeyInfo.keys;
  if (publicKeyInfo?.schema === "ghrab-access-public-key-v1" && publicKeyInfo.publicKey) {
    return [{ keyId: publicKeyInfo.keyId, algorithm: publicKeyInfo.algorithm, publicKey: publicKeyInfo.publicKey }];
  }
  return [];
}
function verificationKeyFor(kid) {
  return verificationKeys(accessState.publicKeyInfo).find((item) => item?.keyId === kid || item?.publicKey?.kid === kid) || null;
}
function validateClaims(payload, policy, revocations) {
  if (!payload || payload.schema !== "ghrab-access-permit-v1") return "invalid-schema";
  if (payload.iss !== policy.issuer || payload.aud !== policy.audience) return "invalid-audience";
  if (!payload.sub || !payload.jti || !payload.kid || !payload.role) return "missing-claims";
  const allowedRoles = new Set([
    "teacher",
    OPERATOR_ROLE,
    ...(policy?.administratorRoles || ["admin"]),
    ...(policy?.operatorRoles || []),
  ]);
  if (!allowedRoles.has(payload.role)) return "invalid-role";
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return "invalid-time-claims";
  const skew = Number(policy.clockSkewSeconds || 300);
  const now = nowSeconds();
  if (Number.isFinite(payload.nbf) && payload.nbf > now + skew) return "not-yet-valid";
  if (payload.iat > now + skew) return "issued-in-future";
  if (payload.exp <= now - skew) return "expired";
  if (payload.exp <= payload.iat) return "invalid-validity-window";
  const enforcementTime = Date.parse(policy.maximumPermitDaysEnforcedAfter || "") / 1000;
  const isLegacyPermit = Number.isFinite(enforcementTime) && payload.iat < enforcementTime;
  const policyMaximumDays = isLegacyPermit
    ? Number(policy.legacyMaximumPermitDays || policy.maximumPermitDays || 1095)
    : Number(policy.maximumPermitDays || 90);
  const maximumDays = payload.iat >= MAX_NEW_PERMIT_DAYS_ENFORCED_AFTER
    ? Math.min(policyMaximumDays, MAX_NEW_PERMIT_DAYS)
    : policyMaximumDays;
  if (payload.exp - payload.iat > maximumDays * 86400 + skew) return "validity-too-long";
  if (revocations?.revokedBefore && payload.iat <= Math.floor(Date.parse(revocations.revokedBefore) / 1000)) return "revoked-by-date";
  if (Array.isArray(revocations?.revokedJti) && revocations.revokedJti.includes(payload.jti)) return "revoked";
  return null;
}
async function importVerificationKey(keyInfo) {
  return crypto.subtle.importKey("jwk", keyInfo.publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function verifyToken(token) {
  if (!token) return { valid: false, reason: "missing" };
  const parts = String(token).trim().split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { valid: false, reason: "invalid-format" };
  let payload;
  try { payload = decodeJsonSegment(parts[1]); } catch { return { valid: false, reason: "invalid-payload" }; }
  const keyInfo = verificationKeyFor(payload.kid);
  if (!keyInfo) return { valid: false, reason: "unknown-key", permit: payload };
  const claimError = validateClaims(payload, accessState.policy, accessState.revocations);
  if (claimError) return { valid: false, reason: claimError, permit: payload };
  try {
    const key = await importVerificationKey(keyInfo);
    const signature = fromBase64Url(parts[2]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, textEncoder.encode(parts[1]));
    return valid
      ? { valid: true, reason: "valid", permit: { ...payload, apps: normaliseApps(payload.apps) } }
      : { valid: false, reason: "invalid-signature", permit: payload };
  } catch {
    return { valid: false, reason: "verification-error", permit: payload };
  }
}
function validateSharedConfiguration(policy, revocations, publicKeyInfo) {
  if (policy?.schema !== "ghrab-access-policy-v1") throw new Error("invalid policy schema");
  if (revocations?.schema !== "ghrab-access-revocation-list-v1") throw new Error("invalid revocation schema");
  if (!verificationKeys(publicKeyInfo).length) throw new Error("invalid public key schema");
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function verifyAccessBundle(bundle, signatureDocument) {
  if (bundle?.schema !== "ghrab-access-config-bundle-v1") return false;
  if (signatureDocument?.schema !== "ghrab-access-config-signature-v1" || signatureDocument.algorithm !== "ES256") return false;
  if (signatureDocument.keyId !== ACCESS_BUNDLE_VERIFY_KEY.kid || signatureDocument.bundleVersion !== bundle.version) return false;
  try {
    const key = await crypto.subtle.importKey("jwk", ACCESS_BUNDLE_VERIFY_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromBase64Url(signatureDocument.signature),
      textEncoder.encode(canonicalJson(bundle)),
    );
  } catch { return false; }
}
function configurationFromBundle(bundle) {
  validateSharedConfiguration(bundle.policy, bundle.revocations, bundle.accessPublicKey);
  return { policy: bundle.policy, revocations: bundle.revocations, publicKeyInfo: bundle.accessPublicKey };
}
function saveLastKnownGood(bundle, signatureDocument) {
  safeStorageSet(LKG_KEY, JSON.stringify({
    schema: "ghrab-access-last-known-good-v4",
    fetchedAt: nowIso(),
    sharedAccessVersion: accessState.deployment?.sharedAccessVersion || bundle.version || "unknown",
    bundle,
    signature: signatureDocument,
  }));
}
async function readLastKnownGood() {
  const parsed = safeJsonParse(safeStorageGet(LKG_KEY), null);
  if (!parsed || ![
    "ghrab-access-last-known-good-v2",
    "ghrab-access-last-known-good-v3",
    "ghrab-access-last-known-good-v4",
  ].includes(parsed.schema)) return null;
  if (!await verifyAccessBundle(parsed.bundle, parsed.signature)) { safeStorageRemove(LKG_KEY); return null; }
  try { configurationFromBundle(parsed.bundle); } catch { safeStorageRemove(LKG_KEY); return null; }
  const expectedVersion = String(accessState.deployment?.sharedAccessVersion || "").trim();
  if (expectedVersion && expectedVersion !== "unavailable" && parsed.bundle?.version !== expectedVersion) {
    safeStorageRemove(LKG_KEY);
    return null;
  }
  const issuedAt = parsed.bundle?.issuedAt || parsed.bundle?.generatedAt || "";
  const issuedMs = Date.parse(issuedAt);
  const fetchedMs = Date.parse(parsed.fetchedAt || "");
  const skewMs = Math.max(0, Number(parsed.bundle?.policy?.clockSkewSeconds || 300)) * 1000;
  if (
    !Number.isFinite(issuedMs) ||
    !Number.isFinite(fetchedMs) ||
    issuedMs > Date.now() + skewMs ||
    fetchedMs > Date.now() + skewMs
  ) {
    safeStorageRemove(LKG_KEY);
    return null;
  }
  return {
    ...parsed,
    issuedAt,
    offlineAgeHours: Math.max(0, (Date.now() - fetchedMs) / 3600000),
    signedBundleAgeHours: Math.max(0, (Date.now() - issuedMs) / 3600000),
  };
}
function applySharedConfiguration({
  policy,
  revocations,
  publicKeyInfo,
  fetchedAt,
  connectionState,
  revocationCheckMode,
  offlineAgeHours = null,
  signedBundleAgeHours = null,
}) {
  accessState.policy = policy;
  accessState.revocations = revocations;
  accessState.publicKeyInfo = publicKeyInfo;
  accessState.fetchedAt = fetchedAt || nowIso();
  accessState.offlineAgeHours = offlineAgeHours;
  accessState.signedBundleAgeHours = signedBundleAgeHours;
  accessState.connectionState = connectionState;
  accessState.revocationListUpdatedAt = revocations.updatedAt || null;
  accessState.revocationCheckMode = revocationCheckMode;
}
async function initialiseSignedPermit(options) {
  const bundleUrl = options.bundleUrl ? new URL(options.bundleUrl, location.href) : new URL("access-config-bundle.json", CONFIG_BASE);
  const signatureUrl = options.bundleSignatureUrl ? new URL(options.bundleSignatureUrl, location.href) : new URL("access-config-bundle.sig.json", CONFIG_BASE);
  const timeoutMs = Math.max(500, Number(options.timeoutMs || 5000));
  try {
    const [bundle, signatureDocument] = await Promise.all([fetchJson(bundleUrl, timeoutMs), fetchJson(signatureUrl, timeoutMs)]);
    if (!await verifyAccessBundle(bundle, signatureDocument)) throw new Error("invalid access bundle signature");
    const expectedVersion = String(accessState.deployment?.sharedAccessVersion || "").trim();
    if (expectedVersion && expectedVersion !== "unavailable" && bundle.version !== expectedVersion) {
      throw new Error("configuration-version-mismatch");
    }
    const configuration = configurationFromBundle(bundle);
    const bundleLimit = Math.max(0, Number(bundle.maxOfflineAgeHours ?? bundle.policy?.maxOfflineAgeHours ?? DEFAULT_MAX_OFFLINE_AGE_HOURS));
    accessState.maxOfflineAgeHours = Math.min(accessState.maxOfflineAgeHours, bundleLimit || accessState.maxOfflineAgeHours);
    const signedBundleLimit = Math.max(0, Number(
      bundle.maxSignedBundleAgeDays ?? bundle.policy?.maxSignedBundleAgeDays ?? DEFAULT_MAX_SIGNED_BUNDLE_AGE_DAYS,
    ));
    accessState.maxSignedBundleAgeDays = Math.min(
      accessState.maxSignedBundleAgeDays,
      signedBundleLimit || accessState.maxSignedBundleAgeDays,
    );
    const issuedMs = Date.parse(bundle.issuedAt || bundle.generatedAt || "");
    const signedBundleAgeHours = Number.isFinite(issuedMs)
      ? Math.max(0, (Date.now() - issuedMs) / 3600000)
      : Number.POSITIVE_INFINITY;
    if (signedBundleAgeHours > accessState.maxSignedBundleAgeDays * 24) {
      accessState.signedBundleAgeHours = signedBundleAgeHours;
      accessState.connectionState = "configuration-stale";
      throw new Error("configuration-stale");
    }
    applySharedConfiguration({
      ...configuration,
      fetchedAt: nowIso(),
      connectionState: "online",
      revocationCheckMode: "online-signed-bundle",
      signedBundleAgeHours,
    });
    saveLastKnownGood(bundle, signatureDocument);
  } catch (error) {
    const lkg = await readLastKnownGood();
    if (!lkg) {
      if (error?.message === "configuration-stale") throw error;
      throw Object.assign(new Error("configuration-unavailable"), { cause: error });
    }
    const configuration = configurationFromBundle(lkg.bundle);
    const bundleLimit = Math.max(0, Number(lkg.bundle.maxOfflineAgeHours ?? lkg.bundle.policy?.maxOfflineAgeHours ?? DEFAULT_MAX_OFFLINE_AGE_HOURS));
    accessState.maxOfflineAgeHours = Math.min(accessState.maxOfflineAgeHours, bundleLimit || accessState.maxOfflineAgeHours);
    const signedBundleLimit = Math.max(0, Number(
      lkg.bundle.maxSignedBundleAgeDays ?? lkg.bundle.policy?.maxSignedBundleAgeDays ?? DEFAULT_MAX_SIGNED_BUNDLE_AGE_DAYS,
    ));
    accessState.maxSignedBundleAgeDays = Math.min(
      accessState.maxSignedBundleAgeDays,
      signedBundleLimit || accessState.maxSignedBundleAgeDays,
    );
    if (lkg.signedBundleAgeHours > accessState.maxSignedBundleAgeDays * 24) {
      accessState.signedBundleAgeHours = lkg.signedBundleAgeHours;
      accessState.connectionState = "configuration-stale";
      throw Object.assign(new Error("configuration-stale"), { cause: error });
    }
    if (lkg.offlineAgeHours > accessState.maxOfflineAgeHours) {
      accessState.offlineAgeHours = lkg.offlineAgeHours;
      accessState.connectionState = "offline-stale";
      throw Object.assign(new Error("offline-stale"), { cause: error });
    }
    applySharedConfiguration({
      ...configuration,
      fetchedAt: lkg.fetchedAt,
      connectionState: "offline-fresh",
      revocationCheckMode: "offline-signed-last-known-good",
      offlineAgeHours: lkg.offlineAgeHours,
      signedBundleAgeHours: lkg.signedBundleAgeHours,
    });
  }
  const token = safeStorageGet(TOKEN_KEY);
  const result = await verifyToken(token);
  accessState.token = token;
  accessState.permit = result.permit || null;
  accessState.valid = result.valid;
  accessState.reason = result.reason;
  accessState.checkedAt = nowIso();
}
function sessionPermitFromResponse(data) {
  const user = data?.user || data?.session?.user || {};
  const roles = normaliseApps(user.roles || (user.role ? [user.role] : []));
  return {
    schema: "ghrab-server-session-v1",
    sub: String(user.id || user.idHash || user.sub || user.email || ""),
    email: user.email ? String(user.email) : undefined,
    displayName: user.displayName ? String(user.displayName) : undefined,
    role: String(user.role || (roles.includes("admin") ? "admin" : roles[0]) || "teacher"),
    roles,
    apps: normaliseApps(user.apps || data.apps || ["*"]),
    training: user.training && typeof user.training === "object" ? user.training : {},
    exp: data.expiresAt ? Math.floor(Date.parse(data.expiresAt) / 1000) : undefined,
    jti: data.sessionId ? String(data.sessionId) : "server-session",
  };
}
async function initialiseServerSession(options) {
  const url = options.sessionUrl ? new URL(options.sessionUrl, location.href) : endpoint(accessState.deployment, "session", "session");
  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    }, Math.max(500, Number(options.timeoutMs || 5000)));
  } catch (error) {
    accessState.connectionState = navigator.onLine ? "server-unavailable" : "offline-stale";
    throw Object.assign(new Error(navigator.onLine ? "server-unavailable" : "server-offline"), { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401) throw Object.assign(new Error("session-required"), { status: 401 });
  if (response.status === 403) throw Object.assign(new Error("access-denied"), { status: 403 });
  if (!response.ok) throw Object.assign(new Error("server-unavailable"), { status: response.status });
  if (!data || !["ghrab-session-v1", "ghrab-server-session-v1"].includes(data.schema) || data.authenticated !== true) throw new Error("session-required");
  const permit = sessionPermitFromResponse(data);
  if (!permit.sub) throw new Error("session-invalid");
  accessState.token = null;
  accessState.permit = permit;
  accessState.valid = true;
  accessState.reason = "valid";
  accessState.checkedAt = nowIso();
  accessState.fetchedAt = accessState.checkedAt;
  accessState.connectionState = "online";
  accessState.revocationCheckMode = "server-authoritative";
  accessState.revocationListUpdatedAt = data.policyVersion || null;
  accessState.policy = data.accessPolicy || {
    schema: "ghrab-access-policy-v1",
    administratorRoles: ["admin"],
    applications: {},
  };
  globalThis.__GHRAB_SERVER_SESSION__ = Object.freeze({
    schema: data.schema,
    authenticated: true,
    user: Object.freeze({ ...permit }),
    expiresAt: data.expiresAt || null,
    requestToken: data.requestToken || data.csrfToken || null,
    csrfToken: data.csrfToken || data.requestToken || null,
    requestTokenStorage: "memory-only",
  });
}

export async function initialiseAccess(options = {}) {
  accessState.ready = false;
  accessState.connectionState = "checking";
  resetVerification("loading");
  accessState.deployment = await deploymentContext();
  accessState.mode = String(options.authMode || accessState.deployment?.authMode || "signed-permit");
  accessState.maxOfflineAgeHours = Math.max(0, Number(
    options.maxOfflineAgeHours ?? accessState.deployment?.access?.maxOfflineAgeHours ?? DEFAULT_MAX_OFFLINE_AGE_HOURS,
  ));
  accessState.maxSignedBundleAgeDays = Math.max(0, Number(
    options.maxSignedBundleAgeDays ??
      accessState.deployment?.access?.maxSignedBundleAgeDays ??
      DEFAULT_MAX_SIGNED_BUNDLE_AGE_DAYS,
  ));
  try {
    if (accessState.mode === "disabled") throw new Error("configuration-unavailable");
    if (accessState.mode === "server-session") await initialiseServerSession(options);
    else await initialiseSignedPermit(options);
  } catch (error) {
    const knownReason = String(error?.message || "");
    const reason = [
      "offline-stale", "configuration-stale", "configuration-unavailable", "session-required", "session-invalid",
      "access-denied", "server-unavailable", "server-offline",
    ].includes(knownReason) ? knownReason : "configuration-unavailable";
    console.warn("AI Studio: access configuration could not be loaded", error);
    resetVerification(reason, accessState.mode === "server-session" ? null : safeStorageGet(TOKEN_KEY));
  }
  accessState.ready = true;
  emitChange();
  return getAccessSnapshot();
}
export async function inspectPermitToken(token) {
  if (accessState.mode === "server-session") return { ok: false, reason: "server-session-managed" };
  const clean = String(token || "").trim();
  if (!clean) return { ok: false, reason: "missing" };
  if (!accessState.policy) await initialiseAccess();
  const result = await verifyToken(clean);
  return { ok: Boolean(result.valid), valid: Boolean(result.valid), reason: result.reason, permit: result.permit || null };
}
export async function setPermitToken(token) {
  if (accessState.mode === "server-session") return { ok: false, reason: "server-session-managed" };
  const clean = String(token || "").trim();
  if (!clean) return { ok: false, reason: "missing" };
  if (!accessState.policy) await initialiseAccess();
  const result = await verifyToken(clean);
  if (!result.valid) return { ok: false, reason: result.reason, permit: result.permit || null };
  if (!safeStorageSet(TOKEN_KEY, clean)) return { ok: false, reason: "storage-error" };
  accessState.token = clean;
  accessState.permit = result.permit;
  accessState.valid = true;
  accessState.reason = "valid";
  accessState.checkedAt = nowIso();
  emitChange();
  return { ok: true, permit: result.permit };
}
export function clearPermit() {
  safeStorageRemove(TOKEN_KEY);
  if (accessState.mode === "server-session") globalThis.__GHRAB_SERVER_SESSION__ = null;
  resetVerification(accessState.mode === "server-session" ? "session-required" : "missing", null);
  accessState.ready = true;
  emitChange();
}
export async function readPermitFile(file) {
  if (accessState.mode === "server-session") return { ok: false, reason: "server-session-managed" };
  if (!file) return { ok: false, reason: "missing-file" };
  if (file.size > 128 * 1024) return { ok: false, reason: "file-too-large" };
  try {
    const parsed = JSON.parse(await file.text());
    const token = typeof parsed === "string" ? parsed : parsed?.token;
    return setPermitToken(token);
  } catch { return { ok: false, reason: "invalid-file" }; }
}
export function getAccessSnapshot() {
  return {
    ready: accessState.ready,
    mode: accessState.mode,
    valid: accessState.valid,
    reason: accessState.reason,
    permit: accessState.permit ? { ...accessState.permit, apps: [...(accessState.permit.apps || [])] } : null,
    policy: accessState.policy,
    checkedAt: accessState.checkedAt,
    fetchedAt: accessState.fetchedAt,
    connectionState: accessState.connectionState,
    offlineAgeHours: accessState.offlineAgeHours,
    maxOfflineAgeHours: accessState.maxOfflineAgeHours,
    signedBundleAgeHours: accessState.signedBundleAgeHours,
    maxSignedBundleAgeDays: accessState.maxSignedBundleAgeDays,
    revocationListUpdatedAt: accessState.revocationListUpdatedAt,
    revocationCheckMode: accessState.revocationCheckMode,
    sharedAccessVersion: accessState.deployment?.sharedAccessVersion || null,
  };
}
export function getPermitToken() { return accessState.mode === "signed-permit" && accessState.valid ? accessState.token : null; }
export function isAdmin() {
  if (!accessState.valid) return false;
  return (accessState.policy?.administratorRoles || ["admin"]).includes(accessState.permit?.role);
}
export function isOperator() {
  if (!accessState.valid || isAdmin()) return false;
  const roles = accessState.policy?.operatorRoles || [OPERATOR_ROLE];
  return roles.includes(accessState.permit?.role);
}
export function canAccessAdminPage(pageId) {
  if (!accessState.valid) return false;
  if (isAdmin()) return true;
  if (!isOperator()) return false;
  const pages = accessState.policy?.operatorPages || DEFAULT_OPERATOR_PAGES;
  return Array.isArray(pages) && pages.includes(String(pageId || ""));
}
function trainingFailure(appId) {
  if (accessState.mode === "server-session") return null;
  const required = accessState.policy?.applications?.[appId];
  if (!required?.trainingRequired) return null;
  const held = accessState.permit?.training?.[appId];
  if (!held) return "training-missing";
  if (held.code !== required.trainingCode || held.version !== required.trainingVersion) return "training-outdated";
  return null;
}
export function hasAppAccess(appId) {
  if (!accessState.ready) return { enabled: false, reason: "loading", permit: null };
  if (!accessState.valid) return { enabled: false, reason: accessState.reason, permit: accessState.permit };
  if (isAdmin()) return { enabled: true, reason: "administrator", permit: accessState.permit };
  const apps = accessState.permit?.apps || [];
  if (!apps.includes("*") && !apps.includes(appId)) return { enabled: false, reason: "app-not-permitted", permit: accessState.permit };
  const trainingReason = trainingFailure(appId);
  if (trainingReason) return { enabled: false, reason: trainingReason, permit: accessState.permit };
  return { enabled: true, reason: "permitted", permit: accessState.permit };
}
export function requiredTraining(appId) { return accessState.policy?.applications?.[appId] || null; }
export function formatReason(reason, language = "cs") {
  const messages = {
    cs: {
      loading: "Ověřuji přístup…", missing: "Přístup zatím nebyl aktivován.",
      "invalid-format": "Přístupový kód má neplatný formát.", "invalid-payload": "Přístupový kód je poškozený.",
      "invalid-schema": "Přístupový kód používá nepodporovanou verzi.", "invalid-audience": "Přístupový kód nepatří k tomuto Studiu.",
      "missing-claims": "V přístupovém kódu chybí povinné údaje.", "invalid-role": "Přístupový kód obsahuje nepovolenou roli.", "invalid-time-claims": "Přístupový kód obsahuje neplatné datum.",
      "not-yet-valid": "Přístup ještě není platný.", "issued-in-future": "Přístupový kód má neplatné datum vydání.",
      expired: "Platnost přístupu skončila.", "invalid-validity-window": "Přístupový kód má neplatnou dobu platnosti.",
      "validity-too-long": "Doba platnosti přístupu překračuje povolený limit.", "revoked-by-date": "Tento přístup byl centrálně zneplatněn.",
      revoked: "Tento přístup byl správcem zneplatněn.", "unknown-key": "Přístupový kód byl podepsán neznámým klíčem.",
      "invalid-signature": "Digitální podpis přístupu není platný.", "verification-error": "Přístup se nepodařilo kryptograficky ověřit.",
      "configuration-unavailable": "Konfiguraci přístupů se nepodařilo načíst.", "configuration-stale": "Podepsaná bezpečnostní konfigurace je příliš stará. Správce musí vydat novou verzi.",
      "offline-stale": "Od posledního online ověření uplynula příliš dlouhá doba. Připojte zařízení k internetu.",
      "server-offline": "Školní server nelze ověřit bez připojení k internetu.", "server-unavailable": "Školní server je dočasně nedostupný.",
      "session-required": "Přihlaste se ke školnímu serveru.", "session-invalid": "Serverová relace je neplatná nebo vypršela.",
      "server-session-managed": "Přístup spravuje školní server.", "access-denied": "Školní server tento přístup nepovolil.",
      "app-not-permitted": "Tato aplikace není v přístupu odemčena.",
      "training-missing": "Přístup neobsahuje potvrzení požadovaného školení pro tuto aplikaci.",
      "training-outdated": "Pro tuto aplikaci je nutné obnovit školení a vydat nové oprávnění.",
      administrator: "Správcovský přístup je aktivní.", operator: "Přístup zástupce správce je aktivní.", permitted: "Přístup k aplikaci je aktivní.",
      "storage-error": "Prohlížeč nepovolil uložení přístupu.", "invalid-file": "Soubor s přístupem nelze přečíst.",
      "file-too-large": "Soubor s přístupem je příliš velký.", "missing-file": "Nebyl vybrán soubor.",
    },
    en: {
      loading: "Verifying access…", missing: "Access has not been activated yet.",
      "invalid-format": "The access code has an invalid format.", "invalid-payload": "The access code is damaged.",
      "invalid-schema": "The access code uses an unsupported version.", "invalid-audience": "The access code does not belong to this Studio.",
      "missing-claims": "Required access data is missing.", "invalid-role": "The access code contains an unsupported role.", "invalid-time-claims": "The access code contains an invalid date.",
      "not-yet-valid": "Access is not valid yet.", "issued-in-future": "The access code has an invalid issue date.", expired: "Access has expired.",
      "invalid-validity-window": "The access validity period is invalid.", "validity-too-long": "The access validity exceeds the allowed limit.",
      "revoked-by-date": "This access has been centrally revoked.", revoked: "This access has been revoked by the administrator.",
      "unknown-key": "The access code was signed by an unknown key.", "invalid-signature": "The digital signature is invalid.",
      "verification-error": "Access could not be cryptographically verified.", "configuration-unavailable": "The access configuration could not be loaded.",
      "configuration-stale": "The signed security configuration is too old. An administrator must issue a new version.",
      "offline-stale": "Too much time has passed since the last online verification. Connect this device to the internet.",
      "server-offline": "The school server cannot be verified while offline.", "server-unavailable": "The school server is temporarily unavailable.",
      "session-required": "Sign in to the school server.", "session-invalid": "The server session is invalid or expired.",
      "server-session-managed": "Access is managed by the school server.", "access-denied": "The school server denied this access.",
      "app-not-permitted": "This application is not unlocked in your access.",
      "training-missing": "The permit does not contain the required training confirmation for this application.",
      "training-outdated": "Training must be renewed and a new permit issued for this application.",
      administrator: "Administrator access is active.", operator: "Deputy administrator access is active.", permitted: "Application access is active.",
      "storage-error": "The browser did not allow access to be saved.", "invalid-file": "The access file could not be read.",
      "file-too-large": "The access file is too large.", "missing-file": "No file was selected.",
    },
  };
  return messages[language]?.[reason] || messages.cs[reason] || reason;
}
export function encodePayloadForSigning(payload) { return toBase64Url(textEncoder.encode(JSON.stringify(payload))); }
