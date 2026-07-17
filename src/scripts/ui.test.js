import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWordCard,
  hydrateOnlineWord,
  getLookupFallbackMessage,
  LOCAL_MISSING_MESSAGE,
  ONLINE_FAILURE_MESSAGE,
  ONLINE_LOOKUP_BUTTON_LABEL,
} from "./ui.js";

const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.document = originalDocument;
});

function installTinyDocument() {
  globalThis.document = {
    createElement() {
      return { className: "", textContent: "" };
    },
  };
}

function makeTextElement() {
  return {
    textContent: "",
    replaceChildren(...nodes) {
      this.textContent = nodes.map((node) => node.textContent || "").join("");
    },
    appendChild(node) {
      this.textContent += node.textContent || "";
    },
  };
}

function makeContainer() {
  return {
    children: [],
    appendChild(node) {
      this.children.push(node);
    },
  };
}

function makeElement(tag = "div") {
  return {
    tag,
    className: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    style: {},
    children: [],
    attributes: {},
    listeners: {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
      this.textContent = nodes.map((node) => node.textContent || "").join("");
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    },
    querySelector(selector) {
      return findInTree(this, selector);
    },
  };
}

function findInTree(node, selector) {
  if (!node?.children) return null;
  for (const child of node.children) {
    if (
      selector.startsWith(".") &&
      String(child.className || "")
        .split(/\s+/)
        .includes(selector.slice(1))
    )
      return child;
    const found = findInTree(child, selector);
    if (found) return found;
  }
  return null;
}

describe("lookup fallback messages", () => {
  it("shows the local missing message during normal analysis", () => {
    expect(getLookupFallbackMessage()).toBe(LOCAL_MISSING_MESSAGE);
    expect(getLookupFallbackMessage({ failed: true })).toBe(
      LOCAL_MISSING_MESSAGE,
    );
  });

  it("shows the network failure message only after explicit online lookup failure", () => {
    expect(
      getLookupFallbackMessage({ explicitLookup: true, failed: true }),
    ).toBe(ONLINE_FAILURE_MESSAGE);
  });

  it("uses the concise online lookup button label", () => {
    expect(ONLINE_LOOKUP_BUTTON_LABEL).toBe("联网查词");
  });

  it("does not call online lookup during normal analysis hydration", async () => {
    installTinyDocument();
    const lookupOnlineData = vi.fn();
    const cn = makeTextElement();
    const ph = { textContent: "" };

    await hydrateOnlineWord(
      "unknownword",
      cn,
      ph,
      {},
      {
        getCachedOnlineWord: () => null,
        lookupOnlineData,
        setMeaning: () => {},
        isCurrentRun: () => true,
        fillMeaning: true,
        allowNetwork: false,
      },
    );

    expect(lookupOnlineData).not.toHaveBeenCalled();
    expect(cn.textContent).toBe(LOCAL_MISSING_MESSAGE);
  });

  it("calls online lookup only for explicit per-word lookup", async () => {
    installTinyDocument();
    const lookupOnlineData = vi.fn(async () => null);
    const cn = makeTextElement();
    const ph = { textContent: "" };

    await hydrateOnlineWord(
      "unknownword",
      cn,
      ph,
      {},
      {
        getCachedOnlineWord: () => null,
        lookupOnlineData,
        setMeaning: () => {},
        isCurrentRun: () => true,
        fillMeaning: true,
        allowNetwork: true,
        explicitLookup: true,
      },
    );

    expect(lookupOnlineData).toHaveBeenCalledTimes(1);
    expect(cn.textContent).toBe(ONLINE_FAILURE_MESSAGE);
  });

  it("does not show online lookup for known Rayna name cards", () => {
    globalThis.document = {
      createElement: makeElement,
      createTextNode(text) {
        return { textContent: text };
      },
    };
    const container = makeContainer();

    buildWordCard("rayna", 0, "Rayna，角色名", container, {
      stopWords: new Set(),
      lookupLocalPhonetic: () => "",
      isStarred: () => false,
      toggleStar: () => false,
      speakWordN: () => {},
      getCachedOnlineWord: () => null,
      lookupOnlineData: vi.fn(),
      sourceSentence: () => "",
      setMeaning: (card, meaning) => {
        card.dataset.meaning = meaning;
      },
      isCurrentRun: () => true,
    });

    expect(container.children[0].querySelector(".btn-online-lookup")).toBe(
      null,
    );
  });

  it("shows missing message and online lookup for non-reserved unknown words", () => {
    globalThis.document = {
      createElement: makeElement,
      createTextNode(text) {
        return { textContent: text };
      },
    };
    const container = makeContainer();

    buildWordCard("unknownword", 0, "", container, {
      stopWords: new Set(),
      lookupLocalPhonetic: () => "",
      isStarred: () => false,
      toggleStar: () => false,
      speakWordN: () => {},
      getCachedOnlineWord: () => null,
      lookupOnlineData: vi.fn(),
      sourceSentence: () => "",
      setMeaning: (card, meaning) => {
        card.dataset.meaning = meaning;
      },
      isCurrentRun: () => true,
    });

    const card = container.children[0];
    expect(card.querySelector(".btn-online-lookup")?.textContent).toBe(
      ONLINE_LOOKUP_BUTTON_LABEL,
    );
    expect(findInTree(card, ".muted-inline")?.textContent).toBe(
      LOCAL_MISSING_MESSAGE,
    );
  });
});
