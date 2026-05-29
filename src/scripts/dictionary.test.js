import { describe, expect, it } from "vitest";
import { lookup, lookupBaseWord } from "./dictionary.js";

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
