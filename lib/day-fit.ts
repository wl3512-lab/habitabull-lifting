import { byId } from "./exercises";
import type { Muscle, PlannedExercise, Routine } from "./types";
import type { TemplateId } from "./templates";

/*
  What a day type is for, and what to call a day that has grown past it.

  A leg day with an ab crunch on it is not a leg day any more, and pretending
  it is costs her twice: Leg day stops meaning legs everywhere else in the
  week, and the workout she actually built has no name of its own to find it
  by. So when a lift lands on a day it does not fit, the editor offers to make
  that day its own workout, with a name already written.

  The fit is wider than the muscles the generator fills a day from. A calf
  raise is not one of Leg day's generator slots and is still obviously leg
  work, and asking "save this as Legs and calves?" about it would be the app
  not knowing what a leg is. Full body fits everything by definition.
*/

type Group = Muscle | "cardio";

const FITS: Record<TemplateId, Group[] | "anything"> = {
  "full-body": "anything",
  push: ["chest", "shoulders", "arms"],
  // Rear delts and face pulls are pull work, filed under shoulders.
  pull: ["back", "hamstrings", "arms", "shoulders"],
  legs: ["quads", "hamstrings", "glutes", "calves"],
  lower: ["quads", "hamstrings", "glutes", "calves"],
  upper: ["chest", "back", "shoulders", "arms", "core"],
  cardio: ["cardio"],
};

/* How each group is said in a workout's name. Four leg muscles are one word. */
const WORD: Record<Group, string> = {
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  core: "abs",
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  arms: "arms",
  cardio: "cardio",
};

/* The day type as the first word of the new name: "Legs and abs", not "Leg day and abs". */
const BASE: Record<TemplateId, string> = {
  "full-body": "Full body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  lower: "Lower body",
  upper: "Upper body",
  cardio: "Cardio",
};

function groupOf(exerciseId: string): Group | null {
  const e = byId(exerciseId);
  if (!e) return null;
  return e.cardio ? "cardio" : e.primary;
}

/**
 * The lifts on a day that its type does not cover, in the order they sit.
 * A lift the library cannot resolve is left out rather than guessed at.
 */
export function offType(template: TemplateId | undefined, exercises: PlannedExercise[]): string[] {
  const fits = FITS[template ?? "full-body"];
  if (fits === "anything") return [];
  return exercises
    .map((e) => e.exerciseId)
    .filter((id) => {
      const g = groupOf(id);
      return g !== null && !fits.includes(g);
    });
}

/**
 * A first name for a day that has grown past its type: "Legs and abs",
 * "Push, abs and legs". It is a starting point she can type over, and the
 * one the model's suggestion replaces when it can be reached.
 */
export function mixedName(template: TemplateId | undefined, offIds: string[]): string {
  const base = BASE[template ?? "full-body"];
  const words: string[] = [];
  for (const id of offIds) {
    const g = groupOf(id);
    if (!g) continue;
    const w = WORD[g];
    if (w !== base.toLowerCase() && !words.includes(w)) words.push(w);
  }
  const extra = words.slice(0, 3);
  if (!extra.length) return base;
  if (extra.length === 1) return `${base} and ${extra[0]}`;
  return `${base}, ${extra.slice(0, -1).join(", ")} and ${extra[extra.length - 1]}`;
}

/**
 * Which days in a week are the same workout as this one, itself included.
 *
 * A day linked to a saved workout is the same as every day linked to that
 * workout. Otherwise days of the same type with the same name are: Monday's
 * and Thursday's "Leg day" are one leg day, so a lift added to one belongs on
 * both. "Full body A" and "Full body B" share a type and are deliberately two
 * different workouts, which is why the name is part of it.
 */
export function sameWorkoutDays(days: Routine[], index: number): number[] {
  const me = days[index];
  if (!me) return [];
  const same = (r: Routine) =>
    me.workoutId
      ? r.workoutId === me.workoutId
      : !r.workoutId && (r.template ?? "full-body") === (me.template ?? "full-body") && r.label === me.label;
  return days.flatMap((r, i) => (same(r) ? [i] : []));
}
