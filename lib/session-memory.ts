import type { LoggedSet, Session, SessionCheckpoint, SessionTimer } from "./types";

/** Recover a saved position, or use the next unfinished lift for older saves. */
export function resumePosition(session: Session): SessionCheckpoint {
  const i = session.exercises.findIndex(e => e.sets.some(s => !s.done));
  const fallback = { exerciseIndex: i === -1 ? 0 : i, timer: null };
  const saved = session.checkpoint;
  if (!saved || session.completedAt || !Number.isInteger(saved.exerciseIndex) ||
      !session.exercises[saved.exerciseIndex]) return fallback;
  const exercise = session.exercises[saved.exerciseIndex];
  const timer = saved.timer;
  const validTimer = timer && timer.exerciseId === exercise.exerciseId &&
    Number.isFinite(timer.endsAt) && Number.isFinite(timer.seconds) && timer.seconds > 0 &&
    Number.isFinite(timer.weight) && Number.isFinite(timer.reps) &&
    exercise.sets.some(s => !s.done);
  return { exerciseIndex: saved.exerciseIndex, timer: validTimer ? timer : null };
}

/** New unlogged work reopens a completed day; previous logged sets stay facts. */
export function replaceSessionSets(session: Session, index: number, sets: LoggedSet[]): Session {
  const exercises = session.exercises.map((e, i) => i === index ? { ...e, sets } : e);
  return { ...session, exercises,
    completedAt: exercises.some(e => e.sets.some(s => !s.done)) ? undefined : session.completedAt };
}

/** Older drafts remain reachable even after today's date changes. */
export function unfinishedSessions(sessions: Session[], today: string) {
  return sessions.filter(s => s.date < today && !s.completedAt && s.exercises.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function finishSession(session: Session, completedAt: string): Session {
  if (!session.exercises.some(e => e.sets.some(s => s.done))) return { ...session, checkpoint: undefined };
  return { ...session, completedAt, checkpoint: undefined,
    exercises: session.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
      .filter(e => e.sets.length > 0) };
}

export function secondsRemaining(endsAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}


export function endTimedWork(session: Session, index: number, timer: SessionTimer, now = Date.now()): Session {
  const exercise = session.exercises[index];
  if (timer.mode !== "work" || exercise?.exerciseId !== timer.exerciseId) return session;
  const at = exercise.sets.findIndex(s => !s.done);
  if (at < 0) return session;
  const reps = Math.max(1, Math.round((timer.seconds - secondsRemaining(timer.endsAt, now)) / 60));
  return replaceSessionSets(session, index, exercise.sets.map((set, i) => i === at ? { ...set, reps, done: true } : set));
}
