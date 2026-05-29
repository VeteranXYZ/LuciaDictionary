import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createDictionaryService, extractLookupTerms, lookup, lookupBaseWord, lookupLayered, buildCoreFormIndex } from "./dictionary.js";

const dict = {
  go: "去",
  do: "做",
  child: "孩子",
  mouse: "老鼠",
  good: "好的",
  run: "跑",
  buy: "买",
  bring: "带来",
  think: "想",
  study: "学习",
  make: "制作",
  take: "拿",
  write: "写",
  see: "看见",
  quick: "快的",
  work: "工作"
};

describe("dictionary lookup", () => {
  it("looks up direct words", () => {
    expect(lookup(dict, "work")).toBe("工作");
  });

  it("handles elementary irregular morphology", () => {
    expect(lookup(dict, "went")).toBe("去(变化形式)");
    expect(lookup(dict, "children")).toBe("孩子");
    expect(lookup(dict, "mice")).toBe("老鼠");
    expect(lookup(dict, "better")).toBe("更好的");
    expect(lookup(dict, "best")).toBe("最好的");
    expect(lookup(dict, "studying")).toBe("学习");
    expect(lookup(dict, "written")).toBe("写(变化形式)");
  });

  it("falls back to regular suffix morphology", () => {
    expect(lookup(dict, "quickly")).toBe("快的地");
    expect(lookup(dict, "worked")).toBe("工作(过去式)");
  });

  it("returns the normalized base word when found", () => {
    expect(lookupBaseWord(dict, "bought")).toEqual({ base: "buy", modifier: "(变化形式)" });
  });
});

const coreLexicon = JSON.parse(fs.readFileSync("public/assets/lexicon/core-lexicon.json", "utf8"));
const phraseLexicon = JSON.parse(fs.readFileSync("public/assets/phrase-lexicon.json", "utf8"));
const formIndex = buildCoreFormIndex(coreLexicon);

describe("local lexicon layers", () => {
  const layers = {
    phraseLexicon,
    coreLexicon,
    formIndex,
    dict: {
      address: "旧地址释义",
      tips: "尖端"
    }
  };

  it("finds required common words locally", () => {
    expect(lookupLayered(layers, "address")).toContain("地址");
    expect(lookupLayered(layers, "activity")).toContain("活动");
    expect(lookupLayered(layers, "privacy")).toContain("隐私");
    expect(lookupLayered(layers, "policy")).toContain("政策");
    expect(lookupLayered(layers, "thoughtful")).toContain("体贴");
    expect(lookupLayered(layers, "supportive")).toBeTruthy();
    expect(lookupLayered(layers, "fun")).toContain("乐趣");
    expect(lookupLayered(layers, "lab")).toContain("实验室");
    expect(lookupLayered(layers, "inbox")).toBeTruthy();
  });

  it("resolves required morphology through core forms", () => {
    expect(lookupLayered(layers, "activities")).toContain("活动");
    expect(lookupLayered(layers, "resources")).toContain("资源");
    expect(lookupLayered(layers, "parents")).toContain("父母");
  });

  it("detects high-priority phrases before single words", () => {
    expect(lookupLayered(layers, "privacy policy")).toBe("隐私政策");
    expect(lookupLayered(layers, "privacy policy")).not.toContain("个人");
    expect(lookupLayered(layers, "email address")).toBe("电子邮件地址");
    expect(lookupLayered(layers, "give up")).toBe("放弃");
    expect(lookupLayered(layers, "face challenges")).toBe("面对挑战");
  });

  it("uses child-friendly context meanings from core lexicon", () => {
    expect(lookupLayered(layers, "tips")).toContain("提示");
    expect(lookupLayered(layers, "woods")).toContain("树林");
  });

  it("lets core lexicon override existing dict.json meanings", () => {
    expect(lookupLayered(layers, "address")).not.toBe("旧地址释义");
  });

  it("extracts phrase terms before individual words", () => {
    expect(extractLookupTerms("Write your email address and read the privacy policy.", phraseLexicon).slice(0, 2)).toEqual([
      "email address",
      "privacy policy"
    ]);
  });

  it("does not need online lookup for required common words", async () => {
    let networkCalls = 0;
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async task => {
        networkCalls++;
        return task();
      },
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {}
    });

    expect(service.lookup("address")).toContain("地址");
    expect(service.lookup("privacy policy")).toBe("隐私政策");
    expect(await service.lookupOnlineData("address")).toBe(null);
    expect(networkCalls).toBe(0);
  });

  it("does not need online lookup for common OCR words", async () => {
    let networkCalls = 0;
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async task => {
        networkCalls++;
        return task();
      },
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {}
    });

    for (const word of ["address", "activity", "privacy", "policy", "thoughtful", "supportive", "fun", "lab", "inbox"]) {
      expect(service.lookup(word)).toBeTruthy();
      expect(await service.lookupOnlineData(word)).toBe(null);
    }
    expect(networkCalls).toBe(0);
  });

  it("does not output empty-cn core entries", () => {
    expect(Object.entries(coreLexicon).filter(([, entry]) => !String(entry.cn || "").trim())).toEqual([]);
  });

  it("does not ship generated examples or simple definitions in core entries", () => {
    expect(Object.entries(coreLexicon).filter(([, entry]) => "examples" in entry || "simple" in entry || "source" in entry)).toEqual([]);
  });
});
