import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppState, subscribeAppState } from "./app-state.js";
import { setSetting } from "./storage.js";
import { clearWordbookItems, toggleStar } from "./wordbook.js";

function installStorage() {
  const data = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
      clear: () => data.clear(),
    },
  });
}

describe("app state", () => {
  beforeEach(installStorage);

  it("returns one snapshot for wordbook and settings", async () => {
    await toggleStar("read", "阅读");
    setSetting("speed", "slow");

    expect(getAppState()).toMatchObject({
      wordbook: [{ w: "read", m: "阅读" }],
      wordbookSummary: { total: 1, due: 1, mastered: 0 },
      settings: { speed: "slow", repeat: 3 },
    });
  });

  it("publishes scoped updates for every supported mutation", async () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeAppState(subscriber);

    await toggleStar("write", "写");
    setSetting("repeat", 5);
    await clearWordbookItems();
    unsubscribe();
    setSetting("repeat", 1);

    expect(subscriber.mock.calls.map(([, change]) => change.scope)).toEqual([
      "all",
      "wordbook",
      "settings",
      "wordbook",
    ]);
    expect(subscriber.mock.calls[3][0].wordbook).toEqual([]);
  });

  it("keeps storage writes successful when a subscriber fails", async () => {
    const unsubscribe = subscribeAppState(
      () => {
        throw new Error("render failed");
      },
      { immediate: false },
    );

    expect(await toggleStar("draw", "画")).toBe(true);
    expect(getAppState().wordbook).toHaveLength(1);
    unsubscribe();
  });
});
