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
