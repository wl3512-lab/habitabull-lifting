import { count } from "./plural";
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

/** How long an unfinished workout is offered back after she started it. */
export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Unfinished days before today, offered back for 24 hours from when she started them.
 * The offer used to stand forever, so Monday's legs were still asking to be resumed on
 * Wednesday. It goes quietly: every set she logged already counts (see `historyFor`
 * in engine.ts), so nothing is lost. Saves from before `startedAt` existed count from
 * the end of their own day, the latest they could have started.
 */
export function unfinishedSessions(sessions: Session[], today: string, now = Date.now()) {
  return sessions.filter(s => s.date < today && !s.completedAt && s.exercises.length > 0 &&
      now - startedAtMs(s) < RESUME_WINDOW_MS)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * How long ago she started an unfinished workout, for the card that offers it back.
 * It said "from 2026-09-29", which left her to work it out; the offer only lasts a
 * day, so hours say it better, and minutes under the first hour. An old save with
 * no start time can only be yesterday's by the time it is offered.
 */
export function startedAgo(session: Session, now = Date.now()): string {
  const t = session.startedAt ? Date.parse(session.startedAt) : NaN;
  if (!Number.isFinite(t)) return "yesterday";
  const minutes = Math.max(1, Math.floor((now - t) / 60000));
  return minutes < 60 ? `${count(minutes, "minute")} ago` : `${count(Math.floor(minutes / 60), "hour")} ago`;
}

function startedAtMs(s: Session) {
  const t = s.startedAt ? Date.parse(s.startedAt) : NaN;
  if (Number.isFinite(t)) return t;
  const [y, m, d] = s.date.split("-").map(Number);
  return new Date(y, m - 1, d + 1).getTime();
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
