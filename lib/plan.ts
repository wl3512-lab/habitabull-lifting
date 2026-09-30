import { mergeDayLibrary, refreshOpenDay, sessionTarget } from "./engine";
import { syncWorkouts } from "./workouts";
import type { AppState, Level, Routine, Session, PlannedExercise, LoggedExercise } from "./types";

/** Apply a plan selected in the editor, import screen or crew copier. */
export function applyPlan(state: AppState, routines: Routine[], level: Level, date: string): AppState {
  const day = new Date(`${date}T00:00:00`).getDay();
  return {
    ...state,
    routines,
    dayLibrary: mergeDayLibrary(state.dayLibrary, routines),
    // A day that is one of her saved workouts carries its edits back into it.
    // Every plan change comes through here, so the two cannot drift apart in
    // one screen and stay together in another.
    workouts: syncWorkouts(state.workouts, routines),
    sessions: refreshOpenDay(state.sessions, state.routines.find(r => r.day === day),
      routines.find(r => r.day === day), level, date),
  };
}


/** Preview the set that will actually open when resuming a saved draft. */
export function previewExercise(planned: PlannedExercise, sessions: Session[], level: Level, draft?: LoggedExercise) {
  if (draft?.exerciseId === planned.exerciseId) {
    const next = draft.sets.find(set => !set.done) ?? draft.sets[0];
    if (next) return { sets: draft.sets.length, weight: next.weight, reps: next.reps };
  }
  return sessionTarget(planned.exerciseId, sessions, level, planned);
}
