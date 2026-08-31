import type { Equipment, Muscle } from "./types";

/**
 * The structured output the model is allowed to produce. Nothing here is a
 * number the rules engine cares about — no sets, reps, load or progression.
 * The model proposes constraints; the engine decides.
 */
export interface Constraints {
  equipment: Equipment[];
  avoid: Muscle[];
  /** Where this came from, so the UI can be honest about it. */
  source: "ai" | "local";
  note?: string;
}

export const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "bodyweight", "kettlebell"];
export const MUSCLES: Muscle[] = [
  "quads",
  "hamstrings",
  "glutes",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
];

export function isEquipment(v: unknown): v is Equipment {
  return typeof v === "string" && (EQUIPMENT as string[]).includes(v);
}

export function isMuscle(v: unknown): v is Muscle {
  return typeof v === "string" && (MUSCLES as string[]).includes(v);
}

/** Keep only values inside the allowed enums. Anything else is dropped. */
export function sanitize(raw: unknown): { equipment: Equipment[]; avoid: Muscle[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const equipment = Array.isArray(o.equipment) ? [...new Set(o.equipment.filter(isEquipment))] : [];
  const avoid = Array.isArray(o.avoid) ? [...new Set(o.avoid.filter(isMuscle))] : [];
  if (equipment.length === 0 && avoid.length === 0) return null;
  return { equipment, avoid };
}

const EQUIPMENT_WORDS: [RegExp, Equipment][] = [
  [/\b(barbell|bar\b|squat rack|power rack|bench press)/i, "barbell"],
  [/\b(dumbbell|db\b|dumbell|free weights?)/i, "dumbbell"],
  [/\b(machine|cable|smith|pulldown|leg press)/i, "machine"],
  [/\b(kettlebell|kb\b)/i, "kettlebell"],
  [/\b(bodyweight|body weight|no equipment|nothing|home|hotel|travell?ing|park)/i, "bodyweight"],
];

const MUSCLE_WORDS: [RegExp, Muscle[]][] = [
  [/\b(shoulder|delt|rotator)/i, ["shoulders"]],
  [/\b(knee|quad)/i, ["quads"]],
  [/\b(hamstring|ham\b)/i, ["hamstrings"]],
  [/\b(glute|butt|hip)/i, ["glutes"]],
  [/\b(chest|pec)/i, ["chest"]],
  [/\b(back|lat|spine|lower back)/i, ["back"]],
  [/\b(arm|bicep|tricep|elbow|wrist)/i, ["arms"]],
  [/\b(core|abs|ab\b|stomach)/i, ["core"]],
];

const HURT = /\b(hurt|hurts|sore|tweak|tweaked|injur|pain|painful|bad|strain|pulled|no\b|skip|avoid|without)/i;

/**
 * Offline parser. Deliberately keyword-based and dumb — its job is to keep the
 * app fully usable with zero AI, which is a hard requirement, not a nicety.
 */
export function parseLocally(text: string): Constraints {
  const equipment = EQUIPMENT_WORDS.filter(([re]) => re.test(text)).map(([, e]) => e);

  const avoid: Muscle[] = [];
  for (const [re, muscles] of MUSCLE_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    // Only treat a body part as "avoid" if it's near a complaint word.
    const window = text.slice(Math.max(0, m.index - 40), m.index + 40);
    if (HURT.test(window)) avoid.push(...muscles);
  }

  return {
    equipment: [...new Set(equipment)],
    avoid: [...new Set(avoid)],
    source: "local",
  };
}

/** Plain-English summary of what was understood, shown back to the user. */
export function describe(c: Constraints): string {
  const parts: string[] = [];
  if (c.equipment.length) parts.push(`using ${c.equipment.join(", ")}`);
  if (c.avoid.length) parts.push(`working around ${c.avoid.join(", ")}`);
  if (parts.length === 0) return "Nothing to change — keeping your usual plan.";
  return `Rebuilt ${parts.join(", ")}.`;
}
