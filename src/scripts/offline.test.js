import { describe, expect, it, vi } from "vitest";
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
      })
    };
    expect(registerServiceWorker({ serviceWorker: { register } }, win)).toBe(true);
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
