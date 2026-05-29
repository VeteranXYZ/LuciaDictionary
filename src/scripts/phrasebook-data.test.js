import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizePhrasebookEntry } from "./translation.js";

const phrasebook = JSON.parse(fs.readFileSync("public/assets/phrasebook.json", "utf8"));

const REQUIRED_CATEGORIES = [
  "Classroom Behavior",
  "Homework Instructions",
  "Reading Comprehension",
  "Writing Tasks",
  "Math Problems",
  "Science Activities",
  "Test / Quiz",
  "Group Work",
  "School Notices",
  "Art / Craft",
  "PE / Outdoor",
  "Permission Slip / Parent Signature",
  "Classmate Talk",
  "Help / Safety / Emergency"
];

describe("public phrasebook data", () => {
  it("contains the expanded school coverage", () => {
    expect(phrasebook.length).toBeGreaterThanOrEqual(220);
    const categories = new Set(phrasebook.map(item => item.cat));
    for (const category of REQUIRED_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it("uses the richer schema for every entry", () => {
    for (const raw of phrasebook) {
      const entry = normalizePhrasebookEntry(raw);
      expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.en).toBeTruthy();
      expect(entry.cn).toBeTruthy();
      expect(entry.scene).toBeTruthy();
      expect(entry.speaker).toBeTruthy();
      expect(entry.intent).toBeTruthy();
      expect(entry.steps.length).toBeGreaterThan(0);
      expect(entry.stepsZh.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.childReply.length).toBeGreaterThan(0);
      expect(["easy", "medium"]).toContain(entry.difficulty);
    }
  });
});
