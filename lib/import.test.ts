import { describe, expect, it } from "vitest";
import { matchExercise, parseWorkoutText, toRoutines } from "./import";

describe("matchExercise", () => {
  it("matches names, abbreviations and near-misses to library ids", () => {
    expect(matchExercise("Back Squat")).toBe("back-squat");
    expect(matchExercise("bench")).toBe("bench-press");
    expect(matchExercise("DB Curl")).toBe("db-curl");
    expect(matchExercise("rdl")).toBe("romanian-deadlift");
    expect(matchExercise("deadlift")).toBe("deadlift");
  });
  it("returns null when nothing is close enough", () => {
    expect(matchExercise("qwertyuiop")).toBeNull();
    expect(matchExercise("")).toBeNull();
  });
});

describe("parseWorkoutText", () => {
  it("reads day headers and NxM schemes", () => {
    const days = parseWorkoutText("Mon: Bench 3x8, Squat 5x5\nWed: Deadlift 3x5");
    expect(days).toHaveLength(2);
    expect(days[0].day).toBe(1);
    expect(days[0].exercises).toEqual([
      { name: "Bench", sets: 3, reps: 8 },
      { name: "Squat", sets: 5, reps: 5 },
    ]);
    expect(days[1].day).toBe(3);
    expect(days[1].exercises[0]).toEqual({ name: "Deadlift", sets: 3, reps: 5 });
  });
  it("tolerates spacing and the × glyph", () => {
    const days = parseWorkoutText("Tue - Overhead press 4 × 6");
    expect(days[0].exercises[0]).toEqual({ name: "Overhead press", sets: 4, reps: 6 });
  });
});

describe("toRoutines", () => {
  it("builds routines from matched names and ignores any pasted weight", () => {
    const parsed = parseWorkoutText("Mon: Bench 3x8, Squat 5x5");
    const { routines, unmatched } = toRoutines(parsed, "new");
    expect(unmatched).toEqual([]);
    expect(routines).toHaveLength(1);
    expect(routines[0].day).toBe(1);
    const ids = routines[0].exercises.map((e) => e.exerciseId);
    expect(ids).toContain("bench-press");
    expect(ids).toContain("back-squat");
    // weight comes from the engine, never from the text
    expect(routines[0].exercises.every((e) => typeof e.weight === "number")).toBe(true);
  });
  it("collects names it cannot place", () => {
    const { routines, unmatched } = toRoutines(
      [{ day: 1, label: "Day", exercises: [{ name: "Zzzقغ nonsense", sets: 3, reps: 8 }] }],
      "new",
    );
    expect(unmatched.length).toBe(1);
    expect(routines).toHaveLength(0);
  });
});
