import { describe, expect, it } from "vitest";
import { arrivalMood } from "./arrival";
import type { AppState, Profile, Routine, Session } from "./types";

// 2026-09-09 is a Wednesday; 2026-09-10 a Thursday.
const WED = "2026-09-09";
const THU = "2026-09-10";

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: "Lucy",
  level: "experienced",
  trainingDays: [1, 3, 5],
  equipment: ["barbell"],
  planChosen: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...over,
});

const routine = (day: number): Routine => ({
  day,
  label: "Pull day",
  exercises: [{ exerciseId: "deadlift", sets: 3, reps: 8, weight: 185 }],
});

const session = (date: string, completed = true): Session => ({
  date,
  label: "Pull day",
  exercises: [],
  ...(completed ? { completedAt: `${date}T18:30:00.000Z` } : {}),
});

const state = (over: Partial<AppState> = {}): AppState => ({
  profile: profile(),
  routines: [routine(3)], // Wednesday
  sessions: [session("2026-09-07")],
  goal: null,
  ...over,
});

const open = { greeted: null, reduced: false };

describe("arrivalMood", () => {
  it("greets on a day that is on the plan", () => {
    expect(arrivalMood(state(), WED, open)).toBe("greet");
  });

  it("calls a day off the plan a rest day", () => {
    expect(arrivalMood(state(), THU, open)).toBe("rest");
  });

  it("says nothing twice in one day", () => {
    const greeted = { date: WED, mood: "greet" as const };
    expect(arrivalMood(state(), WED, { ...open, greeted })).toBeNull();
  });

  it("speaks again once the date turns", () => {
    const greeted = { date: WED, mood: "greet" as const };
    expect(arrivalMood(state(), THU, { ...open, greeted })).toBe("rest");
  });

  it("stays silent when motion is unwelcome", () => {
    expect(arrivalMood(state(), WED, { ...open, reduced: true })).toBeNull();
  });

  it("stays silent before the week is hers", () => {
    // placeDays put a session on today; she has agreed to none of it.
    const fresh = state({
      profile: profile({ planChosen: false }),
      sessions: [],
    });
    expect(arrivalMood(fresh, WED, open)).toBeNull();
    expect(arrivalMood(fresh, THU, open)).toBeNull();
  });

  it("never opens with a rest day for someone who has never trained", () => {
    // The plan is hers, but nothing is logged. A rest day here is the app
    // handing a beginner a reason not to start.
    const yet = state({ sessions: [] });
    expect(arrivalMood(yet, THU, open)).toBeNull();
  });

  it("welcomes a first session on a training day rather than greeting one", () => {
    expect(arrivalMood(state({ sessions: [] }), WED, open)).toBe("first");
  });

  it("welcomes someone back after a gap of a week or more", () => {
    const away = state({ sessions: [session("2026-08-20")] });
    expect(arrivalMood(away, WED, open)).toBe("return");
  });

  it("welcomes them back on a rest day too", () => {
    const away = state({ sessions: [session("2026-08-20")] });
    expect(arrivalMood(away, THU, open)).toBe("return");
  });

  it("ignores a session that was started but never finished", () => {
    // An abandoned session is not a session she came back from.
    const abandoned = state({
      sessions: [session("2026-08-20"), session("2026-09-08", false)],
    });
    expect(arrivalMood(abandoned, WED, open)).toBe("return");
  });

  it("does not count today's own session when judging a gap", () => {
    // Logging today then reopening must not turn a comeback into a greeting
    // halfway through the day.
    const away = state({ sessions: [session("2026-08-20"), session(WED)] });
    expect(arrivalMood(away, WED, open)).toBe("return");
  });

  it("says nothing without a profile", () => {
    expect(arrivalMood(state({ profile: null }), WED, open)).toBeNull();
  });
});
