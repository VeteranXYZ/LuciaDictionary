import { describe, expect, it } from "vitest";
import { buildSentenceExplanation, matchPhrasebook, normalizePhrasebookEntry, normalizeText, parseTaskIntent } from "./translation.js";

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
      difficulty: "medium"
    });
    expect(entry).toMatchObject({
      id: "circle-the-answer",
      scene: "Worksheet",
      speaker: "teacher",
      intent: "circle_answer",
      stepsZh: ["找到答案。"],
      childReply: [{ en: "Okay.", cn: "好的。" }],
      difficulty: "medium"
    });
  });

  it("uses Chinese steps from richer entries for explanations", () => {
    const explanation = buildSentenceExplanation({
      raw: "Circle the answer.",
      sentence: "Circle the answer.",
      phrasebook: [{
        en: "Circle the answer.",
        cn: "圈出答案。",
        steps: ["Find the answer.", "Draw a circle."],
        stepsZh: ["找到答案。", "把答案圈起来。"],
        keywords: [{ word: "circle", cn: "圈出" }]
      }],
      templateGroups: [],
      fallbackMeaning: ""
    });
    expect(explanation.taskSteps).toEqual(["找到答案。", "把答案圈起来。"]);
  });
});

describe("task intent parsing", () => {
  it("detects common school action verbs without an exact phrase match", () => {
    expect(parseTaskIntent("Underline the main idea.")?.intent).toBe("underline");
    expect(parseTaskIntent("Please turn in your homework.")?.intent).toBe("turn_in");
    expect(parseTaskIntent("Compare and contrast the two characters.")?.keywords[0]).toEqual({
      word: "compare and contrast",
      cn: "比较和对比"
    });
  });

  it("adds intent steps to fallback explanations", () => {
    const explanation = buildSentenceExplanation({
      raw: "Estimate the sum.",
      sentence: "Estimate the sum.",
      phrasebook: [],
      templateGroups: [],
      fallbackMeaning: "估算总和。"
    });
    expect(explanation).toMatchObject({
      source: "intent",
      intent: "estimate",
      taskSteps: ["先估算一个接近的答案。"]
    });
  });
});
