"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pill } from "./ui";
import LiftSearch, { fileLift, strengthPicks } from "./LiftSearch";
import { alternativesFor, generateRoutine, LEVEL_SETS, repsFor, SHORT_DAYS, startingWeight, suggestFrom } from "@/lib/engine";
import { TEMPLATES, coversTwiceWeekly, templateOf, type TemplateId } from "@/lib/templates";
import { byId, cardioLifts, nameOf } from "@/lib/exercises";
import { count } from "@/lib/plural";
import {
  NAME_MAX,
  cleanName,
  makeWorkout,
  nameClash,
  placeOn,
  relabel,
  suggestName,
} from "@/lib/workouts";
import { mixedName, offType, sameWorkoutDays } from "@/lib/day-fit";
import type {
  Exercise,
  PlannedExercise,
  Profile,
  Routine,
  SavedWorkout,
} from "@/lib/types";

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


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
  onRenameWorkout,
  onAddCustom,
  initialAdding = false,
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
  /** With the weekday it was saved from, so that day's name and link commit with it. */
  onSaveWorkout?: (w: SavedWorkout, day?: number) => void;
  onRemoveWorkout?: (id: string) => void;
  /** Renamed in place: same workout, new name, on every day it is on. Committed straight away, like saving one. */
  onRenameWorkout?: (id: string, name: string) => void;
  /** A lift the library does not have, added by hand. */
  onAddCustom?: (e: Exercise) => void;
  /** Opens straight into the picker, so /frames can show it. */
  initialAdding?: boolean;
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
  const [adding, setAdding] = useState(initialAdding);
  /* Set when the picker opens from a tap, so its search field takes focus. */
  const [focusSearch, setFocusSearch] = useState(false);
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
  /*
    The seven day types sat open on every visit, three rows of chips between
    the day's name and its first lift. The chosen type is one line now, and
    Change opens the chips in place; picking one closes them again.
  */
  const [kindOpen, setKindOpen] = useState(false);
  /*
    Tapping "+ Add a lift" or a type chip unmounts what was pressed, which
    would drop focus to the page. The search field and the Change link take it
    instead, so keyboard and screen reader users stay where they were.
  */
  const changeRef = useRef<HTMLButtonElement>(null);
  // The chips are named by their short text, so the pressed one is described by
  // the hint, and the group is named by its label. Ids tie those together.
  const kindLabelId = useId();
  const hintId = useId();
  const [pane, setPane] = useState<"editor" | "workouts">("editor");
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
  /* The saved workout whose actions are open in the list, and the one being renamed. */
  const [openWorkout, setOpenWorkout] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [renameClash, setRenameClash] = useState<string | null>(null);
  /*
    Days she has said should stay their type with an off-type lift on them,
    by weekday. Only for this visit: adding another one next time asks again,
    which is the point of asking.
  */
  const [keptMixed, setKeptMixed] = useState<number[]>([]);
  /*
    The name offered for a day that has grown past its type. It starts as the
    app's own ("Legs and abs") and the model's suggestion replaces it when one
    arrives, unless she has already typed over it, which the ref remembers
    across the fetch.
  */
  const [mixName, setMixName] = useState("");
  const mixTyped = useRef(false);
  const nameId = useId();

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
  async function addOwn(name: string) {
    if (!onAddCustom) return;
    // Filed under the day's first muscle until the server says otherwise.
    const made = await fileLift(name, {
      muscle: kind.muscles[0] ?? "arms",
      equipment: profile.equipment[0] ?? "dumbbell",
    });
    onAddCustom(made);
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

  function closeAdd() {
    setAdding(false);
    setFocusSearch(false);
  }

  function openAdd() {
    setOpenId(null);
    setAdding(true);
    setFocusSearch(true);
  }

  /* The type chips close on Done and on a pick, and take what they said with them. */
  function closeKinds() {
    setKindOpen(false);
    setDescribing(false);
    setWeekWhy(null);
    setWeekOffline(false);
    requestAnimationFrame(() => changeRef.current?.focus());
  }

  /*
    Asked once per new off-type lift, before the guard below because a hook
    cannot sit after an early return.
  */
  /*
    Only a lift added on this visit asks the question. One that was already on
    the day when the editor opened has been answered: she kept it, or saved
    the day as its own workout, and asking again every visit would turn a
    question into a nag. `days` is the week as it was when this opened.
  */
  const openedWith = (day: number) =>
    days.find((r) => r.day === day)?.exercises.map((e) => e.exerciseId) ?? [];
  const freshOffType = (r: Routine, exercises = r.exercises) =>
    r.workoutId || keptMixed.includes(r.day)
      ? []
      : offType(r.template, exercises).filter((id) => !openedWith(r.day).includes(id));
  const here = draft[dayIndex];
  const mixedHere = here ? freshOffType(here) : [];
  const mixKey =
    here && onSaveWorkout && mixedHere.length && !keptMixed.includes(here.day)
      ? `${here.day}:${here.template ?? ""}:${mixedHere.join(",")}`
      : "";
  useEffect(() => {
    if (!mixKey || !here) return;
    // Never a name she already uses: "Legs and abs" taken becomes "Legs and abs 2".
    setMixName(suggestName(mixedName(here.template, mixedHere), workouts ?? []));
    mixTyped.current = false;
    const stop = new AbortController();
    const late = setTimeout(() => stop.abort(), 4000);
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "name",
        text: templateOf(here.template ?? "full-body").label,
        lifts: here.exercises.map((e) => nameOf(e.exerciseId)),
      }),
      signal: stop.signal,
    })
      .then((r) => r.json())
      .then((out: { name?: string | null }) => {
        if (out.name && !mixTyped.current) setMixName(suggestName(out.name, workouts ?? []));
      })
      // Offline or slow: the app's own name is already showing.
      .catch(() => {});
    return () => {
      clearTimeout(late);
      stop.abort();
    };
    // Keyed on the off-type lifts themselves, not every render of the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey]);

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

  // Read once: the heading, the hint and the Fill button all describe this day's type.
  // It sits below the guard above because with no days there is no routine to read.
  const kind = templateOf(routine.template ?? "full-body");

  /*
    The days that are this same workout: Monday's and Thursday's Leg day, or
    every day carrying one saved workout. An edit on one is an edit on all of
    them, because that is what "my leg day" means; a lift added on Monday and
    missing on Thursday was the same workout quietly becoming two.
  */
  const twins = sameWorkoutDays(draft, dayIndex);
  const others = twins.filter((i) => i !== dayIndex).map((i) => FULL[draft[i].day]);
  const mixed = freshOffType(routine);
  const asking = mixed.length > 0 && Boolean(onSaveWorkout);

  const write = (exercises: PlannedExercise[]) => {
    /*
      Held back from the other days while a lift that does not fit is waiting
      on her answer. If she makes this day its own workout, Thursday should
      still be the leg day it was; if she keeps it, keepAsType copies it over.
    */
    const hold = twins.length > 1 && freshOffType(routine, exercises).length > 0;
    setDraft(
      draft.map((r, i) => (i === dayIndex || (!hold && twins.includes(i)) ? { ...r, exercises } : r))
    );
  };

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
   * — another day this week with the same type and name, then your saved
   * library — and only falls back to an empty day when you have never shaped
   * it. The library skips full body, which is meant to vary, but another
   * "Full body A" this week is the same workout and comes back like any other.
   */
  function setTemplate(id: TemplateId) {
    // Pressing the type the day already is used to rebuild it, and full body
    // rebuilds empty, so one tap on the pressed chip wiped the day. A day that
    // is one of her saved workouts is the exception: pressing its type is how
    // it becomes the plain day type again.
    if ((routine.template ?? "full-body") === id && !routine.workoutId) return;
    const [rebuilt] = generateRoutine(
      profile.level,
      [routine.day],
      profile.equipment,
      profile.favourites ?? [],
      [id]
    );
    if (!rebuilt) return;
    const twin = draft.find(
      (r, i) =>
        i !== dayIndex &&
        !r.workoutId &&
        (r.template ?? "full-body") === id &&
        r.label === rebuilt.label &&
        r.exercises.length
    );
    const saved = twin?.exercises ?? (id === "full-body" ? undefined : library?.[id]);
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
    closeAdd();
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
  const ownWorkout = routine.workoutId ? mine.find((w) => w.id === routine.workoutId) : undefined;
  const nameTaken = nameClash(mine, workoutName);

  function startNaming() {
    // Never the day type's own name: a custom workout called "Leg day" is the
    // confusion this is here to end. "Monday leg day" is a start she can type over.
    const own = `${FULL[routine.day]} ${routine.label.charAt(0).toLowerCase()}${routine.label.slice(1)}`;
    setWorkoutName(suggestName(mixed.length ? mixedName(routine.template, mixed) : own, mine));
    setNaming(true);
  }

  /**
   * Make this day one of her own workouts, by name.
   *
   * The day takes the name as well as the link, which is the part that used
   * to be missing: save Monday as "Legs and abs" and Monday still said Leg
   * day on Today, on Profile and here, and it kept counting as her leg day.
   * Now it is "Legs and abs" everywhere, it lives in her workouts, and Leg day
   * is left as it was.
   *
   * Saving under a name she already uses updates that workout and keeps its
   * id, the rule `saveWorkout` documents, and every day already on it takes
   * the new lineup with it.
   */
  function keepWorkout(nameArg?: string) {
    const name = cleanName(nameArg ?? workoutName);
    if (!name || !onSaveWorkout || routine.exercises.length === 0) return;
    const taken = nameClash(mine, name);
    const made = makeWorkout(name, routine.exercises, routine.template);
    const id = taken?.id ?? made.id;
    setDraft(
      draft.map((r, i) =>
        i === dayIndex || (taken && r.workoutId === taken.id)
          ? { ...r, workoutId: id, label: name, exercises: routine.exercises.map((e) => ({ ...e })) }
          : r
      )
    );
    onSaveWorkout(made, routine.day);
    setNaming(false);
    setWorkoutName("");
    setSaidSo(taken ? `Updated ${name}.` : `Saved as ${name}. It is in your workouts now.`);
  }

  /** "Keep it on Leg day": the lift stays, and the other leg days get it too. */
  function keepAsType() {
    setKeptMixed([...keptMixed, routine.day]);
    setDraft(draft.map((r, i) => (twins.includes(i) ? { ...r, exercises: routine.exercises } : r)));
    setSaidSo(
      others.length
        ? `Kept on ${routine.label}, and added to ${others.join(" and ")} too.`
        : `Kept on ${routine.label}.`
    );
  }

  function startRename(w: SavedWorkout) {
    setRenaming(w.id);
    setRenameTo(w.name);
    setRenameClash(null);
  }

  function finishRename() {
    if (!renaming) return;
    const name = cleanName(renameTo);
    if (!name) return;
    const clash = nameClash(mine, name, renaming);
    if (clash) {
      setRenameClash(clash.name);
      return;
    }
    onRenameWorkout?.(renaming, name);
    setDraft(relabel(draft, renaming, name));
    setRenaming(null);
    setSaidSo(`Renamed to ${name}.`);
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
    write(built.exercises);
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
    closeAdd();
    setRemoving(null);
    setPane("editor");
    setSaidSo(`${FULL[routine.day]} is now ${w.name}.`);
  }

  const thorough = coversTwiceWeekly(draft.map((r) => r.template ?? "full-body"));
  const used = routine.exercises.map((e) => e.exerciseId);
  const suggestions = suggestFrom(profile.favourites ?? [], profile.equipment).filter(
    (sg) => !used.includes(sg.tryThis)
  );

  /*
    What the picker offers before she types: two lifts for each muscle this day
    type trains, starred ones first. A pull day opens on rows and curls rather
    than on a library she has to know the names in.
  */
  const picks =
    kind.id === "cardio"
      ? cardioLifts(used, profile.equipment)
      : strengthPicks(kind.muscles, profile.equipment, used, profile.favourites ?? [], 2);
  const kindsShown = kindOpen || describing || Boolean(weekWhy) || weekOffline;

  /* The same small form renames a workout here and in the list of them. */
  const renameForm = (w: SavedWorkout) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        finishRename();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`${nameId}-rename`} className="label text-dim">
          Rename {w.name}
        </label>
        <button
          type="button"
          onClick={() => setRenaming(null)}
          className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
        >
          Cancel
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <input
          id={`${nameId}-rename`}
          value={renameTo}
          onChange={(e) => {
            setRenameTo(e.target.value);
            setRenameClash(null);
          }}
          maxLength={NAME_MAX}
          autoFocus
          className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
        />
        <button
          type="submit"
          disabled={!cleanName(renameTo) || cleanName(renameTo) === w.name}
          className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
        >
          Save
        </button>
      </div>
      {renameClash && (
        <p role="status" className="mt-2 text-body leading-snug text-dim">
          You already have a workout called {renameClash}. Pick another name.
        </p>
      )}
    </form>
  );

  /*
    Her saved workouts, as a list of things to choose rather than a settings
    page. It used to open from a chip dressed as one of the seven day types,
    hold a save form, a list and two back buttons at once, and highlight a
    row by comparing lifts rather than by what was actually on the day. Now it
    is only the list: tap one to see what you can do with it.
  */
  if (pane === "workouts") {
    const leave = () => {
      setPane("editor");
      setOpenWorkout(null);
      setRenaming(null);
      setRemoving(null);
    };
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">Your workouts</p>
          <button
            type="button"
            onClick={leave}
            className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
          >
            Back
          </button>
        </div>

        <h1 className="statement mt-2 text-figure text-fg">{FULL[routine.day]}</h1>
        <p className="mt-1.5 text-emphasis leading-snug text-dim">
          {mine.length
            ? `Put one on ${FULL[routine.day]}. Nothing changes until you save the week.`
            : "Nothing saved yet."}
        </p>

        {saidSo && (
          <p role="status" className="mt-3 rounded-2xl bg-card p-[18px] text-body leading-snug text-dim">
            {saidSo}
          </p>
        )}

        {mine.length > 0 ? (
          <ul className="mt-6 overflow-hidden rounded-2xl bg-card">
            {mine.map((w) => {
              const open = openWorkout === w.id;
              const sure = removing === w.id;
              // Where it is, read off the link, not off matching lifts or names.
              const on = draft.filter((r) => r.workoutId === w.id).map((r) => SHORT_DAYS[r.day]);
              const isHere = routine.workoutId === w.id;
              return (
                <li key={w.id} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => {
                      setOpenWorkout(open ? null : w.id);
                      setRenaming(null);
                      setRemoving(null);
                    }}
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-[18px] py-3 text-left transition-colors hover:bg-raise/40 focus-visible:-outline-offset-2!"
                  >
                    <span className="min-w-0">
                      <span className="head block truncate text-emphasis text-fg">{w.name}</span>
                      <span className="mt-0.5 block truncate text-body text-dim">
                        {count(w.exercises.length, "lift")} ·{" "}
                        {w.exercises.map((e) => nameOf(e.exerciseId)).join(", ")}
                      </span>
                      {on.length > 0 && (
                        <span className="label mt-2 block text-cyan">On {on.join(", ")}</span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className={`shrink-0 text-head leading-none text-cyan transition-transform duration-quick ${
                        open ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                  </button>
                  {open && (
                    <div className="rise px-[18px] pb-[18px]">
                      {renaming === w.id ? (
                        renameForm(w)
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                          {!isHere && (
                            <Pill size="sm" variant="ghost" onClick={() => putOn(w)}>
                              Put on {FULL[routine.day]}
                            </Pill>
                          )}
                          {onRenameWorkout && (
                            <button
                              type="button"
                              onClick={() => startRename(w)}
                              className="head tap text-body text-cyan transition-opacity hover:opacity-70"
                            >
                              Rename
                            </button>
                          )}
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
                                setOpenWorkout(null);
                                setSaidSo(`Removed ${w.name}.`);
                              }}
                              aria-label={sure ? `Confirm removing ${w.name}` : `Remove ${w.name}`}
                              className={`head tap text-body transition-colors ${
                                sure ? "text-action" : "text-dim hover:text-fg"
                              }`}
                            >
                              {sure ? "Sure?" : "Remove"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <section className="mt-6 rounded-2xl bg-card p-[18px]">
            <p className="text-body leading-snug text-dim">
              Save a day as a custom workout and it lands here, ready to put on any day.
            </p>
          </section>
        )}
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
      {/* The type has its own line in the card below, so this says what the day holds. */}
      <p className="mt-1 text-emphasis text-dim">
        {routine.exercises.length ? count(routine.exercises.length, "lift") : "No lifts yet"}
      </p>

      {days.length > 1 && (
        <div className="mt-4 flex gap-2">
          {draft.map((r, i) => (
            <button
              key={r.day}
              type="button"
              onClick={() => {
                setDayIndex(i);
                setOpenId(null);
                closeAdd();
                // Said about the day she has just left, so it does not follow
                // her onto the next one.
                setSaidSo(null);
                setNaming(false);
                setRemoving(null);
                setRenaming(null);
                setKindOpen(false);
              }}
              aria-pressed={i === dayIndex}
              // "T" alone is Tuesday or Thursday to a screen reader.
              aria-label={FULL[r.day]}
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
        list before a single lift. As chips they took three rows on every
        visit; now the chosen one is a line, and the chips open on Change.
      */}
      <section className="mt-4 rounded-2xl bg-card p-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <p id={kindLabelId} className="label text-dim">What kind of day</p>
          <button
            ref={changeRef}
            type="button"
            onClick={() => (kindsShown ? closeKinds() : setKindOpen(true))}
            aria-expanded={kindsShown}
            className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
          >
            {kindsShown ? "Done" : "Change"}
          </button>
        </div>

        {kindsShown ? (
          <div className="rise">
            <div role="group" aria-labelledby={kindLabelId} className="mt-3 flex flex-wrap gap-2">
              {TEMPLATES.map((t) => {
                // A custom workout is not one of the seven, so none is pressed.
                const on = !routine.workoutId && (routine.template ?? "full-body") === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTemplate(t.id);
                      closeKinds();
                    }}
                    aria-pressed={on}
                    aria-describedby={on ? hintId : undefined}
                    className={`head h-11 rounded-full border px-4 text-body transition-colors duration-quick ${
                      on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg hover:text-fg"
                    }`}
                  >
                    {t.short}
                  </button>
                );
              })}
            </div>
            <p id={hintId} aria-live="polite" className="mt-3 text-body leading-snug text-dim">
              {kind.hint}
              {kind.recommended && (
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
            // .tap carries its own unlayered -12px margin, which beats Tailwind's
            // layered mt-3, so the spacing lives on a wrapper. It is mt-5 because
            // 12px of it is cancelled by that margin, leaving the hit area clear
            // of the hint and the words 20px below it.
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setDescribing(true)}
                className="head tap text-body text-cyan transition-opacity hover:opacity-70"
              >
                Or describe your week
              </button>
            </div>
          )}
          </div>
        ) : (
          <>
            <p className="head mt-2 text-head text-fg">
              {routine.workoutId ? routine.label : kind.label}
            </p>
            <p className="mt-0.5 text-body leading-snug text-dim">
              {routine.workoutId ? (
                "One of your workouts. Pick a day type to turn it back into one."
              ) : (
                <>
                  {kind.hint}
                  {kind.recommended && (
                    <span className="label ml-2 text-cyan">Recommended</span>
                  )}
                </>
              )}
            </p>
          </>
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

      {/*
        One card with the rows divided, the way Profile lists the plan, rather
        than a card per lift: five lifts used to cost four gaps and ten 18px
        paddings before the first of them ended.
      */}
      {routine.exercises.length > 0 && (
      <ul className="mt-2.5 overflow-hidden rounded-2xl bg-card">
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
            <li key={e.exerciseId} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.exerciseId)}
                aria-expanded={open}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-[18px] py-3 text-left transition-colors hover:bg-raise/40 focus-visible:-outline-offset-2!"
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
      )}

      {/*
        A lift that does not fit the day's type. Asked here, under the list it
        just landed in, with a name already written, because "is this still a
        leg day?" is a question only she can answer and the moment she adds an
        ab crunch is the moment she knows. Either answer is one tap.
      */}
      {asking && (
        <section className="rise mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Its own workout?</p>
          <p className="mt-2 text-body leading-snug text-fg">
            {nameOf(mixed[0])}
            {mixed.length > 1 ? ` and ${count(mixed.length - 1, "other lift")} don't` : " doesn't"} usually
            go on {kind.label}. Save {FULL[routine.day]} as its own workout and {kind.label} stays as it is.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              keepWorkout(mixName);
            }}
            className="mt-3 flex items-center gap-2.5"
          >
            <input
              value={mixName}
              onChange={(e) => {
                setMixName(e.target.value);
                mixTyped.current = true;
              }}
              maxLength={NAME_MAX}
              aria-label="Name for this workout"
              className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            <button
              type="submit"
              disabled={!cleanName(mixName)}
              className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
            >
              Save
            </button>
          </form>
          {nameClash(mine, mixName) && (
            <p className="mt-2 text-body leading-snug text-dim">
              You already have a {nameClash(mine, mixName)!.name}. Saving replaces it.
            </p>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={keepAsType}
              className="head tap text-body text-cyan transition-opacity hover:opacity-70"
            >
              Keep it on {kind.label}
            </button>
          </div>
        </section>
      )}

      {/*
        The one empty state, now that a day type arrives empty rather than
        pre-filled. Three ways out of it and they are genuinely different
        answers: have the app choose the lifts, choose them, or let the day stay
        a rest day. It used to be a sentence, a button, a second sentence and a
        dashed box further down; it is one sentence and the two answers that
        need a tap. Both are outlines: Save is this screen's one fill.
      */}
      {routine.exercises.length === 0 && !adding && (
        <div className="mt-4">
          <p className="text-body leading-snug text-dim">
            Nothing on this day yet. Have the app fill it with {kind.label.toLowerCase()} work,
            choose the lifts yourself, or leave it as a rest day.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Pill size="sm" variant="ghost" onClick={autofill}>
              Autofill for me
            </Pill>
            <Pill size="sm" variant="ghost" onClick={openAdd}>
              Choose a lift
            </Pill>
          </div>
          {mine.length > 0 && onSaveWorkout && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setPane("workouts")}
                className="head tap text-body text-cyan transition-opacity hover:opacity-70"
              >
                Or put one of your workouts on it
              </button>
            </div>
          )}
        </div>
      )}

      {adding ? (
        <div className="rise mt-2.5 rounded-2xl bg-card p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Add a lift</p>
            <button
              type="button"
              onClick={closeAdd}
              className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
            >
              Cancel
            </button>
          </div>
          <LiftSearch
            className="mt-3"
            equipment={profile.equipment}
            exclude={used}
            picks={picks}
            picksLabel={`Suggested for ${kind.label.toLowerCase()}`}
            emptyNote={`Everything that fits a ${kind.label.toLowerCase()} is already on this day. Search the whole library above.`}
            // Cardio has no muscle list to choose among, so it is not asked.
            askMuscles={kind.id === "cardio" ? undefined : kind.muscles}
            onPick={(id) => add(id)}
            onAddOwn={onAddCustom ? addOwn : undefined}
            autoFocus={focusSearch}
          />
        </div>
      ) : (
        (routine.exercises.length > 0 || suggestions.length > 0 || profile.level === "new") && (
          <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
            {/* An empty day has its own Choose a lift above, so it does not get two. */}
            {routine.exercises.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                className="head flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-line-strong text-body text-cyan transition-colors hover:border-fg"
              >
                + Add a lift
              </button>
            )}
            {suggestions.length > 0 && (
              <div className={routine.exercises.length > 0 ? "mt-4 border-t border-line pt-4" : ""}>
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
                          You star {nameOf(sg.because)}. Same muscle, different feel.
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.level === "new" && (
              <p className={`text-body text-dim ${routine.exercises.length > 0 || suggestions.length > 0 ? "mt-3" : ""}`}>
                Your days are full body on purpose. Hitting everything twice a week beats a
                clever split you have to remember.
              </p>
            )}
          </div>
        )
      )}

      {/*
        What this day is, and what saving it would make it.

        Saving a custom workout used to live behind the type chips and inside
        the saved list, under a "This day" label, and the result never showed
        on the day. Here it is the last thing before Save the week, and it
        says which of the two things this day is: her leg day (shared with
        every other leg day, and what Leg day brings back), or one of her own
        named workouts.
      */}
      {routine.exercises.length > 0 && onSaveWorkout && !adding && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          {ownWorkout && renaming === ownWorkout.id ? (
            renameForm(ownWorkout)
          ) : ownWorkout ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="label text-dim">Your workout</p>
                {onRenameWorkout && (
                  <button
                    type="button"
                    onClick={() => startRename(ownWorkout)}
                    className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
                  >
                    Rename
                  </button>
                )}
              </div>
              <p className="head mt-2 text-emphasis text-fg">{ownWorkout.name}</p>
              <p className="mt-1 text-body leading-snug text-dim">
                Saved. Changes here save to it
                {others.length ? `, and to ${others.join(" and ")}` : ""}.
              </p>
            </>
          ) : naming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                keepWorkout();
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={nameId} className="label text-dim">
                  Call it
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNaming(false);
                    setWorkoutName("");
                  }}
                  className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
                >
                  Cancel
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <input
                  id={nameId}
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  maxLength={NAME_MAX}
                  autoFocus
                  placeholder="Legs and abs"
                  className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <button
                  type="submit"
                  disabled={!cleanName(workoutName)}
                  className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
                >
                  {nameTaken ? "Update" : "Save"}
                </button>
              </div>
              {nameTaken && (
                <p className="mt-2 text-body leading-snug text-dim">
                  You already have a {nameTaken.name}. Saving replaces it.
                </p>
              )}
            </form>
          ) : (
            <>
              <p className="label text-dim">Your {routine.label}</p>
              <p className="mt-2 text-body leading-snug text-dim">
                {kind.id === "full-body"
                  ? others.length
                    ? `It is on ${others.join(" and ")} too, so changes here go there as well.`
                    : "Full body is meant to change, so it is not kept by type. Save it to keep this one."
                  : `Press ${kind.label} on any day and this comes back.${
                      others.length ? ` It is on ${others.join(" and ")} too, so changes here go there as well.` : ""
                    }`}
              </p>
              <Pill size="sm" variant="ghost" className="mt-3" onClick={startNaming}>
                Save as a custom workout
              </Pill>
            </>
          )}

          {mine.length > 0 && (
            <button
              type="button"
              onClick={() => {
                closeAdd();
                setPane("workouts");
              }}
              className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 border-t border-line pt-4 text-left"
            >
              <span className="text-body text-fg">Your saved workouts</span>
              <span className="flex items-center gap-2.5 text-body text-dim">
                {mine.length}
                <span aria-hidden className="text-head leading-none text-cyan">
                  ›
                </span>
              </span>
            </button>
          )}
        </section>
      )}

      {/*
        Pinned, over a fade into the ground, so saving is never a scroll to the
        bottom. What keeps the last lift clear of it is this bar's own height in
        the flow, plus the pane's padding, not the padding alone. The wrapper
        ignores taps so a lift showing through the fade can still be tapped;
        only the Save pill takes them.
      */}
      <div className="pointer-events-none sticky bottom-0 -mx-6 mt-auto bg-gradient-to-t from-ground from-60% to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        <Pill className="pointer-events-auto" onClick={() => onSave(draft)}>
          Save the week
        </Pill>
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
