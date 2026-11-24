import { fetchJsonWithPolicy } from "./network.js";

export const ONLINE_DICT_CACHE = "lucia-online-dict-v1";
export const TRANSLATE_CACHE = "lucia-translate-v1";
export const TIP_DISMISSED_KEY = "lucia-learning-tip-dismissed";
export const WORDBOOK_KEY = "lucia-wordbook";
export const CLIENT_ID_KEY = "lucia-client-id";

export const DEFAULT_SETTINGS = {
  speed: "normal",
  repeat: 3,
  offlineOnly: false,
};
export const SETTING_STORAGE_PREFIX = "lucia-";
export const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
export const CACHE_MAX_ITEMS = 240;

const storageSubscribers = new Set();

function publishStorageChange(key, value, external = false) {
  for (const subscriber of storageSubscribers) {
    try {
      subscriber({ key, value, external });
    } catch {
      // A rendering subscriber must never make a successful local write fail.
    }
  }
}

globalThis.window?.addEventListener("storage", (event) => {
  if (event.storageArea === window.localStorage) {
    publishStorageChange(
      event.key,
      event.key === getSettingStorageKey("offlineOnly")
        ? event.newValue === "true"
        : undefined,
      true,
    );
  }
});

export function subscribeStorage(subscriber) {
  storageSubscribers.add(subscriber);
  return () => storageSubscribers.delete(subscriber);
}

// Run the synchronous localStorage read/modify/write as one cross-tab edit.
// IndexedDB readwrite transactions also serialize writers in older browsers.
export async function withStorageLock(key, edit) {
  if (globalThis.navigator?.locks) return navigator.locks.request(key, edit);
  if (typeof window === "undefined") return edit();
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("lucia-storage-locks", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("locks");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("locks", "readwrite");
      let result;
      tx.objectStore("locks").get(key).onsuccess = () => {
        try {
          result = edit();
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

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
    publishStorageChange(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

export function getSetting(key) {
  return readStoredJson(getSettingStorageKey(key), DEFAULT_SETTINGS[key]);
}

export function setSetting(key, value) {
  return writeStoredJson(getSettingStorageKey(key), value);
}

export function getSettingStorageKey(key) {
  return SETTING_STORAGE_PREFIX + key;
}

// "Offline only" is a parent-facing promise: while it is on, nothing the child
// types or photographs may leave the device, whatever the caller asks for.
export function isNetworkAllowed() {
  return getSetting("offlineOnly") !== true;
}

export const OFFLINE_ONLY_ERROR = "offline_only";
function offlineError() {
  return Object.assign(new Error("Offline-only mode is enabled"), {
    code: OFFLINE_ONLY_ERROR,
  });
}

let networkAccess = new AbortController();

export function assertNetworkAllowed() {
  if (!isNetworkAllowed()) throw offlineError();
}

export function getNetworkSignal() {
  return isNetworkAllowed()
    ? networkAccess.signal
    : AbortSignal.abort(offlineError());
}

subscribeStorage(({ key, value }) => {
  if (
    key === getSettingStorageKey("offlineOnly") &&
    (value === true || !isNetworkAllowed())
  ) {
    networkAccess.abort(offlineError());
    networkAccess = new AbortController();
  }
});

export function trimCacheEntries(value, maxItems = CACHE_MAX_ITEMS) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort((a, b) => {
        const at = a[1] && typeof a[1] === "object" ? a[1].cachedAt || 0 : 0;
        const bt = b[1] && typeof b[1] === "object" ? b[1].cachedAt || 0 : 0;
        return bt - at;
      })
      .slice(0, maxItems),
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
  writeStoredJson(
    key,
    trimCacheEntries(value, options.maxItems ?? CACHE_MAX_ITEMS),
  );
}

export function clearLookupCaches() {
  try {
    globalThis.localStorage.removeItem(ONLINE_DICT_CACHE);
    globalThis.localStorage.removeItem(TRANSLATE_CACHE);
  } catch (e) {}
}

export function getClientId(
  storage = globalThis.localStorage,
  cryptoImpl = globalThis.crypto,
) {
  try {
    const existing = storage.getItem(CLIENT_ID_KEY);
    if (/^[a-z0-9-]{8,64}$/i.test(existing || "")) return existing;
    if (typeof cryptoImpl?.randomUUID !== "function") return "";
    const created = cryptoImpl.randomUUID();
    storage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export async function loadJsonAsset(path, fallback) {
  try {
    const res = await fetchJsonWithPolicy(
      path,
      {},
      { timeoutMs: 15000, retries: 1 },
    );
    if (!res.ok) return fallback;
    return res.data;
  } catch (e) {
    return fallback;
  }
}
