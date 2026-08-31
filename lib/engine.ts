import { EXERCISES, byId } from "./exercises";
import { templateOf, defaultTemplates, type TemplateId } from "./templates";
import type { Equipment, Exercise, Goal, Level, Muscle, PlannedExercise, Routine, Session } from "./types";

/**
 * The rules engine owns every number in this app: sets, reps, starting load,
 * progression, deload, and equipment substitution.
 *
 * A language model never picks a weight here. The model may only return
 * constraints (equipment available, muscles to avoid), which are validated
 * against the enums below and then fed into these functions.
 */

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Starting load as a fraction of an untrained bodyweight-ish baseline, in lb. */
const BASE_LOAD: Record<Level, number> = { new: 45, returning: 65, experienced: 95 };

const LEVEL_SETS: Record<Level, number> = { new: 3, returning: 3, experienced: 4 };
/**
 * Working reps for the compounds. Ten was too many for a novice squat and far
 * too many for a novice deadlift; the accessories are where higher reps belong.
 */
const LEVEL_REPS: Record<Level, number> = { new: 8, returning: 6, experienced: 5 };

/**
 * Working reps for one lift. The single source of truth, because this used to
 * be decided independently in the generator, the target calculator and the
 * rebuild — and they disagreed: the plan said deadlift 3×5 while the home
 * screen said 3×8 for the same lift on the same day.
 */
export function repsFor(ex: Exercise, level: Level): number {
  if (ex.primary === "core") return 30;
  if (ex.heavy) return Math.min(5, LEVEL_REPS[level]);
  return ex.compound ? LEVEL_REPS[level] : LEVEL_REPS[level] + 4;
}

/**
 * Full-body sessions, alternating A and B.
 *
 * This used to be a push/pull/legs split, which contradicted the app's own
 * documentation and, more to the point, the guidance. ACSM's 2026 update puts
 * novices on full-body work across non-consecutive days and is explicit that
 * training every major group twice a week matters far more than the shape of
 * the split — and a split cannot deliver that on three days a week, because
 * anything you train on Monday you do not touch again until next Monday.
 *
 * Every session is knee, hinge, push, pull, core. A and B alternate which lift
 * fills each slot, so nothing is identical week to week and everything still
 * gets trained every session. This is the shape every serious beginner program
 * uses, for the same reason.
 */
const FULL_BODY: Muscle[][] = [
  ["quads", "hamstrings", "chest", "back", "core"],
  ["glutes", "quads", "shoulders", "back", "arms"],
];

const SESSION_LABELS = ["Full body A", "Full body B"];

export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return 0;
  return Math.max(increment, Math.round(weight / increment) * increment);
}

/** Pick the best available exercise for a muscle given the user's equipment. */
export function pickExercise(
  muscle: Muscle,
  equipment: Equipment[],
  exclude: Set<string>,
  favourites: string[] = []
): Exercise | null {
  const usable = EXERCISES.filter(
    (e) => e.primary === muscle && equipment.includes(e.equipment) && !exclude.has(e.id)
  );
  if (usable.length === 0) return null;
  const starred = new Set(favourites);
  // A starred lift wins between two that would both do the job. Compounds still
  // come first otherwise, because they carry the session and progress cleanly.
  usable.sort(
    (a, b) =>
      Number(starred.has(b.id)) - Number(starred.has(a.id)) ||
      Number(b.compound) - Number(a.compound)
  );
  return usable[0];
}

export function startingWeight(ex: Exercise, level: Level): number {
  if (ex.increment === 0) return 0; // bodyweight
  const base = BASE_LOAD[level];
  const scaled = ex.compound ? base : base * 0.45;
  return roundToIncrement(scaled, ex.increment);
}

/**
 * Build a week of routines. Deterministic: same inputs always give the same
 * plan, which matters because users must be able to trust it.
 */
export function generateRoutine(
  level: Level,
  trainingDays: number[],
  equipment: Equipment[],
  favourites: string[] = [],
  templates?: TemplateId[]
): Routine[] {
  const days = [...new Set(trainingDays)].sort((a, b) => a - b);
  if (days.length === 0) return [];
  const eq = equipment.length ? equipment : (["bodyweight"] as Equipment[]);
  const chosen = templates?.length ? templates : defaultTemplates(days.length);
  return days.map((day, i) => {
    const tpl = templateOf(chosen[i % chosen.length]);
    // Full body still alternates its slots so two sessions are never identical;
    // a named day is the same shape every time, which is the point of naming it.
    const muscles =
      tpl.id === "full-body" ? FULL_BODY[i % FULL_BODY.length] : tpl.muscles;
    const circuit = tpl.style === "circuit";
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const m of muscles) {
      // A circuit wants things you can start immediately, so bodyweight first.
      const ex = circuit
        ? pickExercise(m, ["bodyweight"], used, favourites) ??
          pickExercise(m, eq, used, favourites)
        : pickExercise(m, eq, used, favourites) ??
          pickExercise(m, ["bodyweight"], used, favourites);
      if (!ex) continue;
      used.add(ex.id);
      exercises.push({
        exerciseId: ex.id,
        sets: LEVEL_SETS[level],
        // Compounds carry the session and are trained heavier and lower; the
        // accessories are where reps live. A beginner deadlifting 3×10 is the
        // clearest sign a generator was not paying attention.
        reps: circuit ? Math.max(15, repsFor(ex, level) * 2) : repsFor(ex, level),
        weight: circuit ? 0 : startingWeight(ex, level),
      });
    }
    const label =
      tpl.id === "full-body" ? SESSION_LABELS[i % SESSION_LABELS.length] : tpl.label;
    return { day, label, template: tpl.id, exercises };
  });
}

/** Every completed set for an exercise, newest session first. */
export function historyFor(sessions: Session[], exerciseId: string) {
  return sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => s.exercises.find((e) => e.exerciseId === exerciseId))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => e.sets.filter((set) => set.done));
}

/**
 * Progressive overload with a deload guard.
 *
 * - Hit every target rep last session -> add one increment.
 * - Missed on three consecutive sessions -> cut 10% and rebuild.
 * - Anything else -> repeat the same load. Repeating is a valid outcome; most
 *   apps push regardless and that is how people get hurt and quit.
 */
export function nextTarget(
  exerciseId: string,
  sessions: Session[],
  level: Level
): { weight: number; reps: number; sets: number; note: string } {
  const ex = byId(exerciseId);
  const fallback = { weight: 0, reps: LEVEL_REPS[level], sets: LEVEL_SETS[level], note: "" };
  if (!ex) return fallback;

  const targetReps = repsFor(ex, level);
  const sets = LEVEL_SETS[level];
  const hist = historyFor(sessions, exerciseId);

  if (hist.length === 0) {
    return { weight: startingWeight(ex, level), reps: targetReps, sets, note: "First time. Start light and learn the movement." };
  }

  const last = hist[0];
  const lastWeight = last.length ? Math.max(...last.map((s) => s.weight)) : startingWeight(ex, level);
  const clearedAll = last.length >= sets && last.every((s) => s.reps >= targetReps);

  if (clearedAll) {
    const weight = ex.increment === 0 ? 0 : roundToIncrement(lastWeight + ex.increment, ex.increment);
    return { weight, reps: targetReps, sets, note: ex.increment === 0 ? "Add two reps this time." : `Up ${ex.increment} lb. You earned it.` };
  }

  const missedStreak = hist.slice(0, 3).filter((sets_) => !(sets_.length && sets_.every((s) => s.reps >= targetReps))).length;
  if (missedStreak >= 3 && hist.length >= 3) {
    const weight = ex.increment === 0 ? 0 : roundToIncrement(lastWeight * 0.9, ex.increment);
    return { weight, reps: targetReps, sets, note: "Backing off 10%. Three tough sessions is a signal, not a failure." };
  }

  // Snap even when holding: a hand-typed 97 should come back as a bar you can
  // actually load, not follow the user around forever.
  const held = ex.increment === 0 ? 0 : roundToIncrement(lastWeight, ex.increment);
  return { weight: held, reps: targetReps, sets, note: "Same weight. Own it this time." };
}

/** Heaviest completed set ever, per exercise. */
export function personalRecord(sessions: Session[], exerciseId: string): number {
  let pr = 0;
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    for (const set of e.sets) if (set.done && set.weight > pr) pr = set.weight;
  }
  return pr;
}

/**
 * Consecutive-week streak: a week counts if at least one session was completed.
 * Weeks, not days, because a 4-day-a-week lifter should never see a broken
 * streak for resting on Tuesday. The deck's whole thesis is that guilt loses.
 */
export function streakWeeks(sessions: Session[], today = new Date()): number {
  const done = sessions.filter((s) => s.completedAt);
  if (done.length === 0) return 0;
  const weekOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x.toISOString().slice(0, 10);
  };
  const weeks = new Set(done.map((s) => weekOf(new Date(s.date + "T00:00:00"))));
  let streak = 0;
  const cursor = new Date(today);
  for (;;) {
    if (weeks.has(weekOf(cursor))) streak++;
    else if (streak > 0 || weekOf(cursor) !== weekOf(today)) break;
    cursor.setDate(cursor.getDate() - 7);
    if (streak > 520) break;
  }
  return streak;
}

/**
 * Turn a planned day into an empty session pre-filled with today's targets.
 * Targets come from nextTarget, so the plan already reflects your history.
 */
export function buildSession(routine: Routine, sessions: Session[], level: Level, date: string): Session {
  return {
    date,
    label: routine.label,
    exercises: routine.exercises.map((p) => {
      const t = nextTarget(p.exerciseId, sessions, level);
      return {
        exerciseId: p.exerciseId,
        sets: Array.from({ length: t.sets }, () => ({ weight: t.weight, reps: t.reps, done: false })),
      };
    }),
  };
}

/**
 * Re-pick a day's exercises under new constraints — different equipment, or a
 * muscle group to work around. The muscles targeted stay the same minus the
 * ones being avoided; only the exercise choices change.
 */
export function rebuildDay(
  routine: Routine,
  level: Level,
  equipment: Equipment[],
  avoid: Muscle[] = [],
  favourites: string[] = []
): Routine {
  const eq = equipment.length ? equipment : (["bodyweight"] as Equipment[]);
  const skip = new Set(avoid);
  const muscles = routine.exercises
    .map((e) => byId(e.exerciseId)?.primary)
    .filter((m): m is Muscle => Boolean(m) && !skip.has(m as Muscle));

  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  for (const m of muscles) {
    const ex = pickExercise(m, eq, used, favourites) ?? pickExercise(m, ["bodyweight"], used, favourites);
    if (!ex) continue;
    used.add(ex.id);
    exercises.push({
      exerciseId: ex.id,
      sets: LEVEL_SETS[level],
      reps: repsFor(ex, level),
      weight: startingWeight(ex, level),
    });
  }

  // Never hand back an empty day — that reads as the app being broken.
  if (exercises.length === 0) {
    for (const m of ["core", "chest", "quads"] as Muscle[]) {
      const ex = pickExercise(m, ["bodyweight"], used);
      if (!ex) continue;
      used.add(ex.id);
      exercises.push({ exerciseId: ex.id, sets: LEVEL_SETS[level], reps: repsFor(ex, level), weight: 0 });
    }
  }

  return { ...routine, exercises };
}

/**
 * How close the goal is, measured from where you started rather than from zero.
 * Starting a "200 lb deadlift" goal already lifting 150 should not read as 75%
 * done on day one — it should read as 0% of the distance you set out to cover.
 */
export function goalProgress(sessions: Session[], goal: Goal): number {
  const best = personalRecord(sessions, goal.exerciseId);
  const hist = historyFor(sessions, goal.exerciseId);
  const start = hist.length ? Math.max(0, ...hist[hist.length - 1].map((s) => s.weight)) : 0;
  if (goal.targetWeight <= start) return best >= goal.targetWeight ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((best - start) / (goal.targetWeight - start)) * 100)));
}

export const dayLabel = (d: number) => DAY_LABELS[d];
export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * How long to rest after a set.
 *
 * p22's fifth finding is that beginners struggle "without enough instruction on
 * pacing, rest periods, or modifications" — so the app should have an opinion
 * rather than leave someone guessing between sets. Compounds move more weight
 * and need longer; timed holds need least.
 *
 * It is guidance, not a deadline. Nothing in the app penalises overrunning it.
 */
export function restSeconds(exerciseId: string): number {
  const ex = byId(exerciseId);
  if (!ex) return 90;
  if (ex.increment === 0) return 60;
  return ex.compound ? 120 : 90;
}

/**
 * Fold a rebuilt day into a session that is already part-logged.
 *
 * Swapping the plan mid-session used to throw the draft away, which quietly
 * deleted sets someone had already done. Anything with a completed set is kept
 * exactly as it is; the rebuild only supplies what has not been started.
 */
export function mergeRebuild(draft: Session | undefined, rebuilt: Session): Session {
  if (!draft) return rebuilt;
  const logged = draft.exercises.filter((e) => e.sets.some((s) => s.done));
  if (logged.length === 0) return rebuilt;
  const kept = new Set(logged.map((e) => e.exerciseId));
  return {
    ...rebuilt,
    exercises: [...logged, ...rebuilt.exercises.filter((e) => !kept.has(e.exerciseId))],
  };
}

/**
 * Every exercise that trains a muscle with the kit on hand, compounds first.
 *
 * The generator picks one; the editor needs the whole list so a swap is a real
 * choice rather than a reroll. Bodyweight is always included: an empty list is
 * a dead end, and there is always something you can do with no equipment.
 */
export function alternativesFor(
  muscle: Muscle,
  equipment: Equipment[],
  exclude: string[] = [],
  favourites: string[] = []
): Exercise[] {
  const kit = new Set<Equipment>([...equipment, "bodyweight"]);
  const skip = new Set(exclude);
  const starred = new Set(favourites);
  return EXERCISES.filter((e) => e.primary === muscle && kit.has(e.equipment) && !skip.has(e.id)).sort(
    (a, b) =>
      Number(starred.has(b.id)) - Number(starred.has(a.id)) ||
      Number(b.compound) - Number(a.compound) ||
      a.name.localeCompare(b.name)
  );
}

/**
 * "Because you favourite Back Squat — try Front Squat." One suggestion per
 * starred lift: a different exercise for the same muscle, within the kit she
 * has. Nothing is suggested when there is no genuine alternative, because a
 * recommendation with nothing behind it is worse than no recommendation.
 */
export function suggestFrom(
  favourites: string[],
  equipment: Equipment[]
): { because: string; tryThis: string }[] {
  const out: { because: string; tryThis: string }[] = [];
  const seen = new Set(favourites);
  for (const id of favourites) {
    const ex = byId(id);
    if (!ex) continue;
    const alt = alternativesFor(ex.primary, equipment, [...seen]).find(Boolean);
    if (!alt) continue;
    seen.add(alt.id);
    out.push({ because: id, tryThis: alt.id });
  }
  return out;
}

/** The muscles this routine already trains, in order, for grouping the editor. */
export function musclesIn(routine: Routine): Muscle[] {
  const seen: Muscle[] = [];
  for (const e of routine.exercises) {
    const m = byId(e.exerciseId)?.primary;
    if (m && !seen.includes(m)) seen.push(m);
  }
  return seen;
}
