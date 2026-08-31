import type { Muscle } from "./types";

/**
 * Named day types, so a week can be planned in the language people use.
 *
 * "Leg day" and "push day" are how lifters talk, and a plan you can name is a
 * plan you can hold in your head. The app used to decide this silently and give
 * everyone Full body A/B; that is still the right default and it is still what
 * you get if you never touch this, but it should not be the only answer.
 *
 * Full body stays first and stays recommended. ACSM's 2026 update puts novices
 * on full-body work across non-consecutive days because training every group
 * twice a week matters more than the split — a three-day push/pull/legs week
 * touches each group once. The app says so where the choice is made, once,
 * without preventing it. Somebody who wants leg day should get leg day.
 */

export type TemplateId =
  | "full-body"
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "cardio";

export interface DayTemplate {
  id: TemplateId;
  label: string;
  hint: string;
  /** Slots, filled in order. A muscle can repeat; the picker won't reuse a lift. */
  muscles: Muscle[];
  /** Circuits run lighter and longer, and prefer what needs no setup. */
  style: "strength" | "circuit";
  /** True for the shape the guidance actually recommends for a novice. */
  recommended?: boolean;
}

export const TEMPLATES: DayTemplate[] = [
  {
    id: "full-body",
    label: "Full body",
    hint: "A bit of everything — the one that works on three days a week",
    muscles: ["quads", "hamstrings", "chest", "back", "core"],
    style: "strength",
    recommended: true,
  },
  {
    id: "push",
    label: "Push day",
    hint: "Chest, shoulders, triceps",
    muscles: ["chest", "shoulders", "arms", "chest", "core"],
    style: "strength",
  },
  {
    id: "pull",
    label: "Pull day",
    hint: "Back, biceps, hamstrings",
    muscles: ["back", "hamstrings", "back", "arms", "core"],
    style: "strength",
  },
  {
    id: "legs",
    label: "Leg day",
    hint: "Quads, hamstrings, glutes",
    muscles: ["quads", "hamstrings", "glutes", "quads", "core"],
    style: "strength",
  },
  {
    id: "upper",
    label: "Upper body",
    hint: "Everything above the hips",
    muscles: ["chest", "back", "shoulders", "arms", "core"],
    style: "strength",
  },
  {
    id: "lower",
    label: "Lower body",
    hint: "Everything below them",
    muscles: ["quads", "hamstrings", "glutes", "core"],
    style: "strength",
  },
  {
    id: "cardio",
    label: "Cardio",
    hint: "A circuit — high reps, short rests, nothing to set up",
    muscles: ["glutes", "quads", "chest", "core"],
    style: "circuit",
  },
];

export const templateOf = (id: TemplateId): DayTemplate =>
  TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/**
 * The default week: full body, alternating so consecutive sessions differ.
 * B is the same shape with the slots rotated, not a different philosophy.
 */
export function defaultTemplates(dayCount: number): TemplateId[] {
  return Array.from({ length: dayCount }, () => "full-body" as TemplateId);
}

/**
 * Whether a week of chosen templates trains everything at least twice.
 *
 * Not a blocker — it drives one honest line under the picker. Somebody running
 * push/pull/legs three days a week should know each group gets trained once,
 * and then decide for themselves.
 */
export function coversTwiceWeekly(ids: TemplateId[]): boolean {
  const counts = new Map<Muscle, number>();
  for (const id of ids) {
    for (const m of new Set(templateOf(id).muscles)) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  const major: Muscle[] = ["quads", "chest", "back"];
  return major.every((m) => (counts.get(m) ?? 0) >= 2);
}
