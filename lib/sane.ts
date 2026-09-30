import type { Exercise, PlannedExercise, WeighIn } from "./types";

/**
 * Checking state that came from outside the running app.
 *
 * There are two doors into the store and both of them are untrusted.
 * localStorage is writable by anything on the origin and survives every version
 * of the app that ever ran on this device, so an old shape or a hand-edited key
 * arrives looking like current state. A backup file is worse: it is whatever
 * somebody dropped into a file picker.
 *
 * These lived inside `storage.ts` as private helpers, which is how the import
 * path came to validate four fields fewer than the load path and quietly drop
 * them. One definition each, used by both doors, is the only version of this
 * that stays true — a field is either checked everywhere it can enter or it is
 * a bug waiting for whoever adds the next door.
 *
 * The rule throughout: repair what can be repaired, drop what cannot, never
 * throw. An import that fails halfway is worse than one that lands slightly
 * lighter, because the person doing it has usually just lost the original.
 */

/**
 * Weigh-ins. A NaN or a string in `lb` reaches the chart as a geometry value
 * and blanks the whole card, so a bad entry is dropped rather than drawn.
 * Sorted here rather than at every read site, so anything downstream can assume
 * oldest-first.
 */
export function saneWeighIns(list: unknown): WeighIn[] {
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
 * The saved day-per-template library. Keep only entries that are arrays of
 * things with an exerciseId; anything malformed is dropped rather than reaching
 * the routine builder as a bad plan.
 */
export function saneDayLibrary(v: unknown): Record<string, PlannedExercise[]> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
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
 * Lifts somebody added by hand. Anything missing a field the app will
 * dereference is dropped rather than crashing a render somewhere far away from
 * here — a plan that mentions a lift the registry does not have renders as a
 * raw id, which is survivable; a lift with no `steps` array is not.
 */
export function saneCustomExercises(list: unknown): Exercise[] {
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
