import { saneCustomExercises, saneDayLibrary, saneWeighIns } from "./sane";
import type { AppState } from "./types";
import { saneWorkouts } from "./workouts";

/**
 * Getting your training out of the browser.
 *
 * Everything this app knows lives in one browser on one device: localStorage
 * for the log and IndexedDB for the photos. Clear site data, switch phones, or
 * let iOS evict an uninstalled site and months of history are gone with no way
 * to ask for it back. For an app whose entire argument is "come back in week
 * three", losing the record of weeks one and two is the worst failure it has.
 *
 * So: one file, everything in it, importable anywhere. Photos travel as data
 * URLs — bigger than a zip, but a single file that works with no tooling beats
 * a smaller one that needs some.
 */

export const BACKUP_VERSION = 1;

export interface BackupPhoto {
  id: string;
  date: string;
  addedAt: string;
  /** data: URL, so the file stands alone. */
  data: string;
}

export interface Backup {
  app: "habitabull";
  version: number;
  exportedAt: string;
  state: AppState;
  photos: BackupPhoto[];
}

export function buildBackup(state: AppState, photos: BackupPhoto[] = []): Backup {
  return {
    app: "habitabull",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    photos,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Anything can be dropped into a file picker, including a file from another
 * app, a truncated download, or something hand-edited into nonsense. Nothing is
 * trusted: every field is checked before it is allowed anywhere near the
 * store, and a bad field is dropped rather than allowed to poison the import.
 */
export function parseBackup(raw: unknown): { state: AppState; photos: BackupPhoto[] } | null {
  if (!isObj(raw) || raw.app !== "habitabull") return null;
  if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) return null;
  if (!isObj(raw.state)) return null;

  const s = raw.state;
  const sessions = Array.isArray(s.sessions)
    ? s.sessions.filter(
        (x): x is AppState["sessions"][number] =>
          isObj(x) && typeof x.date === "string" && Array.isArray(x.exercises)
      )
    : [];
  const routines = Array.isArray(s.routines)
    ? s.routines.filter(
        (x): x is AppState["routines"][number] =>
          isObj(x) && typeof x.day === "number" && Array.isArray(x.exercises)
      )
    : [];
  const profile =
    isObj(s.profile) && typeof s.profile.name === "string"
      ? (s.profile as unknown as AppState["profile"])
      : null;
  const goal =
    isObj(s.goal) && typeof s.goal.exerciseId === "string"
      ? (s.goal as unknown as AppState["goal"])
      : null;

  const photos = Array.isArray(raw.photos)
    ? raw.photos.filter(
        (p): p is BackupPhoto =>
          isObj(p) &&
          typeof p.id === "string" &&
          typeof p.date === "string" &&
          typeof p.data === "string" &&
          p.data.startsWith("data:image/")
      )
    : [];

  /*
    Everything else the store holds.

    These four used to be dropped on the floor. The file carried them — export
    writes the whole state object — and the parser named the fields it returned
    one by one, so anything added to `AppState` after this function was written
    silently did not come back: her weigh-ins, the lifts she added by hand, the
    day library behind the day-type picker, and later her saved workouts. The
    file said "one file holds everything" and restoring it dropped four things.

    Each is validated by the same function the load path uses, and shaped the
    way that path shapes it: a file from a picker is no more trusted than
    localStorage is, and a restored state that differs in shape from a loaded one
    is a second version of the store for every reader downstream to get wrong.
    So the two lists come back as lists, and the two keyed-or-absent fields keep
    their own contract of being undefined when there is nothing in them.

    Whoever adds the next field to `AppState`: it belongs here too, and the
    round-trip test below is the one that will tell you.
  */
  return {
    state: {
      profile,
      routines,
      sessions,
      goal,
      goalDismissed: typeof s.goalDismissed === "boolean" ? s.goalDismissed : undefined,
      weighIns: saneWeighIns(s.weighIns),
      customExercises: saneCustomExercises(s.customExercises),
      dayLibrary: saneDayLibrary(s.dayLibrary),
      workouts: saneWorkouts(s.workouts),
      challenge:
        isObj(s.challenge) && typeof s.challenge.month === "string"
          ? (s.challenge as unknown as AppState["challenge"])
          : undefined,
    },
    photos,
  };
}

/** A filename that sorts by date and says what it is. */
export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `habitabull-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
