"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "./ui";
import { nameOf } from "@/lib/exercises";

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
  nextExerciseId,
  nextWeight,
  nextReps,
  onDone,
  onEnd,
}: {
  seconds: number;
  /** The set you are resting before, if there is one. */
  nextExerciseId?: string;
  nextWeight?: number;
  nextReps?: number;
  onDone: () => void;
  onEnd: () => void;
}) {
  // A target timestamp, not a decrementing counter: phones suspend timers when
  // the screen locks, and coming back to a stalled clock is worse than none.
  const endsAt = useRef(Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    endsAt.current = Date.now() + seconds * 1000;
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [seconds]);

  const done = left === 0;
  const progress = seconds > 0 ? (seconds - left) / seconds : 1;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-center text-cyan">{done ? "Ready when you are" : "Resting"}</p>

      <div className="mt-8 flex justify-center">
        <svg viewBox="0 0 200 200" className="w-[240px]" role="img" aria-label={`${clock(left)} of rest remaining`}>
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
        <p className="tabular statement text-[44px] text-fg">{clock(left)}</p>
        <p className="text-[15px] text-dim">of {clock(seconds)}</p>
      </div>

      {nextExerciseId && (
        <div className="mt-[104px] rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Next up</p>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span className="head text-[19px] text-fg">{nameOf(nextExerciseId)}</span>
            <span className="tabular statement shrink-0 text-[20px] text-cyan">
              {nextWeight ? `${nextWeight} lb × ${nextReps}` : `${nextReps} reps`}
            </span>
          </div>
        </div>
      )}

      <div className="mt-auto pt-8">
        <Pill onClick={onDone}>{done ? "Next set" : "Skip the rest"}</Pill>
        <button
          type="button"
          onClick={onEnd}
          className="head tap mt-2.5 block w-full text-center text-[15px] text-dim transition-colors hover:text-fg"
        >
          End the workout here
        </button>
      </div>
    </main>
  );
}
