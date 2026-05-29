export const ONLINE_DICT_CACHE = "lucia-online-dict-v1";
export const TRANSLATE_CACHE = "lucia-translate-v1";
export const TIP_DISMISSED_KEY = "lucia-learning-tip-dismissed";
export const WORDBOOK_KEY = "lucia-wordbook";

export const DEFAULT_SETTINGS = { speed: "normal", repeat: 3 };
export const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
export const CACHE_MAX_ITEMS = 240;

export function readStoredJson(key, fallback) {
  try {
    const value = globalThis.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function getSetting(key) {
  return readStoredJson("lucia-" + key, DEFAULT_SETTINGS[key]);
}

export function setSetting(key, value) {
  writeStoredJson("lucia-" + key, value);
}

export function trimCacheEntries(value, maxItems = CACHE_MAX_ITEMS) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort((a, b) => {
        const at = a[1] && typeof a[1] === "object" ? a[1].cachedAt || 0 : 0;
        const bt = b[1] && typeof b[1] === "object" ? b[1].cachedAt || 0 : 0;
        return bt - at;
      })
      .slice(0, maxItems)
  );
}

export function readCache(key, options = {}) {
  const ttl = options.ttl ?? CACHE_TTL;
  const raw = readStoredJson(key, {});
  const now = Date.now();
  let changed = false;

  for (const [cacheKey, value] of Object.entries(raw)) {
    const cachedAt = value && typeof value === "object" ? value.cachedAt : 0;
    if (cachedAt && now - cachedAt > ttl) {
      delete raw[cacheKey];
      changed = true;
    }
  }

  if (changed) writeCache(key, raw, options);
  return raw;
}

export function writeCache(key, value, options = {}) {
  writeStoredJson(key, trimCacheEntries(value, options.maxItems ?? CACHE_MAX_ITEMS));
}

export function clearLookupCaches() {
  try {
    globalThis.localStorage.removeItem(ONLINE_DICT_CACHE);
    globalThis.localStorage.removeItem(TRANSLATE_CACHE);
  } catch (e) {}
}

export async function loadJsonAsset(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}
