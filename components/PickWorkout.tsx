"use client";

import { useEffect, useRef, useState } from "react";
import { adjustedLine, readConstraints } from "@/lib/adjust";
import type { Constraints } from "@/lib/constraints";
import { nameOf } from "@/lib/exercises";
import { generateRoutine } from "@/lib/engine";
import { libraryChoices, sameLineup, weekChoices } from "@/lib/workouts";
import { TEMPLATES } from "@/lib/templates";
import type { PlannedExercise, Profile, Routine, SavedWorkout } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";

const SHORT = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** What starting one of these produces: a named lineup, and nothing else. */
export interface WorkoutChoice {
  label: string;
  exercises: PlannedExercise[];
  template?: TemplateId;
}

/**
 * Training on a day the plan says rest.
 *
 * "Train anyway" used to pull up whichever day came next in the rotation and
 * open it, which answers a question nobody asked. Somebody training on a rest
 * day has already decided to train and usually knows what: the gap in the week
 * is chest, or the legs session got missed on Tuesday. The app picking for her
 * meant backing out of a squat day she did not want and going to the editor.
 *
 * So this asks. The list is hers rather than the library's: the workouts she
 * saved by name first, then the days of her own week, which are the versions
 * she shaped rather than the templates they were generated from. Picking "Leg
 * day" here gets the leg day she built.
 *
 * Under her own workouts are the app's, generated for her level and her kit at
 * the moment they are shown, so "give me a leg day" is one tap for somebody who
 * does not want to think about it. And under those, logging as she goes, for
 * the day where the answer is none of the above.
 *
 * One tap starts any of them. There is no confirm step, because every row here
 * is already a statement of what it will do and a second screen between a
 * person standing in a gym and their first set is the thing this product keeps
 * removing.
 */
export default function PickWorkout({
  profile,
  workouts = [],
  routines,
  dayLibrary,
  today,
  planned,
  onStartPlanned,
  onAdjust,
  onPick,
  onQuick,
  onBack,
}: {
  /** Her level and her kit, which is what the app's own workouts are built to. */
  profile: Profile;
  workouts?: SavedWorkout[];
  /** Her week. Each day is her edited version of it, which is the point. */
  routines: Routine[];
  /**
   * Her version of each day type, which is what answers "I used to do legs":
   * a leg day that has since left her week still exists here, shaped the way
   * she shaped it.
   */
  dayLibrary?: Record<string, PlannedExercise[]>;
  /** Today's weekday, so the rest day can be named rather than implied. */
  today: number;
  /**
   * What today is already planned as, on a training day.
   *
   * Not everybody's Monday is the same workout every week, so the list is
   * reachable with a plan on the day. The plan is the first card in it: it
   * used to be left out, because the button on Today starts it, and that made
   * changing your mind a Cancel instead of a tap.
   */
  planned?: { label: string; exercises: PlannedExercise[] };
  /** Start the planned workout as planned, which is not a one-off. */
  onStartPlanned?: () => void;
  /**
   * Rebuild today's plan from a sentence. The list reads it and hands back
   * the constraints with the line Today will show; the page applies them.
   */
  onAdjust?: (c: Constraints, line: string) => void;
  onPick: (choice: WorkoutChoice) => void;
  /** Log it lift by lift, with nothing planned. */
  onQuick?: () => void;
  onBack: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  async function submitAdjust() {
    const text = note.trim();
    if (!text || !onAdjust) return;
    setAsking(true);
    let read: Awaited<ReturnType<typeof readConstraints>>;
    try {
      read = await readConstraints(text);
    } finally {
      // Reset even if the read ever rejects, so the box is never stuck asking.
      setAsking(false);
    }
    onAdjust(read.constraints, adjustedLine(read.constraints, read.offline));
  }

  /*
    Closing the box with Cancel removes the focused control, which would drop
    focus to the page. Put it back on the button that opened the box, but only
    when the box was open a moment ago, so first mount does not take focus.
  */
  const adjustButton = useRef<HTMLButtonElement>(null);
  const wasAdjusting = useRef(false);
  useEffect(() => {
    if (wasAdjusting.current && !adjusting) adjustButton.current?.focus();
    wasAdjusting.current = adjusting;
  }, [adjusting]);

  const isPlanned = (lineup: PlannedExercise[]) =>
    Boolean(planned && sameLineup(planned.exercises, lineup));

  const mine = workouts.filter((w) => !isPlanned(w.exercises));
  const fromWeek = weekChoices(routines, workouts).filter((c) => !isPlanned(c.exercises));
  const fromLibrary = libraryChoices(
    dayLibrary,
    [
      ...workouts.map((w) => w.exercises),
      ...fromWeek.map((c) => c.exercises),
      ...(planned ? [planned.exercises] : []),
    ],
    (template) => TEMPLATES.find((t) => t.id === template)?.label
  );

  /*
    The app's own, built here rather than stored anywhere: the same generator
    the week is built from, for the level and equipment she has right now. A
    template with nothing behind it for her kit is dropped rather than offered
    as an empty day.

    Anything she already has above is left out. Being offered a generated leg
    day directly under her own leg day is the screen failing to notice which
    one she wants.
  */
  const hers = [
    ...(planned ? [planned.exercises] : []),
    ...workouts.map((w) => w.exercises),
    ...fromWeek.map((c) => c.exercises),
    ...fromLibrary.map((c) => c.exercises),
  ];
  const ours = TEMPLATES.map((t) => {
    const [built] = generateRoutine(
      profile.level,
      [today],
      profile.equipment,
      profile.favourites ?? [],
      [t.id]
    );
    return built?.exercises.length ? { template: t, exercises: built.exercises } : null;
  }).filter(
    (c): c is { template: (typeof TEMPLATES)[number]; exercises: PlannedExercise[] } =>
      c !== null && !hers.some((lineup) => sameLineup(lineup, c.exercises))
  );

  /** "Monday", "Monday and Friday", "Monday, Wednesday and Friday". */
  const onDays = (days: number[]) => {
    const names = days.map((d) => SHORT[d]);
    if (names.length < 2) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  };

  const lifts = (exercises: PlannedExercise[]) =>
    exercises.map((e) => nameOf(e.exerciseId)).join(", ");

  const Row = ({
    title,
    under,
    hint,
    exercises,
    onClick,
  }: {
    title: string;
    /** Where this came from: short, and set in the label style. */
    under?: string;
    /**
     * What the workout is, in the app's own words. A sentence, so it keeps
     * sentence case: the template hints are a line long, and a line of
     * uppercase is a wall rather than a caption.
     */
    hint?: string;
    exercises: PlannedExercise[];
    onClick: () => void;
  }) => (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Start ${title}: ${lifts(exercises)}`}
        className="w-full rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="head text-head text-fg">{title}</span>
          <span className="tabular shrink-0 text-body text-cyan">
            {exercises.length} {exercises.length === 1 ? "lift" : "lifts"}
          </span>
        </div>
        <span className="mt-1 block text-body leading-snug text-dim">{lifts(exercises)}</span>
        {under && <span className="label mt-2 block text-dim">{under}</span>}
        {hint && <span className="mt-2 block text-body leading-snug text-dim">{hint}</span>}
      </button>
    </li>
  );

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">
          {planned ? SHORT[today] : `${SHORT[today]} is a rest day`}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
        >
          Cancel
        </button>
      </div>

      <h1 className="statement mt-2 text-figure leading-none text-fg">What are you doing?</h1>
      <p className="mt-2 text-body leading-snug text-dim">
        {planned
          ? `Whatever you pick is just today. ${SHORT[today]} is still ${planned.label} next week.`
          : "Training today does not move your week. Whatever you pick is a one-off, and tomorrow is still whatever it was."}
      </p>

      {planned && (
        <section className="mt-6">
          <div className="rounded-2xl border-[1.5px] border-action bg-card">
            <button
              type="button"
              onClick={onStartPlanned}
              className="w-full p-[18px] text-left"
            >
              {/* A verb in front of the visible text, so the name still contains what is shown. */}
              <span className="sr-only">Start </span>
              <span className="label inline-block rounded-full border border-action px-2 py-0.5 text-action">
                Planned for today
              </span>
              <span className="mt-2.5 flex items-baseline justify-between gap-3">
                <span className="head text-head text-fg">{planned.label}</span>
                <span className="tabular shrink-0 text-body text-cyan">
                  {planned.exercises.length} {planned.exercises.length === 1 ? "lift" : "lifts"}
                </span>
              </span>
              <span className="mt-1 block text-body leading-snug text-dim">{lifts(planned.exercises)}</span>
            </button>
            {onAdjust && (
              <div className="mx-[18px] border-t border-line pb-[18px] pt-3">
                {adjusting ? (
                  <>
                    <label htmlFor="adjust-note" className="label block text-dim">
                      What&apos;s different today?
                    </label>
                    <textarea
                      id="adjust-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="I'm working from home, no machines, only dumbbells"
                      className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                    />
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void submitAdjust()}
                        disabled={asking || !note.trim()}
                        className="head h-12 flex-1 rounded-full border border-line-strong text-body text-cyan transition-opacity disabled:opacity-40"
                      >
                        {asking ? "Rebuilding…" : "Rebuild today"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjusting(false)}
                        disabled={asking}
                        className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    ref={adjustButton}
                    onClick={() => setAdjusting(true)}
                    className="head tap text-body text-cyan transition-opacity hover:opacity-70"
                  >
                    Adjust it for today
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {planned && <p className="label mt-8 text-dim">Or switch to</p>}

      {mine.length > 0 && (
        <section className="mt-6">
          <p className="label text-dim">Your workouts</p>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {mine.map((w) => (
              <Row
                key={w.id}
                title={w.name}
                under="Saved by you"
                exercises={w.exercises}
                onClick={() =>
                  onPick({ label: w.name, exercises: w.exercises, template: w.template })
                }
              />
            ))}
          </ul>
        </section>
      )}

      {fromWeek.length > 0 && (
        <section className="mt-6">
          <p className="label text-dim">From your week</p>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {fromWeek.map((c) => (
              <Row
                key={c.days.join("-")}
                title={c.label}
                under={`Your ${onDays(c.days)}`}
                exercises={c.exercises}
                onClick={() =>
                  onPick({ label: c.label, exercises: c.exercises, template: c.template })
                }
              />
            ))}
          </ul>
        </section>
      )}

      {fromLibrary.length > 0 && (
        <section className="mt-6">
          <p className="label text-dim">You used to do</p>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {fromLibrary.map((c) => (
              <Row
                key={c.template}
                title={c.label}
                under="Not in your week any more"
                exercises={c.exercises}
                onClick={() =>
                  onPick({ label: c.label, exercises: c.exercises, template: c.template })
                }
              />
            ))}
          </ul>
        </section>
      )}

      {ours.length > 0 && (
        <section className="mt-6">
          <p className="label text-dim">Or one of ours</p>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {ours.map((c) => (
              <Row
                key={c.template.id}
                title={c.template.label}
                hint={c.template.hint}
                exercises={c.exercises}
                onClick={() =>
                  onPick({
                    label: c.template.label,
                    exercises: c.exercises,
                    template: c.template.id,
                  })
                }
              />
            ))}
          </ul>
        </section>
      )}

      {/*
        Last, because it is the answer when none of the above is: nothing
        planned, pick each lift as you reach it. It is a row rather than a
        button under the list so that it reads as one of the choices, which is
        what it is, rather than as the way out of making one.
      */}
      {onQuick && (
        <section className="mt-6">
          <p className="label text-dim">Or nothing planned</p>
          <ul className="mt-2.5">
            <li>
              <button
                type="button"
                onClick={onQuick}
                className="w-full rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
              >
                <span className="head block text-head text-fg">Log as you go</span>
                <span className="mt-1 block text-body leading-snug text-dim">
                  Start empty and pick each lift as you get to it. Nothing decided up front.
                </span>
              </button>
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}
