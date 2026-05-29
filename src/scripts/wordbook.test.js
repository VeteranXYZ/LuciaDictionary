import { beforeEach, describe, expect, it } from "vitest";
import {
  getWordbook,
  recordQuizAnswer,
  removeWord,
  saveWordbook,
  toggleStar,
  validateImportedWordbook
} from "./wordbook.js";

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

describe("wordbook CRUD", () => {
  beforeEach(installStorage);

  it("adds and removes words with source sentence support", () => {
    expect(toggleStar("Went", "去", "I went home.")).toBe(true);
    expect(getWordbook()[0]).toMatchObject({
      w: "went",
      m: "去",
      sourceSentence: "I went home.",
      correct: 0,
      wrong: 0,
      level: 0
    });

    removeWord("went");
    expect(getWordbook()).toEqual([]);
  });

  it("keeps backward compatible old items", () => {
    saveWordbook([{ w: "go", m: "去", t: 1 }]);
    expect(getWordbook()[0]).toMatchObject({ w: "go", m: "去", correct: 0, wrong: 0, level: 0 });
  });

  it("validates imported wordbook shape", () => {
    expect(validateImportedWordbook({ bad: true }).ok).toBe(false);
    expect(validateImportedWordbook([{ w: "read", m: "阅读" }])).toMatchObject({ ok: true });
  });
});

describe("quiz answer updates", () => {
  beforeEach(installStorage);

  it("updates correct, wrong, review time, and level", () => {
    saveWordbook([{ w: "read", m: "阅读", t: 1 }]);
    recordQuizAnswer("read", true, 100);
    expect(getWordbook()[0]).toMatchObject({ correct: 1, wrong: 0, level: 1, lastReviewedAt: 100 });

    recordQuizAnswer("read", false, 200);
    expect(getWordbook()[0]).toMatchObject({ correct: 1, wrong: 1, level: 0, lastReviewedAt: 200 });
  });
});
