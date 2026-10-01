"use client";

import { useState } from "react";
import BodyWeight from "./BodyWeight";
import PlaylistRow from "./PlaylistRow";
import YourData from "./YourData";
import Stepper from "./Stepper";
import { ExpandRow, LinkRow, RowGroup, SwitchRow } from "./ProfileRows";
import { Card, Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { count } from "@/lib/plural";
import { offersPlates } from "@/lib/plates";
import { REST_MAX, REST_MIN, REST_STEP, restSeconds, SHORT_DAYS } from "@/lib/engine";
import {
  dayLine,
  equipmentLine,
  EQUIPMENT_LABELS,
  levelLabel,
  LEVELS,
  scheduleLine,
  weighInLine,
} from "@/lib/profile-summary";
import type { AppState, Profile as ProfileT } from "@/lib/types";

/** The rows that open in place. Links and the switch are not in here. */
export type ProfileRowId = "weight" | "saved" | "level" | "kit" | "rest" | "playlist" | "data";

/**
 * You, and the setup that is yours rather than today's.
 *
 * It used to lay every setting out in full, 3,241px on a real history, with
 * Rest three screens down and the whole week printed lift by lift a second
 * time. Now the name and the reason stay as they were, because they are who
 * she is, and everything under them is a row with its value showing. A row
 * opens the same controls and the same explanation it always had, one at a
 * time, so nothing about what a setting does is lost, only where it waits.
 */
export default function Profile({
  profile,
  state,
  today,
  onProfile,
  onWeighIn,
  onImport,
  onEditPlan,
  onEditWeek,
  initialOpen = null,
}: {
  profile: ProfileT;
  state: AppState;
  today: string;
  onProfile: (p: ProfileT) => void;
  onWeighIn: (lb: number) => void;
  onImport: (s: AppState) => void;
  onEditPlan: (day?: number) => void;
  onEditWeek: () => void;
  /** Which row starts open. Only /frames uses it, to show one open. */
  initialOpen?: ProfileRowId | null;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [editingWhy, setEditingWhy] = useState(false);
  const [why, setWhy] = useState(profile.motivation ?? "");
  const [openRow, setOpenRow] = useState<ProfileRowId | null>(initialOpen);
  const toggle = (id: ProfileRowId) => setOpenRow((o) => (o === id ? null : id));

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
  const saved = state.workouts ?? [];

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-cyan">Profile</p>

      {/* Name: the one identifying thing, editable in place. */}
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

      {/* Why: quoted back on the hard days; her words, never rewritten. */}
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
            {profile.motivation ? `“${profile.motivation}”` : "Not said yet"}
          </p>
        )}
      </section>

      <RowGroup title="You">
        <ExpandRow
          label="Body weight"
          value={weighInLine(state.weighIns ?? []) ?? "Add"}
          open={openRow === "weight"}
          onToggle={() => toggle("weight")}
        >
          <BodyWeight bare weighIns={state.weighIns ?? []} today={today} onSave={onWeighIn} />
        </ExpandRow>
      </RowGroup>

      {/*
        The week, one row a day. Each goes straight to that day in the editor,
        which is where its lifts are, so they are not printed here a second
        time. A trained day with no routine yet is possible (the schedule is
        saved before the plan is built on first run), which is why there is a
        "Set up your week" row rather than an empty group.
      */}
      <RowGroup title="Your plan">
        {routines.length === 0 ? (
          <LinkRow label="Set up your week" onClick={onEditWeek} />
        ) : (
          routines.map((r) => (
            <LinkRow
              key={`${r.day}-${r.label}`}
              label={SHORT_DAYS[r.day]}
              value={dayLine(r)}
              onClick={() => onEditPlan(r.day)}
            />
          ))
        )}
        {saved.length > 0 && (
          <ExpandRow
            label="Saved workouts"
            value={String(saved.length)}
            open={openRow === "saved"}
            onToggle={() => toggle("saved")}
          >
            <div className="flex flex-col gap-2.5">
              {saved.map((w) => {
                const on = routines.filter((r) => r.label === w.name).map((r) => SHORT_DAYS[r.day]);
                return (
                  <Card key={w.id} className="bg-raise/40 p-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="head text-emphasis text-fg">{w.name}</h3>
                      <span className="label shrink-0 text-dim">{count(w.exercises.length, "lift")}</span>
                    </div>
                    <p className="mt-1.5 text-body leading-snug text-dim">
                      {w.exercises.map((e) => nameOf(e.exerciseId)).join(", ")}
                    </p>
                    {on.length > 0 && <p className="mt-1.5 text-body text-cyan">On {on.join(", ")}</p>}
                  </Card>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onEditPlan()}
              className="head tap mt-3 text-body text-cyan transition-opacity hover:opacity-70"
            >
              Put one on a day
            </button>
          </ExpandRow>
        )}
        {routines.length > 0 && (
          <LinkRow
            label="Schedule"
            value={scheduleLine(profile.trainingDays, profile.anchors)}
            onClick={onEditWeek}
          />
        )}
      </RowGroup>

      {/*
        Experience and equipment were set for her at signup and then frozen:
        onboarding never asks, and this screen drew them as text. Changing
        either changes what the app chooses next, never the week she has,
        because a setting that quietly rebuilds her days is the plan changing
        itself, which this app does not do.
      */}
      <RowGroup title="In the gym">
        <ExpandRow
          label="Experience"
          value={levelLabel(profile.level)}
          open={openRow === "level"}
          onToggle={() => toggle("level")}
        >
          <div className="flex flex-col gap-2">
            {LEVELS.map(({ id, label, hint }) => {
              const on = profile.level === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onProfile({ ...profile, level: id })}
                  className={`rounded-xl border p-3.5 text-left transition-colors duration-quick ${
                    on ? "border-cyan bg-raise" : "border-transparent bg-raise/40 hover:bg-raise/70"
                  }`}
                >
                  <span className="head block text-emphasis text-fg">{label}</span>
                  <span className="block text-body text-dim">{hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body text-dim">
            Your weights come from what you have actually lifted, so changing this moves the
            shape of a new day rather than the numbers on it.
          </p>
        </ExpandRow>

        <ExpandRow
          label="Equipment"
          value={equipmentLine(kit)}
          open={openRow === "kit"}
          onToggle={() => toggle("kit")}
        >
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_LABELS.map(({ id, label }) => {
              const on = kit.includes(id);
              /*
                The last one cannot be turned off. An empty gym leaves the
                generator nothing to pick from, and a screen that lets you
                arrive at a plan it cannot build is a screen that breaks later
                and somewhere else.
              */
              const last = on && kit.length === 1;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  disabled={last}
                  onClick={() =>
                    onProfile({
                      ...profile,
                      equipment: on ? kit.filter((k) => k !== id) : [...kit, id],
                    })
                  }
                  className={`head h-11 rounded-full border px-4 text-body transition-colors duration-quick disabled:opacity-60 ${
                    on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body text-dim">
            What the gym you actually go to has. New lifts and swaps come from this; the days
            you have already built keep whatever is on them.
          </p>
        </ExpandRow>

        {/*
          A switch, not a pick between two. The question was never which way
          she enters a weight; it is whether plates are offered at all. Off,
          barbell sets show + and minus and nothing else. On, the switch sits
          above the set as it always has. Turning it on starts her on plates,
          since she has just asked for them.
        */}
        <SwitchRow
          label="Load the bar on barbell lifts"
          hint="Tap plates onto the bar instead of typing the total."
          on={offersPlates(profile) === true}
          onChange={(on) =>
            onProfile(on ? { ...profile, loadTheBar: true, weightInput: "plates" } : { ...profile, loadTheBar: false })
          }
        />

        <ExpandRow
          label="Rest between sets"
          value={`${restSeconds(profile)} sec`}
          open={openRow === "rest"}
          onToggle={() => toggle("rest")}
        >
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
            The same on every lift. Take longer when you need it; nothing here counts it against you.
          </p>
        </ExpandRow>
      </RowGroup>

      <RowGroup title="App">
        <ExpandRow
          label="Gym playlist"
          value={profile.playlistId ? (profile.playlistName ?? "Your gym playlist") : "Not set"}
          open={openRow === "playlist"}
          onToggle={() => toggle("playlist")}
        >
          <PlaylistRow bare profile={profile} onProfile={onProfile} onDone={() => setOpenRow(null)} />
        </ExpandRow>
        <ExpandRow
          label="Your data"
          value="Export, import"
          open={openRow === "data"}
          onToggle={() => toggle("data")}
        >
          <YourData bare state={state} onImport={onImport} />
        </ExpandRow>
      </RowGroup>
    </main>
  );
}
