import { beforeEach, describe, expect, it } from "vitest";
import {
  getWordbook,
  getDueWords,
  getReviewSummary,
  recordQuizAnswer,
  recordReviewFeedback,
  removeWord,
  saveWordbook,
  toggleStar,
  validateImportedWordbook,
} from "./wordbook.js";

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
      level: 0,
    });

    removeWord("went");
    expect(getWordbook()).toEqual([]);
  });

  it("keeps backward compatible old items", () => {
    saveWordbook([{ w: "go", m: "去", t: 1 }]);
    expect(getWordbook()[0]).toMatchObject({
      w: "go",
      m: "去",
      correct: 0,
      wrong: 0,
      level: 0,
    });
  });

  it("validates imported wordbook shape", () => {
    expect(validateImportedWordbook({ bad: true }).ok).toBe(false);
    expect(validateImportedWordbook([{ w: "read", m: "阅读" }])).toMatchObject({
      ok: true,
    });
  });
});

describe("quiz answer updates", () => {
  beforeEach(installStorage);

  it("updates correct, wrong, review time, and level", () => {
    saveWordbook([{ w: "read", m: "阅读", t: 1 }]);
    recordQuizAnswer("read", true, 100);
    expect(getWordbook()[0]).toMatchObject({
      correct: 1,
      wrong: 0,
      level: 1,
      lastReviewedAt: 100,
    });

    recordQuizAnswer("read", false, 200);
    expect(getWordbook()[0]).toMatchObject({
      correct: 1,
      wrong: 1,
      level: 0,
      lastReviewedAt: 200,
    });
  });

  it("schedules know, unsure, and forgot feedback locally", () => {
    saveWordbook([{ w: "read", m: "阅读", t: 1 }]);
    recordReviewFeedback("read", "know", 1000);
    expect(getWordbook()[0]).toMatchObject({
      mastery: "learning",
      level: 1,
      nextReviewAt: 1000 + 86400000,
      lastResult: "know",
    });

    recordReviewFeedback("read", "unsure", 2000);
    expect(getWordbook()[0]).toMatchObject({
      level: 1,
      nextReviewAt: 2000 + 86400000,
      lastResult: "unsure",
    });

    recordReviewFeedback("read", "forgot", 3000);
    expect(getWordbook()[0]).toMatchObject({
      level: 0,
      nextReviewAt: 3000 + 600000,
      lastResult: "forgot",
    });
    expect(getWordbook()[0].reviewHistory).toHaveLength(3);
  });

  it("reports due and mastered review counts", () => {
    saveWordbook([
      { w: "read", m: "阅读", t: 1, nextReviewAt: 100, mastery: "learning" },
      {
        w: "write",
        m: "写",
        t: 2,
        nextReviewAt: 1000,
        mastery: "mastered",
        level: 5,
      },
    ]);
    expect(getDueWords(getWordbook(), 500).map((item) => item.w)).toEqual([
      "read",
    ]);
    expect(getReviewSummary(getWordbook(), 500)).toEqual({
      total: 2,
      due: 1,
      mastered: 1,
    });
  });
});
