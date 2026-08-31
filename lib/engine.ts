import { EXERCISES, byId } from "./exercises";
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
const LEVEL_REPS: Record<Level, number> = { new: 10, returning: 8, experienced: 6 };

/** Muscle focus per session slot, cycled so consecutive days don't collide. */
const SPLITS: Record<number, Muscle[][]> = {
  1: [["quads", "chest", "back", "core"]],
  2: [["quads", "hamstrings", "core"], ["chest", "back", "shoulders"]],
  3: [["quads", "glutes", "core"], ["chest", "shoulders", "arms"], ["back", "hamstrings", "core"]],
  4: [["quads", "glutes"], ["chest", "shoulders"], ["back", "arms"], ["hamstrings", "core"]],
  5: [["quads", "glutes"], ["chest", "arms"], ["back", "core"], ["hamstrings", "glutes"], ["shoulders", "arms"]],
  6: [["quads"], ["chest", "arms"], ["back"], ["hamstrings", "glutes"], ["shoulders"], ["core", "glutes"]],
  7: [["quads"], ["chest"], ["back"], ["hamstrings"], ["shoulders", "arms"], ["glutes"], ["core"]],
};

export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return 0;
  return Math.max(increment, Math.round(weight / increment) * increment);
}

/** Pick the best available exercise for a muscle given the user's equipment. */
export function pickExercise(muscle: Muscle, equipment: Equipment[], exclude: Set<string>): Exercise | null {
  const usable = EXERCISES.filter(
    (e) => e.primary === muscle && equipment.includes(e.equipment) && !exclude.has(e.id)
  );
  if (usable.length === 0) return null;
  // Prefer compounds: they carry the session and progress most reliably.
  usable.sort((a, b) => Number(b.compound) - Number(a.compound));
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
export function generateRoutine(level: Level, trainingDays: number[], equipment: Equipment[]): Routine[] {
  const days = [...new Set(trainingDays)].sort((a, b) => a - b);
  if (days.length === 0) return [];
  const eq = equipment.length ? equipment : (["bodyweight"] as Equipment[]);
  const split = SPLITS[Math.min(days.length, 7)] ?? SPLITS[3];

  return days.map((day, i) => {
    const muscles = split[i % split.length];
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const m of muscles) {
      const ex = pickExercise(m, eq, used) ?? pickExercise(m, ["bodyweight"], used);
      if (!ex) continue;
      used.add(ex.id);
      exercises.push({
        exerciseId: ex.id,
        sets: LEVEL_SETS[level],
        reps: ex.primary === "core" ? 30 : LEVEL_REPS[level],
        weight: startingWeight(ex, level),
      });
    }
    return { day, label: DAY_LABELS[day], exercises };
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

  const targetReps = ex.primary === "core" ? 30 : LEVEL_REPS[level];
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
  avoid: Muscle[] = []
): Routine {
  const eq = equipment.length ? equipment : (["bodyweight"] as Equipment[]);
  const skip = new Set(avoid);
  const muscles = routine.exercises
    .map((e) => byId(e.exerciseId)?.primary)
    .filter((m): m is Muscle => Boolean(m) && !skip.has(m as Muscle));

  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  for (const m of muscles) {
    const ex = pickExercise(m, eq, used) ?? pickExercise(m, ["bodyweight"], used);
    if (!ex) continue;
    used.add(ex.id);
    exercises.push({
      exerciseId: ex.id,
      sets: LEVEL_SETS[level],
      reps: ex.primary === "core" ? 30 : LEVEL_REPS[level],
      weight: startingWeight(ex, level),
    });
  }

  // Never hand back an empty day — that reads as the app being broken.
  if (exercises.length === 0) {
    for (const m of ["core", "chest", "quads"] as Muscle[]) {
      const ex = pickExercise(m, ["bodyweight"], used);
      if (!ex) continue;
      used.add(ex.id);
      exercises.push({ exerciseId: ex.id, sets: LEVEL_SETS[level], reps: m === "core" ? 30 : LEVEL_REPS[level], weight: 0 });
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
