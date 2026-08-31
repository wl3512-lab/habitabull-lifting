"use client";

import { useState } from "react";
import { Pill } from "./ui";
import { alternativesFor, generateRoutine, SHORT_DAYS, startingWeight, suggestFrom } from "@/lib/engine";
import { TEMPLATES, coversTwiceWeekly, templateOf, type TemplateId } from "@/lib/templates";
import { byId, nameOf } from "@/lib/exercises";
import type { Muscle, PlannedExercise, Profile, Routine } from "@/lib/types";

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
  onBack,
}: {
  profile: Profile;
  routines: Routine[];
  onSave: (r: Routine[]) => void;
  onBack: () => void;
}) {
  const days = [...routines].sort((a, b) => a.day - b.day);
  const [dayIndex, setDayIndex] = useState(0);
  const [draft, setDraft] = useState<Routine[]>(days);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Muscle | null>(null);

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

  const add = (id: string) => {
    const meta = byId(id);
    if (!meta) return;
    write([
      ...routine.exercises,
      {
        exerciseId: id,
        sets: 3,
        reps: meta.increment === 0 ? 30 : 8,
        weight: startingWeight(meta, profile.level),
      },
    ]);
    setAdding(null);
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
        <p className="label text-cyan">Edit your week</p>
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
              onClick={() => setAdding(null)}
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
