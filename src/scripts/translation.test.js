import { describe, expect, it } from "vitest";
import {
  matchPhrasebook,
  normalizePhrasebookEntry,
  normalizeText,
} from "./translation.js";

const phrasebook = [
  {
    en: "Complete the worksheet.",
    cn: "完成练习单。",
    cat: "作业类",
    steps: ["做练习单"],
    keywords: [{ word: "worksheet", cn: "练习单" }],
  },
];

describe("normalizeText", () => {
  it("normalizes punctuation, spaces, and case", () => {
    expect(normalizeText(" Complete, the Worksheet! ")).toBe(
      "completetheworksheet",
    );
    expect(normalizeText("完成 练习单。")).toBe("完成练习单");
  });
});

describe("phrasebook matching", () => {
  it("matches Chinese and English phrases", () => {
    expect(matchPhrasebook("完成练习单", phrasebook)?.en).toBe(
      "Complete the worksheet.",
    );
    expect(matchPhrasebook("complete the worksheet", phrasebook)?.cn).toBe(
      "完成练习单。",
    );
  });

  it("normalizes richer phrasebook entries while supporting older fields", () => {
    const entry = normalizePhrasebookEntry({
      id: "circle-the-answer",
      en: "Circle the answer.",
      cn: "圈出答案。",
      cat: "Test / Quiz",
      scene: "Worksheet",
      speaker: "teacher",
      intent: "circle_answer",
      steps: ["Find the answer."],
      stepsZh: ["找到答案。"],
      keywords: [{ word: "circle", cn: "圈出" }],
      childReply: [{ en: "Okay.", cn: "好的。" }],
      difficulty: "medium",
    });
    expect(entry).toMatchObject({
      id: "circle-the-answer",
      scene: "Worksheet",
      speaker: "teacher",
      intent: "circle_answer",
      stepsZh: ["找到答案。"],
      childReply: [{ en: "Okay.", cn: "好的。" }],
      difficulty: "medium",
    });
  });
});
