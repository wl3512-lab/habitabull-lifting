"use client";

import { useState } from "react";
import { Pill } from "./ui";
import { alternativesFor, generateRoutine, LEVEL_SETS, repsFor, SHORT_DAYS, startingWeight, suggestFrom } from "@/lib/engine";
import { TEMPLATES, coversTwiceWeekly, templateOf, type TemplateId } from "@/lib/templates";
import { byId, makeCustomExercise, nameOf } from "@/lib/exercises";
import type { Equipment, Exercise, Muscle, PlannedExercise, Profile, Routine } from "@/lib/types";

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MUSCLES: { id: Muscle; label: string }[] = [
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
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
  onSave,
  onAddCustom,
  initialAdding = null,
  onBack,
}: {
  profile: Profile;
  routines: Routine[];
  onSave: (r: Routine[]) => void;
  /** A lift the library does not have, added by hand. */
  onAddCustom?: (e: Exercise) => void;
  /** Opens straight into the picker, so /frames can show it. */
  initialAdding?: Muscle | null;
  onBack: () => void;
}) {
  const days = [...routines].sort((a, b) => a.day - b.day);
  const [dayIndex, setDayIndex] = useState(0);
  const [draft, setDraft] = useState<Routine[]>(days);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Muscle | null>(initialAdding);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggested, setSuggested] = useState<{ id: string; why: string } | null>(null);
  const [weekAsk, setWeekAsk] = useState("");
  const [weekBusy, setWeekBusy] = useState(false);
  const [weekWhy, setWeekWhy] = useState<string | null>(null);
  const [ownName, setOwnName] = useState("");
  const [ownBusy, setOwnBusy] = useState(false);

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
      // The shapes above still work. Nothing is blocked by this being down.
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
    setAdding(null);
    setAsk("");
    setSuggested(null);
  }

  const routine = draft[dayIndex];
  if (!routine) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <p className="text-[17px] text-dim">No training days yet. Set up your week first.</p>
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

  /** Changing the day type rebuilds that day from the template. */
  function setTemplate(id: TemplateId) {
    const [rebuilt] = generateRoutine(
      profile.level,
      [routine.day],
      profile.equipment,
      profile.favourites ?? [],
      [id]
    );
    if (!rebuilt) return;
    setDraft(draft.map((r, i) => (i === dayIndex ? { ...rebuilt, day: r.day } : r)));
    setOpenId(null);
    setAdding(null);
  }

  const thorough = coversTwiceWeekly(draft.map((r) => r.template ?? "full-body"));
  const used = routine.exercises.map((e) => e.exerciseId);
  const suggestions = suggestFrom(profile.favourites ?? [], profile.equipment).filter(
    (sg) => !used.includes(sg.tryThis)
  );

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">
          {profile.planChosen ? "Edit your week" : "Build your week"}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Cancel
        </button>
      </div>

      <h1 className="statement mt-2 text-[44px] text-fg">{FULL[routine.day]}</h1>
      <p className="mt-1 text-[17px] text-dim">{templateOf(routine.template ?? "full-body").label}</p>

      {days.length > 1 && (
        <div className="mt-4 flex gap-2">
          {draft.map((r, i) => (
            <button
              key={r.day}
              type="button"
              onClick={() => {
                setDayIndex(i);
                setOpenId(null);
                setAdding(null);
              }}
              aria-pressed={i === dayIndex}
              className={`head h-11 flex-1 rounded-full border text-[17px] transition-colors duration-150 ${
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

      <section className="mt-4 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">What kind of day</p>
        <div className="mt-3 flex flex-col gap-2">
          {TEMPLATES.map((t) => {
            const on = (routine.template ?? "full-body") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                aria-pressed={on}
                className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
                  on ? "border-cyan bg-raise" : "border-transparent bg-raise/40 hover:bg-raise/70"
                }`}
              >
                <span className="head flex items-baseline gap-2 text-[17px] text-fg">
                  {t.label}
                  {t.recommended && (
                    <span className="label text-cyan">Recommended</span>
                  )}
                </span>
                <span className="block text-[15px] text-dim">{t.hint}</span>
              </button>
            );
          })}
        </div>
        {/*
          For the person who does not know what a split is. It sits under the
          shapes, never instead of them: anyone who knows what they want taps
          the list and never sees a text field.
        */}
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
              placeholder="I want to focus on legs, and one easy day"
              aria-label="Describe the week you want"
              className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-[16px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            <button
              type="submit"
              disabled={!weekAsk.trim() || weekBusy}
              className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-[15px] text-ground transition-opacity disabled:opacity-30"
            >
              {weekBusy ? "…" : "Build"}
            </button>
          </form>
          {weekWhy && (
            <p role="status" className="mt-2.5 text-[15px] leading-snug text-dim">
              {weekWhy} Change any day above.
            </p>
          )}
        </div>

        {/*
          One honest line, not a block. Three days of push/pull/legs trains each
          group once a week, and ACSM's whole point is that twice is what counts
          — she should know that and then decide for herself.
        */}
        {!thorough && (
          <p className="mt-3 text-[15px] text-dim">
            This week trains some muscles once. Twice a week is what makes the difference —
            full body, or run these days again.
          </p>
        )}
      </section>

      <ul className="mt-2.5 flex flex-col gap-2">
        {routine.exercises.map((e) => {
          const meta = byId(e.exerciseId);
          const open = openId === e.exerciseId;
          const alts = meta
            ? alternativesFor(meta.primary, profile.equipment, used, profile.favourites ?? [])
            : [];
          return (
            <li key={e.exerciseId} className="rounded-2xl bg-card">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.exerciseId)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-[18px] text-left"
              >
                <span className="min-w-0">
                  <span className="head block truncate text-[17px] text-fg">
                    {nameOf(e.exerciseId)}
                  </span>
                  <span className="block text-[15px] text-dim">
                    {e.sets} × {e.reps}
                    {e.weight > 0 && ` · ${e.weight} lb`}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-[15px] text-cyan">
                  {open ? "Done" : "Edit"}
                </span>
              </button>

              {open && (
                <div className="rise border-t border-line px-[18px] pb-[18px] pt-4">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[15px] text-dim">Sets</span>
                    <Stepper
                      value={e.sets}
                      min={1}
                      max={6}
                      onChange={(n) => update(e.exerciseId, { sets: n })}
                      label="sets"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="flex-1 text-[15px] text-dim">Reps</span>
                    <Stepper
                      value={e.reps}
                      min={1}
                      max={60}
                      step={meta?.increment === 0 ? 5 : 1}
                      onChange={(n) => update(e.exerciseId, { reps: n })}
                      label="reps"
                    />
                  </div>

                  {alts.length > 0 && (
                    <>
                      <p className="label mt-5 text-dim">
                        Swap for another {meta?.primary} lift
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {alts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => swap(e.exerciseId, a.id)}
                            className="head rounded-full border border-line-strong px-4 py-2.5 text-[15px] text-dim transition-colors hover:border-fg hover:text-fg"
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
                    className="head tap mt-5 text-[15px] text-dim transition-colors hover:text-fg"
                  >
                    Take this out
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {routine.exercises.length === 0 && (
        <p className="mt-4 text-[15px] text-dim">
          Nothing on this day. Add a lift, or leave it as a rest day.
        </p>
      )}

      {adding ? (
        <div className="rise mt-2.5 rounded-2xl bg-card p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Pick a {adding} lift</p>
            <button
              type="button"
              onClick={closeAdd}
              className="head tap shrink-0 text-[15px] text-cyan"
            >
              Cancel
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {alternativesFor(adding, profile.equipment, used, profile.favourites ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => add(a.id)}
                className="head rounded-full border border-line-strong px-4 py-2.5 text-[15px] text-dim transition-colors hover:border-fg hover:text-fg"
              >
                {a.name}
              </button>
            ))}
          </div>

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
                className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-[16px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
              />
              <button
                type="submit"
                disabled={!ask.trim() || asking}
                className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-[15px] text-ground transition-opacity disabled:opacity-30"
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
                  className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-[16px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <button
                  type="submit"
                  disabled={!ownName.trim() || ownBusy}
                  className="head grid h-11 shrink-0 place-items-center rounded-full bg-raise px-5 text-[15px] text-cyan transition-opacity disabled:opacity-30"
                >
                  {ownBusy ? "…" : "Add"}
                </button>
              </form>
              <p className="mt-2 text-[15px] leading-snug text-dim">
                Type the name and it gets filed for you. There is no form guidance for a
                lift you added — that part only exists where a person wrote it.
              </p>
            </div>
          )}

          {suggested && byId(suggested.id) && (
              <div role="status" className="mt-3 rounded-xl bg-raise/50 p-3.5">
                <p className="head text-[17px] text-fg">{nameOf(suggested.id)}</p>
                {suggested.why && (
                  <p className="mt-1 text-[15px] leading-snug text-dim">{suggested.why}</p>
                )}
                <button
                  type="button"
                  onClick={() => add(suggested.id)}
                  className="head tap mt-2 text-[15px] text-cyan transition-opacity hover:opacity-70"
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
                onClick={() => setAdding(m.id)}
                className="head rounded-full border border-line-strong px-4 py-2.5 text-[15px] text-dim transition-colors hover:border-fg hover:text-fg"
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
                      <span className="head block text-[17px] text-fg">{nameOf(sg.tryThis)}</span>
                      <span className="block text-[15px] text-dim">
                        You star {nameOf(sg.because)} — same muscle, different feel.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.level === "new" && (
            <p className="mt-3 text-[15px] text-dim">
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

/** A compact inline ± for numbers that live inside a row. */
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
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
        className="grid h-11 w-11 place-items-center rounded-full bg-raise text-[22px] leading-none text-cyan transition-colors hover:bg-line disabled:opacity-30"
      >
        −
      </button>
      <span className="tabular statement w-10 text-center text-[24px] text-fg">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className="grid h-11 w-11 place-items-center rounded-full bg-raise text-[22px] leading-none text-cyan transition-colors hover:bg-line disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
