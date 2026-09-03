"use client";

import { useCallback, useEffect, useState } from "react";
import Bull, { BULL } from "./Bull";
import { Pill } from "./ui";
import {
  createCrew,
  enabled,
  fetchCrew,
  joinCrew,
  leaveCrew,
  type CrewMember,
} from "@/lib/cloud";
import {
  challengeDone,
  challengePercent,
  daysLeftInMonth,
  defaultTarget,
} from "@/lib/crew";
import { formatCode, isValidCode } from "@/lib/joincode";
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
 * A crew is joined by typing a code somebody read out, not by making an
 * account — there is no password anywhere in this product. What a crew can see
 * is deliberately thin: who trained on which day, and a photo if that person
 * chose to share it. Never a weight, never an order.
 *
 * All of it disappears when no backend is configured. The app was built to work
 * for one person offline and that stays the mode that always works.
 */
export default function Crew({
  profile,
  sessions,
  challenge,
  onChallenge,
  crewPreview,
}: {
  profile: Profile;
  sessions: Session[];
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  /** Supplied instead of fetched, so /frames can show a crew statically. */
  crewPreview?: { code: string | null; members: CrewMember[] };
}) {
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");
  const [code, setCode] = useState<string | null>(crewPreview?.code ?? null);
  const [roster, setRoster] = useState<CrewMember[]>(crewPreview?.members ?? []);
  const [entry, setEntry] = useState("");
  const [trouble, setTrouble] = useState<"none" | "no-such-crew" | "unreachable">("none");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (crewPreview || !enabled()) return;
    fetchCrew().then((res) => {
      setCode(res?.code ?? null);
      setRoster(res?.members ?? []);
    });
  }, [crewPreview]);

  useEffect(load, [load]);

  async function doJoin() {
    if (busy) return;
    setBusy(true);
    const res = await joinCrew(entry, profile.name);
    setBusy(false);
    if (!res.ok) {
      // Only a 404 means the code was wrong. Anything else is our problem and
      // should not be described as hers.
      setTrouble(res.status === 404 ? "no-such-crew" : "unreachable");
      return;
    }
    setTrouble("none");
    setEntry("");
    load();
  }

  async function doCreate() {
    if (busy) return;
    setBusy(true);
    const res = await createCrew(profile.name);
    setBusy(false);
    if (res.ok) {
      setTrouble("none");
      load();
    } else {
      setTrouble("unreachable");
    }
  }

  async function doLeave() {
    if (busy) return;
    setBusy(true);
    await leaveCrew();
    setBusy(false);
    setCode(null);
    setRoster([]);
  }

  const now = new Date();
  // Monday, so "this week" means the same thing here as on the calendar.
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekStart = iso(monday);
  const todayIso = iso(now);
  // Monday-first, matching the calendar and the home screen's week strip.
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { iso: iso(d) };
  });
  const meId = roster.find((m) => m.mine)?.id ?? null;

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setShared("copied");
    } catch {
      setShared("idle");
    }
  }

  const done = challengeDone(sessions, challenge);
  const pct = challengePercent(done, challenge.target);
  const left = Math.max(0, challenge.target - done);
  const daysLeft = daysLeftInMonth(now);
  const monthName = MONTHS[Number(challenge.month.slice(5, 7)) - 1];
  const suggested = defaultTarget(profile.trainingDays, now.getFullYear(), now.getMonth());

  const bump = (n: number) =>
    onChallenge({ ...challenge, target: Math.max(1, challenge.target + n) });

  async function share() {
    const text = code
      ? `I'm doing ${challenge.target} sessions in ${monthName} on HabitaBull Lifting. Join my crew with ${formatCode(code)}.`
      : `I'm doing ${challenge.target} sessions in ${monthName} on HabitaBull Lifting. Come do it with me.`;
    const url = typeof window === "undefined" ? "" : window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HabitaBull Lifting", text, url });
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
      </div>

      <h1 className="statement mt-2 text-[44px] text-fg">
        {roster.length > 1 ? `${roster.length} of you.` : "Just you, for now."}
      </h1>
      {/* Somebody is here either way. */}
      {roster.length <= 1 && (
        <div className="mt-4 flex justify-center">
          <Bull size={BULL.companion} />
        </div>
      )}
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
            className="h-full w-full origin-left rounded-full bg-green transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{ transform: `scaleX(${pct / 100})` }}
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
              : "More sessions than days left. Lower it and keep it real."}
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
        With no backend this says plainly what it does not have. A screen full
        of people who do not exist is worse than one that admits it.
      */}
      {!enabled() && !crewPreview ? (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Nobody here yet</p>
          <p className="mt-2 text-[17px] leading-snug text-fg">
            When someone joins, you&apos;ll see whether they trained. Not what they lifted.
          </p>
        </section>
      ) : code ? (
        <>
          {/*
            A week each, drawn the same way as "This week" on the home screen,
            because it is the same fact about the same seven days.

            It used to read "1 this week" / "1 this week" / "not yet this week",
            which is a leaderboard with extra steps — a column of counts sorts
            itself in the reader's head no matter what the subtitle above it
            promises. Dots carry rhythm without carrying a score: you can see
            that Maya trains Monday and Thursday and that Sam has had a quiet
            week, and there is no number to be behind on.
          */}
          <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label text-dim">Who&apos;s in</p>
              <p className="tabular head shrink-0 text-[15px] text-cyan">{formatCode(code)}</p>
            </div>

            {/* Labelled once, not per person: seven identical rows of letters
                would be noise, and one row orients all of them. */}
            <ul className="mt-3 flex gap-1.5" aria-hidden>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <li key={i} className="flex-1 text-center text-[12px] text-dim">
                  {d}
                </li>
              ))}
            </ul>

            <ul className="mt-2 flex flex-col gap-4">
              {roster.map((m) => {
                const trainedToday = m.days.includes(todayIso);
                return (
                  <li key={m.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="head truncate text-[17px] text-fg">
                        {m.name}
                        {m.id === meId && <span className="text-dim"> · you</span>}
                      </span>
                      {trainedToday && (
                        <span className="head shrink-0 text-[15px] text-green">in today</span>
                      )}
                    </div>
                    <ul className="mt-2 flex gap-1.5" aria-hidden>
                      {weekDays.map((d) => (
                        <li
                          key={d.iso}
                          className={`h-2.5 flex-1 rounded-full ${
                            m.days.includes(d.iso)
                              ? "bg-green"
                              : d.iso === todayIso
                                ? "bg-line-strong"
                                : "bg-raise"
                          }`}
                        />
                      ))}
                    </ul>
                    <p className="sr-only">
                      {m.name} trained {m.days.filter((d) => d >= weekStart).length} times this week.
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Adding someone is the point of the screen, not a footnote on it. */}
          <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <p className="label text-dim">Add someone</p>
            <p className="mt-2 text-[17px] leading-snug text-fg">
              Read them the code, or send it.
            </p>
            <button
              type="button"
              onClick={() => void copyCode()}
              aria-label={`Copy the crew code ${formatCode(code)}`}
              className="tabular statement mt-3 w-full rounded-xl bg-raise py-4 text-center text-[30px] tracking-[0.1em] text-cyan transition-colors hover:bg-line"
            >
              {formatCode(code)}
            </button>
            <div className="mt-2.5">
              <Pill variant="ghost" onClick={share}>
                Send the code
              </Pill>
            </div>
            {shared === "copied" && (
              <p role="status" className="mt-2.5 text-center text-[15px] text-dim">
                Copied. Paste it wherever they&apos;ll see it.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Train with someone</p>
          <p className="mt-2 text-[17px] leading-snug text-fg">
            They&apos;ll see the days you trained and any photo you share. Nothing else.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void doJoin();
            }}
            className="mt-4 flex items-center gap-2.5"
          >
            <input
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value.toUpperCase());
                setTrouble("none");
              }}
              maxLength={7}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Their code"
              aria-label="A crew code"
              aria-invalid={trouble === "no-such-crew"}
              className="tabular min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-[17px] tracking-[0.12em] text-fg placeholder:tracking-normal placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            <button
              type="submit"
              disabled={!isValidCode(entry) || busy}
              className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-[15px] text-ground transition-opacity disabled:opacity-30"
            >
              Join
            </button>
          </form>
          {trouble !== "none" && (
            <p role="status" className="mt-2 text-[15px] text-dim">
              {trouble === "no-such-crew"
                ? "No crew with that code. Check a character and try again."
                : "Could not reach your crew just now. Your training is saved either way — try again in a moment."}
            </p>
          )}

          <button
            type="button"
            onClick={() => void doCreate()}
            disabled={busy}
            className="head tap mt-4 self-start text-[15px] text-cyan transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {busy ? "One moment…" : "Or start one and get a code"}
          </button>
        </section>
      )}

      <div className="mt-auto pt-8">
        {/* Sharing lives in the Add someone card once there is a crew; a second
            copy of the same action down here was the screen asking twice. */}
        {!code && (
          <>
            <Pill variant="ghost" onClick={share}>
              Send this to someone
            </Pill>
            {shared === "copied" && (
              <p className="mt-2.5 text-center text-[15px] text-dim">
                Copied. Paste it wherever they&apos;ll see it.
              </p>
            )}
          </>
        )}
        {code && (
          <button
            type="button"
            onClick={() => void doLeave()}
            disabled={busy}
            className="tap mx-auto mt-4 block text-[15px] text-dim underline underline-offset-4 transition-colors hover:text-fg disabled:opacity-40"
          >
            Leave this crew
          </button>
        )}
      </div>
    </main>
  );
}
