import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("main analysis flow source", () => {
  it("does not render the task instruction panel in the homepage flow", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    expect(source).not.toContain("renderSentenceExplanation(");
    expect(source).toContain("buildWordCard(");
  });

  it("uses separate native camera and photo-library inputs", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    const markup = fs.readFileSync("src/pages/index.astro", "utf8");
    expect(source).not.toContain("createCameraCaptureController");
    expect(source).toContain("sourceDialog.showModal()");
    expect(markup).toContain('id="camera-input"');
    expect(markup).toContain('capture="environment"');
    expect(markup).toContain('for="camera-input"');
    expect(markup).toContain('id="image-input"');
    expect(markup).toContain('for="image-input"');
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

  it("provides a matching copy action with visible completion feedback", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    const markup = fs.readFileSync("src/pages/index.astro", "utf8");
    const styles = fs.readFileSync("src/styles/global.css", "utf8");
    expect(markup).toContain('id="copy-sentence-btn"');
    expect(markup).toContain('id="copy-sentence-icon"');
    expect(markup).toContain("复制文本");
    expect(styles).toContain(".sentence-actions");
    expect(source).toContain("navigator.clipboard?.writeText");
    expect(source).toContain(
      'label.textContent = copied ? "已复制" : "复制文本"',
    );
  });

  it("counts unique local dictionary words in settings", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    expect(source).toMatch(
      /new Set\(\[\s*\.\.\.Object\.keys\(dictData\),\s*\.\.\.Object\.keys\(coreLexicon\),?\s*\]\)\.size/,
    );
  });
});
