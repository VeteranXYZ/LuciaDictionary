import { describe, expect, it } from "vitest";
import { buildSentenceExplanation, matchPhrasebook, normalizeText } from "./translation.js";

const phrasebook = [
  {
    en: "Complete the worksheet.",
    cn: "完成练习单。",
    cat: "作业类",
    steps: ["做练习单"],
    keywords: [{ word: "worksheet", cn: "练习单" }]
  }
];

describe("normalizeText", () => {
  it("normalizes punctuation, spaces, and case", () => {
    expect(normalizeText(" Complete, the Worksheet! ")).toBe("completetheworksheet");
    expect(normalizeText("完成 练习单。")).toBe("完成练习单");
  });
});

describe("phrasebook matching", () => {
  it("matches Chinese and English phrases", () => {
    expect(matchPhrasebook("完成练习单", phrasebook)?.en).toBe("Complete the worksheet.");
    expect(matchPhrasebook("complete the worksheet", phrasebook)?.cn).toBe("完成练习单。");
  });

  it("uses phrasebook data for sentence explanations", () => {
    const explanation = buildSentenceExplanation({
      raw: "Complete the worksheet.",
      sentence: "Complete the worksheet.",
      phrasebook,
      templateGroups: [],
      fallbackMeaning: "完成练习单"
    });
    expect(explanation).toMatchObject({
      sentenceMeaning: "完成练习单。",
      taskSteps: ["做练习单"],
      source: "phrasebook"
    });
    expect(explanation.keywords[0]).toEqual({ word: "worksheet", cn: "练习单" });
  });
});
