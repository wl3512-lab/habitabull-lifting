/**
 * A buzz on a real action, where the platform allows one.
 *
 * The hard truth this file is honest about: iOS Safari and home-screen PWAs do
 * not implement the Vibration API, and this app is an iPhone app. So on the
 * primary target every call here is a silent no-op, and the *visual*
 * confirmation is what the user actually feels. Android and a few desktop
 * browsers do buzz. We still call it — it costs nothing where it is unsupported
 * and it is real feedback where it is not — but nothing in the UI may depend on
 * it having happened.
 *
 * Patterns are deliberately short. A workout log is a quiet confirmation, not a
 * notification demanding attention; a long buzz mid-set reads as an error.
 */

type Cue = "log" | "best" | "tick";

const PATTERNS: Record<Cue, number | number[]> = {
  tick: 8, // a small nudge — stepper edges, minor confirmations
  log: 18, // a set is in the book
  best: [0, 22, 40, 22], // a personal best: two beats, still brief
};

export function haptic(cue: Cue): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[cue]);
  } catch {
    // Some browsers expose vibrate but throw unless the document is focused, or
    // when a user gesture is required and this was not one. Never a problem
    // worth surfacing: the buzz is the least important half of the feedback.
  }
}
