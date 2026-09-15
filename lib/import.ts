import { allExercises } from "./exercises";
import { startingWeight } from "./engine";
import type { Exercise, Level, PlannedExercise, Routine } from "./types";

/**
 * Turning a workout someone already has into the app's own routines.
 *
 * The model (via /api/generate) reads free text into a loose shape; everything
 * that actually becomes a plan is decided here, against the real library. A
 * name the model returns is never trusted as an exercise — it is matched to a
 * library id or handed off to be created as a custom lift. Weights are ignored
 * outright: the engine sets the starting load for this person's level, because
 * a number copied off someone else's plan is the leaderboard in disguise.
 */

/** What the parser (local or model) hands over before validation. */
export interface ParsedDay {
  day: number; // 0-6, Sunday=0
  label: string;
  exercises: { name: string; sets: number; reps: number }[];
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Abbreviations people actually type, expanded before matching.
const ALIAS: Record<string, string> = {
  db: "dumbbell", bb: "barbell", ohp: "overhead press", rdl: "romanian deadlift",
  bench: "bench press", squat: "back squat", dl: "deadlift", pushup: "push up",
  pullup: "pull up", "lat pulldown": "pulldown", ez: "", machine: "",
};

const expand = (q: string) =>
  norm(q).split(" ").map((w) => (w in ALIAS ? ALIAS[w] : w)).filter(Boolean).join(" ");

/**
 * Closest library exercise to a free-text name, or null when nothing is near
 * enough. Exact name wins; then containment; then how many words overlap.
 */
export function matchExercise(name: string, pool: Exercise[] = allExercises()): string | null {
  const q = expand(name);
  if (!q) return null;
  const qt = new Set(q.split(" "));
  let best: { id: string; score: number } | null = null;
  for (const ex of pool) {
    const n = norm(ex.name);
    let score: number;
    if (n === q) score = 100;
    else if (n.includes(q) || q.includes(n)) score = 72;
    else {
      const nt = n.split(" ");
      const overlap = nt.filter((t) => qt.has(t)).length;
      score = (overlap / Math.max(qt.size, nt.length)) * 60;
    }
    if (!best || score > best.score) best = { id: ex.id, score };
  }
  return best && best.score >= 45 ? best.id : null;
}

const DAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

/**
 * A best-effort local parse, used when the model is unreachable. Reads day
 * headers ("Mon:", "Day 1 -") and exercise lines carrying an NxM ("Bench 3x8",
 * "Squat 5 x 5"). Deliberately forgiving; the model does the harder cases.
 */
export function parseWorkoutText(text: string): ParsedDay[] {
  const days: ParsedDay[] = [];
  let current: ParsedDay | null = null;
  let auto = 1; // fallback weekday when none is named

  const pushDay = (label: string, dayNum: number) => {
    current = { day: dayNum, label, exercises: [] };
    days.push(current);
  };

  // Split on newlines and on the middot the app itself uses between days.
  for (const rawLine of text.split(/[\n\r·]+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // A day header: "Mon", "Monday: ...", "Day 2", "Push day"
    const head = line.match(/^(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)[a-z]*\b\s*[:\-]?\s*(.*)$/i);
    if (head) {
      const dayNum = DAY_WORDS[head[1].toLowerCase()] ?? auto++;
      pushDay(head[2].trim() || "Training", dayNum);
      // remainder after the header may still hold exercises on the same line
      const rest = head[2].trim();
      if (rest) parseExercises(rest, current!);
      continue;
    }
    if (!current) pushDay("Training", auto++);
    parseExercises(line, current!);
  }
  return days.filter((d) => d.exercises.length > 0);
}

function parseExercises(chunk: string, into: ParsedDay) {
  // Exercises are comma- or semicolon-separated; each may carry "N x M".
  for (const part of chunk.split(/[,;]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(.*?)[\s:]*?(\d{1,2})\s*[x×]\s*(\d{1,3})/i);
    if (m && m[1].trim()) {
      into.exercises.push({
        name: m[1].trim(),
        sets: clampSets(+m[2]),
        reps: clampReps(+m[3]),
      });
    } else if (/[a-z]{3,}/i.test(p) && !/^\d/.test(p)) {
      // A bare exercise with no scheme — keep it, defaults filled later.
      into.exercises.push({ name: p, sets: 3, reps: 8 });
    }
  }
}

export const clampSets = (n: number) => Math.min(10, Math.max(1, Math.round(n) || 3));
export const clampReps = (n: number) => Math.min(60, Math.max(1, Math.round(n) || 8));

/**
 * Validate a parsed structure into real routines. Names that match the library
 * become planned lifts at this level's starting weight; `onUnknown` is offered
 * each name that does not match, and may return a freshly-created custom lift's
 * id (see the import route) or null to drop it.
 */
export function toRoutines(
  parsed: ParsedDay[],
  level: Level,
  onUnknown?: (name: string) => string | null,
): { routines: Routine[]; unmatched: string[] } {
  const pool = allExercises();
  const unmatched: string[] = [];
  const seenDays = new Set<number>();
  const routines: Routine[] = [];

  for (const d of parsed) {
    let day = d.day;
    while (seenDays.has(day)) day = (day + 1) % 7; // no two routines on one weekday
    seenDays.add(day);

    const exercises: PlannedExercise[] = [];
    for (const raw of d.exercises) {
      let id = matchExercise(raw.name, pool);
      if (!id && onUnknown) id = onUnknown(raw.name);
      if (!id) {
        unmatched.push(raw.name);
        continue;
      }
      if (exercises.some((e) => e.exerciseId === id)) continue;
      const meta = pool.find((e) => e.id === id);
      exercises.push({
        exerciseId: id,
        sets: meta?.cardio ? 1 : clampSets(raw.sets),
        reps: clampReps(raw.reps),
        weight: meta ? startingWeight(meta, level) : 0,
      });
    }
    if (exercises.length) {
      routines.push({ day, label: d.label.slice(0, 40) || "Training", exercises });
    }
  }
  return { routines, unmatched };
}
