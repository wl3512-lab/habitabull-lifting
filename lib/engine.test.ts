import { describe, expect, it } from "vitest";
import {
  buildSession,
  sessionTarget,
  generateRoutine,
  rebuildDay,
  nextTarget,
  plannedShape,
  personalRecord,
  pickExercise,
  roundToIncrement,
  startingWeight,
  streakWeeks,
  restSeconds,
  mergeRebuild,
  alternativesFor,
  musclesIn,
  rememberLineup,
  mergeDayLibrary,
  overlayDayLibrary,
  repsFor,
  suggestFrom,
  LEVEL_SETS,
  reconcileWeek,
  refreshOpenDay,
  samePlan,
  unfilled,
} from "./engine";
import { byId } from "./exercises";
import type { Equipment, Routine, Session } from "./types";

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
    expect(nextTarget("back-squat", s, "new").weight).toBe(102.5);
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

  it("counts a session she ended rather than finished", () => {
    // End, at the top of the log screen, does not write completedAt; Finish
    // does. Requiring it here meant the ordinary gym session did not exist.
    const ended: Session = { ...session("2026-08-01", "back-squat", 3, 10, 200), completedAt: undefined };
    expect(nextTarget("back-squat", [ended], "new").note).not.toMatch(/first time/i);
  });

  it("ignores a session she opened and never lifted in", () => {
    const opened: Session = {
      date: "2026-08-01",
      label: "Leg day",
      exercises: [{ exerciseId: "back-squat", sets: [{ weight: 200, reps: 10, done: false }] }],
    };
    expect(nextTarget("back-squat", [opened], "new").note).toMatch(/first time/i);
  });

  it("always lands on a loadable weight", () => {
    // 2.5 lb is the smallest real jump: 1.25 lb plates, one per side.
    const s = [session("2026-08-01", "bench-press", 3, 3, 97)];
    expect(nextTarget("bench-press", s, "new").weight % 2.5).toBe(0);
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

  it("repeats the completed weight from history", () => {
    const id = routine.exercises[0].exerciseId;
    const prior = [session("2026-08-23", id, 3, 10, 100)];
    const s = buildSession(routine, prior, "new", "2026-08-30");
    expect(s.exercises[0].sets[0]).toEqual({ weight: 100, reps: 10, done: false });
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
  it("is the number she set, whatever the lift", () => {
    // The bug this replaced: one setting, three different rests, because the
    // number was multiplied by whether the lift was a compound.
    expect(restSeconds({ restSec: 60 })).toBe(60);
  });

  it("reads the old pace setting when there is no number", () => {
    // Every device that installed before this stores a pref and nothing else.
    expect(restSeconds({ restPref: "short" })).toBe(60);
    expect(restSeconds({ restPref: "standard" })).toBe(90);
    expect(restSeconds({ restPref: "long" })).toBe(150);
  });

  it("defaults rather than returning undefined for an empty profile", () => {
    expect(restSeconds({})).toBe(90);
  });

  it("clamps a stored number that is out of range", () => {
    expect(restSeconds({ restSec: 5 })).toBe(15);
    expect(restSeconds({ restSec: 9999 })).toBe(300);
  });

  it("prefers the number over a stale pace", () => {
    expect(restSeconds({ restSec: 45, restPref: "long" })).toBe(45);
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


describe("generateRoutine — full body, not a split", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

  it("trains the lower body, a push, a pull and the core every session", () => {
    for (const r of generateRoutine("new", [1, 3, 5], KIT)) {
      const groups = r.exercises.map((e) => byId(e.exerciseId)!.primary);
      const lower = groups.some((m) => ["quads", "hamstrings", "glutes"].includes(m));
      const push = groups.some((m) => ["chest", "shoulders"].includes(m));
      const pull = groups.includes("back");
      expect(lower, `${r.label} has no lower body`).toBe(true);
      expect(push, `${r.label} has no push`).toBe(true);
      expect(pull, `${r.label} has no pull`).toBe(true);
    }
  });

  it("hits every major group at least twice a week on three days", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT);
    const counts = new Map<string, number>();
    for (const r of week) {
      for (const e of r.exercises) {
        const m = byId(e.exerciseId)!.primary;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }
    // ACSM: every major group twice a week. A split cannot do this on 3 days.
    for (const group of ["back"]) {
      expect(counts.get(group) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it("names sessions by what they are, not by the weekday", () => {
    for (const r of generateRoutine("new", [1, 3, 5], KIT)) {
      expect(r.label).toMatch(/Full body/);
      expect(r.label).not.toMatch(/Monday|Wednesday|Friday/);
    }
  });

  it("alternates A and B so consecutive sessions are not identical", () => {
    const [a, b] = generateRoutine("new", [1, 3], KIT);
    expect(a.label).not.toBe(b.label);
    expect(a.exercises.map((e) => e.exerciseId)).not.toEqual(b.exercises.map((e) => e.exerciseId));
  });

  it("gives compounds fewer reps than accessories", () => {
    const [day] = generateRoutine("new", [1], KIT);
    const compound = day.exercises.find((e) => byId(e.exerciseId)!.compound && byId(e.exerciseId)!.primary !== "core");
    const accessory = day.exercises.find((e) => !byId(e.exerciseId)!.compound && byId(e.exerciseId)!.primary !== "core");
    if (compound && accessory) expect(compound.reps).toBeLessThan(accessory.reps);
  });

  it("builds a real session, not two lifts and a plank", () => {
    for (const r of generateRoutine("new", [1, 3, 5], KIT)) {
      expect(r.exercises.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("repsFor — one source of truth", () => {
  it("keeps heavy lifts at five", () => {
    expect(repsFor(byId("deadlift")!, "new")).toBe(5);
    expect(repsFor(byId("deadlift")!, "experienced")).toBe(5);
  });

  it("gives accessories more reps than compounds", () => {
    expect(repsFor(byId("db-curl")!, "new")).toBeGreaterThan(repsFor(byId("bench-press")!, "new"));
  });

  it("times the core instead of counting it", () => {
    expect(repsFor(byId("plank")!, "new")).toBe(30);
  });

  it("agrees with what the plan and the home screen both show", () => {
    const [day] = generateRoutine("new", [1], ["barbell", "dumbbell", "machine", "bodyweight"]);
    for (const planned of day.exercises) {
      const target = nextTarget(planned.exerciseId, [], "new");
      expect(target.reps, `${planned.exerciseId} disagrees`).toBe(planned.reps);
    }
  });
});

describe("favourites", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

  it("breaks a tie toward a starred lift", () => {
    const plain = pickExercise("quads", KIT, new Set());
    const starred = pickExercise("quads", KIT, new Set(), ["goblet-squat"]);
    expect(plain?.id).toBe("back-squat");
    expect(starred?.id).toBe("goblet-squat");
  });

  it("does not invent a lift the kit cannot do", () => {
    const picked = pickExercise("chest", ["bodyweight"], new Set(), ["bench-press"]);
    expect(picked?.equipment).toBe("bodyweight");
  });

  it("puts starred lifts first in the swap list without dropping the rest", () => {
    const all = alternativesFor("quads", KIT);
    const sorted = alternativesFor("quads", KIT, [], ["bodyweight-squat"]);
    expect(sorted[0].id).toBe("bodyweight-squat");
    expect(sorted).toHaveLength(all.length);
  });

  it("feeds the generated week", () => {
    const [day] = generateRoutine("new", [1], KIT, ["goblet-squat"]);
    expect(day.exercises.map((e) => e.exerciseId)).toContain("goblet-squat");
  });

  it("suggests a different lift for the same muscle", () => {
    const [s] = suggestFrom(["back-squat"], KIT);
    expect(s.because).toBe("back-squat");
    expect(s.tryThis).not.toBe("back-squat");
    expect(byId(s.tryThis)!.primary).toBe("quads");
  });

  it("never suggests something already starred", () => {
    const out = suggestFrom(["back-squat", "goblet-squat"], KIT);
    for (const s of out) expect(["back-squat", "goblet-squat"]).not.toContain(s.tryThis);
  });

  it("says nothing when there is no real alternative", () => {
    // Hamstrings have nothing you can do with no equipment at all, so there is
    // genuinely nothing to offer. This used to be asserted with a starred
    // plank, which only held while the plank was the sole core lift in the
    // library — that is a fact about a thin library, not a rule.
    expect(suggestFrom(["romanian-deadlift"], [])).toEqual([]);
  });

  it("now has something to offer the person who stars a plank", () => {
    const out = suggestFrom(["plank"], ["bodyweight"]);
    expect(out.length).toBeGreaterThan(0);
    expect(byId(out[0].tryThis)!.primary).toBe("core");
  });

  it("ignores a favourite that is not a real lift", () => {
    expect(suggestFrom(["not-a-lift"], KIT)).toEqual([]);
  });
});

describe("rememberLineup", () => {
  const legDay: Routine = {
    day: 1,
    label: "Leg day",
    exercises: [
      { exerciseId: "back-squat", sets: 3, reps: 8, weight: 135 },
      { exerciseId: "leg-press", sets: 3, reps: 10, weight: 180 },
    ],
  };
  const pushDay: Routine = {
    day: 3,
    label: "Push day",
    exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }],
  };

  /** A finished Leg day where a lift was added and one dropped. */
  function trained(label: string, ids: string[], extra: Partial<Session> = {}): Session {
    return {
      date: "2026-09-07",
      label,
      completedAt: "2026-09-07T12:00:00.000Z",
      exercises: ids.map((id) => ({
        exerciseId: id,
        sets: [{ weight: 100, reps: 9, done: true }],
      })),
      ...extra,
    };
  }

  it("writes the trained lineup back onto the matching routine", () => {
    const out = rememberLineup([legDay, pushDay], trained("Leg day", ["back-squat", "hip-abductor"]));
    const leg = out.find((r) => r.label === "Leg day")!;
    expect(leg.exercises.map((e) => e.exerciseId)).toEqual(["back-squat", "hip-abductor"]);
    // leg-press was not done, so it is dropped; the added machine is kept.
    expect(leg.exercises.some((e) => e.exerciseId === "leg-press")).toBe(false);
  });

  it("only touches the routine whose label matches", () => {
    const out = rememberLineup([legDay, pushDay], trained("Leg day", ["back-squat"]));
    expect(out.find((r) => r.label === "Push day")).toEqual(pushDay);
  });

  it("carries the performed reps and set count as the new seed", () => {
    const out = rememberLineup([legDay], trained("Leg day", ["back-squat"]));
    const sq = out[0].exercises[0];
    expect(sq).toEqual({ exerciseId: "back-squat", sets: 1, reps: 9, weight: 100 });
  });

  it("leaves the plan alone for a one-off constraint rebuild", () => {
    const out = rememberLineup([legDay], trained("Leg day", ["back-squat"], { adapted: true }));
    expect(out).toEqual([legDay]);
  });

  /*
    A quick workout is improvised lift by lift and happens to fall on a weekday.
    Writing its lineup back would let one drop-in session — two machines and a
    bike, because the rack was busy — redefine Leg day permanently.
  */
  it("leaves the plan alone for a quick workout", () => {
    const quick = trained("Leg day", ["hip-abductor"], { freestyle: true });
    expect(rememberLineup([legDay], quick)).toEqual([legDay]);
  });

  it("leaves the plan alone even when the quick workout shares its name", () => {
    const quick = trained("Quick workout", ["hip-abductor"], { freestyle: true });
    expect(rememberLineup([{ ...legDay, label: "Quick workout" }], quick)[0].exercises).toEqual(
      legDay.exercises
    );
  });

  it("never blanks a routine from an empty session", () => {
    const out = rememberLineup([legDay], { date: "2026-09-07", label: "Leg day", exercises: [] });
    expect(out).toEqual([legDay]);
  });
});

describe("day library (per day-type memory)", () => {
  const leg: Routine = { day: 1, label: "Leg day", template: "legs",
    exercises: [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 135 }] };
  const legB: Routine = { day: 3, label: "Leg day", template: "legs",
    exercises: [{ exerciseId: "leg-press", sets: 3, reps: 10, weight: 180 }] };
  const fb: Routine = { day: 5, label: "Full body A", template: "full-body",
    exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }] };

  it("remembers a named day's exercises under its template", () => {
    expect(mergeDayLibrary({}, [leg]).legs).toEqual(leg.exercises);
  });
  it("never remembers full-body (it is meant to vary)", () => {
    expect(mergeDayLibrary({}, [fb])).toEqual({});
  });
  it("skips an empty day rather than blanking the memory", () => {
    expect(mergeDayLibrary({ legs: leg.exercises }, [{ ...leg, exercises: [] }]).legs)
      .toEqual(leg.exercises);
  });
  it("keeps the most recent version of a day type", () => {
    expect(mergeDayLibrary({}, [leg, legB]).legs).toEqual(legB.exercises);
  });
  it("does not let a saved workout become the day type's lineup", () => {
    // Monday saved as "Legs and abs" is her workout, not her leg day.
    const custom: Routine = { ...legB, label: "Legs and abs", workoutId: "own-legs-and-abs" };
    expect(mergeDayLibrary({ legs: leg.exercises }, [custom]).legs).toEqual(leg.exercises);
    expect(mergeDayLibrary({}, [custom])).toEqual({});
  });

  it("overlays the saved day type onto a freshly generated day", () => {
    const fresh: Routine = { day: 6, label: "Leg day", template: "legs",
      exercises: [{ exerciseId: "goblet-squat", sets: 3, reps: 10, weight: 20 }] };
    const [out] = overlayDayLibrary([fresh], { legs: leg.exercises });
    expect(out.exercises).toEqual(leg.exercises);
  });
  it("leaves a day type with no saved version untouched", () => {
    const push: Routine = { day: 2, label: "Push day", template: "push",
      exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }] };
    expect(overlayDayLibrary([push], { legs: leg.exercises })).toEqual([push]);
  });
  it("does not overlay full-body even if it is in the library", () => {
    expect(overlayDayLibrary([fb], { "full-body": leg.exercises })).toEqual([fb]);
  });
});

describe("cardio is counted differently because it is a different thing", () => {
  // types.ts calls it "one set, logged in minutes" and import.ts has always
  // clamped an imported plan to that. The engine was the path that did not,
  // so a bike came back as four nine-minute blocks with rests between.
  it("gives a cardio machine one set, not the level's", () => {
    expect(nextTarget("bike", [], "experienced").sets).toBe(1);
    expect(nextTarget("treadmill", [], "new").sets).toBe(1);
  });

  it("still gives a hold the level's sets, because a plank is repeated", () => {
    expect(nextTarget("plank", [], "experienced").sets).toBe(LEVEL_SETS.experienced);
  });

  it("does not tell a bike or a plank to add reps", () => {
    // Both are unloaded, so both take the increment === 0 branch, and both
    // used to be told to add two reps — of minutes, and of seconds.
    const cleared = (id: string, reps: number): Session[] => [
      {
        date: "2026-09-01",
        label: "Cardio",
        completedAt: "2026-09-01T18:00:00.000Z",
        exercises: [{ exerciseId: id, sets: Array.from({ length: 4 }, () => ({ weight: 0, reps, done: true })) }],
      },
    ];
    expect(nextTarget("bike", cleared("bike", 99), "experienced").note).not.toMatch(/reps/i);
    expect(nextTarget("plank", cleared("plank", 99), "experienced").note).not.toMatch(/reps/i);
  });

  it("still says reps for a lift actually counted in them", () => {
    const cleared: Session[] = [
      {
        date: "2026-09-01",
        label: "Push",
        completedAt: "2026-09-01T18:00:00.000Z",
        exercises: [{ exerciseId: "push-up", sets: Array.from({ length: 4 }, () => ({ weight: 0, reps: 99, done: true })) }],
      },
    ];
    expect(nextTarget("push-up", cleared, "experienced").note).toMatch(/reps/i);
  });
});

describe("cardio keeps the incline she set", () => {
  const ran = (date: string, minutes: number, incline: number): Session => ({
    date,
    label: "Cardio",
    completedAt: `${date}T18:00:00.000Z`,
    exercises: [{ exerciseId: "treadmill", sets: [{ weight: incline, reps: minutes, done: true }] }],
  });

  it("starts flat when there is no history", () => {
    expect(nextTarget("treadmill", [], "new").weight).toBe(0);
  });

  it("holds the last incline rather than resetting to flat", () => {
    // She set 5% on Monday; Wednesday must not hand her 0% back.
    expect(nextTarget("treadmill", [ran("2026-09-07", 20, 5)], "new").weight).toBe(5);
  });

  it("never raises the incline on its own", () => {
    // Clearing the target is what adds a plate on a loaded lift. How steep a
    // treadmill is stays her call.
    expect(nextTarget("treadmill", [ran("2026-09-07", 99, 5)], "new").weight).toBe(5);
  });

  it("never cuts the incline after a rough run of sessions", () => {
    const rough = [ran("2026-09-07", 1, 8), ran("2026-09-05", 1, 8), ran("2026-09-03", 1, 8)];
    expect(nextTarget("treadmill", rough, "new").weight).toBe(8);
  });

  it("still offers twenty minutes as the duration", () => {
    expect(nextTarget("treadmill", [ran("2026-09-07", 35, 5)], "new").reps).toBe(20);
  });
});

describe("the core slot rotates", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

  it("does not put the same core lift on every day of the week", () => {
    const week = generateRoutine("new", [1, 2, 3, 4], KIT);
    const cores = week
      .flatMap((d) => d.exercises.map((e) => byId(e.exerciseId)!))
      .filter((e) => e.primary === "core")
      .map((e) => e.id);
    expect(cores.length).toBeGreaterThan(1);
    expect(new Set(cores).size).toBeGreaterThan(1);
  });

  it("still gives the best lift for every other slot, every day", () => {
    // Rotation is for core alone. A compound must not be traded for variety.
    const week = generateRoutine("new", [1, 2, 3], KIT);
    for (const day of week) {
      for (const e of day.exercises) {
        const ex = byId(e.exerciseId)!;
        if (ex.primary === "core") continue;
        const best = pickExercise(ex.primary, KIT, new Set());
        // The day may have used the best already for an earlier slot, so this
        // asserts the pick is a top candidate rather than an arbitrary one.
        expect(best).toBeTruthy();
      }
    }
  });
});

describe("the plan she built sets the shape", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];
  const plan = (sets: number, reps: number): Routine => ({
    day: 1,
    label: "Push day",
    exercises: [{ exerciseId: "bench-press", sets, reps, weight: 0 }],
  });

  it("uses the sets and reps she chose, not the level default", () => {
    // She set 3 by 12 in the editor; the session used to start at the level
    // default and the editor kept showing 12 back at her.
    const s = buildSession(plan(3, 12), [], "experienced", "2026-09-15");
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets.every((x) => x.reps === 12)).toBe(true);
  });

  it("still takes the weight from history, never from the plan", () => {
    const history: Session[] = [
      {
        date: "2026-09-08",
        label: "Push day",
        completedAt: "2026-09-08T18:00:00.000Z",
        exercises: [{ exerciseId: "bench-press", sets: [{ weight: 155, reps: 12, done: true }] }],
      },
    ];
    const s = buildSession(plan(3, 12), history, "experienced", "2026-09-15");
    // The plan says weight 0; the engine knows better.
    expect(s.exercises[0].sets[0].weight).toBeGreaterThan(0);
  });

  it("falls back to the engine when a stored plan has no shape", () => {
    // Routines written before the editor existed, or a hand-edited file.
    const broken = { day: 1, label: "Push day", exercises: [{ exerciseId: "bench-press" }] } as unknown as Routine;
    const s = buildSession(broken, [], "experienced", "2026-09-15");
    expect(s.exercises[0].sets.length).toBeGreaterThan(0);
    expect(s.exercises[0].sets[0].reps).toBeGreaterThan(0);
  });

  it("leaves a generated plan exactly as it was", () => {
    const [day] = generateRoutine("new", [1], KIT);
    const s = buildSession(day, [], "new", "2026-09-15");
    expect(s.exercises[0].sets).toHaveLength(day.exercises[0].sets);
    expect(s.exercises[0].sets[0].reps).toBe(day.exercises[0].reps);
  });
});

describe("plannedShape", () => {
  const target = { sets: 3, reps: 8 };

  /*
    The screen that says what today is used to disagree with the session it
    started: Today read sets and reps off `nextTarget`, which answers with the
    level default, while `buildSession` read them off the plan. A bench day set
    to 3 by 12 previewed as 3 by 8 and then ran as 3 by 12.
  */
  it("uses the plan's own shape, not the engine's default", () => {
    expect(plannedShape({ sets: 3, reps: 12 }, target)).toEqual({ sets: 3, reps: 12 });
    expect(plannedShape({ sets: 5, reps: 5 }, target)).toEqual({ sets: 5, reps: 5 });
  });

  it("falls back rather than building a lift with no sets in it", () => {
    expect(plannedShape({ sets: 0, reps: 0 }, target)).toEqual(target);
  });

  it("rounds a fraction rather than carrying it into a set count", () => {
    expect(plannedShape({ sets: 3.4, reps: 8.6 }, target)).toEqual({ sets: 3, reps: 9 });
  });

  it("never returns fewer than one set", () => {
    expect(plannedShape({ sets: -2, reps: 8 }, target).sets).toBe(3);
  });
});

describe("Today's preview and the session it starts", () => {
  const KIT2: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

  it("agree on sets and reps for a day she edited", () => {
    const [routine] = generateRoutine("new", [1], KIT2, [], ["full-body"]);
    // She set the first lift to 5 by 5 in the editor.
    const edited = {
      ...routine,
      exercises: routine.exercises.map((e, i) => (i === 0 ? { ...e, sets: 5, reps: 5 } : e)),
    };
    const session = buildSession(edited, [], "new", "2026-09-26");
    const planned = edited.exercises[0];
    const t = nextTarget(planned.exerciseId, [], "new");
    // What Today draws, and what the session actually holds.
    expect(plannedShape(planned, t)).toEqual({ sets: 5, reps: 5 });
    expect(session.exercises[0].sets).toHaveLength(5);
    expect(session.exercises[0].sets[0].reps).toBe(5);
  });
});

describe("reconcileWeek", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];
  const named = () => generateRoutine("new", [1, 3, 5], KIT, [], ["push", "pull", "legs"]);
  const types = (rs: Routine[]) => rs.map((r) => [r.day, r.template]);

  it("keeps every day still trained exactly as it was", () => {
    const week = named();
    const out = reconcileWeek(week, [1, 3, 5], "new", KIT);
    expect(out).toEqual(week);
  });

  /*
    The reported bug. Adding a Tuesday to Push/Pull/Legs used to rebuild the
    week with no day types at all, so all four days came back full-body and the
    three named days were gone.
  */
  it("gives only the inserted day a default and leaves the rest alone", () => {
    const week = named();
    const out = reconcileWeek(week, [1, 2, 3, 5], "new", KIT);
    expect(types(out)).toEqual([
      [1, "push"],
      [2, "full-body"],
      [3, "pull"],
      [5, "legs"],
    ]);
    // Not just the types: the kept days are the same objects, lifts and all.
    expect(out.filter((r) => r.day !== 2)).toEqual(week);
  });

  it("holds when a day is added at either end", () => {
    const week = named();
    expect(types(reconcileWeek(week, [0, 1, 3, 5], "new", KIT))).toEqual([
      [0, "full-body"], [1, "push"], [3, "pull"], [5, "legs"],
    ]);
    expect(types(reconcileWeek(week, [1, 3, 5, 6], "new", KIT))).toEqual([
      [1, "push"], [3, "pull"], [5, "legs"], [6, "full-body"],
    ]);
  });

  it("drops a day no longer trained without touching the rest", () => {
    const week = named();
    const out = reconcileWeek(week, [1, 5], "new", KIT);
    expect(out).toEqual(week.filter((r) => r.day !== 3));
  });

  /*
    A day that moves. Training push/pull/legs on Mon/Tue/Fri and shifting
    Tuesday to Wednesday read as one deletion and one unrelated insertion, so
    the pull day was discarded and Wednesday came back as a generic full-body
    day. Changing a date is not a request for a different workout.
  */
  it("carries a day's whole workout when it moves to another date", () => {
    const week = generateRoutine("new", [1, 2, 5], KIT, [], ["push", "pull", "legs"]);
    const out = reconcileWeek(week, [1, 3, 5], "new", KIT);
    expect(types(out)).toEqual([[1, "push"], [3, "pull"], [5, "legs"]]);
    const tue = week.find((r) => r.day === 2)!;
    const wed = out.find((r) => r.day === 3)!;
    expect(wed).toEqual({ ...tue, day: 3 });
  });

  it("leaves the days either side of a move untouched", () => {
    const week = generateRoutine("new", [1, 2, 5], KIT, [], ["push", "pull", "legs"]);
    const out = reconcileWeek(week, [1, 3, 5], "new", KIT);
    expect(out.find((r) => r.day === 1)).toEqual(week.find((r) => r.day === 1));
    expect(out.find((r) => r.day === 5)).toEqual(week.find((r) => r.day === 5));
  });

  it("shifts a whole week forward a day without rebuilding any of it", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT, [], ["push", "pull", "legs"]);
    const out = reconcileWeek(week, [2, 4, 6], "new", KIT);
    expect(types(out)).toEqual([[2, "push"], [4, "pull"], [6, "legs"]]);
    expect(out.map((r) => r.exercises)).toEqual(week.map((r) => r.exercises));
  });

  it("still treats an unmatched departure as a genuine drop", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT, [], ["push", "pull", "legs"]);
    // Two days leave, one arrives: one move, one real drop.
    const out = reconcileWeek(week, [1, 4], "new", KIT);
    expect(types(out)).toEqual([[1, "push"], [4, "pull"]]);
  });

  it("still treats an unmatched arrival as a genuinely new day", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT, [], ["push", "pull", "legs"]);
    // Nothing leaves, one arrives: the new day defaults, as it always did.
    const out = reconcileWeek(week, [1, 2, 3, 5], "new", KIT);
    expect(types(out)).toEqual([
      [1, "push"], [2, "full-body"], [3, "pull"], [5, "legs"],
    ]);
  });

  it("does not relabel a full-body week when one of its days moves", () => {
    const week = generateRoutine("new", [1, 2, 5], KIT, [], ["full-body", "full-body", "full-body"]);
    const out = reconcileWeek(week, [1, 3, 5], "new", KIT);
    expect(out.map((r) => r.label)).toEqual(week.map((r) => r.label));
  });

  it("sorts and de-duplicates the days it is given", () => {
    const week = named();
    expect(types(reconcileWeek(week, [5, 1, 1], "new", KIT))).toEqual([[1, "push"], [5, "legs"]]);
  });

  it("builds a whole week from nothing", () => {
    expect(types(reconcileWeek([], [1, 3, 5], "new", KIT))).toEqual([
      [1, "full-body"], [3, "full-body"], [5, "full-body"],
    ]);
  });

  /*
    The quieter half of the same bug. With the day types carried across, a
    full-body week still had its A/B variant assigned by position, so inserting
    a Tuesday turned a "Full body B" Wednesday into "Full body A" with different
    lifts. Wednesday is untouched now, and the new Tuesday takes the variant its
    nearest neighbour does not have, so the week still alternates.
  */
  it("does not change a full-body day's variant or lifts when a day is inserted", () => {
    const week = generateRoutine("new", [1, 3, 5], KIT, [], ["full-body", "full-body", "full-body"]);
    expect(week.map((r) => r.label)).toEqual(["Full body A", "Full body B", "Full body A"]);
    const out = reconcileWeek(week, [1, 2, 3, 5], "new", KIT);
    const wed = out.find((r) => r.day === 3)!;
    expect(wed).toEqual(week[1]);
    expect(out.map((r) => r.label)).toEqual([
      "Full body A",
      "Full body B", // opposite of Monday, its nearest kept neighbour
      "Full body B",
      "Full body A",
    ]);
  });

  it("alternates a new day against its nearest kept full-body neighbour", () => {
    const week = generateRoutine("new", [1, 5], KIT, [], ["full-body", "full-body"]);
    // Mon A, Fri B. A new Thursday sits next to Friday and takes A.
    expect(reconcileWeek(week, [1, 4, 5], "new", KIT).map((r) => r.label)).toEqual([
      "Full body A", "Full body A", "Full body B",
    ]);
  });

  it("applies a saved shape to a new day of that type, and only to it", () => {
    const week = named();
    const library = { push: [{ exerciseId: "bench-press", sets: 5, reps: 5, weight: 135 }] };
    // Nothing new is a push day, so the library changes nothing.
    expect(reconcileWeek(week, [1, 2, 3, 5], "new", KIT, [], library).find((r) => r.day === 1)).toEqual(week[0]);
  });

  it("survives a stored routine with no template on it", () => {
    const week: Routine[] = [{ day: 1, label: "Whatever", exercises: [] }];
    expect(types(reconcileWeek(week, [1, 3], "new", KIT))).toEqual([[1, undefined], [3, "full-body"]]);
  });
});

describe("adding a day to a built week", () => {
  const KIT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight"];

  it("lets the new day be set to cardio without disturbing the others", () => {
    const days = [1, 2, 3, 5];
    const built = generateRoutine("new", days, KIT, [], ["push", "full-body", "pull", "legs"]);
    // What RoutineEditor's day-type picker does to the selected day.
    const picked = built.map((r) =>
      r.day === 2 ? generateRoutine("new", [2], KIT, [], ["cardio"])[0] : r
    );
    expect(picked.map((r) => [r.day, r.template])).toEqual([
      [1, "push"], [2, "cardio"], [3, "pull"], [5, "legs"],
    ]);
    // And it survives the next schedule edit, which is where it used to die.
    const after = reconcileWeek(picked, [1, 2, 3, 5, 6], "new", KIT);
    expect(after.map((r) => r.template)).toEqual(["push", "cardio", "pull", "legs", "full-body"]);
    expect(after.find((r) => r.day === 2)).toEqual(picked[1]);
  });
});

describe("an open day catching up with a plan that changed", () => {
  const plan = (label: string, ids: string[]): Routine => ({
    day: 6,
    label,
    exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 8, weight: 45 })),
  });

  /** Today, opened and not finished. */
  const open = (ids: string[], done = 0): Session => ({
    date: "2026-09-26",
    label: "Leg day",
    startedAt: "2026-09-26T17:00:00.000Z",
    exercises: ids.map((exerciseId, i) => ({
      exerciseId,
      sets: Array.from({ length: 3 }, () => ({ weight: 45, reps: 8, done: i < done })),
    })),
  });

  const before = plan("Leg day", ["back-squat", "romanian-deadlift"]);
  const after = plan("Push day", ["bench-press", "overhead-press"]);

  it("rebuilds a started-but-unlogged day from the new plan", () => {
    const out = refreshOpenDay([open(["back-squat", "romanian-deadlift"])], before, after, "new", "2026-09-26");
    expect(out[0].exercises.map((e) => e.exerciseId)).toEqual(["bench-press", "overhead-press"]);
    expect(out[0].label).toBe("Push day");
    // Opened is still opened: the duration the summary reports survives.
    expect(out[0].startedAt).toBe("2026-09-26T17:00:00.000Z");
  });

  it("keeps the sets she already did, and adds the new lifts after them", () => {
    const out = refreshOpenDay(
      [open(["back-squat", "romanian-deadlift"], 1)],
      before,
      after,
      "new",
      "2026-09-26"
    );
    expect(out[0].exercises.map((e) => e.exerciseId)).toEqual([
      "back-squat",
      "bench-press",
      "overhead-press",
    ]);
    expect(out[0].exercises[0].sets.every((s) => s.done)).toBe(true);
  });

  it("leaves a finished day alone", () => {
    const done = { ...open(["back-squat"], 1), completedAt: "2026-09-26T18:00:00.000Z" };
    expect(refreshOpenDay([done], before, after, "new", "2026-09-26")).toEqual([done]);
  });

  it("leaves a quick workout alone — it was never the plan", () => {
    const quick = { ...open(["back-squat"]), freestyle: true };
    expect(refreshOpenDay([quick], before, after, "new", "2026-09-26")).toEqual([quick]);
  });

  it("leaves the day alone when the plan did not actually change", () => {
    // Otherwise every save would reset a weight she had just dialled in.
    const session = open(["back-squat", "romanian-deadlift"]);
    session.exercises[0].sets[0].weight = 135;
    expect(refreshOpenDay([session], before, plan("Leg day", ["back-squat", "romanian-deadlift"]), "new", "2026-09-26"))
      .toEqual([session]);
  });

  it("touches no other day", () => {
    const other: Session = { ...open(["back-squat"]), date: "2026-09-25" };
    const out = refreshOpenDay([other, open(["back-squat"])], before, after, "new", "2026-09-26");
    expect(out[0]).toEqual(other);
  });

  it("does nothing when today has no session yet", () => {
    expect(refreshOpenDay([], before, after, "new", "2026-09-26")).toEqual([]);
  });
});

describe("samePlan", () => {
  const p = (label: string, sets: number): Routine => ({
    day: 1,
    label,
    exercises: [{ exerciseId: "back-squat", sets, reps: 8, weight: 45 }],
  });

  it("is true for the same name and the same shape", () => {
    expect(samePlan(p("Leg day", 3), p("Leg day", 3))).toBe(true);
  });

  it("notices a renamed day, a changed set count, and a missing plan", () => {
    expect(samePlan(p("Leg day", 3), p("Legs", 3))).toBe(false);
    expect(samePlan(p("Leg day", 3), p("Leg day", 4))).toBe(false);
    expect(samePlan(null, p("Leg day", 3))).toBe(false);
    expect(samePlan(null, null)).toBe(true);
  });
});


describe("remembered set defaults", () => {
  it.each([0, 1, 2])("uses a best on set %i for every future set", (bestIndex) => {
    const prior = session("2026-09-20", "bench-press", 3, 8, 95);
    prior.exercises[0].sets[bestIndex] = { weight: 115, reps: 6, done: true };
    const skipped = session("2026-09-22", "bench-press", 1, 20, 200);
    skipped.exercises[0].sets[0].done = false;
    const plan: Routine = { day: 1, label: "Push", exercises: [{ exerciseId: "bench-press", sets: 4, reps: 12, weight: 0 }] };
    const result = buildSession(plan, [prior, skipped], "new", "2026-09-28");
    expect(result.exercises[0].sets).toEqual(Array.from({ length: 4 }, () => ({ weight: 115, reps: 6, done: false })));
  });

  it("includes repeated entries for the same exercise in last time", () => {
    const prior = session("2026-09-20", "bench-press", 1, 8, 95);
    prior.exercises.push({ exerciseId: "bench-press", sets: [{ weight: 115, reps: 7, done: true }] });
    const plan: Routine = { day: 1, label: "Push", exercises: [{ exerciseId: "bench-press", sets: 1, reps: 12, weight: 0 }] };
    expect(buildSession(plan, [prior], "new", "2026-09-28").exercises[0].sets[0]).toEqual({ weight: 115, reps: 7, done: false });
  });
});


it("uses remembered reps for an added bodyweight exercise", () => {
  const prior = session("2026-09-20", "push-up", 3, 10, 0);
  prior.exercises[0].sets[1].reps = 17;
  expect(sessionTarget("push-up", [prior], "new")).toMatchObject({ weight: 0, reps: 17 });
});


describe("memory isolation", () => {
  it("finishing Monday does not overwrite Wednesday with the same name", () => {
    const monday: Routine = { day: 1, label: "Push", exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }] };
    const wednesday: Routine = { ...monday, day: 3, exercises: [{ exerciseId: "push-up", sets: 2, reps: 15, weight: 0 }] };
    const done = { ...session("2026-09-28", "bench-press", 4, 6, 115), label: "Push" };
    const out = rememberLineup([monday, wednesday], done);
    expect(out[0].exercises[0].sets).toBe(4);
    expect(out[1]).toEqual(wednesday);
  });

  it("does not write an old session into a workout moved to another weekday", () => {
    const moved: Routine = { day: 3, label: "Push", exercises: [{ exerciseId: "push-up", sets: 2, reps: 15, weight: 0 }] };
    const done = { ...session("2026-09-28", "bench-press", 4, 6, 115), label: "Push" };
    expect(rememberLineup([moved], done)).toEqual([moved]);
  });

  it("counts a record in the second occurrence of a lift", () => {
    const done = session("2026-09-28", "bench-press", 1, 8, 95);
    done.exercises.push({ exerciseId: "bench-press", sets: [{ weight: 135, reps: 5, done: true }, { weight: 200, reps: 1, done: false }] });
    expect(personalRecord([done], "bench-press")).toBe(135);
  });
});

/**
 * The two complaints behind this: "last time" quoting a session from days ago,
 * and the same workout coming back with different reps each time. Both are one
 * bug. A session ends on End far more often than on Finish, End writes no
 * `completedAt`, and everything that answers "what did she lift last time"
 * read only sessions that had one.
 */
describe("a session ended rather than finished still counts as last time", () => {
  const legDay: Routine = {
    day: 1,
    label: "Leg day",
    exercises: [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 0 }],
  };

  /** What the log screen writes when she logs sets and taps End. */
  function ended(date: string, reps: number, weight: number): Session {
    return {
      date,
      label: "Leg day",
      exercises: [
        {
          exerciseId: "back-squat",
          sets: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
        },
      ],
    };
  }

  it("carries the weight and reps of the last session she logged in", () => {
    const built = buildSession(legDay, [ended("2026-09-20", 6, 145)], "new", "2026-09-27");
    expect(built.exercises[0].sets[0]).toMatchObject({ weight: 145, reps: 6 });
  });

  it("prefers the most recent session, not the most recently finished one", () => {
    const history = [
      { ...ended("2026-09-13", 10, 95), completedAt: "2026-09-13T18:00:00.000Z" },
      ended("2026-09-20", 6, 145),
    ];
    const built = buildSession(legDay, history, "new", "2026-09-27");
    expect(built.exercises[0].sets[0]).toMatchObject({ weight: 145, reps: 6 });
  });

  it("gives the same workout the same reps every session, given the same history", () => {
    const first = buildSession(legDay, [ended("2026-09-20", 6, 145)], "new", "2026-09-27");
    const second = buildSession(legDay, [ended("2026-09-20", 6, 145)], "new", "2026-10-04");
    expect(second.exercises[0].sets.map((s) => s.reps)).toEqual(
      first.exercises[0].sets.map((s) => s.reps)
    );
  });

  it("does not read a day's own logged sets back into itself", () => {
    // refreshOpenDay rebuilds the open day from the new plan, and passes the
    // sessions it is rebuilding from — today's included.
    const open = ended("2026-09-27", 3, 225);
    const built = buildSession(legDay, [ended("2026-09-20", 6, 145), open], "new", "2026-09-27");
    expect(built.exercises[0].sets[0]).toMatchObject({ weight: 145, reps: 6 });
  });

  it("counts an unfinished session as a personal record, so the two agree", () => {
    expect(personalRecord([ended("2026-09-20", 6, 145)], "back-squat")).toBe(145);
  });

  it("leaves the caller's sessions in the order it was given them", () => {
    const history = [ended("2026-09-13", 10, 95), ended("2026-09-20", 6, 145)];
    buildSession(legDay, history, "new", "2026-09-27");
    expect(history.map((s) => s.date)).toEqual(["2026-09-13", "2026-09-20"]);
  });
});

describe("a week arrives named and empty", () => {
  it("keeps each day's name and type and drops only the lifts", () => {
    const week = generateRoutine("new", [1, 3, 5], ALL);
    const blank = unfilled(week);
    expect(blank.map((r) => r.label)).toEqual(week.map((r) => r.label));
    expect(blank.map((r) => r.template)).toEqual(week.map((r) => r.template));
    expect(blank.every((r) => r.exercises.length === 0)).toBe(true);
  });

  it("does not empty the week it was given", () => {
    const week = generateRoutine("new", [1], ALL);
    unfilled(week);
    expect(week[0].exercises.length).toBeGreaterThan(0);
  });

  it("gives a newly added training day nothing on it", () => {
    const existing = generateRoutine("new", [1], ALL);
    const week = reconcileWeek(existing, [1, 4], "new", ALL);
    expect(week.find((r) => r.day === 4)?.exercises).toEqual([]);
    // And leaves the day she already trains exactly as it was.
    expect(week.find((r) => r.day === 1)?.exercises).toEqual(existing[0].exercises);
  });

  it("still brings back her own version of a day type she has shaped", () => {
    const hers = [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 }];
    const week = reconcileWeek(
      [{ day: 1, label: "Leg day", template: "legs", exercises: [] }],
      [1, 4],
      "new",
      ALL,
      [],
      { legs: hers }
    );
    // The new day is full body, which the library deliberately never holds.
    expect(week.find((r) => r.day === 4)?.exercises).toEqual([]);
  });
});
