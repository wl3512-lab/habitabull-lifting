import { describe, expect, it } from "vitest";
import { TEMPLATES, coversTwiceWeekly, defaultTemplates, templateOf } from "./templates";
import { generateRoutine } from "./engine";
import { byId } from "./exercises";
import type { Equipment } from "./types";

const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

describe("templates", () => {
  it("puts full body first and marks it as the recommended shape", () => {
    expect(TEMPLATES[0].id).toBe("full-body");
    expect(TEMPLATES[0].recommended).toBe(true);
    expect(TEMPLATES.filter((t) => t.recommended)).toHaveLength(1);
  });

  it("gives every template either real slots to fill or lifts by name", () => {
    // A day is built one of two ways and must be whole under whichever it
    // uses: enough slots for the picker to make a session out of, or an
    // explicit lineup. Thin muscle lists were the failure this caught before
    // named lifts existed, and it still catches them.
    for (const t of TEMPLATES) {
      if (t.lifts) expect(t.lifts.length).toBeGreaterThanOrEqual(1);
      else expect(t.muscles.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("names only lifts that exist, and ends on one that needs no kit", () => {
    for (const t of TEMPLATES) {
      if (!t.lifts) continue;
      for (const id of t.lifts) expect(byId(id), id).toBeTruthy();
      // The last is the fallback when nothing else matches her equipment, so
      // it cannot itself require any.
      expect(byId(t.lifts[t.lifts.length - 1])!.equipment).toBe("bodyweight");
    }
  });

  it("falls back rather than throwing on an unknown id", () => {
    // @ts-expect-error deliberately wrong, as a stored plan might be
    expect(templateOf("nonsense").id).toBe("full-body");
  });

  it("defaults a week to full body", () => {
    expect(defaultTemplates(3)).toEqual(["full-body", "full-body", "full-body"]);
  });
});

describe("coversTwiceWeekly", () => {
  it("is true for three full-body days", () => {
    expect(coversTwiceWeekly(["full-body", "full-body", "full-body"])).toBe(true);
  });

  it("is false for a three-day push/pull/legs week", () => {
    // The exact thing ACSM warns about: each group trained once.
    expect(coversTwiceWeekly(["push", "pull", "legs"])).toBe(false);
  });

  it("is true once push/pull/legs is run twice", () => {
    expect(coversTwiceWeekly(["push", "pull", "legs", "push", "pull", "legs"])).toBe(true);
  });
});

describe("generateRoutine with day types", () => {
  it("names the day after the template chosen", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT, [], ["legs", "push", "pull"]);
    expect(week.map((r) => r.label)).toEqual(["Leg day", "Push day", "Pull day"]);
    expect(week.map((r) => r.template)).toEqual(["legs", "push", "pull"]);
  });

  it("keeps full body alternating so two sessions are never identical", () => {
    const week = generateRoutine("new", [1, 3], KIT, [], ["full-body", "full-body"]);
    expect(week[0].exercises.map((e) => e.exerciseId)).not.toEqual(
      week[1].exercises.map((e) => e.exerciseId)
    );
  });

  it("gives a leg day only lower body and core", () => {
    const [day] = generateRoutine("new", [1], KIT, [], ["legs"]);
    for (const e of day.exercises) {
      expect(["quads", "hamstrings", "glutes", "core"]).toContain(byId(e.exerciseId)!.primary);
    }
  });

  it("makes cardio one treadmill, timed, flat, and nothing else", () => {
    const [day] = generateRoutine("new", [1], KIT, [], ["cardio"]);
    expect(day.exercises).toHaveLength(1);
    expect(day.exercises[0].exerciseId).toBe("treadmill");
    // One set, because continuous work is not repeated.
    expect(day.exercises[0].sets).toBe(1);
    // Minutes, not reps.
    expect(day.exercises[0].reps).toBe(20);
    // Flat to start; the incline is hers to raise.
    expect(day.exercises[0].weight).toBe(0);
  });

  it("falls back to a run for somebody with no machine", () => {
    const [day] = generateRoutine("new", [1], ["bodyweight"], [], ["cardio"]);
    expect(day.exercises).toHaveLength(1);
    expect(day.exercises[0].exerciseId).toBe("outdoor-run");
  });

  it("gives cardio the same twenty minutes at every level", () => {
    // Duration is the one variable the app does not progress, so it does not
    // need three starting points.
    for (const level of ["new", "returning", "experienced"] as const) {
      const [day] = generateRoutine(level, [1], KIT, [], ["cardio"]);
      expect(day.exercises[0].reps).toBe(20);
    }
  });

  it("still defaults to full body when nothing is chosen", () => {
    expect(generateRoutine("new", [1], KIT)[0].template).toBe("full-body");
  });

  it("cycles the templates when there are more days than choices", () => {
    const week = generateRoutine("new", [1, 2, 3, 4], KIT, [], ["push", "pull"]);
    expect(week.map((r) => r.template)).toEqual(["push", "pull", "push", "pull"]);
  });
});
