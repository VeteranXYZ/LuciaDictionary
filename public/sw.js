const CACHE_NAME = "lucia-local-core-v3";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/assets/dict.json",
  "/assets/lexicon/core-lexicon.json",
  "/assets/phrase-lexicon.json",
  "/assets/phonetics.json",
  "/assets/phrasebook.json",
  "/assets/logo.png",
  "/assets/lucia.png",
  "/assets/monkey.png",
  "/favicon.png",
  "/favicon.ico"
];
const PUBLIC_ASSET_PATHS = new Set(PRECACHE_URLS);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheableCoreRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_astro/")) return true;
  return PUBLIC_ASSET_PATHS.has(url.pathname);
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (!isCacheableCoreRequest(request)) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
