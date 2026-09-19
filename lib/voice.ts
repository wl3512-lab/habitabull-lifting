/**
 * The bull's voice. Strong, a little stubborn, on your side.
 *
 * Banned: "crush it", "beast mode", "no excuses", "don't lose your streak",
 * and anything that makes missing a day feel like a moral failure. He notices
 * you were gone; he does not punish you for it.
 */

export type Mood = "greet" | "return" | "midset" | "done" | "pr" | "rest" | "first" | "stopped";

const LINES: Record<Mood, string[]> = {
  first: [
    "New here. Good. Let's find out what you can do.",
    "First one's the hardest. Then it isn't.",
  ],
  greet: [
    "There you are.",
    "Right on time.",
    "Let's get it done.",
    "Bar's waiting.",
  ],
  return: [
    "Been a minute. Doesn't matter — you're here.",
    "Welcome back. We start where we left off.",
    "You came back. That's the whole trick.",
  ],
  /*
    Nothing in here may count. "One more set." and "Halfway. Stay with it."
    were in this pool and picked at random, so both got said with four sets
    left — the bull stating a fact about her session that was not true, which
    is the same way `done` said to somebody who stopped after two sets stops a
    voice being trusted.

    The accurate versions of those lines still exist. They live in `midsetLine`
    below, which is allowed to count because it is given the number.
  */
  midset: [
    "Breathe. Then go.",
    "Stay with it.",
    "Next one.",
  ],
  done: [
    "Logged. That's another one on the board.",
    "Done. See you next session.",
    "That's the work. Go eat something.",
  ],
  pr: [
    "That's a personal best. Say it out loud.",
    "New best. You lifted more than you ever have.",
    "Heaviest you've ever moved. Not a small thing.",
  ],
  rest: [
    "Rest day. Recovery is training too.",
    "Nothing scheduled. Come back tomorrow.",
    "Off day. The muscle grows now, not in the gym.",
  ],
  /*
    Walking out mid-session, which `done` must never be used for: "That's the
    work. Go eat something." said to somebody who stopped after two sets is the
    app congratulating them for something they know they did not do, and that is
    how a voice stops being trusted.

    These have to read the same whether four sets went down or none did, because
    the screen shows the count separately and the count is the part that varies.
    Nothing here scolds. A product whose whole argument is that a gap is not a
    failure cannot make an exit feel like one.
  */
  stopped: [
    "Ended early. That's allowed.",
    "Stopped there. Nothing is lost.",
    "Called it. Your plan is where you left it.",
  ],
};

/** Deterministic per seed so the line doesn't reshuffle on every re-render. */
export function line(mood: Mood, seed: number | string = 0): string {
  const pool = LINES[mood];
  const n = typeof seed === "number" ? seed : [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[Math.abs(n) % pool.length];
}

/**
 * The line between lifts, which may only claim what it can check.
 *
 * It is said on the screen a lift has just been finished on, with more of the
 * session to go — so what is left to count is lifts, not sets. "One more set."
 * was in the random pool and landed here, where it was wrong twice over: wrong
 * number, and wrong unit.
 *
 * Counts only while the number is small enough to be encouraging. Past three
 * it falls back to the pool, because "Four lifts to go" is a workload, not a
 * word of support.
 */
export function midsetLine(liftsLeft: number, seed: number): string {
  if (liftsLeft === 1) return "One lift left.";
  if (liftsLeft === 2) return "Two lifts to go.";
  return line("midset", seed);
}

/** Which greeting fits, given how long it's been. */
export function greetingMood(lastSessionDate: string | undefined, today: string): Mood {
  if (!lastSessionDate) return "first";
  const days = Math.round(
    (new Date(today + "T00:00:00").getTime() - new Date(lastSessionDate + "T00:00:00").getTime()) / 86400000
  );
  return days >= 8 ? "return" : "greet";
}
