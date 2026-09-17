"use client";

import { useEffect, useRef, useState } from "react";
import Bull, { BULL } from "./Bull";
import { line } from "@/lib/voice";
import { count } from "@/lib/plural";
import type { WeekDay } from "@/lib/calendar";
import type { ArrivalMood } from "@/lib/arrival";

/**
 * What the app says when you open it, once a day.
 *
 * The sibling of `Comeback`, and deliberately built to its measurements: same
 * centred column, same bull at `hero`, same tap-to-skip, same auto-advance. The
 * two are the only timed beats in the product and they should read as one kind
 * of thing rather than two features that happen to both use the mascot.
 *
 * A training day and a rest day are told apart four ways, and not one of them
 * is a colour — this system has exactly two drenched screens and spending that
 * scarcity on the most frequent moment in the app would cost both of them
 * their meaning.
 *
 * 1. Direction. Training arrives from below; rest comes down and lands.
 * 2. Tempo. Training steps at 60ms on `standard`, which is brisk. Rest steps
 *    at 140ms on `deliberate`, which is not.
 * 3. The bull. He braces on a training day and lies down, eyes shut, on a
 *    rest day, because nothing is being asked of anybody and a mascot bouncing
 *    about a day off would be the app pretending it is an event.
 * 4. What the screen is of. A training day names the day and points at it. A
 *    rest day looks the other way and draws the week she has already banked,
 *    one session at a time, which is the argument the whole product is making
 *    said as a picture instead of a sentence.
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

/**
 * What a rest day with a week behind it is worth, on top of the 2800.
 *
 * The extra time exists to let the banked dots land — the last one is on
 * screen around 1.4s — so it is spent only when there are dots to draw. A rest
 * day early in the week has nothing banked yet and holds for the usual 2800,
 * which is the right length for the screen it is then showing.
 */
const BANKED_EXTRA = 400;

/** How far apart the blocks of each screen arrive. Read by .rise and .settle. */
const STAGGER = { train: "60ms", rest: "140ms" } as const;

export default function Arrival({
  mood,
  seed,
  nextDay,
  label,
  week,
  preview = false,
  onDone,
}: {
  mood: ArrivalMood;
  /** Keeps the line steady across re-renders instead of reshuffling. */
  seed: number;
  /** The next day on the plan, named. Rest days only, and only if there is one. */
  nextDay?: string | null;
  /** What today is called on her plan. Training days, when the day has a name. */
  label?: string | null;
  /** The week as it stands. Rest days only: it is what the screen is about. */
  week?: WeekDay[];
  /** Held open for the frames gallery: no hold, no exit, nothing to miss. */
  preview?: boolean;
  onDone: () => void;
}) {
  const resting = mood === "rest";
  const [leaving, setLeaving] = useState(false);

  /*
    Seven dots and nothing filled is not a rest day, it is a bad week, and
    drawing it slowly would make a ceremony of it. The beat only ever runs
    after a completed session (see `arrivalMood`), but that session can be from
    last week — and on a Sunday or a Monday it usually is — so this is checked
    rather than assumed. With nothing banked the screen falls back to what it
    was before the dots existed, which is a screen that already worked.
  */
  const banked = resting ? (week ?? []).filter((d) => d.trained).length : 0;

  // Ref so the timers are set once on mount; depending on onDone's identity
  // would restart the hold on every re-render of the parent.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (preview) return;
    // The exit runs on screen, so the next screen is arriving into a fade
    // rather than replacing a hard edge. 150ms is the `quick` token.
    const hold = HOLD[mood] + (banked > 0 ? BANKED_EXTRA : 0);
    const leave = setTimeout(() => setLeaving(true), hold);
    const finish = setTimeout(() => done.current(), hold + 150);
    return () => {
      clearTimeout(leave);
      clearTimeout(finish);
    };
  }, [mood, preview, banked]);

  /*
    Sequential by construction. Hand-typed step numbers go wrong the moment a
    block turns out to be conditional — a skipped number leaves a hole in the
    sequence, which is a hitch you can see — and three of these are.
  */
  let n = 0;
  const step = () => ({ "--step": n++ }) as React.CSSProperties;

  const enter = resting ? "settle" : "rise";

  return (
    <main
      onClick={() => !preview && done.current()}
      role="status"
      aria-live="polite"
      style={{ "--stagger": resting ? STAGGER.rest : STAGGER.train } as React.CSSProperties}
      className={`mx-auto flex w-full max-w-[430px] flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center ${
        leaving ? "depart" : ""
      }`}
    >
      {/*
        The day's own name, not the word "today". The app knows this is leg day
        and saying so is both more useful and more of an occasion than a noun
        that is true of every screen ever built. Falls back when the day has no
        name yet, or when the beat is a comeback on an unscheduled day.
      */}
      <p className={`${enter} stage label text-cyan`} style={step()}>
        {resting ? "Rest day" : label || "Today"}
      </p>

      <div className={`${enter} stage mt-6`} style={step()}>
        <Bull size={BULL.hero} react={!resting} pose={resting ? "rest" : undefined} say={line(mood, seed)} />
      </div>

      {/*
        The week she has already put in, drawn one session at a time.

        Only the days she trained animate. The empty days are on screen when
        the row arrives and stay put — same rule as the consistency grid, for
        the same reason: an app whose whole argument is that a gap is not a
        failure cannot then spend a second drawing attention to every gap.
      */}
      {resting && banked > 0 && (
        <div className={`${enter} stage mt-8`} style={step()}>
          <ul
            className="flex justify-center gap-2.5"
            style={{ "--lead": "620ms", "--gap": "100ms" } as React.CSSProperties}
          >
            {(week ?? []).map((d) => (
              <li key={d.iso} className="flex flex-col items-center gap-2">
                <span
                  aria-hidden
                  style={d.trained ? ({ "--cell": d.index } as React.CSSProperties) : undefined}
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 ${
                    d.trained ? "cell-in border-done bg-done" : "border-raise"
                  }`}
                />
                <span className={`text-caption ${d.trained ? "text-fg" : "text-dim"}`}>
                  {d.initial}
                </span>
              </li>
            ))}
          </ul>
          <p className="sr-only">{count(banked, "session")} logged this week.</p>
        </div>
      )}

      {/*
        Where she is next in, so a rest day points at the next session rather
        than reading as a closed door. Left out entirely when the schedule
        cannot name one — a shrug is worse than silence.
      */}
      {resting && nextDay && (
        <p className={`${enter} stage mt-6 text-emphasis text-dim`} style={step()}>
          Next one&apos;s {nextDay}.
        </p>
      )}

      <p className={`${enter} stage mt-10 text-caption text-dim`} style={step()}>
        Tap to skip
      </p>
    </main>
  );
}
