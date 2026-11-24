import { beforeEach, describe, expect, it } from "vitest";
import {
  importWordbookFile,
  getDueWords,
  getReviewSummary,
  getWordbook,
  isStarred,
  recordQuizAnswer,
  recordReviewFeedback,
  recordWordEncounter,
  removeWord,
  saveWordbook,
  toggleStar,
  validateImportedWordbook,
} from "./wordbook.js";
import { WORDBOOK_KEY } from "./storage.js";

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

  it("adds and removes words with source sentence support", async () => {
    expect(await toggleStar("Went", "去", "I went home.")).toBe(true);
    expect(getWordbook()[0]).toMatchObject({
      w: "went",
      m: "去",
      sourceSentence: "I went home.",
      correct: 0,
      wrong: 0,
      level: 0,
    });

    await removeWord("went");
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

  it("drops legacy translation failure messages while preserving valid saved definitions", async () => {
    const data = [
      { w: "lichen", m: "名词：中文释义暂时不可用", t: 2 },
      { w: "chalk", m: "名词：粉笔；动词：中文释义暂时不可用", t: 1 },
    ];
    const result = await importWordbookFile(new Blob([JSON.stringify(data)]));
    expect(result.ok).toBe(true);
    expect(getWordbook().map(({ w, m }) => [w, m])).toEqual([
      ["lichen", ""],
      ["chalk", "名词：粉笔"],
    ]);
  });

  it("tracks repeated encounters in real classroom sentences", async () => {
    await recordWordEncounter("grow", "生长", "Plants grow.", 100);
    await recordWordEncounter("grow", "生长", "Plants grow.", 200);
    await recordWordEncounter("grow", "生长", "Children grow.", 300);

    expect(getWordbook()[0]).toMatchObject({
      w: "grow",
      sourceSentence: "Children grow.",
    });
    expect(getWordbook()[0].sourceSentences).toEqual([
      {
        text: "Children grow.",
        firstSeenAt: 300,
        lastSeenAt: 300,
        count: 1,
      },
      {
        text: "Plants grow.",
        firstSeenAt: 100,
        lastSeenAt: 200,
        count: 2,
      },
    ]);
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

  it("updates correct, wrong, review time, and level", async () => {
    saveWordbook([{ w: "read", m: "阅读", t: 1 }]);
    await recordQuizAnswer("read", true, 100);
    expect(getWordbook()[0]).toMatchObject({
      correct: 1,
      wrong: 0,
      level: 1,
      lastReviewedAt: 100,
    });

    await recordQuizAnswer("read", false, 200);
    expect(getWordbook()[0]).toMatchObject({
      correct: 1,
      wrong: 1,
      level: 0,
      lastReviewedAt: 200,
    });
  });

  it("schedules know, unsure, and forgot feedback locally", async () => {
    saveWordbook([{ w: "read", m: "阅读", t: 1 }]);
    await recordReviewFeedback("read", "know", 1000);
    expect(getWordbook()[0]).toMatchObject({
      mastery: "learning",
      level: 1,
      nextReviewAt: 1000 + 86400000,
      lastResult: "know",
    });

    await recordReviewFeedback("read", "unsure", 2000);
    expect(getWordbook()[0]).toMatchObject({
      level: 1,
      nextReviewAt: 2000 + 86400000,
      lastResult: "unsure",
    });

    await recordReviewFeedback("read", "forgot", 3000);
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

describe("three-way review accounting", () => {
  it("counts 不确定 separately instead of folding it into wrong", async () => {
    saveWordbook([{ w: "circle", m: "圈出" }]);
    await recordReviewFeedback("circle", "unsure");
    const [item] = getWordbook();
    expect(item.unsure).toBe(1);
    expect(item.wrong).toBe(0);
    expect(item.correct).toBe(0);
    expect(item.lastResult).toBe("unsure");
  });

  it("still counts 忘记 as wrong", async () => {
    saveWordbook([{ w: "circle", m: "圈出" }]);
    await recordReviewFeedback("circle", "forgot");
    const [item] = getWordbook();
    expect(item.wrong).toBe(1);
    expect(item.unsure).toBe(0);
  });
});

describe("wordbook cache", () => {
  it("hands out a fresh array so callers cannot mutate the cache", () => {
    saveWordbook([{ w: "apple", m: "苹果" }]);
    const first = getWordbook();
    first.push({ w: "injected", m: "x" });
    expect(getWordbook().map((item) => item.w)).toEqual(["apple"]);
  });

  it("serves repeated reads without re-reading storage", () => {
    saveWordbook([{ w: "apple", m: "苹果" }]);
    const reads = [];
    const original = globalThis.localStorage.getItem;
    globalThis.localStorage.getItem = function (key) {
      reads.push(key);
      return original.call(this, key);
    };
    try {
      isStarred("apple");
      isStarred("apple");
      isStarred("banana");
      expect(reads.filter((key) => key === WORDBOOK_KEY)).toHaveLength(0);
    } finally {
      globalThis.localStorage.getItem = original;
    }
  });
});

it("reports a failed import without losing the previous wordbook", async () => {
  installStorage();
  await toggleStar("apple", "苹果");
  localStorage.setItem = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  const result = await importWordbookFile(
    new Blob(['[{"w":"pear","m":"梨"}]']),
  );
  expect(result).toMatchObject({ ok: false });
  expect(await toggleStar("pear", "梨")).toBeNull();
  expect(await recordReviewFeedback("apple", "know")).toBeNull();
  expect(getWordbook()).toMatchObject([{ w: "apple", level: 0 }]);
});
