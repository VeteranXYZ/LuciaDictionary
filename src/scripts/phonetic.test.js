import { describe, expect, it } from "vitest";
import { cleanPhonetic } from "./phonetic.js";

describe("cleanPhonetic", () => {
  it("keeps valid IPA unchanged", () => {
    expect(cleanPhonetic("/eɪdʒ/")).toBe("/eɪdʒ/");
    expect(cleanPhonetic("/maɪnd/")).toBe("/maɪnd/");
    expect(cleanPhonetic("/ˈsɪstəz/")).toBe("/ˈsɪstəz/");
  });

  it("hides malformed phonetics with square placeholders", () => {
    expect(cleanPhonetic("/ei□□/")).toBe("");
    expect(cleanPhonetic("/ei\u25a1\u25a1/")).toBe("");
  });

  it("hides replacement/control character phonetics", () => {
    expect(cleanPhonetic("/ei\ufffd/")).toBe("");
    expect(cleanPhonetic("/ei\u0001/")).toBe("");
  });

  it("returns empty for empty phonetic input", () => {
    expect(cleanPhonetic("")).toBe("");
    expect(cleanPhonetic(null)).toBe("");
  });
});
