"use client";

import { useState } from "react";
import Image from "next/image";
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
export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [motivation, setMotivation] = useState("");

  const finish = () =>
    onDone({
      name: name.trim(),
      level: "new",
      trainingDays: placeDays(3),
      equipment: ["barbell", "dumbbell", "machine", "bodyweight"] as Equipment[],
      motivation: motivation.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

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
