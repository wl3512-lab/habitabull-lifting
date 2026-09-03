"use client";

import { useState } from "react";
import { Pill } from "./ui";
import { LEVEL_SETS, repsFor, startingWeight } from "@/lib/engine";
import { byId, nameOf } from "@/lib/exercises";
import type { SharedDay } from "@/lib/cloud";
import type { PlannedExercise, Profile, Routine } from "@/lib/types";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Where somebody else's workout lands in your week.
 *
 * Copying is not importing: the lifts come across, the numbers do not. Every
 * weight, set and rep is computed here by the same engine that would have
 * built the day from scratch, for the level of the person copying it. Handing
 * a beginner the loads of somebody who has been training for a year is the
 * exact thing the leaderboard did wrong, in a different costume.
 *
 * Two ways to take it, because there are two real intentions: swap one of your
 * days for theirs, or borrow the lifts into a day you already have.
 */
export default function CopyWorkout({
  source,
  from,
  routines,
  profile,
  onDone,
  onCancel,
}: {
  source: SharedDay;
  /** Whose workout this is, for the sentence at the top. */
  from: string;
  routines: Routine[];
  profile: Profile;
  onDone: (next: Routine[]) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState(0);
  const [mode, setMode] = useState<"replace" | "add">("replace");

  // Anything the copier's library does not have is dropped rather than faked.
  const lifts = source.exercises.map(byId).filter((e) => e !== undefined);
  const missing = source.exercises.length - lifts.length;

  const planned = (): PlannedExercise[] =>
    lifts.map((ex) => ({
      exerciseId: ex.id,
      sets: LEVEL_SETS[profile.level],
      reps: repsFor(ex, profile.level),
      // Her starting weight, from her level. Never theirs.
      weight: startingWeight(ex, profile.level),
    }));

  function apply() {
    const next = routines.map((r, i) => {
      if (i !== target) return r;
      if (mode === "replace") {
        return { ...r, label: source.label, exercises: planned() };
      }
      const already = new Set(r.exercises.map((e) => e.exerciseId));
      return { ...r, exercises: [...r.exercises, ...planned().filter((e) => !already.has(e.exerciseId))] };
    });
    onDone(next);
  }

  const day = routines[target];

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Copying from {from}</p>
        <button
          type="button"
          onClick={onCancel}
          className="head tap -mt-0.5 shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Cancel
        </button>
      </div>

      <h1 className="statement mt-2 text-[44px] leading-none text-fg">{source.label}</h1>
      <p className="mt-2 text-[17px] leading-snug text-dim">
        {lifts.map((e) => nameOf(e.id)).join(", ")}
      </p>
      {missing > 0 && (
        <p className="mt-1.5 text-[15px] text-dim">
          {missing} {missing === 1 ? "lift is" : "lifts are"} not in your library and will be
          left out.
        </p>
      )}

      <section className="mt-6 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">Put it on</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {routines.map((r, i) => (
            <button
              key={r.day}
              type="button"
              onClick={() => setTarget(i)}
              aria-pressed={i === target}
              className={`head h-11 min-w-[64px] rounded-full border px-4 text-[15px] transition-colors duration-150 ${
                i === target
                  ? "border-cyan bg-cyan text-ground"
                  : "border-line-strong text-dim hover:border-fg"
              }`}
            >
              {SHORT[r.day]}
            </button>
          ))}
        </div>
        {day && (
          <p className="mt-3 text-[15px] leading-snug text-dim">
            {SHORT[day.day]} is currently {day.label}, {day.exercises.length}{" "}
            {day.exercises.length === 1 ? "lift" : "lifts"}.
          </p>
        )}
      </section>

      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">How</p>
        <div className="mt-3 flex flex-col gap-2">
          {(
            [
              ["replace", "Replace that day", `It becomes ${source.label}. What was there goes.`],
              ["add", "Add these lifts to it", "Keeps your day and appends anything new."],
            ] as const
          ).map(([id, title, sub]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
                mode === id ? "border-cyan bg-raise" : "border-transparent bg-raise/40 hover:bg-raise/70"
              }`}
            >
              <span className="head block text-[17px] text-fg">{title}</span>
              <span className="block text-[15px] text-dim">{sub}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="mt-4 text-[15px] leading-snug text-dim">
        Their lifts, your weights. Everything starts where the app would have started you
        anyway, and moves from there.
      </p>

      <div className="mt-auto pt-8">
        <Pill onClick={apply} disabled={lifts.length === 0}>
          {mode === "replace" ? `Make ${SHORT[day?.day ?? 0]} this` : `Add to ${SHORT[day?.day ?? 0]}`}
        </Pill>
      </div>
    </main>
  );
}
