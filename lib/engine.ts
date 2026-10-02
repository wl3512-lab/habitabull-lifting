import { attended } from "./attendance";
import { allExercises, byId } from "./exercises";
import { templateOf, defaultTemplates, type TemplateId } from "./templates";
import type { Equipment, Exercise, Goal, Level, Muscle, PlannedExercise, Routine, Session, RestPref } from "./types";

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

export const LEVEL_SETS: Record<Level, number> = { new: 3, returning: 3, experienced: 4 };
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
  // Seconds, for anything you hold. A machine crunch is a rep like any other.
  if (ex.hold) return 30;
  /*
    Minutes, for anything you do continuously. It used to fall through to the
    rep branch and come out as `LEVEL_REPS + 4`, so a treadmill was prescribed
    nine minutes because a cable fly gets nine reps: a number arrived at by
    accident and only coincidentally in the right units.

    Twenty, for every level. Duration is the one variable here the app does
    not manage — it says "go a little longer" and leaves the amount to the
    person on the machine — so this is a starting point to adjust, not a
    progression to climb, and it does not need three of them.
  */
  if (ex.cardio) return 20;
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

/**
 * Pick the best available exercise for a muscle given the user's equipment.
 *
 * `variant` rotates through the candidates instead of always taking the best.
 * It exists for one slot: every template in the app ends in core, and this
 * function is deterministic, so the same core lift was landing on every day of
 * every week. Somebody on a four-day plan got a plank four times and asked,
 * reasonably, why it was on every day.
 *
 * It is not used anywhere else on purpose. Everywhere else the first candidate
 * is first because it is the right answer — rotating a novice off a back squat
 * onto a bodyweight squat for variety's sake would be the generator choosing
 * novelty over the lift that carries the session.
 */
export function pickExercise(
  muscle: Muscle,
  equipment: Equipment[],
  exclude: Set<string>,
  favourites: string[] = [],
  variant = 0
): Exercise | null {
  const usable = allExercises().filter(
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
  return usable[((variant % usable.length) + usable.length) % usable.length];
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
  templates?: TemplateId[],
  /**
   * Which full-body variant a given day gets, by day number. Absent, the
   * variant is the day's position in the week, which alternates A/B across a
   * fresh week and is wrong the moment a day is inserted into an existing one:
   * see `reconcileWeek`, which is the caller that sets this.
   */
  variants?: Record<number, number>
): Routine[] {
  const days = [...new Set(trainingDays)].sort((a, b) => a - b);
  if (days.length === 0) return [];
  const eq = equipment.length ? equipment : (["bodyweight"] as Equipment[]);
  const chosen = templates?.length ? templates : defaultTemplates(days.length);
  return days.map((day, i) => {
    const tpl = templateOf(chosen[i % chosen.length]);
    const slot = variants?.[day] ?? i;
    // Full body still alternates its slots so two sessions are never identical;
    // a named day is the same shape every time, which is the point of naming it.
    const muscles =
      tpl.id === "full-body" ? FULL_BODY[slot % FULL_BODY.length] : tpl.muscles;
    const circuit = tpl.style === "circuit";
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];

    /*
      A template that names its lifts skips the picker entirely: the first one
      her kit allows, and nothing else on the day. Cardio is the only one, and
      it is one lift on purpose — a treadmill for twenty minutes is a session,
      and offering four machines beside it is a decision nobody wanted to make
      before a run.
    */
    const named = tpl.lifts
      ?.map((id) => byId(id))
      .filter((ex): ex is Exercise => Boolean(ex));
    const fixed = named?.find((ex) => eq.includes(ex.equipment)) ?? named?.at(-1);
    if (fixed) {
      return {
        day,
        label: tpl.label,
        template: tpl.id,
        exercises: [
          {
            exerciseId: fixed.id,
            // One set, because that is what continuous work is.
            sets: 1,
            reps: repsFor(fixed, level),
            // Flat to start. The incline is hers to raise.
            weight: 0,
          },
        ],
      };
    }

    for (const m of muscles) {
      // A circuit wants things you can start immediately, so bodyweight first.
      // Core rotates by day so the week is not the same plank five times over.
      const v = m === "core" ? slot : 0;
      const ex = circuit
        ? pickExercise(m, ["bodyweight"], used, favourites, v) ??
          pickExercise(m, eq, used, favourites, v)
        : pickExercise(m, eq, used, favourites, v) ??
          pickExercise(m, ["bodyweight"], used, favourites, v);
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
      tpl.id === "full-body" ? SESSION_LABELS[slot % SESSION_LABELS.length] : tpl.label;
    return { day, label, template: tpl.id, exercises };
  });
}

/**
 * Every logged set for an exercise, newest session first.
 *
 * A set she logged is a fact, and it counts whether or not she ever pressed
 * Finish. This used to require `completedAt`, which only the Finish button
 * writes — and the button most sessions actually end on is End, at the top of
 * the log screen, which does not. So the ordinary gym session (log four lifts,
 * put the phone away, tap End) was invisible here: "Last time" kept quoting a
 * session from days ago, and the next day's targets came back off that older
 * session too, because this is what feeds them.
 *
 * A session she opened and never lifted in still contributes nothing, and that
 * is the distinction that matters: the filter below drops any session with no
 * completed set of this lift in it. What is dropped is emptiness, not
 * unfinished-ness.
 *
 * `completedAt` still means finished, and the "that is the whole job" line is
 * about finishing a workout. The streak, the calendar and the sessions count
 * are about turning up, which is `attended`; this is about what she lifted.
 */
export function historyFor(sessions: Session[], exerciseId: string) {
  // Copied before sorting. `filter` used to hand this a fresh array; without
  // that, `sort` reorders the caller's own sessions in place, which is React
  // state everywhere this is called from.
  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => s.exercises.filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets.filter((set) => set.done)))
    .filter((sets) => sets.length > 0);
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
  /*
    Cardio is one set, and that is not a preference — it is what the type says
    and what `import.ts` has always clamped an imported plan to. The engine
    was the one path that never asked, so a bike added to a day came back as
    four blocks of nine minutes with a rest timer between each, which is not a
    thing anybody does. Everything else keeps the level's set count; a plank
    held three or four times is exactly right.
  */
  const sets = ex.cardio ? 1 : LEVEL_SETS[level];
  const hist = historyFor(sessions, exerciseId);

  if (hist.length === 0) {
    return { weight: startingWeight(ex, level), reps: targetReps, sets, note: "First time. Start light and learn the movement." };
  }

  const last = hist[0];
  const lastWeight = last.length ? Math.max(...last.map((s) => s.weight)) : startingWeight(ex, level);

  /*
    Cardio carries its incline and nothing else.

    That field holds a percent rather than a load here, so none of the
    progression below applies to it: there is no increment to add, and cutting
    it ten percent on a rough week would be the app deciding how steep her
    treadmill is. But resetting it to flat every session is the other wrong
    answer, and it was the one in place — she set 5% on Monday and found 0% on
    Wednesday, from an app whose whole claim is that it remembers.

    So it holds. Duration is hers to move and so is the incline; what the app
    owes her is not making her set it twice.
  */
  if (ex.cardio) {
    return {
      weight: lastWeight,
      reps: targetReps,
      sets,
      note: "Same as last time. Change the time or the incline if you want to.",
    };
  }
  const clearedAll = last.length >= sets && last.every((s) => s.reps >= targetReps);

  if (clearedAll) {
    const weight = ex.increment === 0 ? 0 : roundToIncrement(lastWeight + ex.increment, ex.increment);
    /*
      What "more" means depends on what the lift is counted in. A bike is
      logged in minutes and a plank in seconds, and both were being told to
      add two reps. No number here where the app is not the one setting it:
      on a lift it cannot load, going longer is the user's call.
    */
    const more = ex.cardio || ex.hold ? "Go a little longer this time." : "Add two reps this time.";
    return { weight, reps: targetReps, sets, note: ex.increment === 0 ? more : `Up ${ex.increment} lb. You earned it.` };
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

/**
 * Heaviest logged set ever, per exercise.
 *
 * Counts a set from a session she ended rather than finished, for the same
 * reason `historyFor` does, and it has to agree with it: if "last time" says
 * 150 and the best on record says 145, the next 150 gets celebrated as a
 * personal record she had already set.
 */
export function personalRecord(sessions: Session[], exerciseId: string): number {
  let pr = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const set of e.sets) if (set.done && set.weight > pr) pr = set.weight;
    }
  }
  return pr;
}

/**
 * Consecutive-week streak: a week counts if she went at least once in it,
 * finished or not (`attended`). Weeks, not days, because a 4-day-a-week lifter
 * should never see a broken streak for resting on Tuesday. The deck's whole
 * thesis is that guilt loses, and a week she trained in but stopped early is
 * not one to take off her.
 */
export function streakWeeks(sessions: Session[], today = new Date()): number {
  const done = sessions.filter(attended);
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
 * The best of a lift's completed sets.
 *
 * Heaviest first, most reps only to break a tie, which is how a lifter reads
 * their own history: 135 x 5 is the better set than 95 x 10.
 *
 * Ranking by weight x reps says otherwise — 950 beats 675 — and worse, it is
 * blind to every lift with no weight on it. Push-ups, planks and cardio all
 * store weight 0, so every product is 0, the comparison is never true and the
 * reduce returns whichever set happened to be first. That was the "last time"
 * bug, and the same line had been written again in Progress, where it picked
 * the points the graph plots. One definition now, so the screens agree and
 * there is one place to be right.
 */
export function topSet<T extends { weight: number; reps: number }>(sets: T[]): T | undefined {
  if (sets.length === 0) return undefined;
  return sets.reduce((a, b) =>
    b.weight !== a.weight ? (b.weight > a.weight ? b : a) : b.reps > a.reps ? b : a
  );
}

/**
 * How many sets and reps a planned lift is actually done for.
 *
 * Her plan sets the shape; history sets the load. The rule is small and it has
 * now been got wrong twice in two different files, so it lives in one place:
 * `buildSession` builds the real session from it and Today previews the same
 * numbers, which is the only way the screen that says what today is can agree
 * with the session it starts.
 *
 * A zero, a fraction or a missing value falls back to the engine's own answer
 * rather than producing a lift with no sets in it.
 *
 * The fallback was written as `Math.max(1, Math.round(n)) || target`, which
 * reads right and cannot happen: `Math.max(1, …)` is never 0, so `||` never
 * fires and a malformed lift became one set rather than a sensible default.
 * Nothing the app writes has a zero in it, but an imported plan can, and one
 * set of bench because a file said `"sets": 0` is a silent wrong answer.
 */
export function plannedShape(
  planned: { sets: number; reps: number },
  target: { sets: number; reps: number }
): { sets: number; reps: number } {
  const use = (n: number, fallback: number) => {
    const r = Math.round(n);
    return Number.isFinite(r) && r >= 1 ? r : fallback;
  };
  return {
    sets: use(planned.sets, target.sets),
    reps: use(planned.reps, target.reps),
  };
}

/** Best completed set from the latest session that actually logged this lift. */
export function lastCompletedSet(sessions: Session[], exerciseId: string) {
  return topSet(historyFor(sessions, exerciseId)[0] ?? []);
}

/** Repeat last time's weight/reps together; a plan controls the set count. */
export function sessionTarget(
  exerciseId: string,
  sessions: Session[],
  level: Level,
  planned?: { sets: number; reps: number }
) {
  const fallback = nextTarget(exerciseId, [], level);
  const shape = planned ? plannedShape(planned, fallback) : fallback;
  const last = lastCompletedSet(sessions, exerciseId);
  return { sets: shape.sets, weight: last?.weight ?? fallback.weight, reps: last?.reps ?? shape.reps };
}

export function buildSession(routine: Routine, sessions: Session[], level: Level, date: string): Session {
  // "Last time" has to mean a different day than the one being built. Since a
  // session counts as history from the first set she logs in it, a day being
  // rebuilt mid-workout would otherwise read its own sets back as the evidence
  // for what it should hold.
  const before = sessions.filter((s) => s.date !== date);
  return {
    date,
    label: routine.label,
    exercises: routine.exercises.map((p) => {
      const { sets, weight, reps } = sessionTarget(p.exerciseId, before, level, p);
      return {
        exerciseId: p.exerciseId,
        sets: Array.from({ length: sets }, () => ({ weight, reps, done: false })),
      };
    }),
  };
}

/**
 * Carry a finished day's lineup back onto its routine.
 *
 * buildSession takes a day's exercise *list* from the routine, so the next time
 * that day comes up it rebuilds from the original template and any lift you
 * added or dropped last time is forgotten. Writing the lineup you actually
 * trained back onto the matching routine (matched by weekday and label)
 * makes your workout return instead. Set defaults come from completed history
 * when the next session is built.
 *
 * Three exemptions: a one-off "something hurts" rebuild (`adapted`) changes
 * only today and must not overwrite the plan, a quick workout improvised lift
 * by lift (`freestyle`) is not a redefinition of the day it happened to fall
 * on, and an empty session never blanks a routine.
 */
export function rememberLineup(routines: Routine[], session: Session): Routine[] {
  if (session.adapted || session.freestyle || session.exercises.length === 0) return routines;
  const day = new Date(`${session.date}T00:00:00`).getDay();
  return routines.map((r) =>
    r.day === day && r.label === session.label
      ? {
          ...r,
          exercises: session.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.length,
            reps:
              e.sets[0]?.reps ??
              r.exercises.find((p) => p.exerciseId === e.exerciseId)?.reps ??
              10,
            weight: e.sets[0]?.weight ?? 0,
          })),
        }
      : r
  );
}

/**
 * Remember the user's version of each named day type, keyed by template. Called
 * whenever routines change, so pressing "Leg day" later brings back the leg day
 * they actually shaped, not the generated default. Full-body is skipped: it is
 * meant to vary slot to slot.
 */
export function mergeDayLibrary(
  library: Record<string, PlannedExercise[]> = {},
  routines: Routine[]
): Record<string, PlannedExercise[]> {
  const next = { ...library };
  for (const r of routines) {
    if (r.template && r.template !== "full-body" && r.exercises.length) {
      next[r.template] = r.exercises;
    }
  }
  return next;
}

/**
 * When days are generated from templates, swap in the user's saved version of
 * any day type they have shaped before, so a rebuilt week keeps their days.
 */
/** Which full-body variant a stored day is, read back off its label. */
function fullBodyVariant(r: Routine): number | null {
  if (r.template !== "full-body") return null;
  const i = SESSION_LABELS.indexOf(r.label);
  return i === -1 ? null : i;
}

/**
 * The week after the set of training days changes.
 *
 * Editing which days you train must not touch the days you kept. This used to
 * rebuild the whole week from scratch, which is how adding a Tuesday turned
 * Push/Pull/Legs into four full-body days. Carrying the day types across by
 * day number fixed that and left a quieter version of the same bug: the
 * full-body variant was still assigned by position, so the same Tuesday turned
 * a "Full body B" Wednesday into "Full body A" with different lifts. Nobody
 * touched Wednesday.
 *
 * So a day that is still trained is kept exactly as it was: label, lifts,
 * sets, weights. Only a new day is generated, as full body, which is what the
 * picker recommends, and it takes the variant its nearest anchored full-body
 * neighbour does not have, so the week still alternates. A saved shape for
 * that day type (the library) is applied to new days only, since the kept
 * days already carry theirs.
 *
 * The remaining case was a day that *moves*. Training Mon/Tue/Fri as
 * push/pull/legs and shifting Tuesday to Wednesday read as one deletion and
 * one unrelated insertion, so the pull day was thrown away and Wednesday came
 * back as a generic full-body day — silently, having been asked only to change
 * a date. Somebody moving a session around their week is not asking for a
 * different session.
 *
 * A day that leaves and a day that arrives in the same edit are paired in
 * order and treated as one day moving, carrying label, lifts, sets and weights
 * to the new date. Uneven edits fall back to the old meaning: with more
 * departures than arrivals the extras are genuinely dropped, and with more
 * arrivals than departures the extras are genuinely new.
 */
export function reconcileWeek(
  existing: Routine[],
  trainingDays: number[],
  level: Level,
  equipment: Equipment[],
  favourites: string[] = [],
  library: Record<string, PlannedExercise[]> = {}
): Routine[] {
  const days = [...new Set(trainingDays)].sort((a, b) => a - b);
  const kept = existing.filter((r) => days.includes(r.day));
  const arrived = days.filter((d) => !kept.some((r) => r.day === d));
  const departed = existing
    .filter((r) => !days.includes(r.day))
    .sort((a, b) => a.day - b.day);

  // One out and one in is a move. Paired in order, so shifting a whole week
  // forward a day moves each session rather than rebuilding all of them.
  const moves = Math.min(departed.length, arrived.length);
  const moved = departed.slice(0, moves).map((r, i) => ({ ...r, day: arrived[i] }));
  const fresh = arrived.slice(moves);

  // A moved day is as settled as a kept one, so it anchors the alternation too.
  const anchored = [...kept, ...moved];

  const variants: Record<number, number> = {};
  for (const day of fresh) {
    // Nearest anchored full-body day, earlier one on a tie.
    let near: Routine | null = null;
    for (const r of anchored) {
      if (fullBodyVariant(r) === null) continue;
      if (!near || Math.abs(r.day - day) < Math.abs(near.day - day)) near = r;
    }
    if (near) variants[day] = 1 - (fullBodyVariant(near) as number);
  }

  /*
    A day she has just added is a new day, so it arrives the way every other
    new day does: named, empty, and one tap from being filled. Her own version
    of a day type still overlays on top, which is the whole job of the library
    and the one case where the lifts are hers rather than the app's.
  */
  const made = overlayDayLibrary(
    unfilled(
      generateRoutine(
        level,
        fresh,
        equipment,
        favourites,
        fresh.map(() => "full-body" as TemplateId),
        variants
      )
    ),
    library
  );
  return [...anchored, ...made].sort((a, b) => a.day - b.day);
}

/**
 * The same week, with the lifts left to her.
 *
 * A generated day answers two questions at once: what kind of day this is, and
 * which lifts are on it. The first is the app doing its job (a beginner has no
 * basis to design a split, and ACSM is blunt that turning up twice a week
 * matters more than the shape). The second is the app answering a question it
 * was not asked, in a way that reads as settled: handed five lifts, the person
 * least able to judge them is the most likely to accept them.
 *
 * So the week arrives as days with names and nothing on them, and "Autofill
 * for me" in the editor puts this exact lineup back for anyone who wants the
 * app to decide. Same generator, same answer; the difference is that she asked
 * for it.
 */
export function unfilled(routines: Routine[]): Routine[] {
  return routines.map((r) => ({ ...r, exercises: [] }));
}

export function overlayDayLibrary(
  routines: Routine[],
  library: Record<string, PlannedExercise[]> = {}
): Routine[] {
  return routines.map((r) =>
    r.template && r.template !== "full-body" && library[r.template]?.length
      ? { ...r, exercises: library[r.template] }
      : r
  );
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
 * What the three old pace words are worth in seconds.
 *
 * Only ever read for a profile saved before rest was a number. The values are
 * the middle of what each pace used to produce, so nobody's rest changes
 * noticeably on the update: short ran 40-80, standard 60-120, long 90-180.
 */
const PREF_SECONDS: Record<RestPref, number> = { short: 60, standard: 90, long: 150 };

/** The presets offered at signup and in the profile. Any number is allowed. */
export const REST_CHOICES = [45, 60, 90, 120, 180] as const;

/** The default before anyone has chosen, and the middle of the ramp. */
export const REST_DEFAULT = 90;

/** The shortest and longest the stepper will go, and its step. */
export const REST_MIN = 15;
export const REST_MAX = 300;
export const REST_STEP = 15;

/**
 * How long to rest after a set.
 *
 * p22's fifth finding is that beginners struggle "without enough instruction on
 * pacing, rest periods, or modifications", so the app still has an opinion —
 * it is the default, and it is 90 seconds.
 *
 * It no longer has an opinion per lift. Scaling the number by whether the lift
 * was a compound was defensible and invisible: the setting says a duration, so
 * the duration is what it has to be. Somebody who wants longer on squats than
 * on curls can change it, which is now possible from the profile rather than
 * only at signup.
 *
 * It is guidance, not a deadline. Nothing in the app penalises overrunning it.
 */
export function restSeconds(profile: { restSec?: number; restPref?: RestPref }): number {
  if (typeof profile.restSec === "number" && Number.isFinite(profile.restSec)) {
    return Math.min(REST_MAX, Math.max(REST_MIN, Math.round(profile.restSec)));
  }
  return PREF_SECONDS[profile.restPref ?? "standard"];
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
    /*
      What already happened to this day survives being rebuilt.

      `rebuilt` is a fresh `buildSession`, so it carries no timestamps and no
      note — and spreading it last meant swapping the plan after finishing a
      workout silently dropped `completedAt`. The sets were all still there, so
      nothing looked lost in storage, but the day stopped counting as trained:
      gone from the calendar, out of the streak, out of the progress graph,
      while the crew had already been told she trained. That is what "my
      sessions did not save" looked like from the outside.

      Reopening a finished day is a real thing she can do — adding a lift to it
      does exactly that, deliberately and in one place. Changing the equipment
      for a day she has already done is not that.
    */
    startedAt: draft.startedAt ?? rebuilt.startedAt,
    completedAt: draft.completedAt ?? rebuilt.completedAt,
    note: draft.note ?? rebuilt.note,
    exercises: [...logged, ...rebuilt.exercises.filter((e) => !kept.has(e.exerciseId))],
  };
}

/** Whether two plans for a day are the same workout: same name, same shape. */
export function samePlan(a: Routine | null | undefined, b: Routine | null | undefined): boolean {
  if (!a || !b) return a === b || (!a && !b);
  return (
    a.label === b.label &&
    a.exercises.length === b.exercises.length &&
    a.exercises.every(
      (e, i) =>
        e.exerciseId === b.exercises[i].exerciseId &&
        e.sets === b.exercises[i].sets &&
        e.reps === b.exercises[i].reps
    )
  );
}

/**
 * Today's session, caught up with a plan that just changed underneath it.
 *
 * The home screen reads today off the open session the moment one exists,
 * because a temporary swap has to show without being written back into the
 * plan. The cost was that the opposite edit stopped showing at all: change
 * Saturday's workout in the editor while Saturday is already open — started
 * this morning and left, or adapted around a sore shoulder — and Today's lifts
 * and the Start button both went on listing the old ones, with no way to get
 * the new ones short of finishing or abandoning the day. That is what "saving
 * a workout does not update" was.
 *
 * So the open day is rebuilt from the new plan, and `mergeRebuild` keeps
 * whatever she already logged exactly where it is. Three days are left alone:
 * one already finished (a fact, not a plan), a quick workout (never the plan in
 * the first place), and a plan that did not actually change — that last one
 * matters, because rebuilding regardless would reset a weight she had just
 * dialled in on the log screen.
 */
export function refreshOpenDay(
  sessions: Session[],
  before: Routine | null | undefined,
  after: Routine | null | undefined,
  level: Level,
  date: string
): Session[] {
  if (!after || samePlan(before, after)) return sessions;
  const open = sessions.find((s) => s.date === date);
  if (!open || open.completedAt || open.freestyle) return sessions;
  const rebuilt = mergeRebuild(open, buildSession(after, sessions, level, date));
  return sessions.map((s) =>
    s.date === date
      ? {
          ...rebuilt,
          // mergeRebuild only carries these across when something was logged;
          // a day opened and not yet lifted in is still a day she opened.
          startedAt: open.startedAt,
          // Whatever this day was working around, she has just said in as many
          // words what it should be instead.
          adapted: undefined,
        }
      : s
  );
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
  return allExercises().filter((e) => e.primary === muscle && kit.has(e.equipment) && !skip.has(e.id)).sort(
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
