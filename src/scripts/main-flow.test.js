import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("main analysis flow source", () => {
  it("does not render the task instruction panel in the homepage flow", () => {
    const source = fs.readFileSync("src/scripts/app.js", "utf8");
    expect(source).not.toContain("renderSentenceExplanation(");
    expect(source).toContain("buildWordCard(");
  });
});
