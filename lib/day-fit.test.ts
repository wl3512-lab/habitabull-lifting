import { describe, expect, it } from "vitest";
import { mixedName, offType, sameWorkoutDays } from "./day-fit";
import type { PlannedExercise, Routine } from "./types";

const lift = (exerciseId: string): PlannedExercise => ({ exerciseId, sets: 3, reps: 8, weight: 0 });
const day = (d: number, label: string, template: Routine["template"], ids: string[], workoutId?: string): Routine => ({
  day: d,
  label,
  template,
  exercises: ids.map(lift),
  ...(workoutId ? { workoutId } : {}),
});

describe("what a day type covers", () => {
  it("flags an ab lift on a leg day, and nothing else on it", () => {
    expect(offType("legs", ["back-squat", "leg-press", "ab-crunch-machine"].map(lift))).toEqual(["ab-crunch-machine"]);
  });

  it("counts a calf raise as leg work, even though no leg-day slot asks for one", () => {
    expect(offType("legs", ["back-squat", "calf-raise"].map(lift))).toEqual([]);
  });

  it("lets full body hold anything", () => {
    expect(offType("full-body", ["bench-press", "ab-crunch-machine", "treadmill"].map(lift))).toEqual([]);
    expect(offType(undefined, ["ab-crunch-machine"].map(lift))).toEqual([]);
  });

  it("treats face pulls as pull work and a squat as not", () => {
    expect(offType("pull", ["barbell-row", "face-pull", "db-curl"].map(lift))).toEqual([]);
    expect(offType("pull", ["barbell-row", "back-squat"].map(lift))).toEqual(["back-squat"]);
  });

  it("keeps cardio days for cardio", () => {
    expect(offType("cardio", ["treadmill", "back-squat"].map(lift))).toEqual(["back-squat"]);
  });

  it("leaves out a lift the library cannot resolve rather than guessing", () => {
    expect(offType("legs", ["custom-unknown-123"].map(lift))).toEqual([]);
  });
});

describe("a first name for a day that grew past its type", () => {
  it("says the day type, then what was added", () => {
    expect(mixedName("legs", ["ab-crunch-machine"])).toBe("Legs and abs");
    expect(mixedName("push", ["ab-crunch-machine", "back-squat"])).toBe("Push, abs and legs");
  });

  it("names each added group once", () => {
    expect(mixedName("legs", ["ab-crunch-machine", "plank"])).toBe("Legs and abs");
  });
});

describe("which days are the same workout", () => {
  const week = [
    day(1, "Leg day", "legs", ["back-squat"]),
    day(3, "Full body A", "full-body", ["bench-press"]),
    day(4, "Leg day", "legs", ["back-squat"]),
    day(5, "Full body B", "full-body", ["barbell-row"]),
    day(6, "Legs and abs", "legs", ["back-squat", "ab-crunch-machine"], "own-legs-and-abs"),
  ];

  it("joins the two leg days and leaves the custom one apart", () => {
    expect(sameWorkoutDays(week, 0)).toEqual([0, 2]);
    expect(sameWorkoutDays(week, 4)).toEqual([4]);
  });

  it("keeps Full body A and B as two workouts", () => {
    expect(sameWorkoutDays(week, 1)).toEqual([1]);
    expect(sameWorkoutDays(week, 3)).toEqual([3]);
  });

  it("joins days linked to the same saved workout, whatever they are called", () => {
    const linked = [
      day(1, "Legs and abs", "legs", ["back-squat"], "own-x"),
      day(4, "Legs and abs", "legs", ["back-squat"], "own-x"),
      day(6, "Leg day", "legs", ["back-squat"]),
    ];
    expect(sameWorkoutDays(linked, 1)).toEqual([0, 1]);
  });
});
