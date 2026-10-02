import { describe, expect, it } from "vitest";
import { dayDetail, equipmentLine, levelLabel, LEVELS, scheduleTitle, scheduleWhen, weighInLine } from "./profile-summary";
import type { PlannedExercise } from "./types";

const lift = (exerciseId: string): PlannedExercise => ({ exerciseId, sets: 3, reps: 5, weight: 100 });

describe("what each Profile row says when it is closed", () => {
  it("reads the latest weigh-in with its date, or nothing", () => {
    expect(weighInLine([])).toBeNull();
    expect(
      weighInLine([
        { date: "2026-09-13", lb: 165.85 },
        { date: "2026-09-20", lb: 165.5 },
      ])
    ).toBe("165.5 lb · Sep 20");
  });

  it("falls back to the bare weight when the date is not a date", () => {
    expect(weighInLine([{ date: "soon", lb: 165 }])).toBe("165 lb");
    expect(weighInLine([{ date: "2026-13-02", lb: 165 }])).toBe("165 lb");
  });

  it("says None set for an empty kit", () => {
    expect(equipmentLine([])).toBe("None set");
  });

  it("names up to two pieces of kit and counts the rest", () => {
    expect(equipmentLine(["dumbbell"])).toBe("Dumbbells");
    expect(equipmentLine(["dumbbell", "barbell"])).toBe("Barbells, Dumbbells");
    expect(equipmentLine(["barbell", "dumbbell", "machine", "bodyweight", "kettlebell"])).toBe(
      "Barbells, Dumbbells +3"
    );
  });

  it("counts days a week, and adds when if she said", () => {
    expect(scheduleTitle([1, 3, 5])).toBe("3 days a week");
    expect(scheduleTitle([2])).toBe("1 day a week");
    expect(scheduleTitle([1, 1, 3])).toBe("2 days a week");
    expect(scheduleWhen()).toBeNull();
    expect(scheduleWhen([])).toBeNull();
    expect(scheduleWhen(["evening", "lunch"])).toBe("Evening, Lunchtime");
  });

  it("describes a day by its name and its lifts", () => {
    expect(dayDetail({ exercises: ["back-squat", "deadlift"].map(lift) })).toBe(
      "2 lifts · Back Squat, Deadlift"
    );
    expect(dayDetail({ exercises: ["bench-press"].map(lift) })).toBe("1 lift · Bench Press");
    expect(dayDetail({ exercises: [] })).toBe("Nothing on it yet");
  });

  it("labels every level, and only these three", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(["new", "returning", "experienced"]);
    expect(levelLabel("returning")).toBe("Coming back");
  });
});
