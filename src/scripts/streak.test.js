import { describe, expect, it } from "vitest";
import { calculateDailyStreak, toDateKey } from "./streak.js";

describe("toDateKey", () => {
  it("formats local dates for streak storage", () => {
    expect(toDateKey(new Date(2026, 4, 8))).toBe("2026-05-08");
  });
});

describe("calculateDailyStreak", () => {
  it("keeps the same streak on the same day", () => {
    expect(
      calculateDailyStreak({ count: 4, lastDate: "2026-05-08" }, "2026-05-08"),
    ).toEqual({
      count: 4,
      lastDate: "2026-05-08",
    });
  });

  it("increments after a consecutive day", () => {
    expect(
      calculateDailyStreak({ count: 4, lastDate: "2026-05-08" }, "2026-05-09")
        .count,
    ).toBe(5);
  });

  it("resets after a missed day", () => {
    expect(
      calculateDailyStreak({ count: 4, lastDate: "2026-05-08" }, "2026-05-10")
        .count,
    ).toBe(1);
  });
});
