const APP_VERSION = "5.4.0";
const CACHE_NAME = `korespondencni-asistent-${APP_VERSION}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./manual/",
  "./manual/index.html",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("korespondencni-asistent-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_) {
    return (await caches.match(request)) || (await caches.match("./index.html"));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The client also loads the central access module and revocation data from
  // /AI-Studio-GHRAB/. Those security resources must always be handled by the
  // browser/network and must never be frozen in this application's PWA cache.
  const scopePath = new URL("./", self.location.href).pathname;
  if (!url.pathname.startsWith(scopePath) || request.cache === "no-store") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
