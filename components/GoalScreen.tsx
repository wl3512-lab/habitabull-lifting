"use client";

import { useState } from "react";
import Stepper from "./Stepper";
import { Card, GoalBar, Pill } from "./ui";
import { byId, nameOf } from "@/lib/exercises";
import { goalProgress, personalRecord, roundToIncrement } from "@/lib/engine";
import type { Goal, Routine, Session } from "@/lib/types";

/**
 * One lift, one number, one date.
 *
 * Goals are never part of onboarding — lo-fi testing showed people want to log
 * a workout before they will commit to a number. This screen is only reachable
 * after a session exists, and the bar is measured from where you started rather
 * than from zero, so a slow week never subtracts.
 */
export default function GoalScreen({
  goal,
  sessions,
  routines,
  onSave,
  onClear,
  onBack,
}: {
  goal: Goal | null;
  sessions: Session[];
  routines: Routine[];
  onSave: (g: Goal) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  // Anything on the plan, plus anything already logged.
  const options = [
    ...new Set([
      ...routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)),
      ...sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)),
    ]),
  ].filter((id) => (byId(id)?.increment ?? 0) > 0);

  const [editing, setEditing] = useState(!goal);
  const [exerciseId, setExerciseId] = useState(goal?.exerciseId ?? options[0] ?? "");
  const [target, setTarget] = useState(() => {
    if (goal) return goal.targetWeight;
    const start = personalRecord(sessions, options[0] ?? "");
    const inc = byId(options[0] ?? "")?.increment ?? 5;
    return roundToIncrement(Math.max(inc * 4, start * 1.25), inc);
  });
  const [date, setDate] = useState(
    goal?.targetDate ?? new Date(Date.now() + 84 * 864e5).toISOString().slice(0, 10)
  );

  const increment = byId(exerciseId)?.increment || 5;

  function pick(id: string) {
    setExerciseId(id);
    const inc = byId(id)?.increment ?? 5;
    setTarget(roundToIncrement(Math.max(inc * 4, personalRecord(sessions, id) * 1.25), inc));
  }

  if (!editing && goal) {
    const pct = goalProgress(sessions, goal);
    const now = personalRecord(sessions, goal.exerciseId);
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">Your goal</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="head tap -mt-0.5 shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
          >
            Change
          </button>
        </div>

        <h1 className="statement mt-2 text-[44px] text-fg">
          {nameOf(goal.exerciseId)} {goal.targetWeight} lb by{" "}
          {new Date(goal.targetDate + "T00:00:00").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
          })}
        </h1>

        <Card className="mt-7 p-[18px]">
          <GoalBar
            percent={pct}
            size="lg"
            caption={now > 0 ? `${now} lb now` : "Nothing logged on this lift yet"}
            trailing={`${Math.round(pct)}% achieved`}
          />
        </Card>

        <p className="mt-5 max-w-[34ch] text-[17px] text-dim">
          Measured from where you started, not from zero. Slow weeks do not take anything off it.
        </p>

        <div className="mt-auto pt-10">
          <Pill onClick={onBack}>Okay</Pill>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Set a goal</p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Back
        </button>
      </div>
      <h1 className="statement mt-2 text-[44px] text-fg">Something to aim at</h1>
      <p className="mt-1.5 text-[17px] text-dim">
        One lift, one number, one date. You can move it whenever you want.
      </p>

      {options.length === 0 ? (
        <p className="mt-8 text-[17px] text-dim">
          Log a session with a weighted lift first, then there is something to aim at.
        </p>
      ) : (
        <>
          <p className="label mt-8 text-dim">Which lift</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={id === exerciseId}
                className={`head h-11 rounded-full border px-5 text-[15px] transition-colors duration-150 ${
                  id === exerciseId
                    ? "border-cyan bg-cyan text-ground"
                    : "border-line-strong text-dim hover:border-fg"
                }`}
              >
                {nameOf(id)}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <Stepper
              label="Target"
              value={target}
              step={increment}
              min={increment}
              suffix="lb"
              onChange={setTarget}
            />
            <div className="rounded-2xl bg-card p-[18px]">
              <label htmlFor="by" className="label block text-dim">
                By
              </label>
              <input
                id="by"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="tabular head mt-2 h-12 w-full rounded-xl bg-raise px-4 text-[19px] text-fg focus:outline-none focus:ring-2 focus:ring-cyan"
              />
            </div>
          </div>

          <div className="mt-auto pt-10">
            <Pill
              onClick={() => onSave({ exerciseId, targetWeight: target, targetDate: date })}
              disabled={!exerciseId || !date}
            >
              Set it
            </Pill>
            {goal && (
              <button
                type="button"
                onClick={onClear}
                className="head mt-1 h-12 w-full text-[15px] text-dim transition-colors hover:text-fg"
              >
                Drop the goal
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
