import { count } from "./plural";

/**
 * The arithmetic behind the progress photos page, kept pure so it can be
 * tested without IndexedDB or a DOM.
 *
 * Everything works on ISO dates (YYYY-MM-DD) as stored, and never through a
 * Date at midnight: a photo belongs to the day it was filed under, and the
 * timezone of whoever is looking at it should not move it into another month.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Anything with a date. The screen passes photos; the tests pass bare dates. */
type Dated = { date: string; addedAt?: string };

/**
 * Newest first: by day, then by when it was added, so two photos from one day
 * keep the order they were taken in.
 */
export function newestFirst<T extends Dated>(photos: T[]): T[] {
  return [...photos].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.addedAt ?? "").localeCompare(a.addedAt ?? "")
  );
}

export interface MonthGroup<T> {
  /** YYYY-MM. */
  key: string;
  /** "October", or "October 2025" once it is not this year. */
  label: string;
  photos: T[];
}

/**
 * Photos in months, newest month first and newest photo first inside each.
 *
 * The year is left off the current one. Twelve headings reading "2026" would
 * be noise, and the first heading that does carry a year is exactly where the
 * reader needs telling that the year has turned.
 */
export function byMonth<T extends Dated>(photos: T[], today: string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const p of newestFirst(photos)) {
    const key = p.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.photos.push(p);
    else groups.push({ key, label: monthName(key, today), photos: [p] });
  }
  return groups;
}

function monthName(key: string, today: string): string {
  const name = MONTHS[Number(key.slice(5, 7)) - 1];
  return key.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${key.slice(0, 4)}`;
}

/**
 * How far apart two photos are, said the way a person would say it.
 *
 * Always rounded down. "4 months apart" for two photos three months and
 * twenty-eight days apart would be a number nobody can back, and this is the
 * one line on the page that is a claim about her time. Under two weeks it is
 * days, because "1 week apart" for thirteen days undersells it by almost half.
 */
export function apart(a: string, b: string): string {
  const [early, late] = a <= b ? [a, b] : [b, a];
  const [y1, m1, d1] = early.split("-").map(Number);
  const [y2, m2, d2] = late.split("-").map(Number);
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
  if (days === 0) return "Same day";

  // Whole calendar months: 3 March to 2 July is three, not four.
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest === 0
      ? `${count(years, "year")} apart`
      : `${count(years, "year")} and ${count(rest, "month")} apart`;
  }
  if (months >= 1) return `${count(months, "month")} apart`;
  if (days >= 14) return `${count(Math.floor(days / 7), "week")} apart`;
  return `${count(days, "day")} apart`;
}

/**
 * The line under the page's headline: how many, and since when.
 *
 * Empty for no photos, because the page has its own sentence for that and
 * "0 photos" is a count of nothing.
 */
export function photoSpan(photos: Dated[], today: string): string {
  if (photos.length === 0) return "";
  if (photos.length === 1) return "1 photo so far";
  const first = photos.reduce((min, p) => (p.date < min ? p.date : min), photos[0].date);
  const key = first.slice(0, 7);
  const n = count(photos.length, "photo");
  return key === today.slice(0, 7) ? `${n} this month` : `${n} since ${monthName(key, today)}`;
}
