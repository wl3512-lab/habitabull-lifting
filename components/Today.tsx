"use client";

import { useState } from "react";
import { Card, Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { nextTarget, streakWeeks } from "@/lib/engine";
import { describe, parseLocally, type Constraints } from "@/lib/constraints";
import { greetingMood, line } from "@/lib/voice";
import type { Profile, Routine, Session } from "@/lib/types";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The opening screen. It is a logging screen, not a dashboard — the single
 * largest control on it starts a workout, because the research found people
 * want to log before they will set anything up.
 *
 * No mascot here on purpose. He shows up where there is something to react to:
 * a finished session, a new best, a comeback. A bull on the daily home is
 * decoration, and decoration is the thing this redesign kept cutting.
 */
export default function Today({
  profile,
  routine,
  sessions,
  today,
  onStart,
  onConstraints,
  onExercise,
  onProfile,
}: {
  profile: Profile;
  routine: Routine | null;
  sessions: Session[];
  today: string;
  onStart: () => void;
  onConstraints: (c: Constraints) => void;
  onExercise: (id: string) => void;
  onProfile: (p: Profile) => void;
}) {
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [understood, setUnderstood] = useState("");
  const [open, setOpen] = useState(false);
  const [editingWhy, setEditingWhy] = useState(false);
  const [whyDraft, setWhyDraft] = useState(profile.motivation ?? "");

  const done = sessions.filter((s) => s.completedAt);
  const last = done.map((s) => s.date).sort().at(-1);
  const mood = greetingMood(last, today);
  const alreadyLogged = sessions.some((s) => s.date === today && s.completedAt);
  const weeks = streakWeeks(sessions);

  // The week as it actually stands, Sunday-indexed to match getDay().
  const now = new Date(today + "T00:00:00");
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const week = DAY_INITIALS.map((initial, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return {
      initial,
      iso,
      trained: done.some((s) => s.date === iso),
      isToday: iso === today,
      planned: profile.trainingDays.includes(i),
    };
  });

  async function submitNote() {
    const text = note.trim();
    if (!text) return;
    setAsking(true);
    setOffline(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const c = (await res.json()) as Constraints;
      setOffline(c.source === "local");
      setUnderstood(describe(c));
      onConstraints(c);
    } catch {
      // Hard requirement: the app works with the AI layer completely dead.
      const c = parseLocally(text);
      setOffline(true);
      setUnderstood(describe(c));
      onConstraints(c);
    } finally {
      setAsking(false);
      setNote("");
      setOpen(false);
    }
  }

  /**
   * Their own words, quoted back. This is the sobriety-app mechanism from the
   * deck (p9) and the reason the question is asked at all — an answer collected
   * once and never shown again is a form field, not a motivation feature.
   *
   * It moves. On an ordinary day it sits below the fold of the primary action,
   * quiet. After a gap it comes up above everything, because that is the day it
   * was written for. The model never touches the text either way.
   */
  const motivationCard = profile.motivation ? (
    <section className="rounded-2xl bg-card p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-dim">You workout because</p>
        <button
          type="button"
          onClick={() => {
            setWhyDraft(profile.motivation ?? "");
            setEditingWhy(true);
          }}
          className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Change
        </button>
      </div>
      {editingWhy ? (
        <div className="mt-2.5">
          <textarea
            value={whyDraft}
            onChange={(e) => setWhyDraft(e.target.value)}
            rows={3}
            maxLength={160}
            autoFocus
            aria-label="Why you work out"
            className="w-full resize-none rounded-xl bg-raise p-3.5 text-[17px] leading-snug text-fg focus:outline-none focus:ring-2 focus:ring-cyan"
          />
          <div className="mt-2.5 flex gap-2">
            <Pill
              size="sm"
              className="h-12 flex-1"
              onClick={() => {
                onProfile({ ...profile, motivation: whyDraft.trim() || undefined });
                setEditingWhy(false);
              }}
            >
              Save
            </Pill>
            <button
              type="button"
              onClick={() => setEditingWhy(false)}
              className="head h-12 shrink-0 px-4 text-[15px] text-dim transition-colors hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <blockquote className="statement mt-2 text-[26px] leading-tight text-fg">
          &ldquo;{profile.motivation}&rdquo;
        </blockquote>
      )}
      {mood === "return" && !editingWhy && (
        <p className="mt-2.5 text-[15px] text-dim">Still true. The gap does not undo it.</p>
      )}
    </section>
  ) : null;

  // What today came to, once it is finished.
  const todaySession = sessions.find((s) => s.date === today && s.completedAt);
  const loggedSets =
    todaySession?.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0) ?? 0;
  const loggedVolume =
    todaySession?.exercises.reduce(
      (n, e) => n + e.sets.filter((x) => x.done).reduce((v, x) => v + x.weight * x.reps, 0),
      0
    ) ?? 0;

  // The next day she said she would train, named rather than counted.
  const nextDayLabel = (() => {
    const days = profile.trainingDays;
    if (!days.length) return "soon";
    const dow = new Date(today + "T00:00:00").getDay();
    for (let i = 1; i <= 7; i++) {
      const d = (dow + i) % 7;
      if (days.includes(d)) return i === 1 ? "tomorrow" : FULL_DAYS[d];
    }
    return "soon";
  })();

  // Only when there is a session to describe — on a rest day the headline
  // already says it, and repeating it under itself reads like a bug.
  const kit = [...new Set(profile.equipment)];
  // The hour they committed to, stated back. Habit principle 2 only does its
  // work if the intention is visible on the day, not filed away at signup.
  const when =
    profile.trainingMinute === undefined
      ? null
      : (() => {
          const h = Math.floor(profile.trainingMinute / 60);
          const m = profile.trainingMinute % 60;
          const h12 = h % 12 === 0 ? 12 : h % 12;
          return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
        })();

  const subtitle = routine
    ? [
        `${routine.exercises.length} ${routine.exercises.length === 1 ? "lift" : "lifts"}`,
        kit.length === 1 ? (kit[0] === "bodyweight" ? "just you" : `${kit[0]}s only`) : null,
        when && !alreadyLogged ? `around ${when}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <header>
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">
            {new Date(today + "T00:00:00")
              .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
              .toUpperCase()}
            {weeks > 0 && ` · Week ${weeks}`}
          </p>
        </div>
        <h1 className="statement mt-2 text-[44px] text-fg">
          {routine ? routine.label : alreadyLogged ? "Logged" : "Rest day"}
        </h1>
        {subtitle && <p className="mt-1.5 text-[17px] text-dim">{subtitle}</p>}
      </header>

      {/* After a gap, their reason goes above the action, not below it. */}
      {mood === "return" && motivationCard && <div className="mt-6">{motivationCard}</div>}

      <div className="mt-6 flex flex-col gap-2.5">
        {/*
          Once today is logged there is no orange action, and that is the point.
          The rule is one primary action per screen, not that a screen must
          always have one — inventing "Log another set" for someone who has
          already finished asks them to keep going when the app's whole argument
          is that turning up was the job. What is left is a quiet way back in.
        */}
        {alreadyLogged ? (
          <>
            <div className="rounded-2xl bg-card p-[18px]">
              <p className="label text-dim">Today</p>
              <p className="statement mt-1.5 text-[26px] text-fg">
                {loggedSets} {loggedSets === 1 ? "set" : "sets"} done
                {loggedVolume > 0 && `, ${loggedVolume.toLocaleString()} lb moved`}
              </p>
              <p className="mt-1.5 text-[15px] text-dim">That is the whole job. See you {nextDayLabel}.</p>
            </div>
            <Pill variant="ghost" onClick={onStart}>
              Add to today&apos;s session
            </Pill>
          </>
        ) : (
          <Pill onClick={onStart}>{routine ? "Start workout" : "Train anyway"}</Pill>
        )}
        {open ? (
          <Card className="rise p-[18px]">
            <label htmlFor="note" className="label block text-dim">
              What&apos;s different today?
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Only dumbbells today, and my shoulder is tweaked"
              className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-[16px] text-fg placeholder:text-dim focus:outline-none"
            />
            <div className="mt-2.5 flex gap-2">
              <Pill
                size="sm"
                onClick={submitNote}
                disabled={asking || !note.trim()}
                className="h-12 flex-1"
              >
                {asking ? "Rebuilding…" : "Rebuild today"}
              </Pill>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="head h-12 shrink-0 px-4 text-[15px] text-dim transition-colors hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : (
          <Pill variant="ghost" onClick={() => setOpen(true)}>
            Swap today&apos;s plan
          </Pill>
        )}
        {understood && (
          <p className="text-[15px] text-dim">
            {understood}
            {offline && " Worked that out offline — the smart parser was unreachable."}
          </p>
        )}
      </div>

      <section className="mt-8">
        <p className="label text-dim">This week</p>
        <ul className="mt-3 flex justify-between gap-1.5">
          {week.map((d) => (
            <li key={d.iso} className="flex flex-1 flex-col items-center gap-2">
              <span
                aria-hidden
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors duration-200 ${
                  d.trained
                    ? "border-green bg-green"
                    : d.isToday
                      ? "border-cyan"
                      : d.planned
                        ? "border-line"
                        : "border-raise"
                }`}
              />
              <span className={`text-[13px] ${d.isToday ? "text-fg" : "text-dim"}`}>
                {d.initial}
              </span>
            </li>
          ))}
        </ul>
        <p className="sr-only">
          {done.filter((s) => week.some((d) => d.iso === s.date)).length} sessions logged this week.
        </p>
      </section>

      {mood !== "return" && motivationCard && <div className="mt-8">{motivationCard}</div>}

      {routine ? (
        <section className="mt-8">
          <p className="label text-dim">Today&apos;s lifts</p>
          <ul className="mt-3 flex flex-col gap-2">
            {routine.exercises.map((e) => {
              const t = nextTarget(e.exerciseId, sessions, profile.level);
              return (
                <li key={e.exerciseId}>
                  <button
                    type="button"
                    onClick={() => onExercise(e.exerciseId)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-[18px] py-4 text-left transition-colors duration-150 hover:bg-raise"
                  >
                    <span className="min-w-0">
                      <span className="head block truncate text-[17px] text-fg">
                        {nameOf(e.exerciseId)}
                      </span>
                      {t.weight > 0 && (
                        <span className="tabular statement block text-[26px] text-fg">
                          {t.weight} lb
                        </span>
                      )}
                    </span>
                    <span className="tabular statement shrink-0 text-[20px] text-cyan">
                      {t.sets} × {t.reps}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <Card className="mt-8 p-[18px]">
          <h2 className="head text-[17px] text-fg">Nothing scheduled today</h2>
          <p className="mt-1 text-[15px] text-dim">
            Rest is part of it. If you want to train anyway, pull up your next session.
          </p>
        </Card>
      )}

      <p className="mt-auto pt-8 text-[15px] text-dim">
        {alreadyLogged
          ? line("done", done.length)
          : routine
            ? line(mood, done.length)
            : line("rest", done.length)}
      </p>
    </main>
  );
}
