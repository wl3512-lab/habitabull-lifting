"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "./ui";
import { chime } from "@/lib/chime";
import { haptic } from "@/lib/haptics";
import { byId, nameOf } from "@/lib/exercises";
import { secondsRemaining } from "@/lib/session-memory";
import { count } from "@/lib/plural";

const R = 84;
const CIRCUMFERENCE = 2 * Math.PI * R;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

/**
 * Rest between sets, drawn as the 45 lb plate from the 2023 app icon (`app
 * desgin 2.png`) — the brand's own object doing a job instead of a generic
 * progress ring.
 *
 * It is guidance, not a deadline. p22's fifth finding is that beginners
 * struggle "without enough instruction on pacing, rest periods", so the app
 * has an opinion; but nothing here counts up, nags, or advances on its own when
 * the ring fills. Someone standing in a gym decides when they are ready, and an
 * app that yanks the screen away mid-rest is the pressure this product exists
 * to avoid.
 */
export default function RestTimer({
  seconds,
  deadline,
  mode = "rest",
  workLabel,
  nextExerciseId,
  onPickNext,
  nextWeight,
  nextReps,
  onNextWeight,
  weightStep = 5,
  onAddSet,
  onDropSet,
  canDropSet = false,
  setsLeft,
  onDone,
  onEnd,
}: {
  seconds: number;
  deadline?: number;
  /**
   * `rest` is the gap between sets. `work` is the set itself, which only
   * cardio has: a treadmill is twenty minutes of doing the thing, not four
   * blocks with a wait between, so the clock she sets is the clock that runs.
   */
  mode?: "rest" | "work";
  /** The lift being done, named, in work mode. */
  workLabel?: string;
  /** The set you are resting before, if there is one. */
  nextExerciseId?: string;
  /**
   * Change what comes next, from here. Between sets is when you find out the
   * rack is taken or that you are done with this lift, and until this existed
   * the only way to act on it was to finish the rest, get back to the working
   * screen and open the list from there.
   */
  onPickNext?: () => void;
  nextWeight?: number;
  nextReps?: number;
  /**
   * Change the weight on the set you are resting before, from here.
   *
   * Rest is when you find out the number is wrong. The plates are already on
   * the bar, or the rack only has the next size up, or the last set moved so
   * badly that the next one should not be the same — and until this existed the
   * only way to act on any of it was to sit out the rest, get back to the
   * working screen and fix it there with the bar loaded wrong in front of you.
   *
   * Absent for a lift with no weight on it, which is why it is optional rather
   * than always drawn: a stepper either side of "12 reps" is a control that
   * cannot do anything.
   */
  onNextWeight?: (lb: number) => void;
  /** The smallest sensible jump for that lift, in lb. */
  weightStep?: number;
  /**
   * Add or drop a set on the lift she is resting before.
   *
   * The same pair that sits under the primary action on the working screen,
   * because rest is when the decision actually gets made: whether there is one
   * more in her is something she finds out standing still, two minutes after
   * the set that raised the question. Reaching it meant skipping the rest to
   * get back to a screen that had the buttons.
   *
   * Dropping is refused, not hidden, when the last set is already logged or it
   * is the only one left: a set that happened is a fact, and a lift with no
   * sets is not a lift.
   */
  onAddSet?: () => void;
  onDropSet?: () => void;
  canDropSet?: boolean;
  /** Sets still to do on that lift, the one she is resting before included. */
  setsLeft?: number;
  /**
   * In work mode this hands back the minutes actually spent, which is not
   * always the minutes asked for. Somebody who sets twenty and steps off at
   * twelve did twelve, and logging the twenty would be the app writing down a
   * number she did not do.
   */
  onDone: (minutesDone?: number) => void;
  onEnd: () => void;
}) {
  const working = mode === "work";
  // A target timestamp, not a decrementing counter: phones suspend timers when
  // the screen locks, and coming back to a stalled clock is worse than none.
  const endsAt = useRef(deadline ?? Date.now() + seconds * 1000);
  const rang = useRef(false);
  const [left, setLeft] = useState(() => secondsRemaining(endsAt.current));

  useEffect(() => {
    endsAt.current = deadline ?? Date.now() + seconds * 1000;
    rang.current = false;
    const tick = () =>
      setLeft(secondsRemaining(endsAt.current));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [seconds, deadline]);

  const done = left === 0;
  const progress = seconds > 0 ? (seconds - left) / seconds : 1;

  // The one moment this screen speaks up: a soft bell and a buzz when rest is
  // over. It still never advances on its own — someone in a gym decides when
  // they are ready — it only says the wait it suggested has passed.
  useEffect(() => {
    if (done && !rang.current) {
      rang.current = true;
      chime();
      haptic("best");
    }
  }, [done]);

  /** Minutes actually spent, rounded to the nearest one and never zero. */
  const spent = () => Math.max(1, Math.round((seconds - left) / 60));

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-center text-cyan">
        {working
          ? done
            ? "That is your time"
            : (workLabel ?? "Working")
          : done
            ? "Ready when you are"
            : "Resting"}
      </p>

      <div className="mt-8 flex justify-center">
        <svg
          viewBox="0 0 200 200"
          className="w-[240px]"
          role="img"
          aria-label={`${clock(left)} ${working ? "left on the clock" : "of rest remaining"}`}
        >
          <circle cx="100" cy="100" r="92" className="fill-card" />
          <circle cx="100" cy="100" r="92" className="fill-none stroke-raise" strokeWidth="6" />
          {/* Four spokes, as on the plate. */}
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1="100"
              y1="100"
              x2="100"
              y2="16"
              className="stroke-line"
              strokeWidth="5"
              transform={`rotate(${deg} 100 100)`}
              strokeDasharray="42 42"
              strokeDashoffset="-40"
            />
          ))}
          {/* The track the arc runs on. Without it, a barely-started rest
              reads as a stray cyan tick rather than a ring filling. */}
          <circle cx="100" cy="100" r={R} className="fill-none stroke-raise" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={R}
            className="fill-none stroke-cyan"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
          {/* The hub, where the icon embosses "45 LB." */}
          <circle cx="100" cy="100" r="46" className="fill-deep" />
        </svg>
      </div>

      <div className="-mt-[152px] flex flex-col items-center">
        <p className="tabular statement text-figure text-fg">{clock(left)}</p>
        <p className="text-body text-dim">of {clock(seconds)}</p>
      </div>

      {/*
        Pressable when there is somewhere to go, a plain card when there is
        not, so the box never looks tappable on a screen where tapping does
        nothing. Cancelling out of the list comes back here.

        The reps are optional on the way in, and an older version printed them
        straight into the string — so a next set that arrived without them read
        "undefined reps" at somebody standing between sets. The name alone is
        still a useful thing to say; a number nobody has is not.
      */}
      {!working && nextExerciseId && (() => {
        const name = nameOf(nextExerciseId);
        /*
          The weight is adjustable where there is a weight to adjust. A lift
          logged in reps or seconds carries none, so it keeps the plain figure
          and the row stays a sentence rather than a control panel.
        */
        const tunable =
          Boolean(onNextWeight) && nextWeight !== undefined && nextReps !== undefined && weightStep > 0;
        const meta = byId(nextExerciseId);
        const figure = nextReps === undefined ? null
          : meta?.cardio ? `${nextReps} min${meta.incline && nextWeight ? ` · ${nextWeight}% incline` : ""}`
          : meta?.hold ? `${nextReps} sec`
          : nextWeight ? `${nextWeight} lb × ${nextReps}`
          : count(nextReps, "rep");

        const head = (
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Next up</p>
            {onPickNext &&
              (tunable ? (
                /*
                  Its own control once the card holds steppers: a card-sized
                  button cannot contain them, and a "Change" that is really the
                  whole card is a tap target that swallows the thumb aiming for
                  minus.
                */
                <button
                  type="button"
                  onClick={onPickNext}
                  className="head tap -my-2 py-2 text-caption text-cyan transition-opacity hover:opacity-70"
                >
                  Change
                </button>
              ) : (
                <span className="head text-caption text-cyan">Change</span>
              ))}
          </div>
        );

        if (!tunable) {
          const inner = (
            <>
              {head}
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="head text-head text-fg">{name}</span>
                {figure && (
                  <span className="tabular statement shrink-0 text-head text-cyan">{figure}</span>
                )}
              </div>
            </>
          );
          return onPickNext ? (
            <button
              type="button"
              onClick={onPickNext}
              aria-label={`Next up: ${name}. Change what comes next.`}
              className="mt-[104px] w-full rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
            >
              {inner}
            </button>
          ) : (
            <div className="mt-[104px] rounded-2xl bg-card p-[18px]">{inner}</div>
          );
        }

        const lb = nextWeight ?? 0;
        const bump = (dir: 1 | -1) =>
          onNextWeight?.(Math.max(0, Math.round((lb + dir * weightStep) * 2) / 2));

        return (
          <div className="mt-[104px] rounded-2xl bg-card p-[18px]">
            {head}
            <p className="head mt-1.5 text-head text-fg">{name}</p>
            {/*
              44px targets rather than the 56 the setup steppers use. This sits
              on a screen that already has an orange button and a ring on it,
              and the number between them is read at a glance far more often
              than it is changed — it is a correction, not the main event.
            */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => bump(-1)}
                disabled={lb <= 0}
                aria-label={`Take ${weightStep} pounds off ${name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raise text-title leading-none text-cyan transition-colors duration-quick hover:bg-line active:bg-line disabled:opacity-30"
              >
                −
              </button>
              <p
                aria-live="polite"
                className="tabular statement min-w-0 flex-1 text-center text-head text-cyan"
              >
                {/* Always in pounds here, including at zero: the row is a
                    weight control, and "8 reps" above a minus button reads as
                    the minus doing nothing. */}
                {`${lb} lb × ${nextReps}`}
              </p>
              <button
                type="button"
                onClick={() => bump(1)}
                aria-label={`Put ${weightStep} more pounds on ${name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raise text-title leading-none text-cyan transition-colors duration-quick hover:bg-line active:bg-line"
              >
                +
              </button>
            </div>
          </div>
        );
      })()}

      {/*
        Under the card rather than in it. The card is a statement about what is
        coming; this changes how much of it there is, and the count is the only
        feedback there is — the set list it edits is on the screen behind this
        one, so a plus that silently did something would be a plus that did
        nothing as far as anyone standing here can tell.
      */}
      {!working && (onAddSet || onDropSet) && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDropSet}
            disabled={!onDropSet || !canDropSet}
            aria-label="Remove the last set from this lift"
            className="head tap text-body text-dim transition-colors hover:text-fg disabled:opacity-40"
          >
            − Set
          </button>
          {setsLeft === undefined ? (
            <span aria-hidden className="text-body text-dim">
              ·
            </span>
          ) : (
            <span aria-live="polite" className="tabular text-body text-dim">
              {count(setsLeft, "set")} left
            </span>
          )}
          <button
            type="button"
            onClick={onAddSet}
            disabled={!onAddSet}
            aria-label="Add a set to this lift"
            className="head tap text-body text-cyan transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            + Set
          </button>
        </div>
      )}

      <div className="mt-auto pt-8">
        <Pill onClick={() => onDone(working ? (done ? undefined : spent()) : undefined)}>
          {working ? (done ? "Log it" : "Stop here and log it") : done ? "Next set" : "Skip the rest"}
        </Pill>
        <button
          type="button"
          onClick={onEnd}
          className="head tap mt-2.5 block w-full text-center text-body text-dim transition-colors hover:text-fg"
        >
          End the workout here
        </button>
      </div>
    </main>
  );
}
