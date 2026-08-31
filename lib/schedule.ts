/**
 * When you train, decided after the first session rather than before it.
 *
 * Two findings drive this file.
 *
 * ACSM's 2026 resistance-training update puts novices at 2–3 sessions a week,
 * full body, on non-consecutive days, and is explicit that training every major
 * group twice a week "matters far more than chasing the idea of a 'perfect' or
 * complex training plan". So the app picks the days and never asks a beginner
 * to choose a body-part split — that question is only meaningful once someone
 * has enough training age for it to change anything.
 *
 * The habit literature is the second half. Routine-anchored cues ("after work")
 * outperform clock times: one trial formed a morning-anchored habit in 106 days
 * against 154 for an evening one, and rigid implementation intentions have been
 * shown to break down when circumstances change. A beginner usually cannot
 * answer "what time?" honestly, and can always answer "when in your day?".
 */

export type Anchor = "wake" | "lunch" | "afterwork" | "evening";

export const ANCHORS: { id: Anchor; label: string; hint: string; minute: number }[] = [
  { id: "wake", label: "First thing", hint: "Before the day starts on you", minute: 7 * 60 },
  { id: "lunch", label: "Lunchtime", hint: "The middle of the day", minute: 12 * 60 + 30 },
  { id: "afterwork", label: "After work", hint: "On the way home, or just after", minute: 18 * 60 },
  { id: "evening", label: "Evening", hint: "Once everything else is done", minute: 20 * 60 },
];

export const anchorOf = (id: Anchor) => ANCHORS.find((a) => a.id === id)!;

/**
 * Spread `count` sessions across the week with as much recovery between them as
 * the week allows. Four sessions cannot all be non-consecutive in seven days;
 * the standard answer is two pairs rather than a run of four.
 */
export function placeDays(count: number): number[] {
  const n = Math.max(1, Math.min(7, Math.round(count)));
  const layouts: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return layouts[n];
}

/** True when no two chosen days sit next to each other, wrapping the week. */
export function hasBackToBack(days: number[]): boolean {
  const set = new Set(days);
  return days.some((d) => set.has((d + 1) % 7));
}

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(day)?s?\b/i, 0],
  [/\bmon(day)?s?\b/i, 1],
  [/\btue(s|sday)?s?\b/i, 2],
  [/\bwed(nesday)?s?\b/i, 3],
  [/\bthu(r|rs|rsday)?s?\b/i, 4],
  [/\bfri(day)?s?\b/i, 5],
  [/\bsat(urday)?s?\b/i, 6],
];

// Plurals matter here: people write "most evenings", not "most evening".
const ANCHOR_WORDS: [RegExp, Anchor][] = [
  [/\b(mornings?|first thing|before work|early|sunrise)\b/i, "wake"],
  [/\b(lunch(times?)?|midday|noon)\b/i, "lunch"],
  [/\b(after work|afternoons?|after school|home from work)\b/i, "afterwork"],
  [/\b(evenings?|nights?|after dinner|late)\b/i, "evening"],
];

export interface Availability {
  /** Days named outright. Empty means "no preference, you pick". */
  days: number[];
  /** Days named as bad. Removed from any plan. */
  avoid: number[];
  anchor?: Anchor;
  /** Sessions per week, when a number was actually stated. */
  count?: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
};

/**
 * Free text into a schedule, without a model. This is the fallback that has to
 * work offline, and it is also the thing the model's answer is validated
 * against — anything it returns outside these shapes is discarded.
 */
export function parseAvailability(text: string): Availability {
  const t = text.toLowerCase();
  const avoid: number[] = [];
  const days: number[] = [];

  // "not wednesdays", "except friday", "wednesdays are bad"
  for (const [re, day] of DAY_WORDS) {
    const m = re.exec(t);
    if (!m) continue;
    const around = t.slice(Math.max(0, m.index - 22), m.index + m[0].length + 18);
    if (/\b(not|no|except|apart from|avoid|bad|can'?t|cannot|never|busy)\b/.test(around)) {
      avoid.push(day);
    } else {
      days.push(day);
    }
  }

  let anchor: Anchor | undefined;
  for (const [re, a] of ANCHOR_WORDS) {
    if (re.test(t)) {
      anchor = a;
      break;
    }
  }

  let count: number | undefined;
  const digit = /(\d+)\s*(?:x|times?|days?|sessions?)\b/.exec(t);
  if (digit) count = Number(digit[1]);
  // "twice a week" is how people say it; "two times a week" is how parsers
  // wish they said it.
  if (count === undefined) {
    const shorthand: [RegExp, number][] = [
      [/\bonce\b/, 1],
      [/\btwice\b/, 2],
      [/\bthrice\b/, 3],
    ];
    for (const [re, n] of shorthand) {
      if (re.test(t)) {
        count = n;
        break;
      }
    }
  }
  if (count === undefined) {
    for (const [word, n] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\s+(?:x|times?|days?|sessions?)\\b`).test(t)) {
        count = n;
        break;
      }
    }
  }
  if (count !== undefined && (count < 1 || count > 7)) count = undefined;

  return {
    days: [...new Set(days)].filter((d) => !avoid.includes(d)).sort((a, b) => a - b),
    avoid: [...new Set(avoid)].sort((a, b) => a - b),
    anchor,
    count,
  };
}

/**
 * Pick `count` days from what is available, as far apart as the list allows.
 * Evenly spaced indices rather than the first N: someone free every evening who
 * trains three times should get Sunday/Tuesday/Friday, not three days in a row.
 */
export function spread(available: number[], count: number): number[] {
  const days = [...new Set(available)].sort((a, b) => a - b);
  if (days.length <= count) return days;
  const step = days.length / count;
  return Array.from({ length: count }, (_, i) => days[Math.floor(i * step)]);
}

/**
 * Turn what someone said into an actual week.
 *
 * The distinction that matters: `days` is when they are *available*, not how
 * often they want to train. "Free most evenings" lists six days and means
 * nothing about frequency, so the count comes from what they actually asked for
 * or from the guidance default — never from the length of the availability
 * list. ACSM puts novices at two to three sessions; six is how people quit.
 */
export function planWeek(a: Availability, fallbackCount = 3): number[] {
  const count = Math.max(1, Math.min(7, a.count ?? fallbackCount));
  const available = a.days.filter((d) => !a.avoid.includes(d));
  if (available.length >= count) return spread(available, count);

  const chosen = [...available];
  const wanted = placeDays(count).filter((d) => !a.avoid.includes(d) && !chosen.includes(d));
  for (const d of wanted) {
    if (chosen.length >= count) break;
    chosen.push(d);
  }
  // Still short because too much was ruled out: take whatever is left.
  for (let d = 1; d <= 7 && chosen.length < count; d++) {
    const day = d % 7;
    if (!a.avoid.includes(day) && !chosen.includes(day)) chosen.push(day);
  }
  return chosen.sort((x, y) => x - y);
}

/** Which part of the day an hour belongs to. Evening wraps past midnight. */
export function anchorForHour(hour: number): Anchor {
  if (hour >= 5 && hour <= 10) return "wake";
  if (hour >= 11 && hour <= 14) return "lunch";
  if (hour >= 15 && hour <= 19) return "afterwork";
  return "evening";
}

export interface Observed {
  anchor: Anchor;
  /** Sessions that landed in this part of the day. */
  count: number;
  total: number;
}

/**
 * When she actually trains, as opposed to when she said she would.
 *
 * Stated intentions and revealed behaviour drift, and the honest move is to
 * believe the behaviour. Someone who picked "after work" and then trains at ten
 * every night has told the app something truer than the chip they tapped once —
 * the timestamps were already there, nobody had to be asked again, and a plan
 * built on what actually happens is the one that survives.
 *
 * Deliberately conservative. It needs a real sample and a clear majority before
 * it says anything, because being told "you're a morning person now" off the
 * back of two sessions is worse than silence.
 */
export function observedAnchor(
  sessions: { completedAt?: string }[],
  minSessions = 5,
  majority = 0.5
): Observed | null {
  const hours = sessions
    .filter((s) => s.completedAt)
    .map((s) => new Date(s.completedAt as string).getHours());
  if (hours.length < minSessions) return null;

  const tally = new Map<Anchor, number>();
  for (const h of hours) {
    const a = anchorForHour(h);
    tally.set(a, (tally.get(a) ?? 0) + 1);
  }
  const [anchor, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (count / hours.length < majority) return null;
  return { anchor, count, total: hours.length };
}
