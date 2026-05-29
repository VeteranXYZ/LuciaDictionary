import { describe, expect, it } from "vitest";
import { getLookupFallbackMessage, LOCAL_MISSING_MESSAGE, ONLINE_FAILURE_MESSAGE } from "./ui.js";

describe("lookup fallback messages", () => {
  it("shows the local missing message during normal analysis", () => {
    expect(getLookupFallbackMessage()).toBe(LOCAL_MISSING_MESSAGE);
    expect(getLookupFallbackMessage({ failed: true })).toBe(LOCAL_MISSING_MESSAGE);
  });

  it("shows the network failure message only after explicit online lookup failure", () => {
    expect(getLookupFallbackMessage({ explicitLookup: true, failed: true })).toBe(ONLINE_FAILURE_MESSAGE);
  });
});
