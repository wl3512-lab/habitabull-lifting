import { setCustomExercises } from "./exercises";
import type { AppState, Exercise, Session } from "./types";

const KEY = "habitabull.v1";

export const EMPTY: AppState = { profile: null, routines: [], sessions: [], goal: null };

/** Local date as YYYY-MM-DD. Never UTC — a 11pm workout belongs to today. */
export function todayISO(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function load(): AppState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Into the registry before anything reads byId, so a custom lift is
    // indistinguishable from a built-in one from the first render.
    const customExercises = sane(parsed.customExercises);
    setCustomExercises(customExercises);
    return {
      customExercises,
      profile: parsed.profile ?? null,
      routines: parsed.routines ?? [],
      sessions: parsed.sessions ?? [],
      goal: parsed.goal ?? null,
      goalDismissed: parsed.goalDismissed,
      challenge: parsed.challenge,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * A stored custom lift is as untrusted as an imported one: it came from
 * localStorage, which anything on the origin can write. Anything missing a
 * field the app will dereference is dropped rather than crashing a render
 * somewhere far away from here.
 */
function sane(list: unknown): Exercise[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is Exercise =>
      Boolean(e) &&
      typeof e === "object" &&
      typeof (e as Exercise).id === "string" &&
      typeof (e as Exercise).name === "string" &&
      typeof (e as Exercise).primary === "string" &&
      typeof (e as Exercise).equipment === "string" &&
      typeof (e as Exercise).increment === "number" &&
      typeof (e as Exercise).cue === "string" &&
      Array.isArray((e as Exercise).steps) &&
      Array.isArray((e as Exercise).mistakes)
  );
}

export function save(state: AppState): void {
  if (typeof window === "undefined") return;
  setCustomExercises(state.customExercises ?? []);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked. The in-memory session still works; losing
    // history is bad but blocking a workout log is worse.
  }
}

/** Replace the session for a date, or append it. */
export function upsertSession(sessions: Session[], session: Session): Session[] {
  const i = sessions.findIndex((s) => s.date === session.date);
  if (i === -1) return [...sessions, session];
  const next = [...sessions];
  next[i] = session;
  return next;
}

export function sessionFor(sessions: Session[], date: string): Session | undefined {
  return sessions.find((s) => s.date === date);
}
