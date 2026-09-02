import { describe, expect, it } from "vitest";
import { EXERCISES, byId } from "./exercises";
import { alternativesFor, repsFor } from "./engine";
import type { Muscle } from "./types";

const MUSCLES: Muscle[] = [
  "quads", "hamstrings", "glutes", "chest", "back", "shoulders", "arms", "core",
];

describe("the library covers what people actually train with", () => {
  /**
   * The bug this guards: core held exactly one lift, so "Pick a core lift"
   * offered a single plank — and nothing at all once that plank was already in
   * the day, because the picker excludes what you are already doing.
   */
  it.each(MUSCLES)("leaves a machine-and-dumbbell user options for %s", (muscle) => {
    const options = alternativesFor(muscle, ["machine", "dumbbell"]);
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it.each(MUSCLES)("still has one left for %s after the obvious pick is used", (muscle) => {
    const first = alternativesFor(muscle, ["machine", "dumbbell"])[0];
    const rest = alternativesFor(muscle, ["machine", "dumbbell"], [first.id]);
    expect(rest.length).toBeGreaterThan(0);
  });

  it("gives every muscle a machine option", () => {
    for (const m of MUSCLES) {
      expect(EXERCISES.some((e) => e.primary === m && e.equipment === "machine")).toBe(true);
    }
  });
});

describe("every lift can teach itself", () => {
  // "No guidance for beginners on form, pacing, or rest" was a top-six
  // interview finding, so a lift with no cue is not a lift we offer.
  it.each(EXERCISES.map((e) => [e.name, e] as const))("%s carries full guidance", (_n, ex) => {
    expect(ex.cue.trim().length).toBeGreaterThan(10);
    expect(ex.steps.length).toBeGreaterThanOrEqual(3);
    expect(ex.mistakes.length).toBeGreaterThanOrEqual(2);
    for (const line of [...ex.steps, ...ex.mistakes]) {
      expect(line.trim().length).toBeGreaterThan(10);
    }
  });

  it("has no duplicate ids or names", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(EXERCISES.length);
  });
});

describe("reps follow the lift, not the muscle", () => {
  it("counts a plank in seconds", () => {
    expect(repsFor(byId("plank")!, "new")).toBe(30);
  });

  it("counts a weighted crunch in reps", () => {
    // The old rule was `primary === "core" -> 30`, which would have told
    // someone to do thirty reps on a loaded machine.
    expect(repsFor(byId("ab-crunch-machine")!, "new")).toBeLessThan(30);
  });

  it("marks only holds as holds", () => {
    expect(EXERCISES.filter((e) => e.hold).map((e) => e.id)).toEqual(["plank"]);
  });
});

describe("weight steps match the equipment", () => {
  // One step across the whole app. A lift that progressed in a different unit
  // to its neighbours would make "up 2.5 lb" a lie on some screens.
  it("moves everything loaded in 2.5s, machines included", () => {
    for (const e of EXERCISES.filter((x) => x.increment > 0)) {
      expect(e.increment).toBe(2.5);
    }
  });

  it("gives anything unloaded an increment of zero", () => {
    for (const e of EXERCISES.filter((x) => x.equipment === "bodyweight")) {
      expect(e.increment).toBe(0);
    }
  });
});
