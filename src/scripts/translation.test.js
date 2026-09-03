import { describe, expect, it, vi } from "vitest";
import {
  findPhrasebookMatch,
  matchPhrasebook,
  normalizePhrasebookEntry,
  normalizeText,
  phraseMatchCoverage,
  translateOnDevice,
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

describe("phrasebook match safety", () => {
  const classroom = [
    { en: "Turn in your homework.", cn: "交上你的家庭作业。" },
    { en: "Complete the worksheet.", cn: "完成练习单。" },
  ];

  it("still matches a sentence that is only punctuated differently", () => {
    expect(matchPhrasebook("交上你的家庭作业", classroom)?.en).toBe(
      "Turn in your homework.",
    );
  });

  it("refuses to stand in for a longer sentence it only partly covers", () => {
    expect(
      matchPhrasebook(
        "老师说请交上你的家庭作业，然后安静地回到座位上等待",
        classroom,
      ),
    ).toBeNull();
  });

  it("refuses to expand a short fragment into a whole template", () => {
    expect(matchPhrasebook("家庭作业", classroom)).toBeNull();
  });

  it("prefers the closest template when several could match", () => {
    const best = findPhrasebookMatch("完成练习单", classroom);
    expect(best?.entry.en).toBe("Complete the worksheet.");
    expect(best?.coverage).toBe(1);
  });

  it("scores coverage as the shared share of the longer string", () => {
    expect(phraseMatchCoverage("abcd", "abcd")).toBe(1);
    expect(phraseMatchCoverage("ab", "abcd")).toBe(0.5);
    expect(phraseMatchCoverage("xy", "abcd")).toBe(0);
  });
});

describe("on-device translation guard", () => {
  it("uses the built-in translator when it is ready", async () => {
    const api = {
      availability: async () => "available",
      create: async () => ({
        translate: async () => "Complete the worksheet.",
      }),
    };
    await expect(
      translateOnDevice("完成练习单", "zh-CN", "en", { api }),
    ).resolves.toBe("Complete the worksheet.");
  });

  it("declines when the model would have to be downloaded first", async () => {
    const create = vi.fn();
    const api = { availability: async () => "downloadable", create };
    await expect(
      translateOnDevice("完成练习单", "zh-CN", "en", { api }),
    ).resolves.toBe("");
    expect(create).not.toHaveBeenCalled();
  });

  it("gives up instead of hanging when the built-in translator stalls", async () => {
    const api = {
      availability: async () => "available",
      create: () => new Promise(() => {}),
    };
    await expect(
      translateOnDevice("完成练习单", "zh-CN", "en", { api, timeoutMs: 20 }),
    ).resolves.toBe("");
  });

  it("reports nothing when the API is absent", async () => {
    await expect(
      translateOnDevice("hi", "en", "zh-CN", { api: undefined }),
    ).resolves.toBe("");
  });
});
