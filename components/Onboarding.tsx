"use client";

import { useState } from "react";
import Image from "next/image";
import { Pill } from "./ui";
import { SHORT_DAYS } from "@/lib/engine";
import type { Equipment, Level, Profile } from "@/lib/types";

const LEVELS: { value: Level; label: string; sub: string }[] = [
  { value: "new", label: "New to this", sub: "Never trained, or close to it" },
  { value: "returning", label: "Coming back", sub: "Trained before, stopped for a while" },
  { value: "experienced", label: "Experienced", sub: "Been lifting consistently" },
];

const KIT: { value: Equipment; label: string }[] = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "machine", label: "Machines" },
  { value: "kettlebell", label: "Kettlebells" },
  { value: "bodyweight", label: "Just me" },
];

/**
 * Three screens, no goal-setting. The first prototype opened with goals and it
 * tested badly — people want to log a workout before they'll commit to one.
 * Goals get offered after the first session instead.
 *
 * The welcome keeps the 2023 cyan field, and it is the only screen that does.
 * Dark-on-cyan measures 8:1 and was already canonical in the app icons; the
 * original's white-on-cyan wordmark measured 2.23:1 and is the one thing from
 * the guide that could not be carried forward.
 */
export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("returning");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [equipment, setEquipment] = useState<Equipment[]>([
    "barbell",
    "dumbbell",
    "machine",
    "bodyweight",
  ]);

  const finish = () =>
    onDone({
      name: name.trim(),
      level,
      trainingDays: days,
      equipment,
      createdAt: new Date().toISOString(),
    });

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  if (step === 0) {
    return (
      <div className="flex flex-1 flex-col bg-cyan text-ground">
        <main className="rise mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-10">
          {/* 206 × 250 in the Figma. He is the screen, not an ornament on it. */}
          <Image
            src="/mascot.png"
            alt=""
            width={206}
            height={250}
            priority
            className="mx-auto w-[206px] max-w-full"
          />
          <h1 className="mt-3 text-center text-ground">
            <span className="aside block text-[28px]">Welcome to</span>
            <span className="statement block text-[58px]">HabitaBull!</span>
          </h1>

          <label htmlFor="name" className="head mt-9 block text-[17px] text-ground">
            What&apos;s your name?
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="given-name"
            className="statement mt-1 w-full border-b-2 border-ground/70 bg-transparent pb-2 text-[30px] text-ground placeholder:text-ground/40 focus:border-ground focus:outline-none"
          />

          <div className="mt-auto pt-10">
            <Pill variant="onCyan" onClick={() => setStep(1)}>
              Continue
            </Pill>
            <button
              type="button"
              onClick={finish}
              className="mt-2.5 block w-full text-center text-[13px] text-ground/75 transition-opacity hover:opacity-100"
            >
              {/* The Figma says five; the flow is two. Ship the true number. */}
              Two quick questions. You can skip any of them.
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      {step === 1 && (
        <div key="1" className="rise flex flex-1 flex-col">
          <p className="label text-cyan">Set up · step 1 of 2</p>
          <h1 className="statement mt-2 text-[44px] text-fg">Where are you starting?</h1>
          <p className="mt-1.5 text-[17px] text-dim">
            This sets your first weights. You can be wrong — it corrects itself.
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                aria-pressed={level === l.value}
                // Same selected vocabulary as the day circles and kit chips —
                // cyan border, raised ground. One way to say "chosen" per app.
                className={`rounded-2xl border-2 p-[18px] text-left transition-colors duration-150 ${
                  level === l.value
                    ? "border-cyan bg-raise"
                    : "border-transparent bg-card hover:bg-raise/60"
                }`}
              >
                <div className="head text-[19px] text-fg">{l.label}</div>
                <div className="mt-0.5 text-[15px] text-dim">{l.sub}</div>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-10">
            <Pill onClick={() => setStep(2)}>Next</Pill>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="2" className="rise flex flex-1 flex-col">
          <p className="label text-cyan">Set up · step 2 of 2</p>
          <h1 className="statement mt-2 text-[44px] text-fg">Which days, and with what?</h1>
          <p className="mt-1.5 text-[17px] text-dim">
            Pick honestly. Three real days beat six imagined ones.
          </p>

          <div className="mt-7 rounded-2xl bg-card p-[18px]">
            <p className="label text-dim">Which days?</p>
            {/* flex-1 + aspect-square rather than a fixed size: seven fixed
                circles overflow the card on a 390px screen. */}
            <div className="mt-3 flex gap-1.5">
              {SHORT_DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(toggle(days, i))}
                  aria-pressed={days.includes(i)}
                  aria-label={d}
                  className={`head grid aspect-square min-w-0 flex-1 place-items-center rounded-full border-2 text-[17px] transition-colors duration-150 ${
                    days.includes(i)
                      ? "border-cyan bg-cyan text-ground"
                      : "border-line-strong text-dim hover:border-fg"
                  }`}
                >
                  {d[0]}
                </button>
              ))}
            </div>
            <p className="mt-3.5 text-[15px] text-dim">
              Three days is the number beginners actually keep.
            </p>
          </div>

          <p className="label mt-7 text-dim">What you can get to</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {KIT.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setEquipment(toggle(equipment, k.value))}
                aria-pressed={equipment.includes(k.value)}
                className={`head h-11 rounded-full border px-5 text-[15px] transition-colors duration-150 ${
                  equipment.includes(k.value)
                    ? "border-cyan bg-cyan text-ground"
                    : "border-line-strong text-dim hover:border-fg"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-10">
            <p className="mb-3 text-[15px] text-dim">
              Weights and goals come after your first session — not before it.
            </p>
            <Pill onClick={finish} disabled={days.length === 0}>
              Start my first workout
            </Pill>
            {days.length === 0 && (
              <p className="mt-2 text-center text-[15px] text-dim">Pick at least one day.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
