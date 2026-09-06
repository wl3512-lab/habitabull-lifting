/**
 * The beat between tapping "Log set" and the rest timer.
 *
 * Not a loading page — the set is already written by the time this shows, and
 * making someone wait on a spinner would fight the one rule the logging screen
 * exists to protect: it has to survive being used mid-set, one-handed, in a few
 * seconds. This is the acknowledgement for a moment they are about to spend
 * resting anyway (~650ms, tap to skip, and zero under reduced motion).
 *
 * Presentational only. LogSession owns the timing and what happens next; this
 * draws the confirmation and nothing else, which is also what lets the /frames
 * gallery show the exact thing the app shows rather than a copy of it.
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
  return (
    <main
      onClick={onSkip}
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center"
    >
      {/* Cyan is arrival in this system, green is done — so a best gets the
          threshold colour and an ordinary set gets the plain confirmation. */}
      <div
        className={`stamp grid h-20 w-20 place-items-center rounded-full text-ground ${
          best ? "bg-cyan" : "bg-done"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="rise statement mt-5 text-title text-fg">{best ? "New best" : "Logged"}</p>
      <p className="rise tabular mt-1 text-emphasis text-dim">{summary}</p>
      <p className="mt-10 text-caption text-dim">
        {resting ? "Resting next · tap to skip" : "That's the session · tap to finish"}
      </p>
    </main>
  );
}
