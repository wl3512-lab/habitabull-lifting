import { describe, expect, it } from "vitest";
import { applyPlan, previewExercise } from "./plan";
import { EMPTY } from "./storage";
import type { AppState, Routine } from "./types";

const old: Routine = { day: 1, label: "Push", template: "push", exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 45 }] };
const replacement: Routine = { day: 1, label: "Legs", template: "legs", exercises: [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 45 }] };
const state = (): AppState => ({ ...EMPTY, routines: [old], sessions: [{ date: "2026-09-28", label: "Push", startedAt: "2026-09-28T12:00:00Z", exercises: [{ exerciseId: "bench-press", sets: [{ weight: 95, reps: 8, done: false }] }] }] });

describe("applying an edited, imported or copied plan", () => {
  it("refreshes an open day and remembers the chosen template", () => {
    const out = applyPlan(state(), [replacement], "new", "2026-09-28");
    expect(out.routines).toEqual([replacement]);
    expect(out.sessions[0].label).toBe("Legs");
    expect(out.sessions[0].exercises.map(e => e.exerciseId)).toEqual(["back-squat"]);
    expect(out.dayLibrary?.legs).toEqual(replacement.exercises);
    expect(out.sessions[0].startedAt).toBe("2026-09-28T12:00:00Z");
  });

  it("keeps sets already logged when an imported plan replaces today", () => {
    const input = state();
    input.sessions[0].exercises[0].sets[0].done = true;
    const out = applyPlan(input, [replacement], "new", "2026-09-28");
    expect(out.sessions[0].exercises[0]).toEqual(input.sessions[0].exercises[0]);
    expect(out.sessions[0].exercises[1].exerciseId).toBe("back-squat");
  });

  it.each(["completed", "quick"])("leaves a %s workout intact", kind => {
    const input = state();
    if (kind === "completed") input.sessions[0].completedAt = "2026-09-28T13:00:00Z";
    else input.sessions[0].freestyle = true;
    expect(applyPlan(input, [replacement], "new", "2026-09-28").sessions).toEqual(input.sessions);
  });
});


it("previews the saved next set instead of replacing it with historical defaults", () => {
  const planned = old.exercises[0];
  const draft = { exerciseId: "bench-press", sets: [
    { weight: 95, reps: 8, done: true },
    { weight: 117.5, reps: 7, done: false },
  ] };
  expect(previewExercise(planned, [], "new", draft)).toEqual({ sets: 2, weight: 117.5, reps: 7 });
});
