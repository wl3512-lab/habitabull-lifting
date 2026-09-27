import { greetingMood } from "./voice";
import type { AppState } from "./types";

/**
 * The beat the app opens on, once a day.
 *
 * Opening the app is the one moment where the product can say what today is
 * before being asked anything, and it is worth about two and a half seconds.
 * It is also the moment most easily ruined: someone reopening the app between
 * sets is not here for a greeting, so this fires on the first open of a
 * calendar day and never again until the date turns.
 *
 * Everything about when it stays quiet matters more than what it says. The
 * rules below are the feature.
 */
export type ArrivalMood = "first" | "greet" | "rest" | "return";

/** What was said, and on what day, so neither is repeated. */
export interface Greeted {
  date: string;
  mood: ArrivalMood;
}

const KEY = "habitabull.greeted";

export function lastGreeting(): Greeted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Greeted>;
    return parsed.date && parsed.mood ? { date: parsed.date, mood: parsed.mood } : null;
  } catch {
    return null;
  }
}

export function rememberGreeting(g: Greeted): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // Blocked storage costs a repeated greeting, not the app.
  }
}

/**
 * Which arrival today earns, or null for none.
 *
 * Pure on purpose: what the clock and the storage say are arguments, so the
 * decision can be read and tested without a browser.
 */
export function arrivalMood(
  state: AppState,
  today: string,
  { greeted, reduced }: { greeted: Greeted | null; reduced: boolean }
): ArrivalMood | null {
  // Motion is the whole substance of this screen. Without it there is nothing
  // left but a delay, so it is not shown at all rather than shown still.
  if (reduced) return null;
  // Once a day. The date, not a timestamp: the beat belongs to the day.
  if (greeted?.date === today) return null;

  const { profile, routines, sessions } = state;
  if (!profile) return null;

  /*
    Before the week is hers, the app has no standing to tell her what today is.
    `placeDays` spreads sessions across the week on its own, so somebody who
    signed up on a Thursday would be greeted with a rest day it invented for
    her — told to rest before she had done anything. Today.tsx already refuses
    to do this on the home screen; the same refusal has to hold here, where it
    would be the first thing the app ever says.
  */
  if (!profile.planChosen && sessions.length === 0) return null;

  const done = sessions.filter((s) => s.completedAt);
  const lastDone = done
    .map((s) => s.date)
    .filter((d) => d < today)
    .sort()
    .pop();
  const mood = greetingMood(lastDone, today);

  const dow = new Date(today + "T00:00:00").getDay();
  const training = routines.some((r) => r.day === dow);

  if (training) return mood === "return" ? "return" : mood === "first" ? "first" : "greet";

  /*
    A rest day is only good news to somebody who has trained. To anyone else it
    is the app opening with a reason not to start, which is the one thing this
    product cannot afford to be — so on a rest day with nothing logged, it says
    nothing. Coming back still gets its welcome, rest day or not.
  */
  if (mood === "return") return "return";
  return done.length > 0 ? "rest" : null;
}
