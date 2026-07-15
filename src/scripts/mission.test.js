import { beforeEach, describe, expect, it } from "vitest";
import {
  MISSION_HISTORY_KEY,
  createClozeText,
  createLearningMission,
  getMissionHistory,
  saveMissionResult,
  selectMissionTargets,
  summarizeMission,
} from "./mission.js";

function installStorage() {
  const data = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
  });
}

const candidates = [
  { word: "plants", meaning: "植物", band: "foundation" },
  { word: "sunlight", meaning: "阳光", band: "developing" },
  { word: "water", meaning: "水", band: "foundation" },
  { word: "grow", meaning: "生长", band: "foundation" },
];

describe("classroom mission recommendation", () => {
  beforeEach(installStorage);

  it("prioritizes forgotten and due words and explains why", () => {
    const targets = selectMissionTargets(
      candidates,
      [
        { w: "water", mastery: "mastered", level: 5 },
        { w: "sunlight", lastResult: "forgot" },
        { w: "plants", nextReviewAt: 100 },
      ],
      { now: 200, maxTargets: 3 },
    );

    expect(targets.map((target) => target.word)).toEqual([
      "sunlight",
      "plants",
      "grow",
    ]);
    expect(targets[0]).toMatchObject({ reasonCode: "forgot" });
    expect(targets[1]).toMatchObject({ reasonCode: "due" });
  });

  it("creates explainable mixed exercises in the original sentence", () => {
    const mission = createLearningMission({
      sentence: "Plants need sunlight and water to grow.",
      candidates,
      maxTargets: 4,
      now: 123,
      random: () => 0.4,
    });

    expect(mission.id).toBe("mission-123");
    expect(mission.questions.map((question) => question.type)).toEqual([
      "listen",
      "meaning",
      "cloze",
      "listen",
    ]);
    expect(mission.questions[2].prompt).toContain("_____");
    expect(mission.questions[0].options).toHaveLength(4);
  });

  it("replaces only the target word when creating a cloze", () => {
    expect(createClozeText("Plants need sunlight.", "plants")).toBe(
      "_____ need sunlight.",
    );
  });

  it("summarizes results and stores a bounded local history", () => {
    const mission = createLearningMission({
      sentence: "Plants need water.",
      candidates,
      maxTargets: 2,
      now: 123,
      random: () => 0.4,
    });
    const results = [
      { word: mission.targets[0].word, correct: true },
      { word: mission.targets[1].word, correct: false },
    ];
    const summary = summarizeMission(mission, results);
    expect(summary).toMatchObject({ total: 2, correct: 1 });
    expect(summary.parentPrompt).toContain("是什么意思");

    saveMissionResult(mission, results, 456);
    expect(getMissionHistory()[0]).toMatchObject({
      id: "mission-123",
      completedAt: 456,
    });
    expect(JSON.parse(localStorage.getItem(MISSION_HISTORY_KEY))).toHaveLength(
      1,
    );
  });
});
