import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("main analysis flow source", () => {
  it("does not render the task instruction panel in the homepage flow", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    expect(source).not.toContain("renderSentenceExplanation(");
    expect(source).toContain("buildWordCard(");
  });

  it("uses the native file picker for the camera button", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    const markup = fs.readFileSync("src/pages/index.astro", "utf8");
    expect(source).not.toContain("createCameraCaptureController");
    expect(source).toContain("imageInput.click()");
    expect(markup).toContain('type="file" id="image-input" accept="image/*" hidden');
    expect(markup).not.toContain("capture=");
  });

  it("does not render the photo tips block", () => {
    const markup = fs.readFileSync("src/pages/index.astro", "utf8");
    expect(markup).not.toContain("拍照提示");
    expect(markup).not.toContain("只拍英文题目区域");
  });
});
