import { beforeEach, describe, expect, it } from "vitest";
import { handleQuizAnswer, quizState } from "./quiz.js";
import { getWordbook, saveWordbook } from "./wordbook.js";

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

describe("quiz answer handling", () => {
  beforeEach(() => {
    installStorage();
    quizState.score = 0;
    quizState.total = 0;
    saveWordbook([{ w: "write", m: "写", t: 1 }]);
  });

  it("increments score and wordbook stats for correct answers", () => {
    expect(handleQuizAnswer("write", "write")).toBe(true);
    expect(quizState).toMatchObject({ score: 1, total: 1 });
    expect(getWordbook()[0]).toMatchObject({ correct: 1, wrong: 0, level: 1 });
  });

  it("increments wrong count for incorrect answers", () => {
    expect(handleQuizAnswer("read", "write")).toBe(false);
    expect(quizState).toMatchObject({ score: 0, total: 1 });
    expect(getWordbook()[0]).toMatchObject({ correct: 0, wrong: 1, level: 0 });
  });
});
