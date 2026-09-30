import { describe, expect, it } from "vitest";
import {
  cleanName,
  fromSession,
  makeWorkout,
  placeOn,
  removeWorkout,
  saneWorkouts,
  shareableFromSession,
  sameLineup,
  savedAs,
  saveWorkout,
  libraryChoices,
  weekChoices,
  suggestName,
  syncWorkouts,
  withSharedWorkout,
  yourWorkoutsCategory,
} from "./workouts";
import type { SharedDay } from "./cloud";
import type { PlannedExercise, Routine, SavedWorkout, Session } from "./types";

const lift = (id: string): PlannedExercise => ({ exerciseId: id, sets: 3, reps: 8, weight: 95 });

const legs = [lift("back-squat"), lift("romanian-deadlift"), lift("leg-press")];
const pull = [lift("deadlift"), lift("barbell-row")];

const week = (): Routine[] => [
  { day: 1, label: "Full body A", template: "full-body", exercises: pull },
  { day: 3, label: "Full body B", template: "full-body", exercises: pull },
];

describe("saving a workout of your own", () => {
  it("keeps the lifts and takes her name for it", () => {
    const w = makeWorkout("  Leg   day  ", legs, "legs");
    expect(w.name).toBe("Leg day");
    expect(w.exercises.map((e) => e.exerciseId)).toEqual([
      "back-squat",
      "romanian-deadlift",
      "leg-press",
    ]);
    expect(w.template).toBe("legs");
  });

  it("copies the lineup, so editing the day afterwards does not edit the workout", () => {
    const draft = [...legs];
    const w = makeWorkout("Leg day", draft);
    draft.push(lift("calf-raise"));
    draft[0].reps = 99;
    expect(w.exercises).toHaveLength(3);
    expect(w.exercises[0].reps).toBe(8);
  });

  it("never hands out the same id twice, even in the same millisecond", () => {
    const at = new Date("2026-09-26T10:00:00.000Z");
    const ids = new Set(Array.from({ length: 50 }, () => makeWorkout("Leg day", legs, "legs", at).id));
    expect(ids.size).toBe(50);
  });

  it("falls back to a name rather than saving something called nothing", () => {
    expect(makeWorkout("   ", legs).name).toBe("My workout");
    expect(cleanName("x".repeat(80))).toHaveLength(40);
  });

  it("puts the newest at the top", () => {
    const first = makeWorkout("Leg day", legs);
    const second = makeWorkout("Pull day", pull);
    expect(saveWorkout(saveWorkout([], first), second).map((w) => w.name)).toEqual([
      "Pull day",
      "Leg day",
    ]);
  });

  it("re-saving under the same name updates that workout instead of making a second one", () => {
    // Two rows with the same name in a list whose only job is telling them
    // apart is the list failing at its one job.
    const first = makeWorkout("Leg day", legs, "legs");
    const again = makeWorkout("leg DAY", [...legs, lift("calf-raise")], "legs");
    const list = saveWorkout(saveWorkout([], first), again);
    expect(list).toHaveLength(1);
    expect(list[0].exercises).toHaveLength(4);
    // Same entry, so anything pointing at it still points at it.
    expect(list[0].id).toBe(first.id);
    expect(list[0].createdAt).toBe(first.createdAt);
  });

  it("suggests a name she has not used, rather than one that would overwrite", () => {
    const list = saveWorkout([], makeWorkout("Leg day", legs));
    expect(suggestName("Leg day", list)).toBe("Leg day 2");
    expect(suggestName("Pull day", list)).toBe("Pull day");
    expect(suggestName("   ", [])).toBe("My workout");
  });

  it("recognises the day she is looking at as one she already saved", () => {
    const list = saveWorkout([], makeWorkout("Leg day", legs));
    expect(savedAs(list, [...legs])?.name).toBe("Leg day");
    expect(savedAs(list, pull)).toBeUndefined();
    // Order is part of a workout: the same lifts in a different order is a
    // different session to train.
    expect(sameLineup(legs, [...legs].reverse())).toBe(false);
  });

  it("removes one without touching the others", () => {
    const keep = makeWorkout("Pull day", pull);
    const list = saveWorkout(saveWorkout([], keep), makeWorkout("Leg day", legs));
    expect(removeWorkout(list, list[0].id).map((w) => w.name)).toEqual(["Pull day"]);
    expect(removeWorkout(list, "nothing-like-this")).toHaveLength(2);
  });
});

describe("putting a saved workout on a day", () => {
  const w = makeWorkout("Leg day", legs, "legs");

  it("makes that day the workout, and says so on screen", () => {
    const next = placeOn(week(), 3, w);
    expect(next[1].label).toBe("Leg day");
    expect(next[1].template).toBe("legs");
    expect(next[1].exercises.map((e) => e.exerciseId)).toEqual(w.exercises.map((e) => e.exerciseId));
  });

  it("leaves every other day exactly as it was", () => {
    const before = week();
    const next = placeOn(before, 3, w);
    expect(next[0]).toEqual(before[0]);
  });

  it("does not add a day she never said she trains", () => {
    // Which days she trains belongs to the schedule screen. A workout landing
    // on a Sunday she never agreed to is the plan changing itself.
    const next = placeOn(week(), 0, w);
    expect(next.map((r) => r.day)).toEqual([1, 3]);
  });

  it("hands the day its own copy of the lineup", () => {
    const next = placeOn(week(), 3, w);
    next[1].exercises[0].weight = 500;
    expect(w.exercises[0].weight).toBe(95);
  });
});

describe("the routine editor's own-workouts category", () => {
  it("is a separate category when she has workouts of her own", () => {
    const category = yourWorkoutsCategory([makeWorkout("Leg day", legs)], false);
    expect(category).toEqual({
      id: "your-workouts",
      label: "Your workouts",
      hint: "1 saved workout",
    });
  });

  it("still opens when the current day can be saved as the first one", () => {
    expect(yourWorkoutsCategory([], true)?.hint).toBe("Save this day as your first workout");
  });

  it("does not add an empty category when there is nothing to open", () => {
    expect(yourWorkoutsCategory([], false)).toBeNull();
  });
});

describe("saved workouts read back from storage", () => {
  it("drops anything that is not a workout", () => {
    expect(saneWorkouts(undefined)).toBeUndefined();
    expect(saneWorkouts("nope")).toBeUndefined();
    expect(saneWorkouts([null, 7, {}, { id: "a" }])).toBeUndefined();
  });

  it("drops a workout with no lifts left in it rather than planning an empty day", () => {
    const bad: unknown = [
      { id: "own-1", name: "Leg day", exercises: [{ nonsense: true }] },
      { id: "own-2", name: "Pull day", exercises: [lift("deadlift")] },
    ];
    expect(saneWorkouts(bad)?.map((w) => w.name)).toEqual(["Pull day"]);
  });

  it("repairs what it can instead of throwing the workout away", () => {
    const list = saneWorkouts([{ id: "own-1", name: "  Leg  day ", exercises: legs }]);
    expect(list?.[0].name).toBe("Leg day");
    // An entry saved before createdAt existed still sorts, at the bottom.
    expect(list?.[0].createdAt).toBe(new Date(0).toISOString());
  });

  it("keeps a lift the library does not have, because it may be one of hers", () => {
    // Custom lifts are registered from the same store on the same load, so a
    // workout mentioning one is not evidence of corruption.
    const mine: SavedWorkout[] = [
      { id: "own-1", name: "Mine", exercises: [lift("custom-cable-crossover-abc")], createdAt: "x" },
    ];
    expect(saneWorkouts(mine)?.[0].exercises).toHaveLength(1);
  });
});

describe("keeping the workout you just improvised", () => {
  const session = (): Session => ({
    date: "2026-09-26",
    label: "Quick workout",
    freestyle: true,
    exercises: [
      {
        exerciseId: "back-squat",
        sets: [
          { weight: 135, reps: 5, done: true },
          { weight: 135, reps: 5, done: true },
          { weight: 155, reps: 3, done: false },
        ],
      },
      { exerciseId: "bench-press", sets: [{ weight: 95, reps: 8, done: true }] },
      { exerciseId: "plank", sets: [{ weight: 0, reps: 30, done: false }] },
    ],
  });

  it("keeps what she did, not what she meant to", () => {
    const lineup = fromSession(session());
    expect(lineup.map((e) => e.exerciseId)).toEqual(["back-squat", "bench-press"]);
    // Two sets landed, the third did not.
    expect(lineup[0].sets).toBe(2);
    expect(lineup[0].reps).toBe(5);
    expect(lineup[0].weight).toBe(135);
  });

  it("is a workout she can name and put on a day like any other", () => {
    const w = makeWorkout("Thursday legs", fromSession(session()));
    const next = placeOn([{ day: 4, label: "Full body A", exercises: [] }], 4, w);
    expect(next[0].label).toBe("Thursday legs");
    expect(next[0].exercises).toHaveLength(2);
  });

  it("has nothing to keep from a session where no set landed", () => {
    // The quick workout she opened and walked away from. Offering to save it
    // would be offering to save an empty day.
    const abandoned: Session = {
      date: "2026-09-26",
      label: "Quick workout",
      freestyle: true,
      exercises: [{ exerciseId: "back-squat", sets: [{ weight: 135, reps: 5, done: false }] }],
    };
    expect(fromSession(abandoned)).toEqual([]);
  });
});

describe("sharing the workout you just improvised with a crew", () => {
  const session = (): Session => ({
    date: "2026-09-26",
    label: "Quick workout",
    freestyle: true,
    exercises: [
      {
        exerciseId: "back-squat",
        sets: [
          { weight: 135, reps: 5, done: true },
          { weight: 155, reps: 3, done: false },
        ],
      },
      { exerciseId: "bench-press", sets: [{ weight: 95, reps: 8, done: true }] },
    ],
  });

  it("shares lift choices and a name, never weights, reps, or sets", () => {
    const shared = shareableFromSession(session(), "Hotel gym day");
    expect(shared).toEqual({
      day: 6,
      label: "Hotel gym day",
      exercises: ["back-squat", "bench-press"],
    });
    expect(JSON.stringify(shared)).not.toMatch(/weight|reps|sets|135|155|95/);
  });

  it("has nothing to share when no set landed", () => {
    const abandoned = session();
    abandoned.exercises.forEach((e) => e.sets.forEach((s) => (s.done = false)));
    expect(shareableFromSession(abandoned, "Hotel gym day")).toBeNull();
  });

  it("adds the shared workout to the copyable week without keeping a stale version of that weekday", () => {
    const week: SharedDay[] = [
      { day: 1, label: "Push day", exercises: ["bench-press"] },
      { day: 6, label: "Old Saturday", exercises: ["lat-pulldown"] },
    ];
    expect(withSharedWorkout(week, { day: 6, label: "Hotel gym day", exercises: ["back-squat"] })).toEqual([
      { day: 6, label: "Hotel gym day", exercises: ["back-squat"] },
      { day: 1, label: "Push day", exercises: ["bench-press"] },
    ]);
  });
});


it.each(["sets", "reps", "weight"] as const)("allows saving a workout after only %s changes", (field) => {
  const original = [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }];
  const list = [makeWorkout("Push", original)];
  const edited = original.map(e => ({ ...e, [field]: e[field] + 1 }));
  expect(savedAs(list, edited)).toBeUndefined();
});


it("keeps a unique suffix when the workout name already fills the name limit", () => {
  const name = "A".repeat(40);
  const list = [makeWorkout(name, [lift("bench-press")])];
  const suggestion = suggestName(name, list);
  expect(suggestion).toBe("A".repeat(38) + " 2");
  expect(saveWorkout(list, makeWorkout(suggestion, [lift("back-squat")]))).toHaveLength(2);
});

it("finds a fresh name beyond 99 saved versions", () => {
  const names = ["Push", ...Array.from({ length: 98 }, (_, i) => `Push ${i + 2}`)];
  const list = names.map(name => makeWorkout(name, [lift("bench-press")]));
  expect(suggestName("Push", list)).toBe("Push 100");
});

describe("weekChoices", () => {
  const full = (day: number, label: string, ids: string[]): Routine => ({
    day,
    label,
    exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 8, weight: 100 })),
  });

  it("offers one row for a lineup that sits on two days, and names both", () => {
    const week = [
      full(1, "Full body A", ["back-squat", "bench-press"]),
      full(3, "Full body B", ["deadlift"]),
      full(5, "Full body A", ["back-squat", "bench-press"]),
    ];
    const choices = weekChoices(week);
    expect(choices).toHaveLength(2);
    expect(choices[0]).toMatchObject({ label: "Full body A", days: [1, 5] });
    expect(choices[1]).toMatchObject({ label: "Full body B", days: [3] });
  });

  it("keeps two days that share a name but not their lifts", () => {
    const week = [
      full(1, "Full body A", ["back-squat"]),
      full(5, "Full body A", ["deadlift"]),
    ];
    expect(weekChoices(week)).toHaveLength(2);
  });

  it("leaves out a day she has already saved under a name", () => {
    const week = [full(1, "Leg day", ["back-squat"]), full(3, "Push", ["bench-press"])];
    const saved = [makeWorkout("Leg day", week[0].exercises)];
    expect(weekChoices(week, saved).map((c) => c.label)).toEqual(["Push"]);
  });

  it("skips a day with nothing on it", () => {
    expect(weekChoices([{ day: 2, label: "Empty", exercises: [] }])).toEqual([]);
  });

  it("lists days in week order whatever order the routines arrive in", () => {
    const week = [full(5, "A", ["deadlift"]), full(1, "B", ["back-squat"])];
    expect(weekChoices(week).map((c) => c.days[0])).toEqual([1, 5]);
  });

  it("does not hand out the routine's own exercise objects", () => {
    const week = [full(1, "Leg day", ["back-squat"])];
    const choice = weekChoices(week)[0];
    choice.exercises[0].weight = 999;
    expect(week[0].exercises[0].weight).toBe(100);
  });

  it("leaves the caller's week in the order it was given", () => {
    const week = [full(5, "A", ["deadlift"]), full(1, "B", ["back-squat"])];
    weekChoices(week);
    expect(week.map((r) => r.day)).toEqual([5, 1]);
  });
});

describe("libraryChoices", () => {
  const legs = [
    { exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 },
    { exerciseId: "leg-press", sets: 3, reps: 10, weight: 200 },
  ];

  it("offers a day type she shaped and no longer has in her week", () => {
    const choices = libraryChoices({ legs }, [], () => "Leg day");
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ label: "Leg day", template: "legs", days: [] });
  });

  it("never offers full body, which has no one shape to remember", () => {
    expect(libraryChoices({ "full-body": legs })).toEqual([]);
  });

  it("skips a shape already offered above it", () => {
    expect(libraryChoices({ legs }, [legs])).toEqual([]);
  });

  it("falls back to the template id when there is no label for it", () => {
    expect(libraryChoices({ legs })[0].label).toBe("legs");
  });

  it("skips a day type that was emptied out", () => {
    expect(libraryChoices({ legs: [] })).toEqual([]);
  });

  it("does not hand out the library's own exercise objects", () => {
    const library = { legs: legs.map((e) => ({ ...e })) };
    libraryChoices(library)[0].exercises[0].weight = 999;
    expect(library.legs[0].weight).toBe(145);
  });
});

describe("syncWorkouts", () => {
  const legs = [
    { exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 },
    { exerciseId: "leg-press", sets: 3, reps: 10, weight: 200 },
  ];
  const saved: SavedWorkout = {
    id: "own-leg-day-1",
    name: "Leg day",
    template: "legs",
    createdAt: "2026-09-01T12:00:00.000Z",
    exercises: legs.map((e) => ({ ...e })),
  };

  it("carries a lift added to the day into the workout that day is", () => {
    const week: Routine[] = [
      {
        day: 2,
        label: "Leg day",
        template: "legs",
        workoutId: "own-leg-day-1",
        exercises: [...legs, { exerciseId: "ab-crunch-machine", sets: 3, reps: 12, weight: 50 }],
      },
    ];
    expect(syncWorkouts([saved], week)[0].exercises.map((e) => e.exerciseId)).toEqual([
      "back-squat",
      "leg-press",
      "ab-crunch-machine",
    ]);
  });

  it("leaves a workout alone when a day only shares its name", () => {
    const week: Routine[] = [
      { day: 2, label: "Leg day", template: "legs", exercises: [legs[0]] },
    ];
    expect(syncWorkouts([saved], week)[0].exercises).toHaveLength(2);
  });

  it("never empties a workout from a day that was cleared", () => {
    const week: Routine[] = [
      { day: 2, label: "Leg day", workoutId: "own-leg-day-1", exercises: [] },
    ];
    expect(syncWorkouts([saved], week)[0].exercises).toHaveLength(2);
  });

  it("leaves every other saved workout untouched", () => {
    const other = makeWorkout("Hotel gym day", [legs[0]]);
    const week: Routine[] = [
      { day: 2, label: "Leg day", workoutId: "own-leg-day-1", exercises: [legs[0]] },
    ];
    expect(syncWorkouts([saved, other], week)[1]).toBe(other);
  });

  it("does not share the day's exercise objects with the workout", () => {
    const week: Routine[] = [
      { day: 2, label: "Leg day", workoutId: "own-leg-day-1", exercises: legs.map((e) => ({ ...e })) },
    ];
    const out = syncWorkouts([saved], week)[0];
    out.exercises[0].weight = 999;
    expect(week[0].exercises[0].weight).toBe(145);
  });

  it("is a no-op when she has saved nothing", () => {
    expect(syncWorkouts([], [{ day: 2, label: "Leg day", exercises: legs }])).toEqual([]);
  });
});

describe("placeOn", () => {
  it("links the day to the workout it just became", () => {
    const w = makeWorkout("Leg day", [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 100 }]);
    const week: Routine[] = [{ day: 2, label: "Tuesday", exercises: [] }];
    expect(placeOn(week, 2, w)[0].workoutId).toBe(w.id);
  });
});
