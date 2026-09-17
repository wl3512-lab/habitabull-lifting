"use client";

import { useEffect, useRef } from "react";
import Bull, { BULL } from "./Bull";
import { line } from "@/lib/voice";
import { count } from "@/lib/plural";
import type { Session } from "@/lib/types";

/**
 * Leaving a workout before the end of it.
 *
 * "End" used to be a hard cut: the button swapped the screen for the home
 * screen and that was the whole of it. Two things were wrong with that. It is
 * the only place in the app that changes screen without a transition, so it
 * reads as a crash rather than a decision. And it says nothing about the sets
 * that did go down, so the honest question on the way out, "did I just lose
 * that?", goes unanswered at exactly the moment it is being asked.
 *
 * Built to `Comeback`'s measurements, which is its sibling: same centred
 * column, same bull at `hero`, same tap-to-skip, same auto-advance. Those two
 * and the daily arrival are the only timed beats in the product and they
 * should read as one kind of thing.
 *
 * It settles rather than rises. Every forward moment in this app comes up from
 * below; this one is a wind-down, and it moves the way a rest day moves.
 *
 * The bull does not react. Nothing is being celebrated: a finished session has
 * its own screen and its own ladder, and borrowing that here would tell
 * somebody who stopped after two sets that they had done the work.
 */
export default function StoppedEarly({
  session,
  seed,
  onDone,
}: {
  session: Session;
  /** Keeps the line steady across re-renders instead of reshuffling. */
  seed: number;
  onDone: () => void;
}) {
  // Ref so the auto-advance fires exactly once on mount; depending on onDone's
  // identity would reset the timer on every parent re-render.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Shorter than an arrival. She asked to leave, and a beat she is waiting
    // out is a beat that has stopped being a courtesy.
    const t = setTimeout(() => done.current(), reduced ? 0 : 2000);
    return () => clearTimeout(t);
  }, []);

  const sets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0
  );

  return (
    <main
      onClick={() => done.current()}
      role="status"
      aria-live="polite"
      style={{ "--stagger": "110ms" } as React.CSSProperties}
      className="mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center"
    >
      {/*
        The reassurance first, because it is the thing being asked. "Saved" is
        a claim about her data and it is true: the sets are already on the draft
        and the draft is already written, which is why the home screen offers to
        pick this session back up.
      */}
      <p className="settle stage label text-cyan" style={{ "--step": 0 } as React.CSSProperties}>
        {sets > 0 ? "Saved" : "No harm done"}
      </p>

      <div className="settle stage mt-6" style={{ "--step": 1 } as React.CSSProperties}>
        <Bull size={BULL.hero} say={line("stopped", seed)} />
      </div>

      {/*
        The count, stated rather than celebrated, and left out entirely when it
        is zero. "0 sets logged" is a scoreboard nobody needed to see on their
        way out of a gym.
      */}
      {sets > 0 && (
        <p className="settle stage mt-6 text-emphasis text-dim" style={{ "--step": 2 } as React.CSSProperties}>
          {count(sets, "set")} logged. Pick it back up whenever.
        </p>
      )}

      <p className="settle stage mt-10 text-caption text-dim" style={{ "--step": 3 } as React.CSSProperties}>
        Tap to go back
      </p>
    </main>
  );
}
