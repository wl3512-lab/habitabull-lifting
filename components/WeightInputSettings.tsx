"use client";

import { useState } from "react";
import PlateBar from "./PlateBar";
import Stepper from "./Stepper";
import { DEFAULT_BAR_LB } from "@/lib/plates";
import type { Profile } from "@/lib/types";

/** The preference and a working example of what each choice does. */
export default function WeightInputSettings({ profile, onProfile }: {
  profile: Profile;
  onProfile: (profile: Profile) => void;
}) {
  const mode = profile.weightInput ?? "steppers";
  const [expanded, setExpanded] = useState(false);
  const [weight, setWeight] = useState(95);
  const [bar, setBar] = useState(profile.barLb ?? DEFAULT_BAR_LB);
  return (
    <section className="mt-8">
      <p className="label text-dim">Setting a weight</p>
      <div className="mt-3 rounded-2xl bg-card p-[18px]">
        <div className="grid grid-cols-2 gap-2">
          {(["steppers", "plates"] as const).map(id => {
            const selected = id === mode;
            return (
              <button key={id} type="button" aria-pressed={selected}
                onClick={() => { onProfile({ ...profile, weightInput: id }); setExpanded(true); }}
                className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-cyan bg-cyan/10 text-cyan" : "border-line-strong text-dim hover:text-fg"}`}>
                {id === "steppers" ? (
                  <div aria-hidden className="flex h-14 items-center justify-between gap-2 tabular">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-current text-head">−</span>
                    <span className="statement text-head">95</span>
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-current text-head">+</span>
                  </div>
                ) : (
                  <svg aria-hidden viewBox="0 0 140 56" className="h-14 w-full">
                    <path d="M9 28H131" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                    <rect x="27" y="6" width="10" height="44" rx="3" fill="currentColor" />
                    <rect x="16" y="14" width="7" height="28" rx="2" fill="currentColor" opacity=".5" />
                    <rect x="103" y="6" width="10" height="44" rx="3" fill="currentColor" />
                    <rect x="117" y="14" width="7" height="28" rx="2" fill="currentColor" opacity=".5" />
                  </svg>
                )}
                <span className="head mt-1 block text-body">{id === "steppers" ? "Use + / −" : "Load the bar"}</span>
                <span className="mt-1 block text-caption">{id === "steppers" ? "Enter the total weight" : "Add plates to each side"}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-body leading-snug text-dim">
          {mode === "plates"
            ? "Barbell exercises show a bar and plates. Reps still use + / −. Dumbbells and machines use the weight number."
            : "Tap + or − to adjust the weight, or tap the number to type it."}
        </p>
        <button type="button" aria-expanded={expanded} aria-controls="weight-example"
          onClick={() => setExpanded(!expanded)} className="head mt-2 min-h-11 text-body text-cyan">
          {expanded ? "Hide example" : "See how it works"}
        </button>
        {expanded && (
          <div id="weight-example" className="mt-2 border-t border-line-strong pt-4">
            <p className="label mb-3 text-dim">Practice here</p>
            {mode === "plates" ? (
              <>
                <PlateBar weight={weight} bar={bar} onWeight={setWeight} onBar={setBar} />
                <p className="mt-3 text-body leading-snug text-dim">Each tap adds a matching plate to both sides. A 45 lb bar + 25 lb on each side = 95 lb total.</p>
              </>
            ) : <Stepper label="Example weight" value={weight} step={5} suffix="lb" onChange={setWeight} />}
            <p className="mt-3 text-caption text-dim">These are example weights. Your choice above is saved for workouts.</p>
          </div>
        )}
      </div>
    </section>
  );
}
