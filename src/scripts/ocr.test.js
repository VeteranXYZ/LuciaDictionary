import { describe, expect, it } from "vitest";
import { cleanOcrText, createCompressionPlan, formatBytes } from "./ocr.js";

describe("cleanOcrText", () => {
  it("joins OCR lines into a single sentence for the analyzer", () => {
    expect(cleanOcrText("  Circle the noun.\r\n\nThen write it.  ")).toBe("Circle the noun. Then write it.");
  });

  it("handles empty OCR responses", () => {
    expect(cleanOcrText(null)).toBe("");
  });
});

describe("formatBytes", () => {
  it("formats upload sizes for the OCR status line", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
});

describe("createCompressionPlan", () => {
  it("starts with a readable 1600px pass and then gets smaller", () => {
    const plan = createCompressionPlan(4032, 3024);
    expect(plan[0]).toEqual({ width: 1600, height: 1200, quality: 0.82 });
    expect(plan.at(-1).width).toBeLessThan(plan[0].width);
    expect(plan.at(-1).quality).toBeLessThan(plan[0].quality);
  });

  it("does not upscale small images", () => {
    const plan = createCompressionPlan(800, 600);
    expect(plan[0]).toEqual({ width: 800, height: 600, quality: 0.82 });
  });
});
