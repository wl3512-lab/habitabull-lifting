import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, backupFilename, buildBackup, parseBackup } from "./backup";
import type { AppState } from "./types";

const state: AppState = {
  profile: {
    name: "Lucy",
    level: "new",
    trainingDays: [1, 3, 5],
    equipment: ["barbell"],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  routines: [{ day: 1, label: "Monday", exercises: [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 95 }] }],
  sessions: [
    {
      date: "2026-08-03",
      label: "Monday",
      completedAt: "2026-08-03T18:00:00.000Z",
      exercises: [{ exerciseId: "back-squat", sets: [{ weight: 95, reps: 8, done: true }] }],
    },
  ],
  goal: { exerciseId: "back-squat", targetWeight: 135, targetDate: "2026-12-01" },
  goalDismissed: true,
  challenge: { month: "2026-09", target: 12 },
  weighIns: [{ date: "2026-08-03", lb: 171 }],
  customExercises: [
    {
      id: "custom-cable-crossover-abc",
      name: "Cable Crossover",
      equipment: "machine",
      primary: "chest",
      increment: 2.5,
      compound: false,
      cue: "Your lift, your form.",
      steps: ["Set up the way you know it."],
      mistakes: ["Chasing the number."],
    },
  ],
  dayLibrary: { legs: [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 }] },
  workouts: [
    {
      id: "own-leg-day-1",
      name: "Leg day",
      template: "legs",
      createdAt: "2026-09-26T18:00:00.000Z",
      exercises: [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 }],
    },
  ],
};

const photo = {
  id: "p1",
  date: "2026-08-03",
  addedAt: "2026-08-03T18:05:00.000Z",
  data: "data:image/jpeg;base64,/9j/4AAQ",
};

describe("buildBackup", () => {
  it("stamps the app, version and time", () => {
    const b = buildBackup(state, [photo]);
    expect(b.app).toBe("habitabull");
    expect(b.version).toBe(BACKUP_VERSION);
    expect(Date.parse(b.exportedAt)).not.toBeNaN();
    expect(b.photos).toHaveLength(1);
  });

  it("round-trips through JSON without losing anything", () => {
    const back = parseBackup(JSON.parse(JSON.stringify(buildBackup(state, [photo]))));
    expect(back?.state.sessions).toHaveLength(1);
    expect(back?.state.profile?.name).toBe("Lucy");
    expect(back?.state.goal?.targetWeight).toBe(135);
    expect(back?.photos[0].id).toBe("p1");
  });

  it("brings back everything the store holds, not the five fields somebody listed", () => {
    /*
      The bug this is here for: `parseBackup` builds its answer field by field,
      so anything added to `AppState` afterwards travelled in the file and was
      dropped on the way back in. Four fields had accumulated behind that —
      weigh-ins, the lifts she added by hand, the day library, and saved
      workouts — while the screen promised "one file holds every session, note
      and photo".

      Comparing keys rather than values is deliberate: it fails for the *next*
      field too, which is the only version of this test that keeps working.
    */
    const back = parseBackup(JSON.parse(JSON.stringify(buildBackup(state))));
    const lost = Object.keys(state).filter(
      (k) => (back?.state as unknown as Record<string, unknown>)[k] === undefined
    );
    expect(lost).toEqual([]);
  });

  it("restores each of the four that used to be dropped", () => {
    const back = parseBackup(JSON.parse(JSON.stringify(buildBackup(state))));
    expect(back?.state.weighIns).toEqual([{ date: "2026-08-03", lb: 171 }]);
    expect(back?.state.customExercises?.[0].name).toBe("Cable Crossover");
    expect(back?.state.dayLibrary?.legs).toHaveLength(1);
    expect(back?.state.workouts?.[0].name).toBe("Leg day");
  });
});

describe("parseBackup", () => {
  it("refuses anything that is not one of ours", () => {
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup({})).toBeNull();
    expect(parseBackup({ app: "someone-else", version: 1, state: {} })).toBeNull();
    expect(parseBackup("a string")).toBeNull();
  });

  it("refuses a file written by a newer version than it understands", () => {
    expect(parseBackup({ app: "habitabull", version: BACKUP_VERSION + 1, state: {} })).toBeNull();
  });

  it("drops malformed sessions instead of importing them", () => {
    const back = parseBackup({
      app: "habitabull",
      version: 1,
      state: { ...state, sessions: [state.sessions[0], { nonsense: true }, null, "x"] },
    });
    expect(back?.state.sessions).toHaveLength(1);
  });

  it("checks the four the way the load path does, rather than trusting the file", () => {
    // Same validators as `load`, because a file from a picker is no more
    // trusted than localStorage and two validators for one field drift.
    const back = parseBackup({
      app: "habitabull",
      version: 1,
      state: {
        ...state,
        weighIns: [{ date: "2026-08-03", lb: "171" }, { date: "2026-08-10", lb: 169 }],
        customExercises: [{ id: "half-a-lift", name: "Half" }],
        dayLibrary: { legs: [{ nonsense: true }] },
        workouts: [{ id: "own-1", name: "Empty", exercises: [] }],
      },
    });
    expect(back?.state.weighIns).toEqual([{ date: "2026-08-10", lb: 169 }]);
    // Shaped the way `load` shapes each one, so a restored state and a loaded
    // state are the same store to everything downstream: the two lists come
    // back as lists, and the two keyed fields as undefined when empty.
    expect(back?.state.customExercises).toEqual([]);
    expect(back?.state.dayLibrary).toBeUndefined();
    expect(back?.state.workouts).toBeUndefined();
  });

  it("drops anything that is not really an image", () => {
    const back = parseBackup({
      app: "habitabull",
      version: 1,
      state,
      photos: [photo, { id: "x", date: "d", data: "javascript:alert(1)" }, { id: "y" }],
    });
    expect(back?.photos).toHaveLength(1);
    expect(back?.photos[0].id).toBe("p1");
  });

  it("survives a file with no photos at all", () => {
    const back = parseBackup({ app: "habitabull", version: 1, state });
    expect(back?.photos).toEqual([]);
  });

  it("nulls a profile that is missing rather than half-importing it", () => {
    const back = parseBackup({ app: "habitabull", version: 1, state: { ...state, profile: "nope" } });
    expect(back?.state.profile).toBeNull();
    expect(back?.state.sessions).toHaveLength(1);
  });
});

describe("backupFilename", () => {
  it("sorts by date and says what it is", () => {
    expect(backupFilename(new Date(2026, 8, 5))).toBe("habitabull-2026-09-05.json");
  });
});
