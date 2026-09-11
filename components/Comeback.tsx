"use client";

import { useEffect, useRef } from "react";
import Bull, { BULL } from "./Bull";
import { line } from "@/lib/voice";

/**
 * The one the whole product is built for: someone who was gone for a week or
 * more, opening a workout anyway. Retention is the unsolved problem here, and
 * coming back is the skill — so returning gets its own affirming beat before
 * the first set, in cyan, the colour this system already uses for arrival.
 *
 * The bull does the work, not a badge. He is the reason skipping feels like
 * letting someone down, so he is also who greets you when you don't skip. No
 * day count and no "you missed N days" — the gap is not a mark against anyone,
 * and the return lines already carry the tone. Matches the set-logged ladder:
 * contained, brief, tap to skip, gone under reduced motion.
 */
export default function Comeback({ seed, onDone }: { seed: number; onDone: () => void }) {
  // Ref so the auto-advance fires exactly once on mount; depending on onDone's
  // identity would reset the 2.4s timer on every parent re-render.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => done.current(), reduced ? 0 : 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      onClick={onDone}
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center"
    >
      <p className="rise label text-cyan">Welcome back</p>
      <div className="rise mt-6">
        <Bull size={BULL.hero} react say={line("return", seed)} />
      </div>
      <p className="mt-10 text-caption text-dim">Tap to start where you left off</p>
    </main>
  );
}
