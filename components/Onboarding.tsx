"use client";

import { useState } from "react";
import Bull, { BULL } from "./Bull";
import { Pill } from "./ui";
import { placeDays } from "@/lib/schedule";
import type { Equipment, Profile } from "@/lib/types";

/**
 * Every one of these is intrinsic — a reason that is its own payoff. That is
 * the whole point of the question, not a copywriting preference: the sobriety
 * research (deck p9) found that self-determined reasons hold people and imposed
 * ones don't, so the suggestions must not quietly teach the extrinsic frame.
 * No "lose 10 lb", no "look good for summer". Anyone who wants those can still
 * type them; the app just won't propose them.
 */
const REASONS = [
  "I want to feel strong.",
  "I want more energy in the day.",
  "It clears my head.",
  "I like how it feels afterwards.",
  "I want to keep up with my friends.",
];

/**
 * Two screens. A name and a reason, and then you lift.
 *
 * Everything else waits. Her own lo-fi testing found goal-first tested badly —
 * people want to log a workout before they will commit to anything — and the
 * same logic applies to a schedule. Asking a beginner which days they will
 * train, before they have trained once, asks for a commitment they have no
 * basis to make. ACSM's 2026 guidance is blunt that turning up twice a week
 * matters far more than the shape of the plan, so the app picks a safe starting
 * week and offers to set the real one after the first session.
 *
 * The defaults behind this screen are deliberate, not lazy: beginner level
 * (conservative weights are the safe direction to be wrong in), a standard gym,
 * and three non-consecutive days. All three correct themselves from what
 * actually gets logged.
 */
export default function Onboarding({
  onDone,
  initialStep = 0,
}: {
  onDone: (p: Profile) => void;
  /** The frame gallery opens straight onto the second screen. */
  initialStep?: number;
}) {
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState("");
  const [motivation, setMotivation] = useState("");

  const finish = () =>
    onDone({
      name: name.trim(),
      level: "new",
      // Starting today, so the first thing the app says is not "rest".
      trainingDays: placeDays(3, new Date().getDay()),
      equipment: ["barbell", "dumbbell", "machine", "bodyweight"] as Equipment[],
      motivation: motivation.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

  if (step === 0) {
    return (
      <div className="flex flex-1 flex-col bg-cyan text-ground">
        <main className="rise mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-10">
          {/*
            Through <Bull>, not a hand-rolled <Image>. Two screens carried the
            artwork's height themselves and both were wrong the moment the
            drawing changed shape — the component owns the ratio now.

            The Figma drew him at 206. The 2026 bull is a denser silhouette
            than the 2023 one, so 206 read as 53% of the screen and pushed the
            wordmark and the name field down it.
          */}
          <Bull size={BULL.hero} className="mt-2" />
          {/*
            `.statement`, not `.display`. The display face uppercases, and
            "HABITABULL" throws away the capital B in the middle of the name —
            the camel case is the identity, not a styling accident.

            "Lifting" is tucked under the wordmark rather than floating a line
            below it: tracked out to the wordmark's width, tight leading, so
            the two read as one lockup instead of two headings.
          */}
          <h1 className="mt-4 text-center text-ground">
            <span className="aside block text-[24px] leading-none opacity-80">Welcome to</span>
            <span className="statement mt-1.5 block text-[54px] leading-[0.92]">HabitaBull</span>
            <span className="head block text-[15px] uppercase tracking-[0.34em]">Lifting</span>
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
            className="statement mt-1 w-full border-b-2 border-ground/70 bg-transparent pb-2 text-[30px] text-ground placeholder:text-ground/75 focus:border-ground focus:outline-none"
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
              One quick question, then you lift.
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="rise mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-cyan">One question</p>
        <button
          type="button"
          onClick={finish}
          className="head tap shrink-0 text-[15px] text-dim transition-colors hover:text-fg"
        >
          Skip
        </button>
      </div>

      <h1 className="statement mt-5 text-[44px] text-fg">Why do you lift?</h1>
      <p className="mt-1.5 text-[17px] text-dim">
        Your answer, in your words. We show it back to you on the days you don&apos;t feel like
        it — and we never rewrite it.
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
        className="mt-2 w-full resize-none rounded-2xl bg-card p-[18px] text-[19px] leading-snug text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
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
        <p className="mb-3 text-[15px] text-dim">
          Days, times and weights all come after your first session — not before it.
        </p>
        <Pill onClick={finish}>Start my first workout</Pill>
      </div>
    </main>
  );
}
