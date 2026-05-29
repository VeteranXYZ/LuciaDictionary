import { describe, expect, it } from "vitest";
import { cleanDisplayTranslation } from "./meaningCleaner.js";

function parts(text) {
  return text.split(/[;；,，]/).map(part => part.trim()).filter(Boolean);
}

describe("cleanDisplayTranslation", () => {
  it("removes DOS text from more-like input", () => {
    const cleaned = cleanDisplayTranslation("更多；多的；DOS外部命令:显示满屏后自动暂停；按任意键继续", "more");
    expect(cleaned).toBe("更多；多的");
    expect(cleaned).not.toContain("DOS");
    expect(cleaned).not.toContain("命令");
  });

  it("removes DOS text from share-like input", () => {
    const cleaned = cleanDisplayTranslation("部分；分享；共享；DOS外部命令:在网络中提供文件共享；分担", "share");
    expect(cleaned).toBe("部分；分享；共享；分担");
    expect(cleaned).not.toContain("DOS");
  });

  it("removes DOS internal command text from time-like input", () => {
    const cleaned = cleanDisplayTranslation("时间；时机；DOS内部命令:用于显示或设定系统的时间；时期", "time");
    expect(cleaned).toBe("时间；时机；时期");
    expect(cleaned).not.toContain("DOS");
    expect(cleaned).not.toContain("命令");
  });

  it("removes accumulator, adder, and computer meanings from a-like input", () => {
    const cleaned = cleanDisplayTranslation("一个；第一的；累加器；加法器；计算机；存储器", "a");
    expect(cleaned).toBe("一个；第一的");
  });

  it("removes average retrieval/runtime technical meanings from art-like input", () => {
    const cleaned = cleanDisplayTranslation("艺术；美术；平均检索时间；平均运行时间；技术", "art");
    expect(cleaned).toBe("艺术；美术；技术");
  });

  it("never returns empty when original cn is non-empty", () => {
    const raw = "DOS外部命令；计算机；汇编";
    expect(cleanDisplayTranslation(raw, "noise")).toBe(raw);
  });

  it("limits output to at most 4 meaning parts", () => {
    const cleaned = cleanDisplayTranslation("一；二；三；四；五；六", "many");
    expect(parts(cleaned).length).toBeLessThanOrEqual(4);
  });
});
