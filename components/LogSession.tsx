"use client";

import { useEffect, useMemo, useState } from "react";
import Bull, { BULL } from "./Bull";
import RestTimer from "./RestTimer";
import SetLogged from "./SetLogged";
import SetRow from "./SetRow";
import { Pill } from "./ui";
import { byId, cardioLifts, makeCustomExercise, nameOf } from "@/lib/exercises";
import { EQUIPMENT, MUSCLES } from "@/lib/constraints";
import { alternativesFor, LEVEL_SETS, personalRecord, repsFor, restSeconds, startingWeight } from "@/lib/engine";
import { haptic } from "@/lib/haptics";
import { unlockAudio } from "@/lib/chime";
import { line, midsetLine } from "@/lib/voice";
import type { Equipment, Exercise, LoggedSet, Muscle, Profile, Session } from "@/lib/types";
import { count } from "@/lib/plural";

/**
 * The working screen, and the one the whole product is judged on. Someone is
 * standing between sets, sweaty, glancing down for four seconds with one thumb
 * free. Everything here is subordinate to that: one exercise, one set, one
 * orange button in the same place it is on every other screen.
 */

/**
 * The top set of the most recent session that logged this lift.
 *
 * Ranked by weight first and reps only to break a tie, which is how a lifter
 * reads their own history: 135 x 5 is the better set than 95 x 10 and the old
 * ranking said otherwise, because it compared weight x reps and 950 beats 675.
 *
 * The same multiply made this useless for every lift with no weight on it.
 * Push-ups, planks and cardio all store weight 0, so every product was 0, the
 * comparison was never true, and `reduce` returned whichever set happened to
 * be first — not the best one, not the last one. "Last time: 20 sec" under a
 * plank somebody held for a minute is the bug that got reported.
 */
export function lastAttempt(history: Session[], exerciseId: string, increment: number) {
  const prior = history
    .filter((s) => s.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  const meta = byId(exerciseId);
  for (const s of prior) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    const sets = ex?.sets.filter((x) => x.done) ?? [];
    if (sets.length === 0) continue;
    const best = sets.reduce((a, b) =>
      b.weight !== a.weight ? (b.weight > a.weight ? b : a) : b.reps > a.reps ? b : a
    );
    if (meta?.cardio) return `${best.reps} min`;
    if (meta?.hold) return `${best.reps} sec`;
    if (increment === 0) return count(best.reps, "rep");
    return `${best.weight} lb × ${best.reps}`;
  }
  return undefined;
}

export default function LogSession({
  session,
  history,
  profile,
  onChange,
  onAddCustom,
  onFinish,
  onExit,
  onExercise,
  initialPicking = false,
}: {
  session: Session;
  history: Session[];
  profile: Profile;
  onChange: (next: Session) => void;
  /** Persist a lift the library did not have, so it is there next time too. */
  onAddCustom: (e: Exercise) => void;
  onFinish: () => void;
  onExit: () => void;
  onExercise: (id: string) => void;
  /**
   * The frame gallery opens straight onto the jump list, the same way it opens
   * Onboarding onto its second screen. It is a real screen with real decisions
   * on it and it was the only one in the session flow going undocumented.
   */
  initialPicking?: boolean;
}) {
  // The lift picker for adding to a session mid-way. Null unless open; the
  // chosen muscle narrows the list the same way the routine editor does.
  const [addingMuscle, setAddingMuscle] = useState<Muscle | "cardio" | null>(null);
  const [adding, setAdding] = useState(false);
  /*
    How many sets the lift being added gets. Seeded from the level the same way
    the planned day is, so the default is unchanged — the difference is only
    that it is now a default rather than the whole decision. It defaulted to
    three and there was no control anywhere in the app to make it anything
    else, including after the fact.
  */
  const [addSets, setAddSets] = useState(LEVEL_SETS[profile.level]);
  // The "not seeing it?" fallback: name a lift the library is missing.
  const [ownOpen, setOwnOpen] = useState(false);
  const [ownName, setOwnName] = useState("");
  const [ownEquip, setOwnEquip] = useState<Equipment>("machine");
  // The exercise jump list — pick which lift to do next, any time.
  const [picking, setPicking] = useState(initialPicking);
  /** Which row in the jump list has its swap options open. */
  const [swapping, setSwapping] = useState<string | null>(null);
  const [rest, setRest] = useState<{
    seconds: number;
    exerciseId: string;
    weight: number;
    reps: number;
    /** `work` is the cardio set itself running, not the gap after it. */
    mode?: "rest" | "work";
    label?: string;
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
  const isCardio = meta?.cardio ?? false;
  const hasIncline = meta?.incline ?? false;
  const isHold = meta?.hold ?? false;
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
      reduced ? 0 : logged.best ? 1650 : 850
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

  /**
   * `patch` is for the caller that already knows the set changed as it closed.
   *
   * Cardio stops the clock and logs in one move, and doing that as two — write
   * the minutes, then complete — read the set back out of this render's
   * closure and wrote the planned time instead of the time spent. One write,
   * so there is no window between them to be stale in.
   */
  function completeSet(i: number, patch?: Partial<LoggedSet>) {
    if (!exercise) return;
    const set = { ...exercise.sets[i], ...patch };
    const sets = exercise.sets.map((s, j) => (j === i ? { ...set, done: true } : s));
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
          seconds: restSeconds(profile),
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
    unlockAudio(); // let the rest bell through on iOS later
    haptic(isBest ? "best" : "log");
    setLogged({
      summary: isCardio
        ? `${set.reps} min${set.weight > 0 ? ` · ${set.weight}% incline` : ""}`
        : isHold
          ? `${set.reps} sec`
          : increment === 0
            ? count(set.reps, "rep")
            : `${set.weight} lb × ${set.reps}`,
      best: isBest,
      resting: !lastOfSession,
      advance,
    });
  }

  function reopenSet(i: number) {
    if (!exercise) return;
    writeSets(exercise.sets.map((s, j) => (j === i ? { ...s, done: false } : s)));
  }

  // Add a lift to the session in progress. Weight, reps and set count come out
  // of the same engine that builds the planned day, for this person's level —
  // a lift added by hand is programmed exactly like one the app chose. Clearing
  // completedAt reopens a finished day, which is the whole point of "add to
  // today's session": you already trained, and you are doing a little more.
  function addLift(exerciseId: string) {
    const m = byId(exerciseId);
    // Cardio is one block of time rather than sets, so the count does not
    // apply to it and the chooser is hidden for it.
    const sets: LoggedSet[] = m?.cardio
      ? [{ weight: 0, reps: 20, done: false }]
      : Array.from({ length: Math.max(1, addSets) }, () => ({
          weight: m ? startingWeight(m, profile.level) : 0,
          reps: m ? repsFor(m, profile.level) : 8,
          done: false,
        }));
    const exercises = [...session.exercises, { exerciseId, sets }];
    onChange({ ...session, exercises, completedAt: undefined });
    setIndex(exercises.length - 1);
    setAdding(false);
    setAddingMuscle(null);
    setAddSets(LEVEL_SETS[profile.level]);
  }

  /*
    Swap a lift for one that trains the same thing, from the jump list.

    The same rules the week builder uses: cardio swaps for cardio, everything
    else is filed by muscle, and the weight resets rather than carrying a
    barbell load onto a dumbbell movement. A lift with a logged set in it is
    not offered — that set is a fact, and swapping the lift out from under it
    would either delete it or misattribute it.
  */
  function swapLift(from: string, to: string) {
    const meta = byId(to);
    const exercises = session.exercises.map((e) =>
      e.exerciseId === from
        ? {
            ...e,
            exerciseId: to,
            sets: e.sets.map((s) => ({
              ...s,
              weight: meta ? startingWeight(meta, profile.level) : 0,
            })),
          }
        : e
    );
    onChange({ ...session, exercises });
    setSwapping(null);
  }

  /*
    Add or drop a set on the lift in front of her.
    
    There was no way to do either, so a lift was however many sets it was
    created with, forever. Dropping only ever removes from the end and never
    removes a set that has been logged: the count is a plan, and a set that
    happened is a fact.
  */
  function addSet() {
    if (!exercise) return;
    const last = exercise.sets[exercise.sets.length - 1];
    writeSets([...exercise.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 8, done: false }]);
  }

  function dropSet() {
    if (!exercise) return;
    const sets = exercise.sets;
    if (sets.length <= 1 || sets[sets.length - 1].done) return;
    writeSets(sets.slice(0, -1));
  }

  // The fallback for a machine or lift the library does not have: name it, file
  // it under the muscle you were browsing, and it joins the session and is kept
  // as a custom for next time. No network needed — this is the offline path.
  function addOwn() {
    const name = ownName.trim();
    if (!name || !addingMuscle || addingMuscle === "cardio") return;
    const made = makeCustomExercise(name, addingMuscle, ownEquip, false);
    onAddCustom(made); // registers it synchronously, so addLift can find it
    setOwnName("");
    setOwnOpen(false);
    addLift(made.id);
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

  if (adding) {
    const exclude = session.exercises.map((e) => e.exerciseId);
    const options =
      addingMuscle === "cardio"
        ? cardioLifts(exclude)
        : addingMuscle
          ? alternativesFor(addingMuscle, profile.equipment, exclude)
          : [];
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <div className="flex items-center justify-between gap-3">
          <h1 className="statement text-figure text-fg">Add a lift</h1>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setAddingMuscle(null);
            }}
            className="head tap text-emphasis text-dim transition-colors hover:text-fg"
          >
            Cancel
          </button>
        </div>
        {/*
          Sets first, because it applies to whatever gets picked below and
          reading it after the tap that already added the lift would be too
          late. Hidden for cardio, which is one block of time.
        */}
        {addingMuscle !== "cardio" && (
          <>
            <p className="label mt-6 text-dim">Sets</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAddSets(n)}
                  aria-pressed={addSets === n}
                  className={`tabular min-w-11 rounded-full px-4 py-2 text-caption transition-colors ${
                    addSets === n ? "bg-cyan text-ground" : "bg-raise text-fg"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="label mt-6 text-dim">Muscle</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {MUSCLES.map((mu) => (
            <button
              key={mu}
              type="button"
              onClick={() => setAddingMuscle(mu)}
              className={`rounded-full px-3.5 py-2 text-caption capitalize transition-colors ${
                addingMuscle === mu ? "bg-cyan text-ground" : "bg-raise text-fg"
              }`}
            >
              {mu}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAddingMuscle("cardio")}
            className={`rounded-full px-3.5 py-2 text-caption transition-colors ${
              addingMuscle === "cardio" ? "bg-cyan text-ground" : "bg-raise text-fg"
            }`}
          >
            Cardio
          </button>
        </div>
        {addingMuscle && (
          <>
            <div className="mt-6 flex flex-col gap-2.5">
              {options.length === 0 ? (
                <p className="text-body text-dim">
                  Nothing new for that muscle with your equipment.
                </p>
              ) : (
                options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => addLift(o.id)}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
                  >
                    <span className="head text-emphasis text-fg">{o.name}</span>
                    <span className="head text-body text-cyan">Add</span>
                  </button>
                ))
              )}
            </div>

            {addingMuscle !== "cardio" && (
              <div className="mt-3">
                {!ownOpen ? (
                  <button
                    type="button"
                    onClick={() => setOwnOpen(true)}
                    className="tap head text-body text-cyan transition-opacity hover:opacity-80"
                  >
                    Not seeing it? Add your own
                  </button>
                ) : (
                  <div className="rise flex flex-col gap-3 rounded-2xl bg-card p-[18px]">
                    <input
                      value={ownName}
                      onChange={(e) => setOwnName(e.target.value)}
                      autoFocus
                      placeholder="Name it (e.g. Hip Abductor)"
                      className="w-full rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {EQUIPMENT.map((eq) => (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => setOwnEquip(eq)}
                          className={`rounded-full px-3.5 py-2 text-caption capitalize transition-colors ${
                            ownEquip === eq ? "bg-cyan text-ground" : "bg-raise text-fg"
                          }`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                    <Pill onClick={addOwn} disabled={!ownName.trim()} className="h-12">
                      Add it
                    </Pill>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    );
  }

  if (picking) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <div className="flex items-center justify-between gap-3">
          <h1 className="statement text-figure text-fg">Jump to</h1>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="head tap text-emphasis text-dim transition-colors hover:text-fg"
          >
            Cancel
          </button>
        </div>
        <p className="label mt-6 text-dim">This session, in any order</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {session.exercises.map((e, i) => {
            const doneN = e.sets.filter((x) => x.done).length;
            const total = e.sets.length;
            const complete = doneN === total;
            const started = doneN > 0;
            const meta = byId(e.exerciseId);
            const used = session.exercises.map((x) => x.exerciseId);
            const alts = !meta
              ? []
              : meta.cardio
                ? cardioLifts(used)
                : alternativesFor(meta.primary, profile.equipment, used);
            const open = swapping === e.exerciseId;
            return (
              <div
                key={i}
                className={`rounded-2xl transition-colors ${
                  i === index ? "bg-raise" : "bg-card"
                }`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      setPicking(false);
                    }}
                    className="flex flex-1 items-center justify-between gap-3 p-[18px] text-left"
                  >
                    <span className="flex items-center gap-2">
                      {/*
                        Where she is, said with a mark rather than only a
                        slightly lighter card — the old list distinguished the
                        current lift by a background step most people would not
                        notice standing up in a gym.
                      */}
                      {i === index && (
                        <span aria-hidden className="text-body text-cyan">
                          ▸
                        </span>
                      )}
                      <span className="head text-emphasis text-fg">{nameOf(e.exerciseId)}</span>
                    </span>
                    <span className={`tabular text-body ${complete ? "text-done" : "text-dim"}`}>
                      {complete ? "done" : `${doneN} of ${total}`}
                    </span>
                  </button>
                  {/*
                    Swapping belongs here because here is where you find out
                    the rack is taken. Hidden once a set is logged against the
                    lift: that set happened, and swapping would either bin it
                    or file it under a lift she did not do.
                  */}
                  {!started && alts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSwapping(open ? null : e.exerciseId)}
                      aria-expanded={open}
                      aria-label={`Swap ${nameOf(e.exerciseId)} for another lift`}
                      className="head grid w-16 shrink-0 place-items-center text-body text-cyan transition-opacity hover:opacity-70"
                    >
                      Swap
                    </button>
                  )}
                </div>
                {open && (
                  <div className="flex flex-col gap-1.5 px-[18px] pb-[18px]">
                    {/*
                      Every muscle name in the set is plural or a mass noun —
                      quads, hamstrings, chest, core — so "Other {muscle} lifts"
                      is ungrammatical for most of them. This phrasing reads
                      correctly for all nine and says the thing that matters:
                      why this substitution is a fair one.
                    */}
                    <p className="label text-dim">
                      {meta?.cardio ? "Other cardio" : `Also trains ${meta?.primary}`}
                    </p>
                    {alts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => swapLift(e.exerciseId, a.id)}
                        className="rounded-xl bg-ground p-3 text-left text-body text-fg transition-opacity hover:opacity-80"
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/*
          Adding was reachable only from the screen you get to after the last
          set of the last lift, so deciding mid-session to do one more thing
          meant finishing everything else first. The jump list is already the
          place you go to change what you are doing.
        */}
        <button
          type="button"
          onClick={() => {
            setPicking(false);
            setAdding(true);
          }}
          className="head mt-2.5 w-full rounded-2xl border border-dashed border-line-strong p-[18px] text-center text-emphasis text-cyan transition-colors hover:border-cyan"
        >
          + Add a lift
        </button>
      </main>
    );
  }

  if (rest) {
    return (
      <RestTimer
        seconds={rest.seconds}
        mode={rest.mode}
        workLabel={rest.label}
        nextExerciseId={rest.exerciseId}
        nextWeight={rest.weight}
        nextReps={rest.reps}
        onDone={(minutesDone) => {
          const wasWork = rest.mode === "work";
          setRest(null);
          if (!wasWork) return;
          // Stopping early logs the time actually spent, not the time asked
          // for. Running it out logs what was set.
          completeSet(activeSet, minutesDone === undefined ? undefined : { reps: minutesDone });
        }}
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
            {/*
              Jumping to another lift was an 11px eyebrow, which read as a
              label that happened to be tappable. Making it a pill fixed that
              and overcorrected: "3 of 5 · Jump to ▾" is four elements and most
              of the header width for a control used a few times a session,
              sitting level with the lift's own name.

              The count is the label, which is what it was in the first place,
              and the word is dropped — the chevron already says it opens
              something and the sheet says its own name when it does. Still a
              44px target, still on `raise`, a third of the width.
            */}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="head tap flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-raise px-3 text-caption text-cyan transition-colors hover:bg-line active:bg-line"
              aria-label={`Exercise ${index + 1} of ${session.exercises.length}. Tap to jump to another lift, add one, or swap this one.`}
            >
              <span className="tabular">
                {index + 1}/{session.exercises.length}
              </span>
              <span aria-hidden className="text-[10px]">▾</span>
            </button>
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
                  ? `Set ${i + 1}, logged ${increment === 0 ? count(s.reps, "rep") : `${s.weight} lb × ${s.reps}`}. Tap to edit.`
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
              ? `All ${count(exercise.sets.length, "set")} done`
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
            cardio={isCardio}
            incline={hasIncline}
            hold={isHold}
            lastTime={lastTime}
            onChange={(next) => updateSet(activeSet, next)}
          />
        ) : (
          <div className="rise flex flex-col items-center pt-4">
            {/*
              The lift is finished and the session is not, so what is left to
              say something true about is the lifts after this one.
            */}
            <Bull
              size={BULL.speak}
              react
              say={
                allDone
                  ? line("done", doneSets)
                  : midsetLine(
                      session.exercises.filter((e) => e.sets.some((s) => !s.done)).length,
                      doneSets
                    )
              }
            />
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 bg-ground px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {!exerciseDone ? (
          <>
            {/*
              Cardio is the one lift where the set has a duration you spend
              rather than a count you finish, so the clock comes first and the
              log comes after it. Everything else logs on the tap.
            */}
            {isCardio ? (
              <Pill
                onClick={() => {
                  const set = exercise.sets[activeSet];
                  setRest({
                    seconds: Math.max(60, set.reps * 60),
                    exerciseId: exercise.exerciseId,
                    weight: set.weight,
                    reps: set.reps,
                    mode: "work",
                    label: nameOf(exercise.exerciseId),
                  });
                }}
              >
                Go
              </Pill>
            ) : (
              <Pill onClick={() => completeSet(activeSet)}>Log set</Pill>
            )}
            <p className="mt-2.5 text-center text-body text-dim">
              {activeSet === exercise.sets.length - 1 && isLastExercise
                ? "Last set of the session."
                : "Rest as long as you need. Nothing is counting."}
            </p>
            {/*
              Changing your mind about the count, mid-lift. Deliberately quiet
              and deliberately not a stepper: it sits under the primary action
              in the thumb's path, and two 56px steppers there would compete
              with the one orange button this screen is built around.
            */}
            {!isCardio && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={dropSet}
                  disabled={exercise.sets.length <= 1 || exercise.sets[exercise.sets.length - 1].done}
                  aria-label="Remove the last set from this lift"
                  className="head tap text-body text-dim transition-colors hover:text-fg disabled:opacity-40"
                >
                  − Set
                </button>
                <span aria-hidden className="text-body text-dim">
                  ·
                </span>
                <button
                  type="button"
                  onClick={addSet}
                  aria-label="Add a set to this lift"
                  className="head tap text-body text-cyan transition-opacity hover:opacity-70"
                >
                  + Set
                </button>
              </div>
            )}
          </>
        ) : isLastExercise ? (
          <>
            <Pill onClick={onFinish} disabled={doneSets === 0}>
              Finish workout
            </Pill>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="head tap mt-2.5 block w-full text-center text-body text-cyan transition-opacity hover:opacity-70"
            >
              Add a lift
            </button>
          </>
        ) : (
          <>
            <Pill onClick={() => setIndex(index + 1)}>Next exercise</Pill>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="head tap mt-2.5 block w-full text-center text-body text-cyan transition-opacity hover:opacity-70"
            >
              Add a lift
            </button>
          </>
        )}
      </nav>
    </main>
  );
}
