import { describe, expect, it } from "vitest";
import { rememberLineup } from "./engine";
import { weekStrip } from "./calendar";
import { upsertSession } from "./storage";
import type { Routine, Session } from "./types";

/**
 * A quick workout: no plan behind it, logged one lift at a time.
 *
 * The flow lives in app/page.tsx, which is a view machine and not importable
 * here, so these rebuild the two writes it makes — starting one, and backing
 * out of one nothing was logged in — exactly as that file makes them. Same
 * approach as session-identity.test.ts, and for the same reason: the invariants
 * are about what ends up in storage, and that is checkable without a renderer.
 */

const TODAY = "2026-09-26";
const QUICK_LABEL = "Quick workout";

/** `startQuick`: an empty, dated, flagged record, and nothing guessed into it. */
const startQuick = (sessions: Session[]): Session[] =>
  upsertSession(sessions, {
    date: TODAY,
    label: QUICK_LABEL,
    exercises: [],
    startedAt: `${TODAY}T17:00:00.000Z`,
    freestyle: true,
  });

/** What `onExit` does when the picker was backed out of without a lift. */
const abandonEmpty = (sessions: Session[]): Session[] =>
  sessions.filter((x) => x.date !== TODAY);

const legDay: Routine = {
  day: 6,
  label: "Leg day",
  template: "legs",
  exercises: [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 135 }],
};

describe("starting a quick workout", () => {
  it("opens genuinely empty rather than with a guess in it", () => {
    const [s] = startQuick([]);
    expect(s.exercises).toEqual([]);
    expect(s.freestyle).toBe(true);
  });

  it("records when it began, so the summary can state a real duration", () => {
    expect(startQuick([])[0].startedAt).toBeDefined();
  });

  /*
    The log screen decides what an empty session means from this flag alone:
    empty and freestyle is "pick your first lift", empty and planned is "every
    lift got ruled out". Inferring it from the exercise list would give those
    two opposite situations the same screen.
  */
  it("is told apart from a day whose lifts were all ruled out", () => {
    const ruledOut: Session = { date: TODAY, label: "Leg day", exercises: [] };
    expect(ruledOut.freestyle).toBeUndefined();
    expect(startQuick([])[0].freestyle).toBe(true);
  });

  /*
    One record per date, so starting a quick workout over a session that already
    exists would be starting over the top of it. The screen offers to carry that
    one on instead; this is the guard behind the screen.
  */
  it("never replaces a session the day already has", () => {
    const partway: Session = {
      date: TODAY,
      label: "Leg day",
      startedAt: `${TODAY}T16:00:00.000Z`,
      exercises: [{ exerciseId: "back-squat", sets: [{ weight: 135, reps: 5, done: true }] }],
    };
    // page.tsx returns early when there is a draft; nothing is written at all.
    expect(startQuick([partway])).not.toEqual([partway]); // the write it must not make
    const guarded = (sessions: Session[]) =>
      sessions.some((s) => s.date === TODAY) ? sessions : startQuick(sessions);
    expect(guarded([partway])).toEqual([partway]);
  });
});

describe("backing out before the first lift", () => {
  /*
    Tapping Quick workout and changing your mind is not a workout ended early.
    Left in storage, the empty record would have Today announcing a session with
    nothing in it — "Quick workout · 0 lifts" — over a plan it had just hidden.
  */
  it("leaves no trace of the day", () => {
    expect(abandonEmpty(startQuick([]))).toEqual([]);
  });

  it("does not take an earlier day's session with it", () => {
    const monday: Session = {
      date: "2026-09-21",
      label: "Leg day",
      completedAt: "2026-09-21T18:00:00.000Z",
      exercises: [{ exerciseId: "back-squat", sets: [{ weight: 135, reps: 5, done: true }] }],
    };
    expect(abandonEmpty(startQuick([monday]))).toEqual([monday]);
  });
});

describe("a finished quick workout", () => {
  const finished: Session = {
    date: TODAY,
    label: QUICK_LABEL,
    startedAt: `${TODAY}T17:00:00.000Z`,
    completedAt: `${TODAY}T17:40:00.000Z`,
    freestyle: true,
    exercises: [
      { exerciseId: "hip-abductor", sets: [{ weight: 90, reps: 12, done: true }] },
      { exerciseId: "lat-pulldown", sets: [{ weight: 70, reps: 10, done: true }] },
    ],
  };

  it("counts as a trained day like any other", () => {
    const strip = weekStrip([finished], [6], TODAY);
    expect(strip.find((d) => d.iso === TODAY)?.trained).toBe(true);
  });

  /*
    The point of the flag. Saturday is Leg day; improvising two machines on one
    Saturday is not a decision that Leg day is now two machines.
  */
  it("does not rewrite the plan of the day it fell on", () => {
    expect(rememberLineup([legDay], finished)).toEqual([legDay]);
  });
});
