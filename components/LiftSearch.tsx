"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "./ui";
import { alternativesFor } from "@/lib/engine";
import { byId, makeCustomExercise, nameOf, searchLifts } from "@/lib/exercises";
import type { Equipment, Exercise, Muscle } from "@/lib/types";

/*
  Finding one lift to add, the same way everywhere a lift gets added.

  The week editor and the workout screen each had their own picker, and both
  opened on a muscle: nine chips, then a list for the one she tapped. That
  files the library the way the app thinks of it. Somebody standing at a
  machine is thinking "leg curl", not "hamstrings". So this is one field over
  the whole library by name, with a short list under it before anything is
  typed, and one tap to add. Asking the model and adding a lift of her own
  only come up when a search finds nothing, using the words she already typed.
*/

/* Said in rows and in the one line under each name. Typed so a new kind cannot go unnamed. */
const MUSCLE_NAME: Record<Muscle, string> = {
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
};
const KIT: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
};

/**
 * What to offer before she types: a few lifts for each muscle, starred ones
 * first, each lift once.
 *
 * Cardio is filed by muscle too (a treadmill is a quads lift, a stairmaster a
 * glutes one), so without the filter a leg day's suggestions could open on a
 * machine you walk on. Cardio comes from search, or from a cardio day's own list.
 */
export function strengthPicks(
  muscles: Muscle[],
  equipment: Equipment[],
  exclude: string[],
  favourites: string[],
  perMuscle: number,
  max = 6
): Exercise[] {
  const out = new Map<string, Exercise>();
  for (const m of new Set(muscles)) {
    for (const e of alternativesFor(m, equipment, exclude, favourites)
      .filter((e) => !e.cardio)
      .slice(0, perMuscle)) {
      out.set(e.id, e);
    }
  }
  return [...out.values()].slice(0, max);
}

/**
 * A lift the library has never heard of, filed by the model when it can be
 * reached and by the fallback when it cannot.
 *
 * The model reads the name and says which muscle it trains and what it is done
 * with: two enums this app already understands, checked on the server. It
 * writes no coaching. Offline, or past four seconds, the fallback stands, so
 * the lift is still added. Four, because this can happen mid-session with a
 * bar loaded, and an answer that takes longer is not worth waiting for.
 */
export async function fileLift(
  name: string,
  fallback: { muscle: Muscle; equipment: Equipment }
): Promise<Exercise> {
  let { muscle, equipment } = fallback;
  let compound = false;
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "classify", text: name }),
      signal: AbortSignal.timeout(4000),
    });
    const out = (await res.json()) as { muscle?: Muscle; equipment?: Equipment; compound?: boolean };
    if (out.muscle) muscle = out.muscle;
    if (out.equipment) equipment = out.equipment;
    compound = out.compound === true;
  } catch {
    // Offline or slow. Her lift is still added, filed by the fallback.
  }
  return makeCustomExercise(name, muscle, equipment, compound);
}

export default function LiftSearch({
  equipment,
  exclude,
  picks,
  picksLabel,
  emptyNote,
  askMuscles,
  onPick,
  onAddOwn,
  autoFocus = false,
  className = "",
}: {
  equipment: Equipment[];
  /** Lifts already in the day or session. Never offered again, so nothing goes on twice. */
  exclude: string[];
  /** What shows before she types. */
  picks: Exercise[];
  picksLabel: string;
  /** Said instead of the list when every pick is already in. */
  emptyNote: string;
  /** The muscles "Ask for one" chooses among. Without them there is no Ask. */
  askMuscles?: Muscle[];
  onPick: (id: string) => void;
  /** Adds a lift by the name she typed. Without it there is no "add your own". */
  onAddOwn?: (name: string) => Promise<void> | void;
  /**
   * Focus the field when the picker opens from a tap, so a keyboard or screen
   * reader stays in it. Not on a frame that opens already showing it, where it
   * would scroll the gallery.
   */
  autoFocus?: boolean;
  className?: string;
}) {
  const [hunt, setHunt] = useState("");
  const [asking, setAsking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggested, setSuggested] = useState<{ id: string; why: string } | null>(null);
  /*
    Ask used to fail by going quiet, which was survivable while the list sat
    beside it. Here it is the only thing on screen, so it says so.
  */
  const [noSignal, setNoSignal] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) field.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const typed = hunt.trim();
  const searching = typed.length >= 2;
  const found = searching ? searchLifts(hunt, equipment, exclude) : [];
  const rows = searching ? found : picks;

  /**
   * The model only ever picks from the lifts these muscles have, and the
   * server checks its answer against that list before it comes back, so the
   * worst case is the app suggesting what it would have suggested anyway. It
   * never proposes a weight or a rep count.
   */
  async function ask() {
    if (!askMuscles?.length || asking || !typed) return;
    setAsking(true);
    setSuggested(null);
    setNoSignal(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "pick", text: typed, muscles: askMuscles, equipment, exclude }),
      });
      const out = (await res.json()) as { id?: string; why?: string };
      if (out.id) setSuggested({ id: out.id, why: out.why ?? "" });
    } catch {
      setNoSignal(true);
    }
    setAsking(false);
  }

  async function addOwn() {
    if (!onAddOwn || adding || !typed) return;
    setAdding(true);
    try {
      await onAddOwn(typed);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={field}
        value={hunt}
        onChange={(e) => {
          setHunt(e.target.value);
          setSuggested(null);
          setNoSignal(false);
        }}
        placeholder="Search every lift"
        aria-label="Search every lift by name"
        className="h-12 w-full rounded-full bg-raise px-[18px] text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
      />

      {searching && found.length === 0 ? (
        <div className="mt-4" aria-live="polite">
          <p className="text-body leading-snug text-dim">
            Nothing called &ldquo;{typed}&rdquo; in your kit.
          </p>
          {(askMuscles?.length || onAddOwn) && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {askMuscles?.length ? (
                <Pill size="sm" variant="ghost" onClick={() => void ask()} disabled={asking}>
                  {asking ? "Asking…" : "Ask for one"}
                </Pill>
              ) : null}
              {onAddOwn && (
                <Pill
                  size="sm"
                  variant="ghost"
                  className="max-w-full truncate"
                  onClick={() => void addOwn()}
                  disabled={adding}
                >
                  {adding ? "Adding…" : <>Add &ldquo;{typed}&rdquo; as your own</>}
                </Pill>
              )}
            </div>
          )}
          {onAddOwn && (
            <p className="mt-2 text-body leading-snug text-dim">
              A lift you add gets filed for you, but has no form guidance. That part
              only exists where a person wrote it.
            </p>
          )}
          {noSignal && (
            <p role="status" className="mt-3 text-body leading-snug text-dim">
              No signal, so nothing can answer that right now.
              {onAddOwn ? " Adding it as your own still works." : ""}
            </p>
          )}
          {suggested && byId(suggested.id) && (
            <div role="status" className="mt-3 rounded-xl bg-raise/50 p-3.5">
              <p className="head text-emphasis text-fg">{nameOf(suggested.id)}</p>
              {suggested.why && (
                <p className="mt-1 text-body leading-snug text-dim">{suggested.why}</p>
              )}
              <button
                type="button"
                onClick={() => onPick(suggested.id)}
                className="head tap mt-2 text-body text-cyan transition-opacity hover:opacity-70"
              >
                Add it
              </button>
            </div>
          )}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-body leading-snug text-dim">{emptyNote}</p>
      ) : (
        <>
          <p className="label mt-5 text-dim">{searching ? "In your kit" : picksLabel}</p>
          <ul className="mt-1.5">
            {rows.map((a) => (
              <li key={a.id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => onPick(a.id)}
                  aria-label={`Add ${a.name}`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-2.5 text-left transition-opacity hover:opacity-80 focus-visible:-outline-offset-2!"
                >
                  <span className="min-w-0">
                    <span className="head block truncate text-emphasis text-fg">{a.name}</span>
                    <span className="block truncate text-body text-dim">
                      {a.cardio ? "Cardio" : MUSCLE_NAME[a.primary]} · {KIT[a.equipment]}
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-head leading-none text-cyan">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
