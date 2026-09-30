import { describe, expect, it } from "vitest";
import { saneCustomExercises, saneDayLibrary, saneWeighIns } from "./sane";
import type { Exercise } from "./types";

const mine: Exercise = {
  id: "custom-cable-crossover-abc",
  name: "Cable Crossover",
  equipment: "machine",
  primary: "chest",
  increment: 2.5,
  compound: false,
  cue: "Your lift, your form.",
  steps: ["Set up the way you know it."],
  mistakes: ["Chasing the number."],
};

describe("weigh-ins from outside the app", () => {
  it("keeps the real entries, oldest first", () => {
    const out = saneWeighIns([
      { date: "2026-09-20", lb: 168 },
      { date: "2026-09-06", lb: 171 },
    ]);
    expect(out.map((w) => w.date)).toEqual(["2026-09-06", "2026-09-20"]);
  });

  it("drops a weight that would reach the chart as geometry", () => {
    // A NaN or a string in `lb` blanks the whole card rather than drawing one
    // bad point, which is why this is dropped and not rounded.
    const out = saneWeighIns([
      { date: "2026-09-06", lb: Number.NaN },
      { date: "2026-09-07", lb: "171" },
      { date: "2026-09-08", lb: 0 },
      { date: "2026-09-09", lb: -4 },
      { date: "2026-09-10", lb: 171 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].lb).toBe(171);
  });

  it("answers with a list for anything that is not one", () => {
    expect(saneWeighIns(undefined)).toEqual([]);
    expect(saneWeighIns("168")).toEqual([]);
    expect(saneWeighIns([null, 7, {}])).toEqual([]);
  });
});

describe("the day library from outside the app", () => {
  it("keeps the day types that hold real lifts", () => {
    const out = saneDayLibrary({
      legs: [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 }],
      push: [{ nonsense: true }],
      pull: "not a day",
      upper: [],
    });
    expect(Object.keys(out ?? {})).toEqual(["legs"]);
  });

  it("is undefined rather than empty when there is nothing usable", () => {
    // `load` returns undefined for "never shaped a day", and an empty object
    // would read as "shaped one and it is blank" to anything that checks.
    expect(saneDayLibrary({ legs: [{ nonsense: true }] })).toBeUndefined();
    expect(saneDayLibrary(undefined)).toBeUndefined();
    expect(saneDayLibrary("legs")).toBeUndefined();
    expect(saneDayLibrary([1, 2])).toBeUndefined();
  });
});

describe("custom lifts from outside the app", () => {
  it("keeps a whole one", () => {
    expect(saneCustomExercises([mine])[0].name).toBe("Cable Crossover");
  });

  it("drops one missing a field a screen will dereference", () => {
    const { steps: _steps, ...noSteps } = mine;
    const { cue: _cue, ...noCue } = mine;
    expect(saneCustomExercises([noSteps, noCue, { id: "x" }, null, "lift"])).toEqual([]);
  });

  it("answers with a list for anything that is not one", () => {
    expect(saneCustomExercises(undefined)).toEqual([]);
    expect(saneCustomExercises({ id: "x" })).toEqual([]);
  });
});
