import type { Challenge, Profile, Session } from "./types";

/**
 * The monthly challenge.
 *
 * Miles, the Competitor archetype (deck p21), is "motivated by competition and
 * leaderboard rankings". The leaderboard is not coming back — ranked by
 * absolute load it shames the beginner the deck was written for, and the lo-fi
 * leaderboard (p37) even had rows 3 and 4 out of order. What survives from the
 * Miro sticky, "different challenge every month", is a target rather than a
 * ranking: something to be behind or ahead of that is not another person.
 *
 * The target is his own schedule, counted. Not a stretch goal and not a number
 * the app invented — showing up the number of times you already said you would
 * is the whole job, and it is hard enough.
 */

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthKey = key;

/** How many of this month's days fall on a training day. */
export function defaultTarget(trainingDays: number[], year: number, month: number): number {
  if (trainingDays.length === 0) return 0;
  const days = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= days; d++) {
    if (trainingDays.includes(new Date(year, month, d).getDay())) n++;
  }
  return n;
}

/**
 * The challenge for the month `now` falls in, regenerating when the month
 * turns. An existing target for the current month is kept, so nudging it up or
 * down survives until the month rolls.
 */
export function challengeFor(
  profile: Pick<Profile, "trainingDays">,
  existing: Challenge | undefined,
  now = new Date()
): Challenge {
  const month = key(now);
  if (existing && existing.month === month) return existing;
  return {
    month,
    target: defaultTarget(profile.trainingDays, now.getFullYear(), now.getMonth()),
  };
}

/** Completed sessions inside the challenge's month. */
export function challengeDone(sessions: Session[], challenge: Challenge): number {
  return sessions.filter((s) => s.completedAt && s.date.startsWith(challenge.month)).length;
}

/** 0-100, capped, so a strong month never renders past the end of the bar. */
export function challengePercent(done: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / target) * 100)));
}

/** Days left in the challenge month, today included. */
export function daysLeftInMonth(now = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}
