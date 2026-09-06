"use client";

import { useEffect, useMemo, useState } from "react";
import Bull, { BULL } from "./Bull";
import RestTimer from "./RestTimer";
import SetLogged from "./SetLogged";
import SetRow from "./SetRow";
import { Pill } from "./ui";
import { byId, nameOf } from "@/lib/exercises";
import { personalRecord, restSeconds } from "@/lib/engine";
import { haptic } from "@/lib/haptics";
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
  // The confirmation beat between logging a set and the rest timer. Null except
  // for the ~650ms it is on screen; `advance` is the deferred move to rest.
  const [logged, setLogged] = useState<{
    summary: string;
    best: boolean;
    resting: boolean;
    advance: () => void;
  } | null>(null);

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

  // The beat acknowledges the set and then gets out of the way. It is short
  // because the set is already logged — the only thing waiting is the word for
  // it — and it disappears entirely under reduced motion, where it resolves on
  // the next tick and the flow behaves exactly as it did before this existed.
  useEffect(() => {
    if (!logged) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(
      () => {
        logged.advance();
        setLogged(null);
      },
      reduced ? 0 : 650
    );
    return () => clearTimeout(t);
  }, [logged]);

  // A tap anywhere on the beat takes her straight to rest — nobody who already
  // knows the set landed should have to watch the animation finish.
  function skipConfirm() {
    if (!logged) return;
    logged.advance();
    setLogged(null);
  }

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
    const set = exercise.sets[i];
    const sets = exercise.sets.map((s, j) => (j === i ? { ...s, done: true } : s));
    // Carry what you actually did into the sets ahead, so the next row is
    // already right and needs zero taps in the common case. This write happens
    // now, not after the confirmation — the set is in the book the instant she
    // taps, and stays there even if she leaves mid-beat.
    writeSets(sets.map((s, j) => (j > i && !s.done ? { ...s, weight: sets[i].weight } : s)));

    // What logging does *next* — the move to the rest timer — is what waits
    // behind the confirmation, not the logging itself. Composed here as a
    // closure so the beat can fire it on its own timer or on a tap to skip.
    const lastOfExercise = i === exercise.sets.length - 1;
    const lastOfSession = lastOfExercise && isLastExercise;
    let advance: () => void;
    if (lastOfSession) {
      // Nothing to rest for; the beat clears and the Finish button is waiting.
      advance = () => {};
    } else {
      const upcoming = lastOfExercise
        ? session.exercises[index + 1]
        : { exerciseId: exercise.exerciseId, sets: sets.slice(i + 1) };
      const nextSet = lastOfExercise ? upcoming.sets[0] : sets[i + 1];
      advance = () => {
        if (lastOfExercise) setIndex(index + 1);
        setRest({
          seconds: restSeconds(exercise.exerciseId),
          exerciseId: upcoming.exerciseId,
          weight: lastOfExercise ? nextSet.weight : sets[i].weight,
          reps: nextSet.reps,
        });
      };
    }

    // A best is only a best when there was a number to beat. The first time a
    // lift is ever logged is not a personal record, whatever the arithmetic
    // says — the bull does not congratulate someone for turning up once, and
    // the product's whole voice is about not claiming a number you cannot back.
    const isBest = increment > 0 && pr > 0 && set.weight > pr;
    haptic(isBest ? "best" : "log");
    setLogged({
      summary: increment === 0 ? `${set.reps} reps` : `${set.weight} lb × ${set.reps}`,
      best: isBest,
      resting: !lastOfSession,
      advance,
    });
  }

  function reopenSet(i: number) {
    if (!exercise) return;
    writeSets(exercise.sets.map((s, j) => (j === i ? { ...s, done: false } : s)));
  }

  if (!exercise) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <h1 className="statement text-figure text-fg">Nothing to work with.</h1>
        <p className="mt-1.5 text-emphasis text-dim">
          Everything on today&apos;s plan got ruled out. Loosen what you asked to work around,
          or train a different day.
        </p>
        <div className="mt-auto pt-10">
          <Pill onClick={onExit}>Back</Pill>
        </div>
      </main>
    );
  }

  if (logged) {
    return (
      <SetLogged
        summary={logged.summary}
        best={logged.best}
        resting={logged.resting}
        onSkip={skipConfirm}
      />
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
                className="-ml-2 grid h-11 w-9 place-items-center text-emphasis leading-none text-dim transition-colors hover:text-fg"
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
            className="head tap text-emphasis text-fg transition-opacity hover:opacity-70"
          >
            End
          </button>
        </div>

        <h1 className="statement mt-2 text-figure text-fg">{nameOf(exercise.exerciseId)}</h1>

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
                className={`block h-1.5 w-full rounded-full transition-colors duration-standard ${
                  s.done
                    ? "bg-done group-hover:bg-done/80"
                    : i === activeSet
                      ? "bg-line-strong"
                      : "bg-raise"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-emphasis text-dim">
            {exerciseDone
              ? `All ${exercise.sets.length} sets done`
              : `Set ${activeSet + 1} of ${exercise.sets.length}`}
          </p>
          {pr > 0 && <span className="tabular text-body text-dim">· Best {pr} lb</span>}
          <button
            type="button"
            onClick={() => onExercise(exercise.exerciseId)}
            className="head tap text-body text-cyan transition-opacity hover:opacity-70"
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
            <Bull size={BULL.speak} react say={line(allDone ? "done" : "midset", doneSets)} />
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 bg-ground px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {!exerciseDone ? (
          <>
            <Pill onClick={() => completeSet(activeSet)}>Log set</Pill>
            <p className="mt-2.5 text-center text-body text-dim">
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
