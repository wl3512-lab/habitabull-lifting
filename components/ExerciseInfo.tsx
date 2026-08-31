"use client";

import { useState } from "react";
import Image from "next/image";
import { Pill } from "./ui";
import { byId } from "@/lib/exercises";
import type { Profile, Session } from "@/lib/types";

/**
 * The bull coach moment — the deck's "Workout tutorial" screen, which answered
 * the most repeated interview complaint: inadequate instructions for new users.
 *
 * This is the one screen where the mascot does literal work. He is not next to
 * the advice, he is saying it: the cue sits in a bubble he speaks from, in
 * Condensed Medium rather than a heading weight, because a training partner
 * saying "knees caving in?" is a different thing from a label reading FORM.
 * Cutting him here would turn coaching back into documentation.
 */
export default function ExerciseInfo({
  exerciseId,
  profile,
  onProfile,
  onBack,
}: {
  exerciseId: string;
  profile: Profile;
  onProfile: (p: Profile) => void;
  /** Accepted so the caller stays uniform; the coach screen shows no history —
      the Figma keeps personal bests on the logging screen where they're used. */
  sessions?: Session[];
  onBack: () => void;
}) {
  const [demoAsked, setDemoAsked] = useState(false);
  const ex = byId(exerciseId);
  const starred = (profile.favourites ?? []).includes(exerciseId);

  if (!ex) {
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
        <p className="text-[17px] text-dim">That exercise is not in the library.</p>
        <div className="mt-auto pt-10">
          <Pill onClick={onBack}>Back</Pill>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Form cue</p>
        <div className="-mt-0.5 flex shrink-0 items-center gap-1">
          {/*
            Starring a lift is a preference, not a rule. It wins a coin toss
            between two exercises that would both do the job, and never
            overrides the balance of a day.
          */}
          <button
            type="button"
            onClick={() => {
              const now = profile.favourites ?? [];
              onProfile({
                ...profile,
                favourites: starred ? now.filter((x) => x !== exerciseId) : [...now, exerciseId],
              });
            }}
            aria-pressed={starred}
            aria-label={starred ? `Unstar ${ex.name}` : `Star ${ex.name}`}
            className={`grid h-11 w-11 place-items-center rounded-full text-[19px] transition-colors ${
              starred ? "text-cyan" : "text-dim hover:text-fg"
            }`}
          >
            {starred ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
          >
            Back
          </button>
        </div>
      </div>

      <h1 className="statement mt-2 text-[42px] text-fg">{ex.name}</h1>

      {/* He says it. The bubble is his, not the screen's. */}
      <div className="mt-5 flex items-end gap-2">
        <Image
          src="/mascot.png"
          alt=""
          width={96}
          height={116}
          priority
          className="w-[96px] shrink-0"
        />
        <div className="relative flex-1 rounded-2xl rounded-bl-sm bg-cyan px-5 py-4">
          <p className="aside text-[24px] text-ground">{ex.cue}</p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">The movement</p>
        <ol className="mt-3 flex flex-col gap-3">
          {ex.steps.map((s, i) => (
            <li key={i} className="flex gap-3.5">
              <span
                aria-hidden
                className="tabular statement grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan text-[15px] text-ground"
              >
                {i + 1}
              </span>
              <span className="text-[15px] leading-snug text-fg">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">Common mistakes</p>
        <ul className="mt-3 flex flex-col gap-3">
          {ex.mistakes.map((m) => (
            <li key={m} className="flex items-center gap-3.5">
              {/* A leading marker, not a stripe down the side of the row. */}
              <span aria-hidden className="h-5 w-[3px] shrink-0 rounded-full bg-orange" />
              <span className="text-[16px] leading-snug text-fg">{m}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-[14px] leading-snug text-dim">
        Shown once, on the set where it usually goes wrong. Not every set.
      </p>

      <div className="mt-auto pt-8">
        <Pill onClick={onBack}>Got it</Pill>
        <div className="mt-2.5">
          <Pill variant="ghost" onClick={() => setDemoAsked(true)}>
            Watch the demo
          </Pill>
        </div>
        {demoAsked && (
          // Better an honest empty hand than a button that pretends.
          <p className="mt-2.5 text-center text-[14px] text-dim">
            No clip for this one yet. The three steps above are the whole movement.
          </p>
        )}
      </div>
    </main>
  );
}
