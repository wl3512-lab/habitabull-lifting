"use client";

import { useState } from "react";
import { Pill } from "./ui";
import {
  challengeDone,
  challengePercent,
  daysLeftInMonth,
  defaultTarget,
} from "@/lib/crew";
import type { Challenge, Profile, Session } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * What replaced the leaderboard.
 *
 * Miles, the Competitor (deck p21), wants something to be ahead of. The 2023
 * flow gave him a leaderboard (p27, lo-fi p37) and the redesign took it away on
 * purpose: ranked by absolute load it shames the beginner the whole deck was
 * written for, and beginners quit ladders. What replaces it is the Miro
 * sticky's "different challenge every month" — a target rather than a ranking.
 *
 * There is no crew list here yet and nothing pretends there is. Real presence
 * needs other people's check-ins, which needs a backend and accounts, both of
 * which are out of scope for v1. The screen is built so that a crew slots into
 * this layout without moving anything: the challenge is already the shared
 * object it would be measured against.
 */
export default function Crew({
  profile,
  sessions,
  challenge,
  onChallenge,
  onBack,
}: {
  profile: Profile;
  sessions: Session[];
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  onBack: () => void;
}) {
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");

  const now = new Date();
  const done = challengeDone(sessions, challenge);
  const pct = challengePercent(done, challenge.target);
  const left = Math.max(0, challenge.target - done);
  const daysLeft = daysLeftInMonth(now);
  const monthName = MONTHS[Number(challenge.month.slice(5, 7)) - 1];
  const suggested = defaultTarget(profile.trainingDays, now.getFullYear(), now.getMonth());

  const bump = (n: number) =>
    onChallenge({ ...challenge, target: Math.max(1, challenge.target + n) });

  async function share() {
    const text = `I'm doing ${challenge.target} sessions in ${monthName} on HabitaBull. Come do it with me.`;
    const url = typeof window === "undefined" ? "" : window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HabitaBull", text, url });
        setShared("idle");
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared("copied");
    } catch {
      // A cancelled share throws the same as a failed one; say nothing rather
      // than accusing someone of an error they did on purpose.
      setShared("idle");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Your crew</p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Back
        </button>
      </div>

      <h1 className="statement mt-2 text-[44px] text-fg">Just you, for now.</h1>
      <p className="mt-1.5 text-[17px] text-dim">
        No rankings. No weights. Just who turned up.
      </p>

      <section className="mt-6 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">This month</p>
        <p className="statement mt-2 text-[30px] leading-tight text-fg">
          {challenge.target} {challenge.target === 1 ? "session" : "sessions"} in {monthName}.
        </p>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-raise" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${done} of ${challenge.target} sessions this month`}>
          <div
            className="h-full rounded-full bg-green transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <span className="tabular text-[15px] text-dim">
            {done} done{left > 0 && ` · ${left} to go`}
          </span>
          <span className="head tabular shrink-0 text-[15px] text-cyan">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>

        <p className="mt-3 text-[15px] text-dim">
          {left === 0
            ? "Target met. The rest of the month is yours."
            : left <= daysLeft
              ? "Still on for it."
              : `That is more than the days left. Move the number rather than the month.`}
        </p>

        <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-4">
          <span className="flex-1 text-[15px] text-dim">
            Adjust the target
            {challenge.target !== suggested && (
              <span className="block text-[14px] text-dim/70">
                Your schedule says {suggested}.
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={challenge.target <= 1}
            aria-label="Lower the target"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raise text-[22px] leading-none text-cyan transition-colors hover:bg-line disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => bump(1)}
            aria-label="Raise the target"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raise text-[22px] leading-none text-cyan transition-colors hover:bg-line"
          >
            +
          </button>
        </div>
      </section>

      {/*
        Said plainly rather than mocked up. A screen full of people who do not
        exist is worse than a screen that admits what it does not have yet.
      */}
      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">When there are others</p>
        <p className="mt-2 text-[17px] leading-snug text-fg">
          Your crew will show who trained and who came back — never what anybody
          lifted, and never in order.
        </p>
        <p className="mt-2 text-[15px] text-dim">
          Nobody can see your numbers, only whether you showed up. Beginners quit
          leaderboards, not gyms.
        </p>
      </section>

      <div className="mt-auto pt-8">
        <Pill variant="ghost" onClick={share}>
          Send this to someone
        </Pill>
        {shared === "copied" && (
          <p className="mt-2.5 text-center text-[15px] text-dim">
            Copied. Paste it wherever they&apos;ll see it.
          </p>
        )}
      </div>
    </main>
  );
}
