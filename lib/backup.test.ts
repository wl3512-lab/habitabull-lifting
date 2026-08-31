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
