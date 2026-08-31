import { describe, expect, it } from "vitest";
import {
  buildSession,
  generateRoutine,
  rebuildDay,
  nextTarget,
  personalRecord,
  pickExercise,
  roundToIncrement,
  startingWeight,
  streakWeeks,
  restSeconds,
  mergeRebuild,
  alternativesFor,
  musclesIn,
} from "./engine";
import { byId } from "./exercises";
import type { Equipment, Session } from "./types";

const ALL: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight", "kettlebell"];

/** Build a completed session where every set hit `reps` at `weight`. */
function session(date: string, exerciseId: string, sets: number, reps: number, weight: number): Session {
  return {
    date,
    label: "Test",
    completedAt: date + "T12:00:00.000Z",
    exercises: [
      {
        exerciseId,
        sets: Array.from({ length: sets }, () => ({ weight, reps, done: true })),
      },
    ],
  };
}

describe("roundToIncrement", () => {
  it("snaps to the nearest plate jump", () => {
    expect(roundToIncrement(97, 5)).toBe(95);
    expect(roundToIncrement(98, 5)).toBe(100);
  });

  it("never returns less than one increment", () => {
    expect(roundToIncrement(1, 10)).toBe(10);
    expect(roundToIncrement(-50, 5)).toBe(5);
  });

  it("returns zero for bodyweight movements", () => {
    expect(roundToIncrement(100, 0)).toBe(0);
  });
});

describe("pickExercise", () => {
  it("prefers compounds over isolation", () => {
    const picked = pickExercise("glutes", ALL, new Set());
    expect(picked?.compound).toBe(true);
  });

  it("only returns exercises the user has equipment for", () => {
    const picked = pickExercise("quads", ["bodyweight"], new Set());
    expect(picked?.equipment).toBe("bodyweight");
  });

  it("respects the exclusion set so a day never repeats a lift", () => {
    const first = pickExercise("back", ALL, new Set())!;
    const second = pickExercise("back", ALL, new Set([first.id]));
    expect(second?.id).not.toBe(first.id);
  });

  it("returns null when nothing fits", () => {
    expect(pickExercise("arms", ["barbell"], new Set())).toBeNull();
  });
});

describe("generateRoutine", () => {
  it("returns one routine per training day", () => {
    expect(generateRoutine("new", [1, 3, 5], ALL)).toHaveLength(3);
  });

  it("is deterministic — same inputs, same plan", () => {
    const a = generateRoutine("returning", [1, 3, 5], ALL);
    const b = generateRoutine("returning", [1, 3, 5], ALL);
    expect(a).toEqual(b);
  });

  it("never repeats an exercise inside a single day", () => {
    for (const r of generateRoutine("experienced", [0, 1, 2, 3, 4, 5, 6], ALL)) {
      const ids = r.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("falls back to bodyweight rather than producing an empty day", () => {
    const routines = generateRoutine("new", [1, 2, 3], []);
    for (const r of routines) expect(r.exercises.length).toBeGreaterThan(0);
  });

  it("substitutes when the user only has dumbbells", () => {
    const routines = generateRoutine("returning", [1, 2, 3], ["dumbbell"]);
    for (const r of routines) {
      for (const e of r.exercises) {
        expect(["dumbbell", "bodyweight"]).toContain(byId(e.exerciseId)!.equipment);
      }
    }
  });

  it("gives experienced lifters more sets at lower reps", () => {
    const [beginner] = generateRoutine("new", [1], ALL);
    const [advanced] = generateRoutine("experienced", [1], ALL);
    expect(advanced.exercises[0].sets).toBeGreaterThan(beginner.exercises[0].sets);
    expect(advanced.exercises[0].reps).toBeLessThan(beginner.exercises[0].reps);
  });

  it("dedupes and sorts training days", () => {
    const r = generateRoutine("new", [5, 1, 1, 3], ALL);
    expect(r.map((x) => x.day)).toEqual([1, 3, 5]);
  });

  it("returns nothing when no days are selected", () => {
    expect(generateRoutine("new", [], ALL)).toEqual([]);
  });
});

describe("startingWeight", () => {
  it("scales isolation work below compounds", () => {
    const squat = byId("back-squat")!;
    const curl = byId("db-curl")!;
    expect(startingWeight(curl, "new")).toBeLessThan(startingWeight(squat, "new"));
  });

  it("gives bodyweight movements no load", () => {
    expect(startingWeight(byId("push-up")!, "experienced")).toBe(0);
  });

  it("starts experienced lifters heavier than beginners", () => {
    const squat = byId("back-squat")!;
    expect(startingWeight(squat, "experienced")).toBeGreaterThan(startingWeight(squat, "new"));
  });
});

describe("nextTarget", () => {
  it("starts at the level baseline with no history", () => {
    const t = nextTarget("back-squat", [], "new");
    expect(t.weight).toBe(startingWeight(byId("back-squat")!, "new"));
    expect(t.note).toMatch(/first time/i);
  });

  it("adds exactly one increment after clearing every rep", () => {
    const s = [session("2026-08-01", "back-squat", 3, 10, 100)];
    expect(nextTarget("back-squat", s, "new").weight).toBe(110);
  });

  it("holds the weight after a missed session", () => {
    const s = [session("2026-08-01", "back-squat", 3, 7, 100)];
    const t = nextTarget("back-squat", s, "new");
    expect(t.weight).toBe(100);
    expect(t.note).toMatch(/same weight/i);
  });

  it("deloads 10% after three consecutive misses", () => {
    const s = [
      session("2026-08-01", "back-squat", 3, 6, 100),
      session("2026-08-03", "back-squat", 3, 6, 100),
      session("2026-08-05", "back-squat", 3, 6, 100),
    ];
    const t = nextTarget("back-squat", s, "new");
    expect(t.weight).toBe(90);
    expect(t.note).toMatch(/backing off/i);
  });

  it("does not deload on only two misses", () => {
    const s = [
      session("2026-08-03", "back-squat", 3, 6, 100),
      session("2026-08-05", "back-squat", 3, 6, 100),
    ];
    expect(nextTarget("back-squat", s, "new").weight).toBe(100);
  });

  it("keeps bodyweight lifts at zero and asks for reps instead", () => {
    const s = [session("2026-08-01", "push-up", 3, 10, 0)];
    const t = nextTarget("push-up", s, "new");
    expect(t.weight).toBe(0);
    expect(t.note).toMatch(/reps/i);
  });

  it("ignores sessions that were never completed", () => {
    const abandoned: Session = { ...session("2026-08-01", "back-squat", 3, 10, 200), completedAt: undefined };
    expect(nextTarget("back-squat", [abandoned], "new").note).toMatch(/first time/i);
  });

  it("always lands on a loadable weight", () => {
    const s = [session("2026-08-01", "bench-press", 3, 3, 97)];
    expect(nextTarget("bench-press", s, "new").weight % 5).toBe(0);
  });

  it("survives an unknown exercise id", () => {
    expect(() => nextTarget("not-a-lift", [], "new")).not.toThrow();
  });
});

describe("personalRecord", () => {
  it("returns the heaviest completed set ever", () => {
    const s = [
      session("2026-08-01", "deadlift", 3, 5, 185),
      session("2026-08-08", "deadlift", 3, 5, 225),
      session("2026-08-15", "deadlift", 3, 5, 205),
    ];
    expect(personalRecord(s, "deadlift")).toBe(225);
  });

  it("ignores sets that were skipped", () => {
    const s: Session[] = [
      {
        date: "2026-08-01",
        label: "Test",
        completedAt: "2026-08-01T12:00:00.000Z",
        exercises: [{ exerciseId: "deadlift", sets: [{ weight: 315, reps: 1, done: false }] }],
      },
    ];
    expect(personalRecord(s, "deadlift")).toBe(0);
  });
});

describe("buildSession", () => {
  const [routine] = generateRoutine("new", [1], ALL);

  it("pre-fills one set row per target set", () => {
    const s = buildSession(routine, [], "new", "2026-08-30");
    expect(s.exercises).toHaveLength(routine.exercises.length);
    for (const e of s.exercises) expect(e.sets).toHaveLength(3);
  });

  it("starts every set unfinished", () => {
    const s = buildSession(routine, [], "new", "2026-08-30");
    expect(s.exercises.every((e) => e.sets.every((set) => !set.done))).toBe(true);
  });

  it("carries progression forward from history", () => {
    const id = routine.exercises[0].exerciseId;
    const prior = [session("2026-08-23", id, 3, 10, 100)];
    const s = buildSession(routine, prior, "new", "2026-08-30");
    expect(s.exercises[0].sets[0].weight).toBe(nextTarget(id, prior, "new").weight);
  });

  it("is not marked complete on creation", () => {
    expect(buildSession(routine, [], "new", "2026-08-30").completedAt).toBeUndefined();
  });
});

describe("rebuildDay", () => {
  const [routine] = generateRoutine("returning", [1], ALL);

  it("swaps to what the user actually has", () => {
    const rebuilt = rebuildDay(routine, "returning", ["dumbbell"]);
    for (const e of rebuilt.exercises) {
      expect(["dumbbell", "bodyweight"]).toContain(byId(e.exerciseId)!.equipment);
    }
  });

  it("drops muscles being worked around", () => {
    const rebuilt = rebuildDay(routine, "returning", ALL, ["quads"]);
    expect(rebuilt.exercises.map((e) => byId(e.exerciseId)!.primary)).not.toContain("quads");
  });

  it("keeps the day it belongs to", () => {
    expect(rebuildDay(routine, "returning", ["dumbbell"]).day).toBe(routine.day);
  });

  it("never returns an empty day", () => {
    const rebuilt = rebuildDay(routine, "returning", [], ["quads", "glutes", "chest", "back", "shoulders", "arms", "core", "hamstrings"]);
    expect(rebuilt.exercises.length).toBeGreaterThan(0);
  });
});

describe("streakWeeks", () => {
  const today = new Date("2026-08-30T10:00:00");

  it("is zero with no completed sessions", () => {
    expect(streakWeeks([], today)).toBe(0);
  });

  it("counts the current week", () => {
    expect(streakWeeks([session("2026-08-30", "plank", 3, 30, 0)], today)).toBe(1);
  });

  it("does not break for rest days inside a week", () => {
    const s = [session("2026-08-24", "plank", 3, 30, 0)];
    expect(streakWeeks(s, today)).toBe(1);
  });

  it("chains consecutive weeks", () => {
    const s = [
      session("2026-08-25", "plank", 3, 30, 0),
      session("2026-08-18", "plank", 3, 30, 0),
      session("2026-08-11", "plank", 3, 30, 0),
    ];
    expect(streakWeeks(s, today)).toBe(3);
  });

  it("survives an empty current week if last week was hit", () => {
    // Grace: the week isn't over yet, so a gap at the front doesn't end it.
    expect(streakWeeks([session("2026-08-26", "plank", 3, 30, 0)], today)).toBe(1);
  });

  it("stops at a missed week", () => {
    const s = [
      session("2026-08-25", "plank", 3, 30, 0),
      session("2026-08-04", "plank", 3, 30, 0),
    ];
    expect(streakWeeks(s, today)).toBe(1);
  });
});

describe("restSeconds", () => {
  it("gives compounds the longest rest", () => {
    expect(restSeconds("back-squat")).toBe(120);
  });

  it("gives timed holds the shortest", () => {
    expect(restSeconds("plank")).toBe(60);
  });

  it("falls back for an unknown exercise rather than throwing", () => {
    expect(restSeconds("not-a-real-lift")).toBe(90);
  });
});

describe("mergeRebuild", () => {
  const set = (done: boolean) => ({ weight: 100, reps: 8, done });
  const draft: Session = {
    date: "2026-09-01",
    label: "Day",
    exercises: [
      { exerciseId: "back-squat", sets: [set(true), set(false)] },
      { exerciseId: "bench-press", sets: [set(false)] },
    ],
  };
  const rebuilt: Session = {
    date: "2026-09-01",
    label: "Day",
    exercises: [{ exerciseId: "goblet-squat", sets: [set(false)] }],
  };

  it("keeps work already done and appends the rebuild", () => {
    const out = mergeRebuild(draft, rebuilt);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(["back-squat", "goblet-squat"]);
    expect(out.exercises[0].sets[0].done).toBe(true);
  });

  it("drops an untouched draft entirely", () => {
    const untouched: Session = {
      ...draft,
      exercises: [{ exerciseId: "back-squat", sets: [set(false)] }],
    };
    expect(mergeRebuild(untouched, rebuilt).exercises.map((e) => e.exerciseId)).toEqual([
      "goblet-squat",
    ]);
  });

  it("returns the rebuild when there is no draft at all", () => {
    expect(mergeRebuild(undefined, rebuilt)).toBe(rebuilt);
  });

  it("does not duplicate a lift that survives the rebuild", () => {
    const same: Session = { ...rebuilt, exercises: [{ exerciseId: "back-squat", sets: [set(false)] }] };
    expect(mergeRebuild(draft, same).exercises.map((e) => e.exerciseId)).toEqual(["back-squat"]);
  });
});

describe("alternativesFor", () => {
  it("returns every option for a muscle, compounds first", () => {
    const alts = alternativesFor("quads", ALL);
    expect(alts.length).toBeGreaterThan(1);
    expect(alts[0].compound).toBe(true);
    expect(alts.every((e) => e.primary === "quads")).toBe(true);
  });

  it("respects the kit on hand", () => {
    for (const e of alternativesFor("chest", ["dumbbell"])) {
      expect(["dumbbell", "bodyweight"]).toContain(e.equipment);
    }
  });

  it("always leaves something to do, even with no equipment", () => {
    expect(alternativesFor("quads", []).length).toBeGreaterThan(0);
  });

  it("drops what is already in the session", () => {
    const all = alternativesFor("back", ALL);
    const trimmed = alternativesFor("back", ALL, [all[0].id]);
    expect(trimmed.map((e) => e.id)).not.toContain(all[0].id);
    expect(trimmed).toHaveLength(all.length - 1);
  });
});

describe("musclesIn", () => {
  it("lists each muscle once, in the order the routine trains them", () => {
    const [routine] = generateRoutine("new", [1], ALL);
    const muscles = musclesIn(routine);
    expect(new Set(muscles).size).toBe(muscles.length);
    expect(muscles.length).toBeGreaterThan(0);
  });
});
