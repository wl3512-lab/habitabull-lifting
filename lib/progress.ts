import { topSet } from "./engine";
import type { Session } from "./types";

/** Best completed set per training day, oldest first. */
export function exerciseTrack(sessions: Session[], exerciseId: string) {
  return sessions.filter(s => s.completedAt).sort((a, b) => a.date.localeCompare(b.date))
    .flatMap(s => {
      const best = topSet(s.exercises.filter(e => e.exerciseId === exerciseId)
        .flatMap(e => e.sets.filter(set => set.done)));
      return best ? [{ date: s.date, weight: best.weight, reps: best.reps }] : [];
    });
}
