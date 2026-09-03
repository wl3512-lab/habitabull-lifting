"use client";

import Bull from "./Bull";
import Streak from "./Streak";
import { Pill, Stat } from "./ui";
import { nameOf } from "@/lib/exercises";
import { personalRecord, streakWeeks } from "@/lib/engine";
import { line } from "@/lib/voice";
import type { Session } from "@/lib/types";

/**
 * The celebration screen. It exists to make coming back tomorrow feel like
 * something, which is the entire retention mechanism — the mascot is doing the
 * work here, not the data.
 *
 * Two grounds, and which one you get is the whole hierarchy. A new best inverts
 * the app to orange, and that inversion is the celebration: no confetti, no
 * sound, no badge. Finishing a normal session stays on the charcoal ground,
 * because if every session is a party then none of them is.
 */
export default function Finished({
  session,
  sessions,
  records,
  onHome,
  offerGoal,
  onSetGoal,
  onAddDetail,
}: {
  session: Session;
  sessions: Session[];
  /** exercise ids where this session set a new best */
  records: string[];
  onHome: () => void;
  /** Goals are offered here, after a session exists — never during setup. */
  offerGoal: boolean;
  onSetGoal: () => void;
  onAddDetail: () => void;
}) {
  const setsDone = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0
  );
  const volume = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).reduce((v, s) => v + s.weight * s.reps, 0),
    0
  );

  // How much the top new best beat the old one by. The guide's congratulations
  // card is specific ("by 15 lbs"), and specific is what makes it land.
  //
  // Only when there was something to beat. On a first session everything is a
  // record by definition, and "you beat it by 70 lb" would be a lie.
  /**
   * Say it once, on the day there is finally something to lose.
   *
   * Everything this app knows lives in one browser, and iOS clears
   * script-writable storage after seven idle days for a site that was never
   * added to the home screen — which is the exact user this product is for.
   * The manifest has always been ready for it and nothing ever asked.
   *
   * Only after the first session, only when not already installed, and never
   * again: a prompt on the way in is asking for commitment before there is
   * anything to protect, and a prompt every time is nagging.
   */
  const justStarted = sessions.filter((x) => x.completedAt).length === 1;
  const installed =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  const prior = sessions.filter((s) => s.date !== session.date);
  const best = records
    .map((id) => {
      const now = Math.max(
        0,
        ...session.exercises
          .find((e) => e.exerciseId === id)!
          .sets.filter((s) => s.done)
          .map((s) => s.weight)
      );
      const was = personalRecord(prior, id);
      return { id, was, by: now - was, now };
    })
    .filter((r) => r.was > 0)
    .sort((a, b) => b.by - a.by)[0];

  const weeks = streakWeeks(sessions);
  const total = sessions.filter((s) => s.completedAt).length;

  if (best) {
    return (
      <div className="flex flex-1 flex-col bg-orange text-ground">
        <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
          <p className="label text-center text-ground/75">Personal record</p>

          {/* 180 × 218 in the Figma. */}
          <div className="rise mt-4 flex flex-col items-center">
            <Bull size={180} react />
          </div>

          <h1 className="statement mt-5 text-center text-[42px] text-ground">
            {best.by} lb more than you&apos;ve ever done.
          </h1>

          <div className="rise mt-6 rounded-2xl bg-ground px-5 py-6 text-center">
            <p className="label text-dim">{nameOf(best.id)}</p>
            <p className="tabular statement mt-2 text-[56px] text-orange">{best.now} lb</p>
            <p className="mt-1.5 text-[17px] text-fg">
              Up from {best.was} lb. You beat it by {best.by}.
            </p>
          </div>

          <div className="mt-auto pt-10">
            <p className="mb-3 text-center text-[15px] text-ground/80">
              Only your own numbers. Nobody else is in this.
            </p>
            <Pill variant="onOrange" onClick={onHome}>
              Keep going
            </Pill>
            <button
              type="button"
              onClick={onAddDetail}
              className="head tap mt-2.5 block w-full text-center text-[15px] text-ground/80 transition-opacity hover:opacity-100"
            >
              Add a note or photo
            </button>
            {offerGoal && (
              <button
                type="button"
                onClick={onSetGoal}
                className="head mt-1 h-12 w-full text-[15px] text-ground/80 transition-opacity hover:opacity-100"
              >
                Now pick something to aim at
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="rise flex flex-col items-center text-fg">
        <Bull size={168} react />
        {/*
          Always the plain line here. Reaching this branch means nothing was
          beaten — on a first session every lift is a record by definition, and
          "you lifted more than you ever have" is a claim with nothing behind
          it. The honest version of that is the "first time on X" chips below.
        */}
        <p className="head mt-4 max-w-[26ch] text-center text-[19px] leading-snug">
          {line("done", sessions.length)}
        </p>
      </div>

      <div className="mt-8 flex gap-2.5">
        <Stat value={setsDone} label={setsDone === 1 ? "set today" : "sets today"} />
        {volume > 0 && <Stat value={`${volume.toLocaleString()}`} label="lb moved" />}
      </div>

      <div className="mt-2.5">
        <Streak weeks={weeks} sessions={total} />
      </div>

      {records.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {records.map((id) => (
            <li
              key={id}
              className="head rounded-full border border-line-strong px-4 py-2 text-[15px] text-cyan"
            >
              First time on {nameOf(id)}
            </li>
          ))}
        </ul>
      )}

      {justStarted && !installed && (
        <div className="mt-8 rounded-2xl border border-line-strong p-[18px]">
          <p className="label text-cyan">Keep this</p>
          <p className="mt-1.5 text-[17px] leading-snug text-fg">
            Add HabitaBull to your home screen.
          </p>
          <p className="mt-1 text-[15px] leading-snug text-dim">
            Everything you log lives in this browser, and phones clear that for sites
            you have not saved. Share, then Add to Home Screen.
          </p>
        </div>
      )}

      <div className="mt-auto pt-10">
        <Pill onClick={onHome}>Done</Pill>
        <button
          type="button"
          onClick={onAddDetail}
          className="head tap mt-2.5 block w-full text-center text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Add a note or photo
        </button>
        {offerGoal && (
          <button
            type="button"
            onClick={onSetGoal}
            className="head mt-1 h-12 w-full text-[15px] text-cyan transition-opacity hover:opacity-70"
          >
            Now pick something to aim at
          </button>
        )}
      </div>
    </main>
  );
}
