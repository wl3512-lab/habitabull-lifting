import type { Session } from "./types";

/**
 * Whether she went. The one answer to "did she train that day", for every
 * screen that asks it: the calendar, the week strip, the streak, comebacks,
 * the Progress grid, a day opened from the calendar, the crew.
 *
 * It used to be `completedAt`, which only Finish writes, and Finish only shows
 * up after the last set of the last lift. End, which is where most sessions
 * actually stop, keeps every set and says "Saved", and then the day was missing
 * from the calendar, the month count, the streak and the crew all the same.
 * "Only two sessions are saved even though I logged way more" was the app
 * telling her she had not been to the gym on days she had.
 *
 * A logged set is proof she turned up, finished or not. A session she opened
 * and logged nothing in is not: tapping Start and putting the phone down is not
 * a gym visit, so it stays off the calendar.
 *
 * `completedAt` still means finished, and still answers the questions that are
 * about finishing, such as whether Today offers "Continue workout". Weights and
 * targets read neither; they read the sets themselves (`historyFor`).
 */
export function attended(session: Pick<Session, "completedAt" | "exercises">): boolean {
  return (
    Boolean(session.completedAt) ||
    session.exercises.some((e) => e.sets.some((s) => s.done))
  );
}

/**
 * The days the crew is told she trained.
 *
 * Every day she went, with one hold: today's session, until she finishes it.
 * End leaves a session open to carry on, so on the day itself there is no
 * telling a session she stopped from one she is still in the middle of, and a
 * workout in progress is nobody's business but hers. Once the date turns it is
 * a day she went, and the crew hears about it like any other.
 */
export function checkinDates(sessions: Session[], today: string): string[] {
  return sessions
    .filter((s) => s.completedAt || (s.date < today && attended(s)))
    .map((s) => s.date);
}
