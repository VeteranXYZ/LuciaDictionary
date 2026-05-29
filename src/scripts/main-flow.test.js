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

  it("keeps mobile OCR buttons horizontal and shortens crowded labels", () => {
    const markup = fs.readFileSync("src/pages/index.astro", "utf8");
    const styles = fs.readFileSync("src/styles/global.css", "utf8");
    expect(markup).toContain('class="hero-center"');
    expect(markup).toContain('class="hero-copy"');
    expect(markup).toContain("<span>朗读</span>");
    expect(markup).toContain("已收藏单词");
    expect(styles).toContain(".hero-center");
    expect(styles).toContain("display: inline-flex");
    expect(styles).toContain("grid-template-columns: 1fr 1fr");
    expect(styles).toContain("#pg-home > .hero");
    expect(styles).toContain("justify-content: center");
    expect(styles).toContain("height: 104px");
  });

  it("counts unique local dictionary words in settings", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    expect(source).toContain("new Set([...Object.keys(dictData), ...Object.keys(coreLexicon)]).size");
  });
});
