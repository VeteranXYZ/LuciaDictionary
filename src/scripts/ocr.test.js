import { describe, expect, it } from "vitest";
import {
  cleanOcrText,
  createCompressionPlan,
  getOcrErrorMessage,
  isSupportedOcrImage,
  mapOcrResponseError,
  formatBytes,
} from "./ocr.js";

describe("cleanOcrText", () => {
  it("joins OCR lines into a single sentence for the analyzer", () => {
    expect(cleanOcrText("  Circle the noun.\r\n\nThen write it.  ")).toBe(
      "Circle the noun. Then write it.",
    );
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

describe("OCR error helpers", () => {
  it("maps response statuses to stable frontend error codes", () => {
    expect(mapOcrResponseError(413)).toBe("file_too_large");
    expect(mapOcrResponseError(415)).toBe("unsupported_file_type");
    expect(mapOcrResponseError(429)).toBe("too_many_requests");
    expect(mapOcrResponseError(503)).toBe("service_unavailable");
  });

  it("returns parent-friendly Chinese copy", () => {
    expect(getOcrErrorMessage({ code: "no_text_detected" })).toContain(
      "没有识别到清晰的英文",
    );
    expect(getOcrErrorMessage({ code: "offline" })).toContain(
      "OCR 需要网络连接",
    );
  });

  it("accepts only upload types supported by the server", () => {
    expect(isSupportedOcrImage({ type: "image/jpeg" })).toBe(true);
    expect(isSupportedOcrImage({ type: "image/heic" })).toBe(false);
  });
});
