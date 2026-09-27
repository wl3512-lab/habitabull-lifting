import type { Session } from "./types";

/**
 * Calendar maths, kept pure and away from the component so it can be tested
 * without a DOM. Everything here is local-time: a 11pm workout belongs to that
 * day, not to tomorrow in UTC.
 */

export interface MonthCell {
  /** ISO date, or null for the padding cells before the 1st / after the last. */
  iso: string | null;
  day: number | null;
  trained: boolean;
  /** First session back after a gap of a week or more. */
  comeback: boolean;
  today: boolean;
  future: boolean;
  hasPhoto: boolean;
}

const iso = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const isoDate = iso;

/** One day of the week strip, as the week actually stands. */
export interface WeekDay {
  /** Sunday-indexed, matching Date.getDay() and Profile.trainingDays. */
  index: number;
  /** The single letter under the dot. */
  initial: string;
  iso: string;
  trained: boolean;
  isToday: boolean;
  planned: boolean;
  /** A gym day still ahead of you this week. */
  upcoming: boolean;
}

const INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The current week, Sunday first.
 *
 * It lived inside Today and is now read by the rest-day arrival as well, which
 * draws the same seven days for the opposite reason: the home screen's strip
 * says where you are in the week, and the arrival's says what is already
 * banked. Two readings of one fact, and the one thing they must never do is
 * disagree about which days those were.
 *
 * Built on the same local-time `iso` as everything else in this file. The
 * version inside the component used `toISOString()` on a Date at local
 * midnight, which is the same day only for timezones at or west of UTC; east
 * of it every dot in the strip was a day early.
 */
export function weekStrip(
  sessions: Session[],
  trainingDays: number[],
  today: string
): WeekDay[] {
  const done = sessions.filter((s) => s.completedAt);
  const now = new Date(today + "T00:00:00");
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());

  return INITIALS.map((initial, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    const day = iso(d);
    return {
      index,
      initial,
      iso: day,
      trained: done.some((s) => s.date === day),
      isToday: day === today,
      planned: trainingDays.includes(index),
      // A planned day already past stays quiet: absence, not failure.
      upcoming: day > today,
    };
  });
}

/** Dates that were the first session back after a break of `gapDays` or more. */
export function comebackDates(sessions: Session[], gapDays = 7): Set<string> {
  const done = sessions
    .filter((s) => s.completedAt)
    .map((s) => s.date)
    .sort();
  const out = new Set<string>();
  for (let i = 1; i < done.length; i++) {
    const gap = Math.round((Date.parse(done[i]) - Date.parse(done[i - 1])) / 864e5);
    if (gap >= gapDays) out.add(done[i]);
  }
  return out;
}

/** The biggest break she has actually come back from. Zero if she never has. */
export function longestComebackGap(sessions: Session[]): number {
  const done = sessions
    .filter((s) => s.completedAt)
    .map((s) => s.date)
    .sort();
  let longest = 0;
  for (let i = 1; i < done.length; i++) {
    const gap = Math.round((Date.parse(done[i]) - Date.parse(done[i - 1])) / 864e5);
    if (gap >= 7) longest = Math.max(longest, gap);
  }
  return longest;
}

/**
 * A month as calendar rows, Sunday-first, padded to whole weeks so the grid
 * stays rectangular. `month` is 0-indexed, matching Date.
 */
export function monthMatrix(
  year: number,
  month: number,
  sessions: Session[],
  photoDates: string[] = [],
  today = new Date()
): MonthCell[][] {
  const trained = new Set(sessions.filter((s) => s.completedAt).map((s) => s.date));
  const comebacks = comebackDates(sessions);
  const photos = new Set(photoDates);
  const todayIso = iso(today);

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const cells: MonthCell[] = [];
  for (let i = 0; i < total; i++) {
    const dayNum = i - lead + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({
        iso: null,
        day: null,
        trained: false,
        comeback: false,
        today: false,
        future: false,
        hasPhoto: false,
      });
      continue;
    }
    const d = new Date(year, month, dayNum);
    const key = iso(d);
    cells.push({
      iso: key,
      day: dayNum,
      trained: trained.has(key),
      comeback: comebacks.has(key),
      today: key === todayIso,
      future: key > todayIso,
      hasPhoto: photos.has(key),
    });
  }

  const rows: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Sessions completed in a given month, for the year view and the month header. */
export function sessionsInMonth(sessions: Session[], year: number, month: number): number {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return sessions.filter((s) => s.completedAt && s.date.startsWith(prefix)).length;
}

/** Twelve counts, January to December, for the year view. */
export function yearCounts(sessions: Session[], year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => sessionsInMonth(sessions, year, m));
}
