import { nameOf } from "./exercises";
import { count } from "./plural";
import { anchorOf, type Anchor } from "./schedule";
import type { Equipment, Level, Routine, WeighIn } from "./types";

/**
 * What each Profile row says while it is closed.
 *
 * Profile used to lay every setting out in full, which made it 3,241px on a
 * real history: Rest was three screens down. Now each setting is one row with
 * its current value, and these are those values. They live here, not in the
 * component, so they are tested and so the labels are written once.
 */

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "new", label: "New to this", hint: "Fewer sets, lighter starts, full body days." },
  { id: "returning", label: "Coming back", hint: "You have lifted before and stopped." },
  { id: "experienced", label: "Experienced", hint: "More sets, and the app assumes less." },
];

/** In the order the chips are drawn, which is also the order the line names them. */
export const EQUIPMENT_LABELS: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Barbells" },
  { id: "dumbbell", label: "Dumbbells" },
  { id: "machine", label: "Machines" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "bodyweight", label: "Bodyweight" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function levelLabel(level: Level): string {
  return LEVELS.find((l) => l.id === level)?.label ?? LEVELS[0].label;
}

/**
 * "165.5 lb · Sep 20", or null with no weigh-ins, so the row can say Add.
 * The date is built by hand rather than with the locale, so it reads the same
 * in a test as on her phone.
 */
export function weighInLine(weighIns: WeighIn[]): string | null {
  const latest = weighIns[weighIns.length - 1];
  if (!latest) return null;
  const [, month, day] = latest.date.split("-").map(Number);
  // Backups only check that date is a string, so a bad one must not print "undefined".
  if (!(month >= 1 && month <= 12) || !Number.isInteger(day)) return `${latest.lb} lb`;
  return `${latest.lb} lb · ${MONTHS[month - 1]} ${day}`;
}

/**
 * Two names and a count, so the row stays one line whatever her gym has.
 * Old saved state or an imported backup can have an empty kit, and the row
 * should still show a value rather than a label with nothing beside it.
 */
export function equipmentLine(kit: Equipment[]): string {
  const names = EQUIPMENT_LABELS.filter((e) => kit.includes(e.id)).map((e) => e.label);
  if (names.length === 0) return "None set";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function scheduleLine(trainingDays: number[], anchors?: Anchor[]): string {
  const days = `${count(new Set(trainingDays).size, "day")} a week`;
  if (!anchors?.length) return days;
  return `${days} · ${anchors.map((a) => anchorOf(a).label).join(", ")}`;
}

/**
 * The line under a plan day's name: how many lifts, then which. Three days of
 * "Leg day · 6 lifts" read as one row printed three times; the lifts are what
 * tells them apart. The row truncates it, so it can run as long as it likes.
 * A day type can arrive blank, and the row says so rather than "0 lifts".
 */
export function dayDetail(routine: Pick<Routine, "exercises">): string {
  if (routine.exercises.length === 0) return "Nothing on it yet";
  const names = routine.exercises.map((e) => nameOf(e.exerciseId)).join(", ");
  return `${count(routine.exercises.length, "lift")} · ${names}`;
}
