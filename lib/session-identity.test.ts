import { describe, expect, it } from "vitest";
import { buildSession, mergeRebuild } from "./engine";
import { upsertSession } from "./storage";
import type { Routine, Session } from "./types";

/**
 * One session per calendar date, and what that costs.
 *
 * `upsertSession` keys by date, so a day has exactly one record. That is right
 * for the product — the calendar, the streak and the heatmap are all per-day —
 * but it means every path that writes today's session is writing over the one
 * that is already there, and any field it forgets is gone.
 */

const TODAY = "2026-09-26";
const routine: Routine = {
  day: 6, label: "Full body A", template: "full-body",
  exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 45 }],
};
const set = (w: number, r: number, done: boolean) => ({ weight: w, reps: r, done });
const finished: Session = {
  date: TODAY,
  label: "Full body A",
  startedAt: `${TODAY}T17:00:00.000Z`,
  completedAt: `${TODAY}T18:00:00.000Z`,
  note: "Felt strong.",
  exercises: [{ exerciseId: "bench-press", sets: [set(95, 8, true), set(95, 8, true), set(95, 8, true)] }],
};

/** What `applyConstraints` does when "Swap today's plan" is tapped. */
const swapPlan = (sessions: Session[]) =>
  upsertSession(
    sessions.filter((x) => x.date !== TODAY || x.completedAt),
    {
      ...mergeRebuild(
        sessions.find((s) => s.date === TODAY),
        buildSession(routine, sessions, "new", TODAY)
      ),
      adapted: true,
    }
  );

describe("swapping the plan on a day already finished", () => {
  /*
    The reported bug, and the reason it read as "my sessions did not save":
    nothing was removed from storage, but the day stopped counting as trained.
  */
  it("leaves the day counted as trained", () => {
    const out = swapPlan([finished]);
    expect(out[0].completedAt).toBe(finished.completedAt);
  });

  it("keeps when it started, so the summary can still state a duration", () => {
    expect(swapPlan([finished])[0].startedAt).toBe(finished.startedAt);
  });

  it("keeps what she wrote about it", () => {
    expect(swapPlan([finished])[0].note).toBe("Felt strong.");
  });

  it("keeps every set that was logged", () => {
    const out = swapPlan([finished]);
    expect(out[0].exercises.flatMap((e) => e.sets.filter((s) => s.done))).toHaveLength(3);
  });

  it("still leaves exactly one record for the day", () => {
    expect(swapPlan([finished])).toHaveLength(1);
  });

  it("does not resurrect a day that was never finished", () => {
    const draft = { ...finished, completedAt: undefined, startedAt: undefined };
    expect(swapPlan([draft])[0].completedAt).toBeUndefined();
  });
});

describe("training twice on the same date", () => {
  /*
    There is one record per date by design, so a second workout is folded into
    the first rather than filed beside it. The thing that must never happen is
    the first one's sets going missing.
  */
  it("adds to the day rather than replacing it", () => {
    const second: Session = {
      ...finished,
      exercises: [
        finished.exercises[0],
        { exerciseId: "back-squat", sets: [set(135, 5, true)] },
      ],
    };
    const out = upsertSession([finished], second);
    expect(out).toHaveLength(1);
    const done = out[0].exercises.flatMap((e) => e.sets.filter((s) => s.done));
    expect(done).toHaveLength(4);
  });
});
