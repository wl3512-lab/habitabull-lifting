"use client";

import { useEffect, useRef, useState } from "react";
import Bull, { BULL } from "./Bull";
import { line } from "@/lib/voice";
import type { ArrivalMood } from "@/lib/arrival";

/**
 * What the app says when you open it, once a day.
 *
 * The sibling of `Comeback`, and deliberately built to its measurements: same
 * centred column, same bull at `hero`, same tap-to-skip, same auto-advance. The
 * two are the only timed beats in the product and they should read as one kind
 * of thing rather than two features that happen to both use the mascot.
 *
 * A training day and a rest day are told apart by how they move, not by what
 * colour they are. Training arrives from below and braces, and the bull nods:
 * the whole gesture points forward, at the thing you are about to do. Rest
 * comes down and lands, holds a little longer, and the bull stays still —
 * nothing is being asked of anybody, and a mascot bouncing about it would be
 * the app pretending a day off is an event.
 *
 * Whether it appears at all is decided in `lib/arrival.ts`, which is where the
 * feature actually lives. By the time this renders, the decision that today
 * earns a beat has already been made and tested.
 */

/** Training arrives at a working pace. A rest day gets to take its time. */
const HOLD: Record<ArrivalMood, number> = {
  first: 2400,
  greet: 2400,
  return: 2400,
  rest: 2800,
};

export default function Arrival({
  mood,
  seed,
  nextDay,
  onDone,
}: {
  mood: ArrivalMood;
  /** Keeps the line steady across re-renders instead of reshuffling. */
  seed: number;
  /** The next day on the plan, named. Rest days only, and only if there is one. */
  nextDay?: string | null;
  onDone: () => void;
}) {
  const resting = mood === "rest";
  const [leaving, setLeaving] = useState(false);

  // Ref so the timers are set once on mount; depending on onDone's identity
  // would restart the hold on every re-render of the parent.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    // The exit runs on screen, so the next screen is arriving into a fade
    // rather than replacing a hard edge. 150ms is the `quick` token.
    const leave = setTimeout(() => setLeaving(true), HOLD[mood]);
    const finish = setTimeout(() => done.current(), HOLD[mood] + 150);
    return () => {
      clearTimeout(leave);
      clearTimeout(finish);
    };
  }, [mood]);

  return (
    <main
      onClick={() => done.current()}
      role="status"
      aria-live="polite"
      className={`mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center ${
        leaving ? "depart" : ""
      }`}
    >
      <p className={`${resting ? "settle" : "rise"} label text-cyan`}>
        {resting ? "Rest day" : "Today"}
      </p>

      <div className={`${resting ? "settle" : "rise"} mt-6`}>
        <Bull size={BULL.hero} react={!resting} say={line(mood, seed)} />
      </div>

      {/*
        Where she is next in, so a rest day points at the next session rather
        than reading as a closed door. Left out entirely when the schedule
        cannot name one — a shrug is worse than silence.
      */}
      {resting && nextDay && (
        <p className="settle mt-4 text-emphasis text-dim">Next one&apos;s {nextDay}.</p>
      )}

      <p className="mt-10 text-caption text-dim">Tap to skip</p>
    </main>
  );
}
