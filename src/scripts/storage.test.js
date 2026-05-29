import { beforeEach, describe, expect, it } from "vitest";
import { CACHE_MAX_ITEMS, readCache, trimCacheEntries, writeCache } from "./storage.js";

function installStorage() {
  const data = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
    }
  });
}

describe("cache trimming", () => {
  beforeEach(installStorage);

  it("keeps newest entries by cachedAt", () => {
    const input = {
      old: { cachedAt: 1 },
      newest: { cachedAt: 3 },
      middle: { cachedAt: 2 }
    };
    expect(Object.keys(trimCacheEntries(input, 2))).toEqual(["newest", "middle"]);
  });

  it("trims persisted cache to the configured limit", () => {
    const value = {};
    const now = Date.now();
    for (let i = 0; i < CACHE_MAX_ITEMS + 10; i++) {
      value[`item-${i}`] = { cachedAt: now + i };
    }
    writeCache("cache", value);
    expect(Object.keys(readCache("cache")).length).toBe(CACHE_MAX_ITEMS);
    expect(readCache("cache")["item-0"]).toBeUndefined();
  });
});
