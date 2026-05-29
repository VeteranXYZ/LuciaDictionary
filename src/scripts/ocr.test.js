import { describe, expect, it } from "vitest";
import { cleanOcrText, formatBytes } from "./ocr.js";

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
