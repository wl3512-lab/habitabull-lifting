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

  it("gives every template real slots to fill", () => {
    for (const t of TEMPLATES) expect(t.muscles.length).toBeGreaterThanOrEqual(4);
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

  it("makes cardio a bodyweight circuit at high reps and no load", () => {
    const [day] = generateRoutine("new", [1], KIT, [], ["cardio"]);
    for (const e of day.exercises) {
      expect(e.weight).toBe(0);
      expect(e.reps).toBeGreaterThanOrEqual(15);
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
