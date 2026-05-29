import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateOnlineWord, getLookupFallbackMessage, LOCAL_MISSING_MESSAGE, ONLINE_FAILURE_MESSAGE, ONLINE_LOOKUP_BUTTON_LABEL } from "./ui.js";

const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.document = originalDocument;
});

function installTinyDocument() {
  globalThis.document = {
    createElement() {
      return { className: "", textContent: "" };
    }
  };
}

function makeTextElement() {
  return {
    textContent: "",
    replaceChildren(...nodes) {
      this.textContent = nodes.map(node => node.textContent || "").join("");
    },
    appendChild(node) {
      this.textContent += node.textContent || "";
    }
  };
}

describe("lookup fallback messages", () => {
  it("shows the local missing message during normal analysis", () => {
    expect(getLookupFallbackMessage()).toBe(LOCAL_MISSING_MESSAGE);
    expect(getLookupFallbackMessage({ failed: true })).toBe(LOCAL_MISSING_MESSAGE);
  });

  it("shows the network failure message only after explicit online lookup failure", () => {
    expect(getLookupFallbackMessage({ explicitLookup: true, failed: true })).toBe(ONLINE_FAILURE_MESSAGE);
  });

  it("uses the full online lookup button label", () => {
    expect(ONLINE_LOOKUP_BUTTON_LABEL).toBe("联网查询");
  });

  it("does not call online lookup during normal analysis hydration", async () => {
    installTinyDocument();
    const lookupOnlineData = vi.fn();
    const cn = makeTextElement();
    const ph = { textContent: "" };

    await hydrateOnlineWord("unknownword", cn, ph, {}, {
      getCachedOnlineWord: () => null,
      lookupOnlineData,
      setMeaning: () => {},
      isCurrentRun: () => true,
      fillMeaning: true,
      allowNetwork: false
    });

    expect(lookupOnlineData).not.toHaveBeenCalled();
    expect(cn.textContent).toBe(LOCAL_MISSING_MESSAGE);
  });

  it("calls online lookup only for explicit per-word lookup", async () => {
    installTinyDocument();
    const lookupOnlineData = vi.fn(async () => null);
    const cn = makeTextElement();
    const ph = { textContent: "" };

    await hydrateOnlineWord("unknownword", cn, ph, {}, {
      getCachedOnlineWord: () => null,
      lookupOnlineData,
      setMeaning: () => {},
      isCurrentRun: () => true,
      fillMeaning: true,
      allowNetwork: true,
      explicitLookup: true
    });

    expect(lookupOnlineData).toHaveBeenCalledTimes(1);
    expect(cn.textContent).toBe(ONLINE_FAILURE_MESSAGE);
  });
});
