"use client";

import { useState } from "react";
import BodyWeight from "./BodyWeight";
import PlaylistRow from "./PlaylistRow";
import YourData from "./YourData";
import { Card, Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { REST_MAX, REST_MIN, REST_STEP, restSeconds, SHORT_DAYS } from "@/lib/engine";
import { DEFAULT_BAR_LB } from "@/lib/plates";
import Stepper from "./Stepper";
import type { AppState, Profile as ProfileT } from "@/lib/types";

/**
 * You, and the setup that is yours rather than today's.
 *
 * Everything here used to be scattered: the reason lived on Today, the data
 * export on Progress, the playlist under the Start button, the plan behind an
 * edit link. None of it is a per-session decision, so it belongs together in
 * one place you visit rarely — which is also what lets Today and Progress stay
 * about the single thing each is for.
 *
 * Body weight moved here from Progress on purpose. It is something about you,
 * not about a workout, and keeping the record screen strictly about training
 * is the same instinct that keeps a scale out of the logging flow.
 */
const ANCHOR: Record<string, string> = {
  wake: "First thing",
  lunch: "Lunchtime",
  afterwork: "After work",
  evening: "Evening",
};

export default function Profile({
  profile,
  state,
  today,
  onProfile,
  onWeighIn,
  onImport,
  onEditPlan,
  onEditWeek,
}: {
  profile: ProfileT;
  state: AppState;
  today: string;
  onProfile: (p: ProfileT) => void;
  onWeighIn: (lb: number) => void;
  onImport: (s: AppState) => void;
  onEditPlan: (day?: number) => void;
  onEditWeek: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [editingWhy, setEditingWhy] = useState(false);
  const [why, setWhy] = useState(profile.motivation ?? "");

  function saveName() {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean) onProfile({ ...profile, name: clean });
    else setName(profile.name);
    setEditingName(false);
  }
  function saveWhy() {
    onProfile({ ...profile, motivation: why.trim().slice(0, 120) || undefined });
    setEditingWhy(false);
  }

  const routines = [...state.routines].sort((a, b) => a.day - b.day);
  const kit = [...new Set(profile.equipment)];
  const days = [...profile.trainingDays].sort((a, b) => a - b);
  /*
    What a given weekday is called in the plan. A trained day with no routine
    yet is possible — the schedule is saved before the plan is built on first
    run — so this returns undefined rather than assuming one exists.
  */
  const labelFor = (d: number) => routines.find((r) => r.day === d)?.label;
  const when = profile.anchors?.length
    ? profile.anchors.map((a) => ANCHOR[a] ?? a).join(", ")
    : profile.anchors === undefined
      ? null
      : "Whenever you can";

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-cyan">Profile</p>

      {/* Name — the one identifying thing, editable in place. */}
      {editingName ? (
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="statement mt-2 w-full border-b-2 border-line-strong bg-transparent pb-1 text-figure text-fg focus:border-cyan focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setName(profile.name);
            setEditingName(true);
          }}
          className="mt-2 text-left"
        >
          <span className="statement text-figure text-fg">{profile.name}</span>
          <span className="head ml-3 align-middle text-caption text-cyan">Edit</span>
        </button>
      )}

      {/* Why — quoted back on the hard days; her words, never rewritten. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label text-dim">You workout because</p>
          {!editingWhy && (
            <button
              type="button"
              onClick={() => {
                setWhy(profile.motivation ?? "");
                setEditingWhy(true);
              }}
              className="head tap text-caption text-cyan transition-opacity hover:opacity-70"
            >
              {profile.motivation ? "Change" : "Add"}
            </button>
          )}
        </div>
        {editingWhy ? (
          <div className="mt-2.5">
            <textarea
              value={why}
              autoFocus
              rows={2}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="It clears my head."
              className="w-full resize-none rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            <div className="mt-2.5 flex gap-2">
              <Pill size="sm" onClick={saveWhy} className="h-12 flex-1">
                Save
              </Pill>
              <button
                type="button"
                onClick={() => setEditingWhy(false)}
                className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="statement mt-1.5 text-title text-fg">
            {profile.motivation ? `“${profile.motivation}”` : "—"}
          </p>
        )}
      </section>

      {/* Body weight — moved from Progress; it is about you, not a session. */}
      <BodyWeight weighIns={state.weighIns ?? []} today={today} onSave={onWeighIn} />

      {/* The plan: what you train and the sets and reps behind each lift. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label text-dim">Your workouts</p>
          <button
            type="button"
            onClick={() => onEditPlan()}
            className="head tap text-caption text-cyan transition-opacity hover:opacity-70"
          >
            Edit
          </button>
        </div>
        {routines.length === 0 ? (
          <Card className="mt-3 p-[18px]">
            <p className="text-body text-dim">No plan yet. Set up your week to build one.</p>
            <div className="mt-4">
              <Pill size="sm" variant="ghost" onClick={onEditWeek}>
                Set up your week
              </Pill>
            </div>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {routines.map((r) => (
              <Card key={`${r.day}-${r.label}`} className="p-[18px]">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="head text-emphasis text-fg">{r.label}</h2>
                  <span className="label shrink-0 text-dim">{SHORT_DAYS[r.day]}</span>
                </div>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {r.exercises.map((e) => (
                    <li
                      key={e.exerciseId}
                      className="flex items-baseline justify-between gap-3 text-body"
                    >
                      <span className="text-fg">{nameOf(e.exerciseId)}</span>
                      <span className="tabular shrink-0 text-dim">
                        {e.sets} × {e.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Schedule and equipment — the frame the plan is built inside. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label text-dim">Schedule</p>
          <button
            type="button"
            onClick={onEditWeek}
            className="head tap text-caption text-cyan transition-opacity hover:opacity-70"
          >
            Edit
          </button>
        </div>
        {/*
          The trained days are the way into what each one is. They were flat
          labels, so changing Wednesday from a pull day to a leg day meant
          knowing to go up to "Your workouts" and hunt for Wednesday there —
          the screen that says which days you train could not say what they
          were. A day you do not train is still a label: there is nothing to
          open, and offering one would imply tapping it adds the day, which is
          what Edit is for.
        */}
        <Card className="mt-3 p-[18px]">
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((d) =>
              days.includes(d) ? (
                <button
                  key={d}
                  type="button"
                  onClick={() => onEditPlan(d)}
                  aria-label={`${SHORT_DAYS[d]}: ${labelFor(d) ?? "training day"}. Edit this day.`}
                  className="rounded-tick bg-cyan px-2.5 py-1.5 text-caption text-ground transition-opacity hover:opacity-80"
                >
                  {SHORT_DAYS[d]}
                </button>
              ) : (
                <span
                  key={d}
                  className="rounded-tick bg-raise px-2.5 py-1.5 text-caption text-dim"
                >
                  {SHORT_DAYS[d]}
                </span>
              )
            )}
          </div>
          {/* What each trained day is, which the row of letters cannot say. */}
          <ul className="mt-3 flex flex-col gap-1">
            {days.map((d) => (
              <li key={d} className="flex items-baseline justify-between gap-3 text-body">
                <span className="text-dim">{SHORT_DAYS[d]}</span>
                <button
                  type="button"
                  onClick={() => onEditPlan(d)}
                  className="head text-body text-cyan transition-opacity hover:opacity-70"
                >
                  {labelFor(d) ?? "Not set"}
                </button>
              </li>
            ))}
          </ul>
          {when && <p className="mt-3 text-body text-dim">{when}</p>}
        </Card>
      </section>

      {kit.length > 0 && (
        <section className="mt-8">
          <p className="label text-dim">Equipment</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kit.map((k) => (
              <span key={k} className="rounded-full bg-raise px-3 py-1.5 text-caption text-fg">
                {k === "bodyweight" ? "bodyweight" : `${k}s`}
              </span>
            ))}
          </div>
        </section>
      )}

      {/*
        Two ways to put a number on a barbell lift, and she picks. The steppers
        ask what the set weighs and assume she has worked it out; the plates ask
        what is on the bar and work it out for her. Neither is right for
        everybody, which is why this is a setting and not a redesign.

        Only barbell lifts change. A dumbbell has no bar to load and a machine
        has a pin, so those keep the steppers either way — the toggle says so
        rather than letting her find out.
      */}
      <section className="mt-8">
        <p className="label text-dim">Setting a weight</p>
        <Card className="mt-3 p-[18px]">
          <div className="flex gap-1.5">
            {(
              [
                ["steppers", "Steppers"],
                ["plates", "Load the bar"],
              ] as const
            ).map(([id, label]) => {
              const on = (profile.weightInput ?? "steppers") === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onProfile({ ...profile, weightInput: id })}
                  className={`head h-11 flex-1 rounded-full border text-body transition-colors ${
                    on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body text-dim">
            {(profile.weightInput ?? "steppers") === "plates"
              ? `Tap plates onto a ${profile.barLb ?? DEFAULT_BAR_LB} lb bar and the total works itself out. Barbell lifts only — dumbbells and machines keep the steppers.`
              : "Plus and minus, or tap the number to type it."}
          </p>
        </Card>
      </section>

      {/*
        Rest was set once at signup and then unreachable forever, which is half
        of why the old pace setting felt broken: somebody who disagreed with it
        had nowhere to go. It belongs here rather than on the timer — it is a
        setting, not a per-set decision — and the timer already lets you skip.
      */}
      <section className="mt-8">
        <p className="label text-dim">Rest between sets</p>
        <Card className="mt-3 p-[18px]">
          <Stepper
            label="Rest"
            value={restSeconds(profile)}
            step={REST_STEP}
            min={REST_MIN}
            max={REST_MAX}
            suffix="sec"
            onChange={(sec) => onProfile({ ...profile, restSec: sec })}
          />
          <p className="mt-3 text-body text-dim">
            The same on every lift. Take longer when you need it — nothing here counts it against you.
          </p>
        </Card>
      </section>

      {/* Music on the way in, and the data underneath all of it. */}
      <section className="mt-8">
        <p className="label text-dim">Gym playlist</p>
        <div className="mt-3">
          <PlaylistRow profile={profile} onProfile={onProfile} />
        </div>
      </section>

      <div className="mt-8">
        <YourData state={state} onImport={onImport} />
      </div>
    </main>
  );
}
