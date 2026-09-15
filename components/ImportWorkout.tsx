"use client";

import { useState } from "react";
import { Card, Pill } from "./ui";
import { allExercises, makeCustomExercise, nameOf } from "@/lib/exercises";
import { matchExercise, toRoutines, type ParsedDay } from "@/lib/import";
import { SHORT_DAYS } from "@/lib/engine";
import type { Equipment, Exercise, Muscle, Profile, Routine } from "@/lib/types";

/**
 * Paste a workout you already have; get it back as routines. The model reads
 * the text into a loose shape (via /api/generate, with a local parser behind
 * it), and everything is validated against the real library here. A lift the
 * library doesn't have is created as a custom one — its muscle and equipment
 * guessed by the same classify call the routine editor uses — so nothing you
 * pasted is silently lost. Weights are never taken from the text; the engine
 * sets the starting load, and you confirm the whole thing before it saves.
 */
export default function ImportWorkout({
  profile,
  onDone,
  onCancel,
}: {
  profile: Profile;
  onDone: (routines: Routine[], customs: Exercise[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"input" | "working" | "preview">("input");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [customs, setCustoms] = useState<Exercise[]>([]);

  async function read() {
    if (!text.trim()) return;
    setPhase("working");

    let days: ParsedDay[] = [];
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "import", text }),
      });
      const data = await res.json();
      days = Array.isArray(data?.days) ? (data.days as ParsedDay[]) : [];
    } catch {
      days = [];
    }

    // Names the library doesn't know become custom lifts, muscle + equipment
    // inferred. Done once per unique name, before the routines are assembled.
    const pool = allExercises();
    const names = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.name)))];
    const idFor: Record<string, string> = {};
    const made: Exercise[] = [];
    for (const name of names) {
      if (matchExercise(name, pool)) continue;
      let muscle: Muscle = "arms";
      let equipment: Equipment = profile.equipment[0] ?? "dumbbell";
      let compound = false;
      try {
        const r = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: "classify", text: name }),
        });
        const o = (await r.json()) as { muscle?: Muscle; equipment?: Equipment; compound?: boolean };
        if (o.muscle) muscle = o.muscle;
        if (o.equipment) equipment = o.equipment;
        compound = o.compound === true;
      } catch {
        // fall back to the sensible defaults above
      }
      const ex = makeCustomExercise(name, muscle, equipment, compound);
      idFor[name] = ex.id;
      made.push(ex);
    }

    const { routines: built } = toRoutines(days, profile.level, (n) => idFor[n] ?? null);
    setRoutines(built);
    setCustoms(made);
    setPhase("preview");
  }

  if (phase === "working") {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="statement text-title text-fg">Reading your workout…</p>
        <p className="mt-2 text-body text-dim">Matching each lift to the library.</p>
      </main>
    );
  }

  if (phase === "preview") {
    const nameById = (id: string) => customs.find((c) => c.id === id)?.name ?? nameOf(id);
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <h1 className="statement text-figure text-fg">Here&apos;s what we read</h1>
        {routines.length === 0 ? (
          <>
            <p className="mt-2 text-emphasis text-dim">
              Couldn&apos;t make a plan out of that. Try one lift per line, like
              &ldquo;Bench 3x8&rdquo;.
            </p>
            <div className="mt-auto flex gap-2.5 pt-10">
              <Pill onClick={() => setPhase("input")}>Try again</Pill>
              <Pill variant="ghost" onClick={onCancel}>Cancel</Pill>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-emphasis text-dim">
              Check it over. Weights start from your level and you can change anything later.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {routines.map((r) => (
                <Card key={`${r.day}-${r.label}`} className="p-[18px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="head text-emphasis text-fg">{r.label}</h2>
                    <span className="label shrink-0 text-dim">{SHORT_DAYS[r.day]}</span>
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {r.exercises.map((e) => (
                      <li key={e.exerciseId} className="flex items-baseline justify-between gap-3 text-body">
                        <span className="text-fg">{nameById(e.exerciseId)}</span>
                        <span className="tabular shrink-0 text-dim">
                          {e.sets} × {e.reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            {customs.length > 0 && (
              <p className="mt-4 text-body text-dim">
                Added {customs.length} lift{customs.length === 1 ? "" : "s"} the app didn&apos;t have:{" "}
                {customs.map((c) => c.name).join(", ")}.
              </p>
            )}
            <div className="mt-auto flex gap-2.5 pt-10">
              <Pill onClick={() => onDone(routines, customs)}>Use this plan</Pill>
              <Pill variant="ghost" onClick={() => setPhase("input")}>Back</Pill>
            </div>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-cyan">Import</p>
        <button
          type="button"
          onClick={onCancel}
          className="head tap shrink-0 text-body text-dim transition-colors hover:text-fg"
        >
          Cancel
        </button>
      </div>
      <h1 id="import-heading" className="statement mt-5 text-figure text-fg">
        Paste a workout you have
      </h1>
      <p id="import-hint" className="mt-1.5 text-emphasis text-dim">
        From your notes, a coach, anywhere. We turn it into your week.
      </p>
      {/*
        Named by the heading rather than by its own label, because the heading
        already says exactly what the field is for and a second copy of that
        sentence would only be there for the screen reader.

        It had no name at all before. The placeholder was doing the work, and
        a placeholder stops existing the moment somebody types into it, so the
        field was unnamed for everyone using one and unnamed the whole time
        for anyone who could not see it.
      */}
      <textarea
        aria-labelledby="import-heading"
        aria-describedby="import-hint"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        placeholder={"Mon: Bench 3x8, Incline DB press 3x10, Cable fly 3x12\nWed: Squat 5x5, RDL 3x8, Leg press 3x12\nFri: Deadlift 3x5, Row 4x8, Curl 3x12"}
        className="mt-6 w-full flex-1 resize-none rounded-2xl bg-card p-[18px] text-emphasis leading-snug text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
      />
      <div className="mt-auto pt-6">
        <Pill onClick={read} disabled={!text.trim()}>Read it</Pill>
        <p className="mt-2.5 text-center text-caption text-dim">
          Photo import is coming. For now, paste the text.
        </p>
      </div>
    </main>
  );
}
