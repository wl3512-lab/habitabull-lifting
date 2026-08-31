import { describe, expect, it } from "vitest";
import {
  challengeDone,
  challengeFor,
  challengePercent,
  daysLeftInMonth,
  defaultTarget,
  monthKey,
} from "./crew";
import type { Challenge, Session } from "./types";

const session = (date: string, completed = true): Session => ({
  date,
  label: "Test",
  exercises: [],
  ...(completed ? { completedAt: `${date}T18:30:00.000Z` } : {}),
});

describe("defaultTarget", () => {
  it("counts the training days that actually fall in the month", () => {
    // September 2026: 1st is a Tuesday, 30 days. Mon/Wed/Fri.
    expect(defaultTarget([1, 3, 5], 2026, 8)).toBe(13);
  });

  it("counts a single training day", () => {
    // Sundays in September 2026: 6, 13, 20, 27.
    expect(defaultTarget([0], 2026, 8)).toBe(4);
  });

  it("handles February in a leap year", () => {
    // 29 days from a Thursday: 4 Mondays, 4 Wednesdays, 4 Fridays.
    expect(defaultTarget([1, 3, 5], 2024, 1)).toBe(12);
  });

  it("is zero when no days are chosen", () => {
    expect(defaultTarget([], 2026, 8)).toBe(0);
  });

  it("counts every day when all seven are chosen", () => {
    expect(defaultTarget([0, 1, 2, 3, 4, 5, 6], 2026, 8)).toBe(30);
  });
});

describe("challengeFor", () => {
  it("generates a target for the current month", () => {
    const c = challengeFor({ trainingDays: [1, 3, 5] }, undefined, new Date(2026, 8, 15));
    expect(c.month).toBe("2026-09");
    expect(c.target).toBe(13);
  });

  it("keeps an existing target for the same month, so edits survive", () => {
    const existing: Challenge = { month: "2026-09", target: 20 };
    const c = challengeFor({ trainingDays: [1, 3, 5] }, existing, new Date(2026, 8, 15));
    expect(c.target).toBe(20);
  });

  it("regenerates when the month turns over", () => {
    const stale: Challenge = { month: "2026-08", target: 20 };
    const c = challengeFor({ trainingDays: [1, 3, 5] }, stale, new Date(2026, 8, 1));
    expect(c.month).toBe("2026-09");
    expect(c.target).toBe(13);
  });

  it("pads the month so keys sort and compare as strings", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
});

describe("challengeDone", () => {
  const c: Challenge = { month: "2026-09", target: 13 };

  it("counts completed sessions inside the month only", () => {
    const s = [session("2026-09-01"), session("2026-09-30"), session("2026-08-31")];
    expect(challengeDone(s, c)).toBe(2);
  });

  it("ignores an unfinished draft", () => {
    expect(challengeDone([session("2026-09-02", false)], c)).toBe(0);
  });

  it("does not match another year's same month", () => {
    expect(challengeDone([session("2025-09-02")], c)).toBe(0);
  });
});

describe("challengePercent", () => {
  it("is a plain percentage", () => {
    expect(challengePercent(6, 12)).toBe(50);
  });

  it("caps at 100 so a strong month cannot overflow the bar", () => {
    expect(challengePercent(20, 12)).toBe(100);
  });

  it("is zero rather than NaN when there is no target", () => {
    expect(challengePercent(3, 0)).toBe(0);
  });
});

describe("daysLeftInMonth", () => {
  it("counts today as still available", () => {
    expect(daysLeftInMonth(new Date(2026, 8, 30))).toBe(1);
  });

  it("counts the whole month on the first", () => {
    expect(daysLeftInMonth(new Date(2026, 8, 1))).toBe(30);
  });
});
