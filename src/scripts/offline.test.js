import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { isOffline, registerServiceWorker } from "./offline.js";

describe("isOffline", () => {
  it("detects offline browser state", () => {
    expect(isOffline({ onLine: false })).toBe(true);
    expect(isOffline({ onLine: true })).toBe(false);
  });
});

describe("registerServiceWorker", () => {
  it("does not register when service workers are unavailable", () => {
    expect(registerServiceWorker({})).toBe(false);
  });

  it("defers registration until window load", () => {
    const register = vi.fn(() => Promise.resolve());
    const win = {
      addEventListener: vi.fn((event, cb) => {
        if (event === "load") cb();
      }),
    };
    expect(
      registerServiceWorker({ serviceWorker: { register } }, win, true),
    ).toBe(true);
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});

describe("service worker asset routing", () => {
  it("tracks Astro's configured build asset directory", () => {
    const source = fs.readFileSync("public/sw.js", "utf8");
    expect(source).toContain('const BUILD_ASSET_PREFIX = "/_a/"');
    expect(source).toContain("__PRECACHE_URLS__");
    expect(source).not.toContain('startsWith("/_astro/")');
  });
});
