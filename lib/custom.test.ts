import { afterEach, describe, expect, it } from "vitest";
import { allExercises, byId, isCustom, makeCustomExercise, setCustomExercises } from "./exercises";
import { alternativesFor, repsFor, startingWeight } from "./engine";

afterEach(() => setCustomExercises([]));

describe("a lift someone added", () => {
  const mine = makeCustomExercise("Cable Crossover", "chest", "machine", false);

  it("is indistinguishable from a built-in one to byId", () => {
    setCustomExercises([mine]);
    expect(byId(mine.id)?.name).toBe("Cable Crossover");
    expect(isCustom(mine.id)).toBe(true);
    expect(isCustom("back-squat")).toBe(false);
  });

  it("shows up in the picker for its muscle and kit", () => {
    setCustomExercises([mine]);
    expect(alternativesFor("chest", ["machine"]).map((e) => e.id)).toContain(mine.id);
    // and nowhere else
    expect(alternativesFor("quads", ["machine"]).map((e) => e.id)).not.toContain(mine.id);
    expect(alternativesFor("chest", ["barbell"]).map((e) => e.id)).not.toContain(mine.id);
  });

  it("disappears cleanly when cleared", () => {
    setCustomExercises([mine]);
    const withIt = allExercises().length;
    setCustomExercises([]);
    expect(allExercises().length).toBe(withIt - 1);
    expect(byId(mine.id)).toBeUndefined();
  });

  it("gets its numbers from the engine like everything else", () => {
    setCustomExercises([mine]);
    expect(repsFor(mine, "new")).toBe(repsFor(byId("pec-deck")!, "new"));
    expect(startingWeight(mine, "new")).toBeGreaterThan(0);
  });

  it("carries no invented coaching, and says so", () => {
    // A model improvising form advice for an arbitrary barbell movement is the
    // one place in this product where being wrong could injure somebody.
    expect(mine.steps[0]).toMatch(/no coaching/i);
    expect(mine.cue.length).toBeGreaterThan(10);
    expect(mine.mistakes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("making one", () => {
  it("steps loaded lifts in 2.5 and unloaded ones not at all", () => {
    expect(makeCustomExercise("X", "chest", "machine", false).increment).toBe(2.5);
    expect(makeCustomExercise("X", "chest", "dumbbell", false).increment).toBe(2.5);
    expect(makeCustomExercise("X", "core", "bodyweight", false).increment).toBe(0);
  });

  it("never collides with a built-in id", () => {
    const ids = new Set(allExercises().map((e) => e.id));
    expect(ids.has(makeCustomExercise("Back Squat", "quads", "barbell", true).id)).toBe(false);
  });

  it("gives two lifts of the same name different ids", () => {
    const a = makeCustomExercise("Row", "back", "machine", true);
    const b = makeCustomExercise("Row", "back", "machine", true);
    expect(a.id).not.toBe(b.id);
  });

  it("tidies the name and survives one made only of punctuation", () => {
    expect(makeCustomExercise("  cable   crossover  ", "chest", "machine", false).name)
      .toBe("cable crossover");
    expect(makeCustomExercise("???", "chest", "machine", false).id).toMatch(/^custom-lift-/);
  });

  it("caps a runaway name", () => {
    expect(makeCustomExercise("x".repeat(200), "chest", "machine", false).name).toHaveLength(40);
  });
});
