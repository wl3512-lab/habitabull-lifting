"use client";

import { useMemo, useState } from "react";
import Bull from "./Bull";
import RestTimer from "./RestTimer";
import SetRow from "./SetRow";
import { Pill } from "./ui";
import { byId, nameOf } from "@/lib/exercises";
import { personalRecord, restSeconds } from "@/lib/engine";
import { line } from "@/lib/voice";
import type { LoggedSet, Session } from "@/lib/types";

/**
 * The working screen, and the one the whole product is judged on. Someone is
 * standing between sets, sweaty, glancing down for four seconds with one thumb
 * free. Everything here is subordinate to that: one exercise, one set, one
 * orange button in the same place it is on every other screen.
 */

/** The most recent completed attempt at this lift, phrased for the cue line. */
function lastAttempt(history: Session[], exerciseId: string, increment: number) {
  const prior = history
    .filter((s) => s.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of prior) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    const sets = ex?.sets.filter((x) => x.done) ?? [];
    if (sets.length === 0) continue;
    const best = sets.reduce((a, b) => (b.weight * b.reps > a.weight * a.reps ? b : a));
    return increment === 0 ? `${best.reps} reps` : `${best.weight} lb × ${best.reps}`;
  }
  return undefined;
}

export default function LogSession({
  session,
  history,
  onChange,
  onFinish,
  onExit,
  onExercise,
}: {
  session: Session;
  history: Session[];
  onChange: (next: Session) => void;
  onFinish: () => void;
  onExit: () => void;
  onExercise: (id: string) => void;
}) {
  const [rest, setRest] = useState<{
    seconds: number;
    exerciseId: string;
    weight: number;
    reps: number;
  } | null>(null);
  const [index, setIndex] = useState(() => {
    const i = session.exercises.findIndex((e) => e.sets.some((s) => !s.done));
    return i === -1 ? 0 : i;
  });

  const exercise = session.exercises[index] as (typeof session.exercises)[number] | undefined;
  const meta = exercise ? byId(exercise.exerciseId) : undefined;
  const increment = meta?.increment ?? 5;
  const activeSet = exercise ? exercise.sets.findIndex((s) => !s.done) : -1;
  const pr = useMemo(
    () => (exercise ? personalRecord(history, exercise.exerciseId) : 0),
    [history, exercise]
  );
  const lastTime = useMemo(
    () => (exercise ? lastAttempt(history, exercise.exerciseId, increment) : undefined),
    [history, exercise, increment]
  );

  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0
  );
  const allDone = doneSets === totalSets;
  const exerciseDone = activeSet === -1;
  const isLastExercise = index === session.exercises.length - 1;

  function writeSets(sets: LoggedSet[]) {
    if (!exercise) return;
    const exercises = session.exercises.map((e, i) => (i === index ? { ...e, sets } : e));
    onChange({ ...session, exercises });
  }

  function updateSet(i: number, next: LoggedSet) {
    if (!exercise) return;
    writeSets(exercise.sets.map((s, j) => (j === i ? next : s)));
  }

  function completeSet(i: number) {
    if (!exercise) return;
    const sets = exercise.sets.map((s, j) => (j === i ? { ...s, done: true } : s));
    // Carry what you actually did into the sets ahead, so the next row is
    // already right and needs zero taps in the common case.
    writeSets(sets.map((s, j) => (j > i && !s.done ? { ...s, weight: sets[i].weight } : s)));

    const lastOfExercise = i === exercise.sets.length - 1;
    if (lastOfExercise && !isLastExercise) setIndex(index + 1);

    // No rest after the final set — there is nothing to be ready for.
    if (lastOfExercise && isLastExercise) return;

    const upcoming = lastOfExercise
      ? session.exercises[index + 1]
      : { exerciseId: exercise.exerciseId, sets: sets.slice(i + 1) };
    const nextSet = lastOfExercise ? upcoming.sets[0] : sets[i + 1];
    setRest({
      seconds: restSeconds(exercise.exerciseId),
      exerciseId: upcoming.exerciseId,
      weight: lastOfExercise ? nextSet.weight : sets[i].weight,
      reps: nextSet.reps,
    });
  }

  function reopenSet(i: number) {
    if (!exercise) return;
    writeSets(exercise.sets.map((s, j) => (j === i ? { ...s, done: false } : s)));
  }

  if (!exercise) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <h1 className="statement text-[44px] text-fg">Nothing to work with.</h1>
        <p className="mt-1.5 text-[17px] text-dim">
          Everything on today&apos;s plan got ruled out. Loosen what you asked to work around,
          or train a different day.
        </p>
        <div className="mt-auto pt-10">
          <Pill onClick={onExit}>Back</Pill>
        </div>
      </main>
    );
  }

  if (rest) {
    return (
      <RestTimer
        seconds={rest.seconds}
        nextExerciseId={rest.exerciseId}
        nextWeight={rest.weight}
        nextReps={rest.reps}
        onDone={() => setRest(null)}
        onEnd={() => {
          setRest(null);
          onFinish();
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">
      <header className="px-6 pb-1 pt-12">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                aria-label="Previous exercise"
                className="-ml-2 grid h-11 w-9 place-items-center text-[16px] leading-none text-dim transition-colors hover:text-fg"
              >
                ←
              </button>
            )}
            <p className="label text-cyan">
              Exercise {index + 1} of {session.exercises.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="head tap text-[17px] text-fg transition-opacity hover:opacity-70"
          >
            End
          </button>
        </div>

        <h1 className="statement mt-2 text-[44px] text-fg">{nameOf(exercise.exerciseId)}</h1>

        {/* Sets you have finished. Tap one to reopen and correct it. */}
        <div className="mt-3 flex gap-2.5">
          {exercise.sets.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => s.done && reopenSet(i)}
              disabled={!s.done}
              aria-label={
                s.done
                  ? `Set ${i + 1}, logged ${increment === 0 ? `${s.reps} reps` : `${s.weight} lb × ${s.reps}`}. Tap to edit.`
                  : `Set ${i + 1}, not logged`
              }
              // Drawn 6px, tapped at 44. The padding grows the target and the
              // negative margin gives the layout its 6px back — these are how
              // you correct a mis-logged set, one-handed, between working sets.
              className="group flex-1 py-[19px] -my-[19px]"
            >
              <span
                className={`block h-1.5 w-full rounded-full transition-colors duration-200 ${
                  s.done
                    ? "bg-green group-hover:bg-green/80"
                    : i === activeSet
                      ? "bg-line-strong"
                      : "bg-raise"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[17px] text-dim">
            {exerciseDone
              ? `All ${exercise.sets.length} sets done`
              : `Set ${activeSet + 1} of ${exercise.sets.length}`}
          </p>
          {pr > 0 && <span className="tabular text-[15px] text-dim">· Best {pr} lb</span>}
          <button
            type="button"
            onClick={() => onExercise(exercise.exerciseId)}
            className="head tap text-[15px] text-cyan transition-opacity hover:opacity-70"
          >
            How to do it
          </button>
        </div>
      </header>

      <div className="flex-1 px-6 pb-6 pt-4">
        {!exerciseDone ? (
          <SetRow
            key={activeSet}
            set={exercise.sets[activeSet]}
            increment={increment}
            lastTime={lastTime}
            onChange={(next) => updateSet(activeSet, next)}
          />
        ) : (
          <div className="rise flex flex-col items-center pt-4">
            <Bull size={132} react say={line(allDone ? "done" : "midset", doneSets)} />
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 bg-ground px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {!exerciseDone ? (
          <>
            <Pill onClick={() => completeSet(activeSet)}>Log set</Pill>
            <p className="mt-2.5 text-center text-[15px] text-dim">
              {activeSet === exercise.sets.length - 1 && isLastExercise
                ? "Last set of the session."
                : "Rest as long as you need. Nothing is counting."}
            </p>
          </>
        ) : isLastExercise ? (
          <Pill onClick={onFinish} disabled={doneSets === 0}>
            Finish workout
          </Pill>
        ) : (
          <Pill onClick={() => setIndex(index + 1)}>Next exercise</Pill>
        )}
      </nav>
    </main>
  );
}
