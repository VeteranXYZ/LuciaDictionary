import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSentenceSpeechLabel,
  renderSpeakableText,
  resetSentenceSpeech,
  startSentenceSpeech,
  toggleSentenceSpeech,
} from "./speech.js";

const originalDocument = globalThis.document;
const originalSpeechSynthesis = globalThis.speechSynthesis;
const originalUtterance = globalThis.SpeechSynthesisUtterance;

afterEach(() => {
  resetSentenceSpeech();
  vi.useRealTimers();
  globalThis.document = originalDocument;
  globalThis.speechSynthesis = originalSpeechSynthesis;
  globalThis.SpeechSynthesisUtterance = originalUtterance;
});

function makeClassList() {
  const classes = new Set();
  return {
    add: (cls) => classes.add(cls),
    remove: (cls) => classes.delete(cls),
    toggle(cls, force) {
      if (force) classes.add(cls);
      else classes.delete(cls);
    },
    contains: (cls) => classes.has(cls),
    toString: () => Array.from(classes).join(" "),
  };
}

function makeElement() {
  const el = {
    children: [],
    textContent: "",
    dataset: {},
    classList: makeClassList(),
    replaceChildren(...nodes) {
      this.children = nodes;
      this.textContent = nodes.map((node) => node.textContent || "").join("");
    },
    appendChild(node) {
      this.children.push(node);
      this.textContent += node.textContent || "";
    },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        if (
          selector === ".speaking-word" &&
          node.classList?.contains("speaking-word")
        )
          matches.push(node);
        for (const child of node.children || []) visit(child);
      };
      visit(this);
      return matches;
    },
  };
  return el;
}

function installSpeech() {
  let utterance;
  globalThis.document = {
    createElement() {
      return makeElement();
    },
    createTextNode(text) {
      return { textContent: text };
    },
    querySelectorAll() {
      return [];
    },
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      utterance = this;
    }
  };
  globalThis.speechSynthesis = {
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn(),
    getVoices: () => [],
  };
  return () => utterance;
}

describe("sentence read aloud", () => {
  it("changes label while speaking, paused, and ended", () => {
    const getUtterance = installSpeech();
    const textEl = makeElement();
    let state = "idle";

    startSentenceSpeech("Read the words.", {
      textEl,
      onStateChange: (next) => {
        state = next;
      },
    });
    expect(getSentenceSpeechLabel(state)).toBe("暂停朗读");

    toggleSentenceSpeech("Read the words.", {
      textEl,
      onStateChange: (next) => {
        state = next;
      },
    });
    expect(globalThis.speechSynthesis.pause).toHaveBeenCalled();
    expect(getSentenceSpeechLabel(state)).toBe("继续朗读");

    toggleSentenceSpeech("Read the words.", {
      textEl,
      onStateChange: (next) => {
        state = next;
      },
    });
    expect(globalThis.speechSynthesis.resume).toHaveBeenCalled();
    expect(getSentenceSpeechLabel(state)).toBe("暂停朗读");

    getUtterance().onend();
    expect(getSentenceSpeechLabel(state)).toBe("朗读整句");
  });

  it("applies and clears sentence word highlight", () => {
    const getUtterance = installSpeech();
    const textEl = makeElement();

    startSentenceSpeech("Long original text still displays words.", { textEl });
    expect(textEl.querySelectorAll(".speaking-word").length).toBe(1);

    getUtterance().onend();
    expect(textEl.querySelectorAll(".speaking-word").length).toBe(0);
  });

  it("does not let fallback timing override browser word boundaries", () => {
    vi.useFakeTimers();
    const getUtterance = installSpeech();
    const textEl = makeElement();

    startSentenceSpeech("Alpha beta gamma.", { textEl });
    getUtterance().onboundary({ name: "word", charIndex: 6 });
    vi.advanceTimersByTime(2000);

    const highlighted = textEl.querySelectorAll(".speaking-word");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toBe("beta");
  });

  it("pause keeps current highlight and resume keeps a highlight", () => {
    installSpeech();
    const textEl = makeElement();

    startSentenceSpeech("Pause keeps highlight.", { textEl });
    toggleSentenceSpeech("Pause keeps highlight.", { textEl });
    expect(textEl.querySelectorAll(".speaking-word").length).toBe(1);

    toggleSentenceSpeech("Pause keeps highlight.", { textEl });
    expect(textEl.querySelectorAll(".speaking-word").length).toBe(1);
  });

  it("renderSpeakableText preserves long original text content", () => {
    installSpeech();
    const textEl = makeElement();
    const text =
      "This is a long sentence, with punctuation and many words for Lucia.";

    renderSpeakableText(textEl, text);

    expect(textEl.textContent).toBe(text);
  });
});
