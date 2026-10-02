import type { PlannedExercise, Routine, SavedWorkout, Session } from "./types";
import type { SharedDay } from "./cloud";
import type { TemplateId } from "./templates";

/**
 * Her own workouts, saved by name and put on whichever day she wants.
 *
 * The week could already be edited day by day, and the app already remembered
 * the shape of each day *type* behind her back (`dayLibrary`). What neither of
 * those does is let a workout she built exist on its own: shape a leg day on
 * Monday and there was no way to say "Thursday, that one again" short of
 * rebuilding it lift by lift, and no way to keep two versions of it at all,
 * because the automatic memory holds one entry per type and overwrites it.
 *
 * So a saved workout is a named lineup and nothing more. It is not a schedule,
 * it does not know a weekday, and it is not the plan — it is the thing the plan
 * can be set to. That is also why saving is explicit: the automatic memory
 * already covers "bring back what I did last time", and a list that filled
 * itself from every edit would be a list of forty near-identical Full body A's
 * with nothing worth choosing between.
 */

/** Longest name kept, matching the cap on a custom lift's name. */
export const NAME_MAX = 40;

/** Tidy whitespace and length, the way a custom lift's name is tidied. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function makeWorkout(
  name: string,
  exercises: PlannedExercise[],
  template?: TemplateId,
  now = new Date()
): SavedWorkout {
  const clean = cleanName(name);
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    // Same shape as a custom lift's id and for the same reason: two workouts
    // saved in one millisecond must not collide into one unreachable entry.
    id: `own-${slug || "workout"}-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean || "My workout",
    // Copied, not referenced. The draft these came from keeps being edited
    // after this returns, and a saved workout that changes under her is not
    // saved.
    exercises: exercises.map((e) => ({ ...e })),
    template,
    createdAt: now.toISOString(),
  };
}

/**
 * Where a newly saved workout goes.
 *
 * Saving under a name she has already used **replaces** that workout rather
 * than adding a second one, because re-saving after a tweak is what she means
 * by using the same name — and two rows called "Leg day" in a list whose only
 * job is telling them apart is a list that has stopped working. The screen says
 * "Update" instead of "Save" when it is about to do this, so it is never a
 * surprise.
 */
export function saveWorkout(list: SavedWorkout[] = [], workout: SavedWorkout): SavedWorkout[] {
  const same = (n: string) => n.toLowerCase();
  const at = list.findIndex((w) => same(w.name) === same(workout.name));
  if (at === -1) return [workout, ...list];
  // Keeps its place in the list, and keeps the id, so a rename elsewhere or a
  // stale reference still lands on the workout she thinks it does.
  return list.map((w, i) => (i === at ? { ...workout, id: w.id, createdAt: w.createdAt } : w));
}

export function removeWorkout(list: SavedWorkout[] = [], id: string): SavedWorkout[] {
  return list.filter((w) => w.id !== id);
}

/**
 * Another workout already called this, if there is one. Renaming onto a name
 * in use would leave two rows nobody can tell apart, so a rename checks first
 * and says so, rather than merging two workouts she did not ask to merge.
 */
export function nameClash(list: SavedWorkout[] = [], name: string, exceptId?: string): SavedWorkout | undefined {
  const want = cleanName(name).toLowerCase();
  return list.find((w) => w.id !== exceptId && w.name.toLowerCase() === want);
}

/**
 * Rename a saved workout in place: same id, same lifts, same place in the list.
 *
 * There was no rename. Saving under a new name made a second workout and left
 * the first one behind, unlinked, with the old name still on the day, which
 * from her side is a rename that did not work. A clash or an empty name
 * changes nothing; the screen checks `nameClash` first and says why.
 */
export function renameWorkout(list: SavedWorkout[] = [], id: string, name: string): SavedWorkout[] {
  const clean = cleanName(name);
  if (!clean || nameClash(list, clean, id)) return list;
  return list.map((w) => (w.id === id ? { ...w, name: clean } : w));
}

/**
 * Every day a workout is on takes its new name. The day's name is what Today,
 * Profile and the editor show, so a renamed workout still sitting on Monday as
 * "Leg day" is the rename failing everywhere she looks.
 */
export function relabel(routines: Routine[], id: string, name: string): Routine[] {
  const clean = cleanName(name);
  if (!clean) return routines;
  return routines.map((r) => (r.workoutId === id ? { ...r, label: clean } : r));
}

/**
 * The day-type picker has one category that is not generated by the app: the
 * workouts she named herself. It only appears when it has somewhere useful to
 * go, either a saved workout to choose or the current day to save as the first.
 */
export function yourWorkoutsCategory(list: SavedWorkout[] = [], canSaveCurrent = false) {
  if (!list.length && !canSaveCurrent) return null;
  return {
    id: "your-workouts" as const,
    label: "Your workouts",
    hint:
      list.length > 0
        ? `${list.length} saved ${list.length === 1 ? "workout" : "workouts"}`
        : "Save this day as your first workout",
  };
}

/** Whether these two lineups are the same lifts in the same order. */
export function sameLineup(a: PlannedExercise[], b: PlannedExercise[]): boolean {
  return a.length === b.length && a.every((e, i) => e.exerciseId === b[i].exerciseId);
}

/**
 * The workout this day already is, if any — so the screen can say "Saved as
 * Leg day" instead of offering to save a second copy of it.
 */
export function savedAs(list: SavedWorkout[] = [], exercises: PlannedExercise[]): SavedWorkout | undefined {
  return list.find((w) => sameLineup(w.exercises, exercises) &&
    w.exercises.every((e, i) => e.sets === exercises[i].sets &&
      e.reps === exercises[i].reps && e.weight === exercises[i].weight));
}

/**
 * A name for the workout this day is about to become, avoiding one she has
 * already used. "Leg day" then "Leg day 2", so saving twice in a row does not
 * silently overwrite the first.
 */
export function suggestName(label: string, list: SavedWorkout[] = []): string {
  const base = cleanName(label) || "My workout";
  const taken = new Set(list.map((w) => w.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const suffix = ` ${n}`;
    const tryThis = `${base.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(tryThis.toLowerCase())) return tryThis;
  }
}

/** A workout offered from her own week, and the days it is currently on. */
export interface WeekChoice {
  label: string;
  exercises: PlannedExercise[];
  template?: TemplateId;
  /** Every weekday this exact lineup sits on, in week order. */
  days: number[];
}

/**
 * Her week, as a list of workouts to choose from rather than a list of days.
 *
 * Training on a rest day means picking a workout, and a week is mostly not
 * seven different ones: a Monday and a Friday that are the same five lifts are
 * one choice offered twice, and two rows with the same name that start the
 * same session is the screen inventing a decision. So identical lineups fold
 * together and carry every day they are on, which is also the honest label for
 * them.
 *
 * Anything she has already saved by name is left out, because the saved list
 * is shown above this one and it is the same workout.
 *
 * Matched on the lineup, never the label: two days called "Full body A" with
 * different lifts in them are genuinely two workouts, and a rest day is
 * exactly when the difference matters.
 */
export function weekChoices(routines: Routine[], saved: SavedWorkout[] = []): WeekChoice[] {
  const out: WeekChoice[] = [];
  for (const r of [...routines].sort((a, b) => a.day - b.day)) {
    if (!r.exercises.length) continue;
    if (saved.some((w) => sameLineup(w.exercises, r.exercises))) continue;
    const already = out.find((c) => sameLineup(c.exercises, r.exercises));
    if (already) {
      already.days.push(r.day);
      continue;
    }
    out.push({
      label: r.label,
      exercises: r.exercises.map((e) => ({ ...e })),
      template: r.template,
      days: [r.day],
    });
  }
  return out;
}

/**
 * Day types she has shaped, for the ones nothing else is offering.
 *
 * `dayLibrary` is the app's quiet memory of what each named day type means to
 * her: shape a leg day once and it holds that shape, so pressing Leg day again
 * brings hers back rather than the generated default. It outlives the week,
 * which is exactly what makes it worth reading here. A leg day she trained for
 * a month and then dropped out of her schedule is still the leg day she means
 * on the Sunday she decides to train legs, and it is the one thing on this
 * screen that can offer it.
 *
 * Full body is excluded, as everywhere else: it is meant to vary slot to slot,
 * so there is no single shape of it to remember. Anything already offered by
 * a saved workout or by the week is skipped rather than shown twice.
 */
export function libraryChoices(
  library: Record<string, PlannedExercise[]> = {},
  offered: PlannedExercise[][] = [],
  labelFor: (template: string) => string | undefined = () => undefined
): WeekChoice[] {
  const out: WeekChoice[] = [];
  for (const [template, exercises] of Object.entries(library)) {
    if (template === "full-body" || !exercises?.length) continue;
    if (offered.some((lineup) => sameLineup(lineup, exercises))) continue;
    if (out.some((c) => sameLineup(c.exercises, exercises))) continue;
    out.push({
      label: labelFor(template) ?? template,
      exercises: exercises.map((e) => ({ ...e })),
      template: template as TemplateId,
      days: [],
    });
  }
  return out;
}

/**
 * Put a saved workout on a day of the week.
 *
 * The day becomes that workout: its lifts, its name on screen, its day type.
 * Weights come back out of her history when the session is built, so this
 * carries no numbers forward from whenever she saved it.
 *
 * A day that is not in the week is not silently added — which days she trains
 * is the schedule screen's decision, and a workout appearing on a Sunday she
 * never agreed to train is the plan changing itself.
 */
export function placeOn(routines: Routine[], day: number, workout: SavedWorkout): Routine[] {
  return routines.map((r) =>
    r.day === day
      ? {
          ...r,
          label: workout.name,
          template: workout.template,
          exercises: workout.exercises.map((e) => ({ ...e })),
          // What makes the day and the workout stay the same thing from here.
          workoutId: workout.id,
        }
      : r
  );
}

/**
 * Carry a day's edits back into the workout that day is.
 *
 * Putting a saved workout on Tuesday used to be a copy: add a lift to Tuesday
 * afterwards and the workout in her list kept the old lineup, so the next time
 * she reached for it the lift she had added was gone and nothing had said so.
 * "I added cable crunches to my workout and it didn't save" is that, exactly.
 *
 * Only a day that is explicitly linked to a workout updates it, never a day
 * that merely shares its name: the day types are called "Leg day" too, and a
 * generated leg day quietly overwriting hers is the same bug pointing the
 * other way.
 *
 * A day emptied out updates nothing. Clearing a day is how she rearranges the
 * week, and a workout she saved is not something the week is allowed to delete
 * the contents of behind her.
 */
export function syncWorkouts(workouts: SavedWorkout[] = [], routines: Routine[]): SavedWorkout[] {
  if (!workouts.length) return workouts;
  return workouts.map((w) => {
    // First match wins if the same workout sits on two days. They are the same
    // workout, so the days agree except in the moment one of them is being
    // edited, and that edit is the one being saved right now.
    const day = routines.find((r) => r.workoutId === w.id && r.exercises.length > 0);
    if (!day) return w;
    return {
      ...w,
      exercises: day.exercises.map((e) => ({ ...e })),
      template: day.template ?? w.template,
    };
  });
}

/**
 * The lineup of a session she actually trained, as a plan she could train again.
 *
 * Only the sets she completed count: a workout saved from a session she cut
 * short should be the workout she did, not the one she meant to. Reps and weight
 * come off the first completed set, the same reading `rememberLineup` takes of a
 * finished day, and the weights barely matter anyway — the engine sets the load
 * from history every time the session is built.
 *
 * This exists for the workout nothing else remembers. A planned day carries its
 * own lineup back onto the routine when it finishes, but a quick workout
 * improvised lift by lift is deliberately exempt from that, and so is a day
 * rebuilt around an injury — so those two are the sessions that disappear when
 * the screen closes, and the only ones worth offering to keep.
 */
export function fromSession(session: Session): PlannedExercise[] {
  return session.exercises
    .map((e) => {
      const done = e.sets.filter((s) => s.done);
      if (!done.length) return null;
      return {
        exerciseId: e.exerciseId,
        sets: done.length,
        reps: done[0].reps,
        weight: done[0].weight,
      };
    })
    .filter((e): e is PlannedExercise => e !== null);
}

/**
 * The same finished workout, but in the crew's privacy shape.
 *
 * The crew can copy lift choices. It cannot receive weights, reps or sets,
 * because those are performance and this product has already chosen not to
 * make performance social.
 */
export function shareableFromSession(session: Session, name = session.label): SharedDay | null {
  const lineup = fromSession(session);
  if (!lineup.length) return null;
  const day = new Date(`${session.date}T00:00:00`).getDay();
  if (!Number.isInteger(day)) return null;
  return {
    day,
    label: cleanName(name) || cleanName(session.label) || "Workout",
    exercises: lineup.map((e) => e.exerciseId),
  };
}

/** Put the just-shared workout at the top of the copyable crew list. */
export function withSharedWorkout(plan: SharedDay[], workout: SharedDay): SharedDay[] {
  return [workout, ...plan.filter((d) => d.day !== workout.day)].slice(0, 7);
}

/**
 * Saved workouts as read back from localStorage or a backup file: untrusted,
 * like everything else that comes from there. A workout missing a name or with
 * no usable lift in it is dropped rather than reaching the week builder as a
 * day with nothing on it.
 */
export function saneWorkouts(v: unknown): SavedWorkout[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedWorkout[] = [];
  for (const w of v) {
    if (!w || typeof w !== "object") continue;
    const cand = w as Partial<SavedWorkout>;
    if (typeof cand.id !== "string" || typeof cand.name !== "string") continue;
    if (!Array.isArray(cand.exercises)) continue;
    const exercises = cand.exercises.filter(
      (e): e is PlannedExercise =>
        Boolean(e) && typeof e === "object" && typeof (e as PlannedExercise).exerciseId === "string"
    );
    if (!exercises.length) continue;
    out.push({
      id: cand.id,
      name: cleanName(cand.name) || "My workout",
      exercises,
      template: typeof cand.template === "string" ? (cand.template as TemplateId) : undefined,
      createdAt: typeof cand.createdAt === "string" ? cand.createdAt : new Date(0).toISOString(),
    });
  }
  return out.length ? out : undefined;
}
