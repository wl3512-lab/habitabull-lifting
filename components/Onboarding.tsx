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
 * Every one of these is intrinsic — a reason that is its own payoff. That is
 * the whole point of the question, not a copywriting preference: the sobriety
 * research (deck p9) found that self-determined reasons hold people and
 * imposed ones don't, so the suggestions must not quietly teach the extrinsic
 * frame. No "lose 10 lb", no "look good for summer", no "get my ex back".
 * Anyone who wants those can still type them; the app just won't propose them.
 */
const REASONS = [
  "I want to feel strong.",
  "I want more energy in the day.",
  "It clears my head.",
  "I like how it feels afterwards.",
  "I want to keep up with my friends.",
];

const STEPS = 3;

/** 1110 → "6:30 pm" */
function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Onboarding, rebuilt from the deck's own research rather than from what an
 * app setup flow usually asks.
 *
 * What it does NOT ask is as considered as what it does. No goal — her lo-fi
 * testing found goal-first tested badly, and goals are offered after the first
 * session instead. No weights, no body stats, no photo, no account. p22's top
 * findings are "clustered and complex interfaces" and "too many features
 * unrelated to personal needs"; an onboarding that harvests everything up front
 * is that failure at the front door.
 *
 * What it does ask, in order:
 *   1. Why they train — the sobriety-app finding (p9). Intrinsic motivation,
 *      in their words, quoted back on the days they don't feel like it.
 *   2. Which days and at what time — habit principle 2 (p12). Days alone are a
 *      preference; a day and an hour is an implementation intention.
 *   3. Where they're starting — so the first session is not "unrealistic", the
 *      exact phrase behind p22's "Programs are unrealistic and won't have
 *      motivation to do them".
 *
 * Every step is skippable and every one has a working default, because the
 * fastest way to lose someone here is to make setup feel like a form.
 */
export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [motivation, setMotivation] = useState("");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [minute, setMinute] = useState(18 * 60 + 30);
  const [level, setLevel] = useState<Level>("returning");
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
      trainingDays: days.length ? days : [1, 3, 5],
      equipment: equipment.length ? equipment : ["bodyweight"],
      motivation: motivation.trim() || undefined,
      trainingMinute: minute,
      createdAt: new Date().toISOString(),
    });

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const next = () => (step >= STEPS ? finish() : setStep(step + 1));

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
              className="tap mt-3 block w-full text-center text-[13px] text-ground/75 transition-opacity hover:opacity-100"
            >
              Three quick questions. You can skip any of them.
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-cyan">
          Set up · step {step} of {STEPS}
        </p>
        <button
          type="button"
          onClick={next}
          className="head tap shrink-0 text-[15px] text-dim transition-colors hover:text-fg"
        >
          Skip
        </button>
      </div>
      {/* Where you are, without a progress bar pretending this is long. */}
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? "bg-cyan" : "bg-raise"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div key="1" className="rise flex flex-1 flex-col">
          <h1 className="statement mt-5 text-[44px] text-fg">Why do you lift?</h1>
          <p className="mt-1.5 text-[17px] text-dim">
            Your answer, in your words. We show it back to you on the days you don&apos;t feel
            like it — and we never rewrite it.
          </p>

          <label htmlFor="why" className="label mt-7 block text-dim">
            I workout because…
          </label>
          <textarea
            id="why"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={3}
            maxLength={160}
            placeholder="I want to be strong and feel good."
            className="mt-2 w-full resize-none rounded-2xl bg-card p-[18px] text-[19px] leading-snug text-fg placeholder:text-dim/70 focus:outline-none focus:ring-2 focus:ring-cyan"
          />

          <p className="mt-4 text-[15px] text-dim">Or start from one of these:</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setMotivation(r)}
                className={`head rounded-full border px-4 py-2.5 text-left text-[15px] transition-colors duration-150 ${
                  motivation === r
                    ? "border-cyan bg-cyan text-ground"
                    : "border-line-strong text-dim hover:border-fg"
                }`}
              >
                {r.replace(/\.$/, "")}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-10">
            <Pill onClick={next}>Next</Pill>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="2" className="rise flex flex-1 flex-col">
          <h1 className="statement mt-5 text-[44px] text-fg">When will you train?</h1>
          <p className="mt-1.5 text-[17px] text-dim">
            Pick honestly. Three real days beat six imagined ones.
          </p>

          <div className="mt-7 rounded-2xl bg-card p-[18px]">
            <p className="label text-dim">Which days?</p>
            {/*
              Seven targets across 342px is a real constraint, not a rounding
              error: 7 × 44 plus the recommended 8px gaps needs 356px and there
              are 342. So height is pinned at 44 and width takes what the row
              allows (~43), pulled out past the card padding to buy back the
              last few pixels. `rounded-full` on a 43 × 44 box still reads as a
              circle, and nothing here drops under the 24px WCAG 2.2 floor.
            */}
            <div className="mt-3 -mx-2 flex gap-1">
              {SHORT_DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(toggle(days, i))}
                  aria-pressed={days.includes(i)}
                  aria-label={d}
                  className={`head grid h-11 min-w-0 flex-1 place-items-center rounded-full border-2 text-[17px] transition-colors duration-150 ${
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

          {/* Principle 2. Without an hour this is a preference, not a plan. */}
          <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <label htmlFor="when" className="label block text-dim">
              Around what time?
            </label>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[17px] text-dim">Around</span>
              <input
                id="when"
                type="time"
                value={`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (!Number.isNaN(h) && !Number.isNaN(m)) setMinute(h * 60 + m);
                }}
                className="statement flex-1 rounded-xl bg-raise px-4 py-2 text-[26px] text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
              />
            </div>
            <p className="mt-3 text-[15px] text-dim">
              A day and an hour is a plan. A day on its own is a wish.
            </p>
          </div>

          <div className="mt-auto pt-10">
            <Pill onClick={next} disabled={days.length === 0}>
              Next
            </Pill>
            {days.length === 0 && (
              <p className="mt-2 text-center text-[15px] text-dim">Pick at least one day.</p>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div key="3" className="rise flex flex-1 flex-col">
          <h1 className="statement mt-5 text-[44px] text-fg">Where are you starting?</h1>
          <p className="mt-1.5 text-[17px] text-dim">
            This sets your first session so it isn&apos;t harder than it should be. You can be
            wrong — it corrects itself.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                aria-pressed={level === l.value}
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
              {days.length} {days.length === 1 ? "day" : "days"} a week, around{" "}
              {clockLabel(minute)}. Weights and goals come after your first session.
            </p>
            <Pill onClick={finish}>Start my first workout</Pill>
          </div>
        </div>
      )}
    </main>
  );
}
