import { anchorOf, primaryAnchor } from "./schedule";
import type { Profile } from "./types";

/**
 * The reminder, as a calendar event.
 *
 * Habit principle 5 (deck p12) is "repeat consistently", and the 2023 note asks
 * for "notification reminders to workout". A web app cannot honestly deliver
 * that on its own: scheduled local notifications need either the Notification
 * Triggers API (never shipped) or Web Push (needs a server and VAPID keys), and
 * a setTimeout only fires while the app is already open — which is precisely
 * when a reminder is pointless.
 *
 * So the reminder goes where reminders actually work. A recurring calendar
 * event with an alarm fires on every platform, offline, forever, with no
 * backend and no permission prompt that the app cannot honour. It also survives
 * the app being deleted, which a push subscription does not.
 *
 * Times are deliberately floating (no Z, no TZID): a 6:30pm training slot is
 * 6:30pm wherever she happens to be, not 6:30pm Eastern re-rendered as 3:30am.
 */

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const pad = (n: number) => String(n).padStart(2, "0");

/** RFC 5545 escaping for TEXT values. Backslash first or it doubles the rest. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Content lines are limited to 75 octets; continuations start with a space. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

const local = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(
    d.getMinutes()
  )}00`;

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** The first training day on or after `from`, at the chosen hour. */
export function firstOccurrence(trainingDays: number[], minute: number, from: Date): Date {
  const days = [...trainingDays].sort((a, b) => a - b);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    if (days.includes(d.getDay()) && d.getTime() >= from.getTime()) return d;
  }
  const d = new Date(from);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

/**
 * A weekly recurring training block with an alarm `alarmMinutes` beforehand.
 * Returns null when there is nothing to schedule.
 */
export function buildIcs(
  profile: Pick<Profile, "trainingDays" | "trainingMinute" | "motivation" | "anchors">,
  now = new Date(),
  alarmMinutes = 15
): string | null {
  const { trainingDays } = profile;
  // An hour comes from the earliest chosen slot, or from an explicit clock time.
  // "Whenever I can" gets a sensible default rather than no reminder at all —
  // a calendar entry she can drag is more use than silence.
  const anchor = primaryAnchor(profile.anchors);
  const minute = anchor ? anchorOf(anchor).minute : profile.trainingMinute ?? 18 * 60;
  if (!trainingDays.length) return null;

  const start = firstOccurrence(trainingDays, minute, now);
  const byday = [...trainingDays].sort((a, b) => a - b).map((d) => BYDAY[d]).join(",");

  // Their own reason, unedited. The app never rewrites it — least of all in a
  // place she will read on a day she does not feel like going.
  const because = profile.motivation
    ? `You said: ${profile.motivation}`
    : "Showing up is the whole thing.";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HabitaBull//Training//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:habitabull-training-${start.getTime()}@habitabull.local`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${local(start)}`,
    "DURATION:PT45M",
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    `SUMMARY:${escapeText("Training — HabitaBull")}`,
    `DESCRIPTION:${escapeText(because)}`,
    "BEGIN:VALARM",
    `TRIGGER:-PT${alarmMinutes}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("Training in " + alarmMinutes + " minutes.")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * The same event as a Google Calendar link.
 *
 * A downloaded .ics is the honest, portable answer and stays the default — it
 * works offline, on every platform, and outlives the app being deleted. But a
 * file download is a miserable experience on an Android phone, and Google
 * Calendar is what most of the people this was built for actually use, so
 * there is a second door.
 *
 * Google's template URL takes one start time and a recurrence rule; the rule
 * is the same RRULE the .ics carries, so the two cannot drift.
 */
export function googleUrl(
  profile: Pick<Profile, "trainingDays" | "trainingMinute" | "motivation" | "anchors">,
  now = new Date()
): string | null {
  const { trainingDays } = profile;
  if (!trainingDays.length) return null;

  const anchor = primaryAnchor(profile.anchors);
  const minute = anchor ? anchorOf(anchor).minute : profile.trainingMinute ?? 18 * 60;
  const start = firstOccurrence(trainingDays, minute, now);
  const end = new Date(start.getTime() + 45 * 60000);
  const byday = [...trainingDays].sort((a, b) => a - b).map((d) => BYDAY[d]).join(",");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Training — HabitaBull",
    // Local wall-clock on both ends, no Z: the hour survives a timezone change,
    // exactly as the .ics floating time does.
    dates: `${local(start)}/${local(end)}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    details: profile.motivation ? `You said: ${profile.motivation}` : "Showing up is the whole thing.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
