import { setCustomExercises } from "./exercises";
import type { AppState, Exercise, PlannedExercise, Session, WeighIn } from "./types";

const KEY = "habitabull.v1";

/**
 * A one-time wipe of every device's local slate.
 *
 * Everything this app knows lives in localStorage on one device, so there is no
 * server switch to clear a tester's data from here. Instead, bumping
 * RESET_EPOCH makes every device clear all of its habitabull.* keys the next
 * time it loads — the app state, the crew identity, and the cached crew code
 * and check-ins together — so a friend who poked at a pre-launch build starts
 * from a genuinely fresh install. It fires once per epoch and then the app
 * persists normally again; a later test wave just needs a new date here.
 */
const RESET_KEY = "habitabull.reset";
const RESET_EPOCH = "2026-09-08";

function resetOncePerEpoch(): void {
  try {
    if (window.localStorage.getItem(RESET_KEY) === RESET_EPOCH) return;
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("habitabull."));
    for (const k of keys) window.localStorage.removeItem(k);
    window.localStorage.setItem(RESET_KEY, RESET_EPOCH);
  } catch {
    // Storage blocked (private mode). Nothing persisted, nothing to reset.
  }
}

export const EMPTY: AppState = { profile: null, routines: [], sessions: [], goal: null };

/** Local date as YYYY-MM-DD. Never UTC — a 11pm workout belongs to today. */
export function todayISO(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function load(): AppState {
  if (typeof window === "undefined") return EMPTY;
  resetOncePerEpoch();
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
      weighIns: saneWeighIns(parsed.weighIns),
      dayLibrary: saneDayLibrary(parsed.dayLibrary),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Weigh-ins get the same treatment as custom lifts: they came from
 * localStorage, and a NaN or a string in `lb` would reach the chart as a
 * geometry value and blank the whole card. Sorted here rather than at every
 * read site, so anything downstream can assume oldest-first.
 */
function saneWeighIns(list: unknown): WeighIn[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (w): w is WeighIn =>
        Boolean(w) &&
        typeof w === "object" &&
        typeof (w as WeighIn).date === "string" &&
        typeof (w as WeighIn).lb === "number" &&
        Number.isFinite((w as WeighIn).lb) &&
        (w as WeighIn).lb > 0
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The saved day-per-template library came from localStorage too. Keep only
 * entries that are arrays of things with an exerciseId; anything malformed is
 * dropped rather than reaching the routine builder as a bad plan.
 */
function saneDayLibrary(v: unknown): Record<string, PlannedExercise[]> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, PlannedExercise[]> = {};
  for (const [k, list] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const items = list.filter(
      (p): p is PlannedExercise =>
        Boolean(p) && typeof p === "object" && typeof (p as PlannedExercise).exerciseId === "string"
    );
    if (items.length) out[k] = items;
  }
  return Object.keys(out).length ? out : undefined;
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

/**
 * Write the whole state, and say whether it landed.
 *
 * This used to swallow the failure. The reasoning was sound as far as it went
 * — the in-memory session still works, and losing history is bad where
 * blocking a workout log is worse — but it stopped one step short. A device
 * that cannot write is a device where every edit disappears on the next
 * launch, and saying nothing about it means the app looks like it is working
 * right up until all of the evidence is gone.
 *
 * It happens for real and not only when a disk is full: Safari in private
 * browsing throws on the first `setItem`, and iOS evicts a web app's storage
 * after seven idle days unless it has been installed to the home screen. Both
 * are ordinary situations for somebody handed a link to a deployed app.
 *
 * So the write still never throws and never blocks a log. It just reports, and
 * the caller is the one that decides whether the person should be told.
 */
type SaveWatcher = (ok: boolean) => void;
const watchers = new Set<SaveWatcher>();

/**
 * Watch whether writes are landing. Returns the unsubscribe.
 *
 * A broadcast rather than a return value threaded through the app, because the
 * screen that has to say "this is not being kept" is not the screen that made
 * the write, and there is no single place in the view machine that renders on
 * every path. One subscriber at the root beats a prop through forty branches.
 */
export function watchSaves(fn: SaveWatcher): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

export function save(state: AppState): boolean {
  if (typeof window === "undefined") return true;
  setCustomExercises(state.customExercises ?? []);
  let ok = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    ok = false;
  }
  for (const w of watchers) w(ok);
  return ok;
}

/** Replace the session for a date, or append it. */
export function upsertSession(sessions: Session[], session: Session): Session[] {
  const i = sessions.findIndex((s) => s.date === session.date);
  if (i === -1) return [...sessions, session];
  const next = [...sessions];
  next[i] = session;
  return next;
}

/** Replace the entry for a date, or insert it in date order. */
export function upsertWeighIn(list: WeighIn[], entry: WeighIn): WeighIn[] {
  const rest = list.filter((w) => w.date !== entry.date);
  return [...rest, entry].sort((a, b) => a.date.localeCompare(b.date));
}

export function sessionFor(sessions: Session[], date: string): Session | undefined {
  return sessions.find((s) => s.date === date);
}
