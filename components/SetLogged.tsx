/**
 * The beat between tapping "Log set" and the rest timer, on an escalation
 * ladder so a routine set and a personal best don't feel the same.
 *
 * Routine set: a green disc pops in, the check draws itself on, and one ring
 * pulses outward and is gone. Contained, over in half a second.
 *
 * A best floods the whole screen green instead, check and words knocked out in
 * the ground colour. That full-field takeover is the app's biggest gesture, so
 * it is spent only when there is a real number to beat, and never on an
 * ordinary rep. It is green, not the orange the finished-workout PR uses, so
 * the two celebrations read as different heights of the same ladder.
 *
 * Presentational only — LogSession owns the timing and what comes next — which
 * is also what lets the /frames gallery show the exact thing the app shows.
 */
export default function SetLogged({
  summary,
  best,
  resting,
  onSkip,
}: {
  /** What was logged, phrased for a glance: "145 lb × 6" or "12 reps". */
  summary: string;
  /** A personal best — only ever true when there was a prior number to beat. */
  best: boolean;
  /** Whether a rest timer follows, or this was the last set of the session. */
  resting: boolean;
  onSkip?: () => void;
}) {
  const footer = resting ? "Resting next · tap to skip" : "That's the session · tap to finish";

  if (best) {
    return (
      <main
        onClick={onSkip}
        role="status"
        aria-live="polite"
        className="flood mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center bg-done px-6 text-center text-ground"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="stamp h-28 w-28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="check-draw" d="M5 13l4 4L19 7" />
        </svg>
        <p className="rise statement mt-6 text-display">New best</p>
        <p className="rise tabular mt-1 text-head">{summary}</p>
        <p className="mt-10 text-caption text-ground/70">{footer}</p>
      </main>
    );
  }

  return (
    <main
      onClick={onSkip}
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center"
    >
      <div className="relative grid h-20 w-20 place-items-center">
        {/* One ripple out from the disc, then gone. */}
        <span aria-hidden className="ring-pulse absolute inset-0 rounded-full bg-done" />
        <span className="stamp relative grid h-20 w-20 place-items-center rounded-full bg-done text-ground">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="check-draw" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
      <p className="rise statement mt-5 text-title text-fg">Logged</p>
      <p className="rise tabular mt-1 text-emphasis text-dim">{summary}</p>
      <p className="mt-10 text-caption text-dim">{footer}</p>
    </main>
  );
}
