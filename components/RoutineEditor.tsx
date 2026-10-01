"use client";

import { useRef, useState } from "react";
import { Pill } from "./ui";
import { alternativesFor, generateRoutine, LEVEL_SETS, repsFor, SHORT_DAYS, startingWeight, suggestFrom } from "@/lib/engine";
import { TEMPLATES, coversTwiceWeekly, templateOf, type TemplateId } from "@/lib/templates";
import { byId, cardioLifts, makeCustomExercise, nameOf, searchLifts } from "@/lib/exercises";
import { count } from "@/lib/plural";
import {
  NAME_MAX,
  cleanName,
  makeWorkout,
  placeOn,
  savedAs,
  suggestName,
  yourWorkoutsCategory,
} from "@/lib/workouts";
import type {
  Equipment,
  Exercise,
  Muscle,
  PlannedExercise,
  Profile,
  Routine,
  SavedWorkout,
} from "@/lib/types";

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MUSCLES: { id: Muscle; label: string }[] = [
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core" },
];

/**
 * Editing a day — the deck's second core journey (p28), and the last thing the
 * app could not do. Until now a routine was generated once at signup and was
 * unchangeable forever, which meant a plan you disagreed with was a plan you
 * were stuck with.
 *
 * What it does not offer is a body-part split. ACSM's 2026 update puts novices
 * on full-body work across non-consecutive days and says the split matters far
 * less than showing up, so choosing one is a decision that can only make a
 * beginner's week worse. Swapping a lift for another that trains the same
 * muscle is the edit people actually want — the barbell one hurts my shoulder,
 * give me the dumbbell one — and it cannot break the balance of the day.
 */
export default function RoutineEditor({
  profile,
  routines,
  focusDay,
  library,
  workouts,
  onSave,
  onSaveWorkout,
  onRemoveWorkout,
  onAddCustom,
  initialAdding = null,
  initialDescribing = false,
  onBack,
}: {
  profile: Profile;
  routines: Routine[];
  /** Weekday to open on, 0-6. Anything not in the plan opens the first day. */
  focusDay?: number;
  /** The user's saved version of each named day type, keyed by template id. */
  library?: Record<string, PlannedExercise[]>;
  /** Workouts she saved and named, newest first. Any of them can go on any day. */
  workouts?: SavedWorkout[];
  onSave: (r: Routine[]) => void;
  /**
   * A workout of her own, saved by name. Committed straight away rather than
   * with the week, for the same reason a custom lift is: her library is not the
   * plan, and cancelling an edit to Wednesday should not throw away the workout
   * she saved while she was in here.
   */
  onSaveWorkout?: (w: SavedWorkout) => void;
  onRemoveWorkout?: (id: string) => void;
  /** A lift the library does not have, added by hand. */
  onAddCustom?: (e: Exercise) => void;
  /** Opens straight into the picker, so /frames can show it. */
  initialAdding?: Muscle | null;
  /** Opens with the describe-your-week field showing. Only /frames uses it. */
  initialDescribing?: boolean;
  onBack: () => void;
}) {
  const days = [...routines].sort((a, b) => a.day - b.day);
  /*
    Which day the editor opens on.
    
    It always opened on the first day of the week, which is right when the
    whole plan is being set up and wrong every other time: arriving here to
    answer "what is my new Wednesday" and landing on Monday means finding the
    day yourself before you can change it. `focusDay` is a weekday number, and
    an unknown one falls back to the first day rather than an empty editor.
  */
  const [dayIndex, setDayIndex] = useState(() => {
    const i = days.findIndex((r) => r.day === focusDay);
    return i === -1 ? 0 : i;
  });
  const [draft, setDraft] = useState<Routine[]>(days);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Muscle | null>(initialAdding);
  /* What she typed into the picker's search. Clears whenever it opens. */
  const [hunt, setHunt] = useState("");
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggested, setSuggested] = useState<{ id: string; why: string } | null>(null);
  const [weekAsk, setWeekAsk] = useState("");
  const [weekBusy, setWeekBusy] = useState(false);
  const [weekWhy, setWeekWhy] = useState<string | null>(null);
  /*
    Set when the builder could not be reached. It is its own state rather than
    a message pushed through `weekWhy`, because that slot is the model saying
    why it chose a shape and this is the app saying it never got one. Reading
    them out of the same variable is how a failure ends up phrased as a reason.
  */
  const [weekOffline, setWeekOffline] = useState(false);
  /*
    "Or describe your week" is for the person who does not know what a split
    is, and it used to sit open under the list for everybody. It is a link
    now; it stays open while it has something to say back.
  */
  const [describing, setDescribing] = useState(initialDescribing);
  const [pane, setPane] = useState<"editor" | "workouts">("editor");
  const [ownName, setOwnName] = useState("");
  const [ownBusy, setOwnBusy] = useState(false);
  /* Naming a workout to save. Closed until asked for, like the week textarea. */
  const [naming, setNaming] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  /*
    What just happened to this day, said once. Putting a workout on a day
    changes the list below and the heading above it, and on a phone the heading
    is what scrolls off — so the change needs saying rather than assuming she
    saw it.
  */
  const [saidSo, setSaidSo] = useState<string | null>(null);
  /** Which workout's remove button has been pressed once. */
  const [removing, setRemoving] = useState<string | null>(null);

  /**
   * A lift the library has never heard of.
   *
   * Thirty-nine entries is a lot and still not everything — somebody's gym has
   * a machine nobody else's does, and a plan you cannot write down is a plan
   * you stop using. The model reads the name and says which muscle it trains
   * and what it is done with: two enums this app already understands, checked
   * on the server, defaulting to arms-and-dumbbell when it cannot tell.
   *
   * It writes no coaching. Every built-in cue and step was written by a person,
   * and having a model improvise form advice for an arbitrary barbell movement
   * is the one place here where being wrong could hurt somebody.
   */
  async function addOwn() {
    const name = ownName.trim();
    if (!name || ownBusy || !onAddCustom) return;
    setOwnBusy(true);

    let muscle: Muscle = adding ?? "arms";
    let equipment: Equipment = profile.equipment[0] ?? "dumbbell";
    let compound = false;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "classify", text: name }),
      });
      const out = (await res.json()) as { muscle?: Muscle; equipment?: Equipment; compound?: boolean };
      // Only the server's validated enums land here; if it is offline the
      // guesses above stand and she can still add the lift.
      if (out.muscle) muscle = out.muscle;
      if (out.equipment) equipment = out.equipment;
      compound = out.compound === true;
    } catch {
      // Offline. Her lift still gets added, filed where she was standing.
    }

    const made = makeCustomExercise(name, muscle, equipment, compound);
    onAddCustom(made);
    setOwnName("");
    setOwnBusy(false);
    add(made.id, made);
  }

  /**
   * "Build me a week."
   *
   * The model picks day *types* from the seven above and nothing else. Every
   * exercise, set, rep and weight then comes out of `generateRoutine` exactly
   * as it does when the shapes are tapped by hand — so the worst a bad answer
   * can do is give someone leg day on a Wednesday, and the fix for that is one
   * tap on the list above.
   */
  async function buildWeek() {
    if (weekBusy || !weekAsk.trim()) return;
    setWeekBusy(true);
    setWeekWhy(null);
    setWeekOffline(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "week", text: weekAsk, count: draft.length }),
      });
      const out = (await res.json()) as { templates?: TemplateId[]; why?: string | null };
      if (out.templates?.length) {
        const built = generateRoutine(
          profile.level,
          draft.map((r) => r.day),
          profile.equipment,
          profile.favourites ?? [],
          out.templates
        );
        if (built.length) {
          setDraft(built);
          setDayIndex(0);
          setOpenId(null);
          setWeekWhy(out.why ?? null);
          setWeekAsk("");
        }
      }
    } catch {
      // The shapes above still work; nothing here is blocked by this being
      // down. It used to say so by going quiet, which from the other side of
      // the screen is a button that does nothing.
      setWeekOffline(true);
    }
    setWeekBusy(false);
  }

  /**
   * "I don't know what I want to do for biceps."
   *
   * The model only ever picks from the same shortlist the buttons above show,
   * and the server checks its answer against that list before it comes back —
   * so the worst case is the app suggesting what it would have suggested
   * anyway. It never proposes a weight or a rep count; adding the lift runs
   * the rules engine exactly as tapping the name does.
   */
  async function askAi() {
    if (!adding || asking) return;
    setAsking(true);
    setSuggested(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "pick",
          text: ask,
          muscle: adding,
          equipment: profile.equipment,
          exclude: used,
        }),
      });
      const out = (await res.json()) as { id?: string; why?: string };
      if (out.id) setSuggested({ id: out.id, why: out.why ?? "" });
    } catch {
      // Offline is not an error state here — the list is still on screen.
    }
    setAsking(false);
  }

  function closeAdd() {
    (setHunt(""), setAdding(null));
    setAsk("");
    setSuggested(null);
  }

  const routine = draft[dayIndex];
  if (!routine) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <p className="text-emphasis text-dim">No training days yet. Set up your week first.</p>
        <div className="mt-auto pt-10">
          <Pill onClick={onBack}>Back</Pill>
        </div>
      </main>
    );
  }

  const write = (exercises: PlannedExercise[]) =>
    setDraft(draft.map((r, i) => (i === dayIndex ? { ...r, exercises } : r)));

  const update = (id: string, patch: Partial<PlannedExercise>) =>
    write(routine.exercises.map((e) => (e.exerciseId === id ? { ...e, ...patch } : e)));

  const remove = (id: string) => {
    write(routine.exercises.filter((e) => e.exerciseId !== id));
    setOpenId(null);
  };

  const swap = (from: string, to: string) => {
    const meta = byId(to);
    write(
      routine.exercises.map((e) =>
        e.exerciseId === from
          ? {
              ...e,
              exerciseId: to,
              // A different lift is a different load. Reset rather than carry
              // a barbell weight onto a dumbbell movement.
              weight: meta ? startingWeight(meta, profile.level) : 0,
            }
          : e
      )
    );
    setOpenId(to);
  };

  /**
   * `meta` is passed explicitly when the lift was just invented, because the
   * registry `byId` reads is repopulated by storage on the next commit — so a
   * brand-new custom id does not resolve yet and the add silently did nothing.
   */
  const add = (id: string, meta = byId(id)) => {
    if (!meta) return;
    write([
      ...routine.exercises,
      {
        exerciseId: id,
        // repsFor, not a rule retyped here. `increment === 0 ? 30 : 8` gave
        // thirty reps to every unloaded lift — push-ups and bodyweight squats
        // included — and hard-coded eight for everyone regardless of level.
        // Reps have one owner in this app and it is the engine.
        sets: LEVEL_SETS[profile.level],
        reps: repsFor(meta, profile.level),
        weight: startingWeight(meta, profile.level),
      },
    ]);
    closeAdd();
    setOpenId(id);
  };

  /**
   * Changing the day type brings back the version of that day you already made
   * — another day of the same type this week, then your saved library — and
   * only falls back to a fresh default when you have never shaped it. Full-body
   * is exempt: it is meant to vary, so it always rebuilds.
   */
  function setTemplate(id: TemplateId) {
    const [rebuilt] = generateRoutine(
      profile.level,
      [routine.day],
      profile.equipment,
      profile.favourites ?? [],
      [id]
    );
    if (!rebuilt) return;
    const saved =
      id === "full-body"
        ? undefined
        : draft.find((r) => r.template === id && r.exercises.length)?.exercises ?? library?.[id];
    /*
      A day type she has never shaped arrives empty, and the button below
      fills it if she wants that.

      It used to arrive as five lifts the app had chosen, which reads as the
      answer rather than as a suggestion: picking "Leg day" and being handed a
      leg day makes the lineup feel settled, and the people most likely to
      accept it are the ones with the least basis to judge it. A blank day
      asks the question out loud instead, and "Autofill for me" is there for
      the beginner who genuinely wants the app to decide.

      Her own version of a day type still comes back untouched. That is hers,
      not a default, and forgetting it to ask a question she has already
      answered would be worse than either.
    */
    const exercises = saved?.length ? saved : [];
    // A day that has just become a different type is no longer the workout it
    // was, so the link goes with the lineup it described.
    setDraft(
      draft.map((r, i) =>
        i === dayIndex ? { ...rebuilt, day: r.day, exercises, workoutId: undefined } : r
      )
    );
    setOpenId(null);
    (setHunt(""), setAdding(null));
  }

  /*
    Her own saved workouts.

    The day-type list under this is seven shapes the app knows; this is the
    workouts she built. Both are needed and hers goes first: once she has
    shaped a leg day, "that one again, on Thursday" is a more specific answer
    than "leg day", and the app cannot regenerate it — the seven shapes rebuild
    from muscle slots and would hand back a different lineup.
  */
  const mine = workouts ?? [];
  const already = savedAs(mine, routine.exercises);
  const nameTaken = mine.find(
    (w) => w.name.toLowerCase() === cleanName(workoutName).toLowerCase()
  );

  function startNaming() {
    setWorkoutName(suggestName(routine.label, mine));
    setNaming(true);
  }

  function keepWorkout() {
    const name = cleanName(workoutName);
    if (!name || !onSaveWorkout || routine.exercises.length === 0) return;
    const made = makeWorkout(name, routine.exercises, routine.template);
    /*
      The day becomes the workout it was just saved as, so editing it again
      edits the workout rather than a copy of it. Saving under a name she has
      already used keeps that workout's id, which is the rule `saveWorkout`
      documents, so the link has to point at the id that survives rather than
      at the one just generated.
    */
    const id = nameTaken?.id ?? made.id;
    setDraft(draft.map((r, i) => (i === dayIndex ? { ...r, workoutId: id } : r)));
    onSaveWorkout(made);
    setNaming(false);
    setWorkoutName("");
    setSaidSo(nameTaken ? `Updated ${name}.` : `Saved as ${name}.`);
  }

  /**
   * The app's answer, when she asks for it.
   *
   * Same generator the week was built from, for her level and the kit she says
   * she has, so what lands here is what the old automatic fill would have put
   * there. The difference is only that she asked.
   */
  function autofill() {
    const [built] = generateRoutine(
      profile.level,
      [routine.day],
      profile.equipment,
      profile.favourites ?? [],
      [routine.template ?? "full-body"]
    );
    if (!built?.exercises.length) return;
    setDraft(
      draft.map((r, i) => (i === dayIndex ? { ...r, exercises: built.exercises } : r))
    );
    setSaidSo(`Filled ${FULL[routine.day]} with ${count(built.exercises.length, "lift")}.`);
  }

  /**
   * Put one of her workouts on the day she is editing. It replaces the day
   * rather than appending to it, because that is what picking a workout off a
   * list means; the lift-by-lift edits below are still there for borrowing one
   * movement.
   */
  function putOn(w: SavedWorkout) {
    setDraft(placeOn(draft, routine.day, w));
    setOpenId(null);
    (setHunt(""), setAdding(null));
    setRemoving(null);
    setPane("editor");
    setSaidSo(`${FULL[routine.day]} is now ${w.name}.`);
  }

  const ownWorkouts = yourWorkoutsCategory(
    mine,
    Boolean(onSaveWorkout && routine.exercises.length > 0)
  );

  const thorough = coversTwiceWeekly(draft.map((r) => r.template ?? "full-body"));
  const used = routine.exercises.map((e) => e.exerciseId);
  const suggestions = suggestFrom(profile.favourites ?? [], profile.equipment).filter(
    (sg) => !used.includes(sg.tryThis)
  );

  if (pane === "workouts") {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">Your workouts</p>
          <button
            type="button"
            onClick={() => {
              setPane("editor");
              setNaming(false);
              setRemoving(null);
            }}
            className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
          >
            Back
          </button>
        </div>

        <h1 className="statement mt-2 text-figure text-fg">{FULL[routine.day]}</h1>
        <p className="mt-1.5 text-emphasis leading-snug text-dim">
          Put one of your saved workouts on this day, or save this day as a workout.
        </p>

        <section className="mt-6 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Saved workouts</p>
          {mine.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {mine.map((w) => {
                const on = already?.id === w.id;
                const sure = removing === w.id;
                return (
                  <li
                    key={w.id}
                    className={`flex items-center rounded-xl border transition-colors duration-quick ${
                      on ? "border-cyan bg-raise" : "border-transparent bg-raise/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => putOn(w)}
                      aria-pressed={on}
                      className="min-w-0 flex-1 p-3.5 text-left"
                    >
                      <span className="head block truncate text-emphasis text-fg">{w.name}</span>
                      <span className="block truncate text-body text-dim">
                        {count(w.exercises.length, "lift")} ·{" "}
                        {w.exercises.map((e) => nameOf(e.exerciseId)).join(", ")}
                      </span>
                    </button>
                    {onRemoveWorkout && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!sure) {
                            setRemoving(w.id);
                            return;
                          }
                          onRemoveWorkout(w.id);
                          setRemoving(null);
                          setSaidSo(`Removed ${w.name}.`);
                        }}
                        aria-label={sure ? `Confirm removing ${w.name}` : `Remove ${w.name}`}
                        className={`head h-11 shrink-0 rounded-full px-3.5 text-body transition-colors duration-quick ${
                          sure ? "text-action" : "text-dim hover:text-fg"
                        }`}
                      >
                        {sure ? "Sure?" : "Remove"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-emphasis leading-snug text-fg">
              Nothing saved yet.
            </p>
          )}
        </section>

        {onSaveWorkout && routine.exercises.length > 0 && (
          <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
            {already ? (
              <p className="text-body leading-snug text-dim">
                This day is already saved as {already.name}. Change a lift, sets or reps to save an updated version.
              </p>
            ) : naming ? (
              <>
                <label htmlFor="workout-name" className="label block text-dim">
                  Call it
                </label>
                <input
                  id="workout-name"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  maxLength={NAME_MAX}
                  autoFocus
                  placeholder="Leg day"
                  className="mt-2.5 w-full rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <div className="mt-2.5 flex items-center gap-2.5">
                  <Pill
                    size="sm"
                    className="h-12 flex-1"
                    onClick={keepWorkout}
                    disabled={!cleanName(workoutName)}
                  >
                    {nameTaken ? "Update it" : "Save it"}
                  </Pill>
                  <button
                    type="button"
                    onClick={() => {
                      setNaming(false);
                      setWorkoutName("");
                    }}
                    className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
                  >
                    Cancel
                  </button>
                </div>
                {nameTaken && (
                  <p className="mt-2 text-body leading-snug text-dim">
                    You already have a {nameTaken.name}. Saving replaces it.
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={startNaming}
                className="flex w-full items-baseline justify-between gap-3 text-left"
              >
                <span>
                  <span className="label block text-dim">This day</span>
                  <span className="mt-1.5 block text-emphasis leading-snug text-fg">
                    Save {FULL[routine.day]} as a workout you can put on any day.
                  </span>
                </span>
                <span className="head shrink-0 text-body text-cyan">Save</span>
              </button>
            )}
          </section>
        )}

        {saidSo && (
          <p role="status" className="mt-3 text-body leading-snug text-dim">
            {saidSo}
          </p>
        )}

        <div className="mt-auto pt-8">
          <Pill variant="ghost" onClick={() => setPane("editor")}>
            Back to day types
          </Pill>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">
          {profile.planChosen ? "Edit your week" : "Build your week"}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
        >
          Cancel
        </button>
      </div>

      <h1 className="statement mt-2 text-figure text-fg">{FULL[routine.day]}</h1>
      <p className="mt-1 text-emphasis text-dim">{templateOf(routine.template ?? "full-body").label}</p>

      {days.length > 1 && (
        <div className="mt-4 flex gap-2">
          {draft.map((r, i) => (
            <button
              key={r.day}
              type="button"
              onClick={() => {
                setDayIndex(i);
                setOpenId(null);
                (setHunt(""), setAdding(null));
                // Said about the day she has just left, so it does not follow
                // her onto the next one.
                setSaidSo(null);
                setNaming(false);
                setRemoving(null);
              }}
              aria-pressed={i === dayIndex}
              className={`head h-11 flex-1 rounded-full border text-emphasis transition-colors duration-quick ${
                i === dayIndex
                  ? "border-cyan bg-cyan text-ground"
                  : "border-line-strong text-dim hover:border-fg"
              }`}
            >
              {SHORT_DAYS[r.day][0]}
            </button>
          ))}
        </div>
      )}

      {saidSo && (
        <p role="status" className="mt-3 rounded-2xl bg-card p-[18px] text-body leading-snug text-dim">
          {saidSo}
        </p>
      )}

      {/*
        The seven shapes used to be tall cards with a sentence each, 802px of
        list before a single lift. As chips they take two rows, and only the
        chosen one says what it is, which is the sentence that matters.
      */}
      <section className="mt-4 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">What kind of day</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ownWorkouts && (
            <button
              type="button"
              onClick={() => {
                closeAdd();
                setPane("workouts");
                setRemoving(null);
              }}
              className="head h-11 rounded-full border border-line-strong px-4 text-body text-fg transition-colors duration-quick hover:border-fg"
            >
              {ownWorkouts.label}
            </button>
          )}
          {TEMPLATES.map((t) => {
            const on = (routine.template ?? "full-body") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                aria-pressed={on}
                aria-label={t.label}
                className={`head h-11 rounded-full border px-4 text-body transition-colors duration-quick ${
                  on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg hover:text-fg"
                }`}
              >
                {t.short}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-body leading-snug text-dim">
          {templateOf(routine.template ?? "full-body").hint}
          {templateOf(routine.template ?? "full-body").recommended && (
            <span className="label ml-2 text-cyan">Recommended</span>
          )}
        </p>

        {describing || weekWhy || weekOffline ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="label text-dim">Or describe your week</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void buildWeek();
              }}
              className="mt-2.5 flex items-center gap-2.5"
            >
              <input
                value={weekAsk}
                onChange={(e) => setWeekAsk(e.target.value)}
                maxLength={200}
                autoFocus={describing && !initialDescribing}
                placeholder="I want to focus on legs, and one easy day"
                aria-label="Describe the week you want"
                className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
              />
              <button
                type="submit"
                disabled={!weekAsk.trim() || weekBusy}
                className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
              >
                {weekBusy ? "…" : "Build"}
              </button>
            </form>
            {weekWhy && (
              <p role="status" className="mt-2.5 text-body leading-snug text-dim">
                {weekWhy} Change any day above.
              </p>
            )}
            {weekOffline && (
              <p role="status" className="mt-2.5 text-body leading-snug text-dim">
                No signal, so this one cannot answer. Pick the day types above and you
                get the same week without it.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDescribing(true)}
            className="head tap mt-3 text-body text-cyan transition-opacity hover:opacity-70"
          >
            Or describe your week
          </button>
        )}

        {/*
          One honest line, not a block. Three days of push/pull/legs trains each
          group once a week, and ACSM's whole point is that twice is what counts.
          She should know that and then decide for herself.
        */}
        {!thorough && (
          <p className="mt-3 text-body text-dim">
            This week trains some muscles once. Twice a week is what makes the difference —
            full body, or run these days again.
          </p>
        )}
      </section>

      <ul className="mt-2.5 flex flex-col gap-2">
        {routine.exercises.map((e) => {
          const meta = byId(e.exerciseId);
          const open = openId === e.exerciseId;
          /*
            Cardio swaps for cardio. Filed by muscle, a treadmill is a quads
            lift and a rower is a back lift, so the muscle-based list offered
            squats in place of a run and put the rower somewhere a treadmill
            could never reach. LogSession already knew this when adding a lift
            mid-session; the week builder did not.
          */
          const alts = !meta
            ? []
            : meta.cardio
              ? cardioLifts(used, profile.equipment)
              : alternativesFor(meta.primary, profile.equipment, used, profile.favourites ?? []);
          return (
            <li key={e.exerciseId} className="rounded-2xl bg-card">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.exerciseId)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-[18px] text-left"
              >
                <span className="min-w-0">
                  <span className="head block truncate text-emphasis text-fg">
                    {nameOf(e.exerciseId)}
                  </span>
                  {/*
                    What this row can change, and nothing else.

                    It used to print the weight too, which is not editable on
                    this screen and is not hers to set anyway: the engine picks
                    the load from her history every time the day is built, so a
                    number shown here is a number she cannot act on and that
                    will have moved by the session. On a cardio lift it was
                    also plain wrong — that field carries the incline, so a
                    treadmill at 5% read "5 lb".
                  */}
                  <span className="block text-body text-dim">
                    {byId(e.exerciseId)?.cardio
                      ? count(e.reps, "minute")
                      : `${e.sets} × ${e.reps}`}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-body text-cyan">
                  {open ? "Done" : "Edit"}
                </span>
              </button>

              {open && (
                <div className="rise border-t border-line px-[18px] pb-[18px] pt-4">
                  {/*
                    Cardio is set the way it is done: a time you spend and how
                    steep it is. Sets and reps are the wrong two numbers for
                    it — there is only ever one set, so a stepper offering six
                    is offering something the engine will not build, and "reps"
                    on a treadmill has never meant reps. This panel asks for
                    what the machine actually has.
                  */}
                  {meta?.cardio ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-body text-dim">Time</span>
                        <Stepper
                          value={e.reps}
                          min={5}
                          max={120}
                          step={5}
                          onChange={(n) => update(e.exerciseId, { reps: n })}
                          label="minutes"
                        />
                      </div>
                      {meta.incline && (
                        <div className="mt-2.5 flex items-center gap-3">
                          <span className="flex-1 text-body text-dim">Incline</span>
                          <Stepper
                            value={e.weight}
                            min={0}
                            max={15}
                            onChange={(n) => update(e.exerciseId, { weight: n })}
                            label="percent"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-body text-dim">Sets</span>
                        <Stepper
                          value={e.sets}
                          min={1}
                          max={6}
                          onChange={(n) => update(e.exerciseId, { sets: n })}
                          label="sets"
                        />
                      </div>
                      {/*
                        Fives only for a hold, where the number is seconds.
                        `increment === 0` was the wrong test for that: it is
                        true of every unloaded lift, so pull-ups, push-ups,
                        dips and bodyweight squats all stepped by five. Six
                        pull-ups was a number you could not ask for, because
                        the control skipped it and went to ten. Reps go up by
                        one, the way you actually earn them.
                      */}
                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="flex-1 text-body text-dim">{meta?.hold ? "Time" : "Reps"}</span>
                        <Stepper
                          value={e.reps}
                          min={meta?.hold ? 5 : 1}
                          max={60}
                          step={meta?.hold ? 5 : 1}
                          onChange={(n) => update(e.exerciseId, { reps: n })}
                          label={meta?.hold ? "seconds" : "reps"}
                        />
                      </div>
                    </>
                  )}

                  {alts.length > 0 && (
                    <>
                      <p className="label mt-5 text-dim">
                        {meta?.cardio
                          ? "Swap for different cardio"
                          : `Swap for another ${meta?.primary} lift`}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {alts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => swap(e.exerciseId, a.id)}
                            className="head rounded-full border border-line-strong px-4 py-2.5 text-body text-dim transition-colors hover:border-fg hover:text-fg"
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(e.exerciseId)}
                    className="head tap mt-5 text-body text-dim transition-colors hover:text-fg"
                  >
                    Take this out
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/*
        The one empty state, now that a day type arrives empty rather than
        pre-filled. Three ways out of it and they are genuinely different
        answers: choose the lifts, have the app choose them, or let the day
        stay a rest day.
      */}
      {routine.exercises.length === 0 && (
        <div className="mt-4">
          <p className="text-body leading-snug text-dim">
            Nothing on this day. Add a lift below, or leave it as a rest day.
          </p>
          <Pill size="sm" variant="ghost" className="mt-3" onClick={autofill}>
            Autofill for me
          </Pill>
          <p className="mt-2 text-body leading-snug text-dim">
            Fills it with {templateOf(routine.template ?? "full-body").label.toLowerCase()} work
            the app picks, for your level and your kit. Change anything after.
          </p>
        </div>
      )}

      {adding ? (
        <div className="rise mt-2.5 rounded-2xl bg-card p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Pick a {adding} lift</p>
            <button
              type="button"
              onClick={closeAdd}
              className="head tap shrink-0 text-body text-cyan"
            >
              Cancel
            </button>
          </div>
          {/*
            Search across the whole library, not just this muscle.

            The list below is filed by muscle, which is right for browsing and
            wrong for looking something up: a seated leg curl lives under
            hamstrings, and somebody standing at the machine is thinking "leg
            curl". It was in the library the whole time and could not be found,
            which from her side is the same as it not being there.
          */}
          <input
            value={hunt}
            onChange={(e) => setHunt(e.target.value)}
            placeholder="Search every lift"
            aria-label="Search every lift by name"
            className="mt-3 h-12 w-full rounded-full bg-raise px-[18px] text-body text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(hunt.trim().length >= 2
              ? searchLifts(hunt, profile.equipment, [...used])
              : alternativesFor(adding, profile.equipment, used, profile.favourites ?? [])
            ).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => add(a.id)}
                className="head rounded-full border border-line-strong px-4 py-2.5 text-body text-dim transition-colors hover:border-fg hover:text-fg"
              >
                {a.name}
              </button>
            ))}
          </div>
          {hunt.trim().length >= 2 &&
            searchLifts(hunt, profile.equipment, [...used]).length === 0 && (
              <p className="mt-2.5 text-body text-dim">
                Nothing by that name in your kit. You can add it yourself below.
              </p>
            )}

          {/*
            For the person who does not know the names yet. It sits under the
            list, not instead of it: someone who knows what they want should
            never have to talk to anything.
          */}
          <div className="mt-4 border-t border-line pt-4">
            <p className="label text-dim">Not sure?</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void askAi();
              }}
              className="mt-2.5 flex items-center gap-2.5"
            >
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                maxLength={200}
                placeholder={`Something for ${adding} that is easy on the wrists`}
                aria-label={`Ask for help choosing a ${adding} lift`}
                className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
              />
              <button
                type="submit"
                disabled={!ask.trim() || asking}
                className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
              >
                {asking ? "…" : "Ask"}
              </button>
            </form>

            {/*
            Adding a lift the app does not have. Under the shortlist and under
            the ask, because it is the last resort of the three, not the first.
          */}
          {onAddCustom && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="label text-dim">Not listed?</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addOwn();
                }}
                className="mt-2.5 flex items-center gap-2.5"
              >
                <input
                  value={ownName}
                  onChange={(e) => setOwnName(e.target.value)}
                  maxLength={40}
                  placeholder="Cable crossover"
                  aria-label="The name of a lift to add yourself"
                  className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <button
                  type="submit"
                  disabled={!ownName.trim() || ownBusy}
                  className="head grid h-11 shrink-0 place-items-center rounded-full bg-raise px-5 text-body text-cyan transition-opacity disabled:opacity-30"
                >
                  {ownBusy ? "…" : "Add"}
                </button>
              </form>
              <p className="mt-2 text-body leading-snug text-dim">
                Type the name and it gets filed for you. There is no form guidance for a
                lift you added — that part only exists where a person wrote it.
              </p>
            </div>
          )}

          {suggested && byId(suggested.id) && (
              <div role="status" className="mt-3 rounded-xl bg-raise/50 p-3.5">
                <p className="head text-emphasis text-fg">{nameOf(suggested.id)}</p>
                {suggested.why && (
                  <p className="mt-1 text-body leading-snug text-dim">{suggested.why}</p>
                )}
                <button
                  type="button"
                  onClick={() => add(suggested.id)}
                  className="head tap mt-2 text-body text-cyan transition-opacity hover:opacity-70"
                >
                  Add it
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Add a lift</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => (setHunt(""), setAdding(m.id))}
                className="head rounded-full border border-line-strong px-4 py-2.5 text-body text-dim transition-colors hover:border-fg hover:text-fg"
              >
                {m.label}
              </button>
            ))}
          </div>
          {suggestions.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="label text-dim">Because of what you starred</p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {suggestions.map((sg) => (
                  <li key={sg.tryThis}>
                    <button
                      type="button"
                      onClick={() => add(sg.tryThis)}
                      className="w-full rounded-xl bg-raise/50 p-3.5 text-left transition-colors hover:bg-raise"
                    >
                      <span className="head block text-emphasis text-fg">{nameOf(sg.tryThis)}</span>
                      <span className="block text-body text-dim">
                        You star {nameOf(sg.because)} — same muscle, different feel.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.level === "new" && (
            <p className="mt-3 text-body text-dim">
              Your days are full body on purpose. Hitting everything twice a week beats a
              clever split you have to remember.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-8">
        <Pill onClick={() => onSave(draft)}>Save the week</Pill>
      </div>
    </main>
  );
}

/**
 * A compact inline ± for numbers that live inside a row.
 *
 * `handed` is here for the same reason it is in components/Stepper.tsx: taps
 * arrive faster than renders, and reading the `value` prop inside the handler
 * made every tap in a burst compute from the same stale number, so holding +
 * changed sets by one and looked like a control that had stopped working.
 */
function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  const handed = useRef(value);
  handed.current = value;
  const bump = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, handed.current + dir * step));
    handed.current = next;
    onChange(next);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
        className="grid h-11 w-11 place-items-center rounded-full bg-raise text-head leading-none text-cyan transition-colors hover:bg-line disabled:opacity-30"
      >
        −
      </button>
      <span className="tabular statement w-10 text-center text-title text-fg">{value}</span>
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className="grid h-11 w-11 place-items-center rounded-full bg-raise text-head leading-none text-cyan transition-colors hover:bg-line disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
