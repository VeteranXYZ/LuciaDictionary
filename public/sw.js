const CACHE_PREFIX = "lucia-local-core-";
const CACHE_NAME = "lucia-local-core-__BUILD_HASH__";
const BUILD_ASSET_PREFIX = "/_a/";
const PRECACHE_URLS = /* __PRECACHE_URLS__ */ [
  "/",
  "/manifest.webmanifest",
  "/assets/dict.json",
  "/assets/lexicon/core-lexicon.json",
  "/assets/phonetics.json",
  "/assets/phrasebook.json",
  "/assets/logo.png",
  "/assets/lucia.png",
  "/assets/monkey.png",
  "/favicon.png",
  "/favicon.ico",
];
const PRECACHE_PATHS = new Set(PRECACHE_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

async function cacheFirst(request) {
  const url = new URL(request.url);
  const cached =
    (await caches.match(request, { ignoreSearch: true })) ||
    (await caches.match(url.pathname, { ignoreSearch: true }));
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, event) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      event.waitUntil(
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, response.clone())),
      );
    }
    return response;
  } catch {
    const url = new URL(request.url);
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(url.pathname, { ignoreSearch: true })) ||
      (await caches.match("/"))
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isSameOrigin(request)) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, event));
    return;
  }

  if (
    url.pathname.startsWith(BUILD_ASSET_PREFIX) ||
    PRECACHE_PATHS.has(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
