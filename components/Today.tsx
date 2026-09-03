"use client";

import { useState } from "react";
import Bull, { BULL } from "./Bull";
import CrewToday from "./CrewToday";
import { Card, GoalBar, Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { goalProgress, nextTarget, personalRecord, streakWeeks } from "@/lib/engine";
import { describe, parseLocally, type Constraints } from "@/lib/constraints";
import { greetingMood, line } from "@/lib/voice";
import { anchorLabel, anchorOf, observedAnchor, primaryAnchor } from "@/lib/schedule";
import type { CrewDay } from "@/lib/cloud";
import type { Goal, Profile, Routine, Session } from "@/lib/types";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The opening screen. It is a logging screen, not a dashboard — the single
 * largest control on it starts a workout, because the research found people
 * want to log before they will set anything up.
 *
 * The mascot earns his place here rather than decorating it: beside her reason
 * on a training day, on the first run when there is no plan yet, and on a rest
 * day, where "not today, and that is fine" is the sentence this whole product
 * is arguing for. He is still absent from the ordinary mid-week home screen
 * with a plan already on it, because there he would be decoration.
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
  onSetUpWeek,
  onEditRoutine,
  goal,
  onGoal,
  onOpenDay,
  crewPreview,
}: {
  profile: Profile;
  routine: Routine | null;
  sessions: Session[];
  today: string;
  onStart: () => void;
  onConstraints: (c: Constraints) => void;
  onExercise: (id: string) => void;
  onProfile: (p: Profile) => void;
  onSetUpWeek: () => void;
  onEditRoutine: () => void;
  goal: Goal | null;
  onGoal: () => void;
  onOpenDay: (date: string) => void;
  /** Passed straight through to the crew line, for /frames. */
  crewPreview?: CrewDay;
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
   * The quote rises on the days it was written for and rests on the days it was
   * not: a training day she has not started yet, and any comeback. Not on every
   * launch — a line shown every time stops being read inside a week, and the
   * mid-set opens are exactly the ones that must stay fast. Rare is what keeps
   * it legible.
   */
  const raised = Boolean(profile.motivation) && (mood === "return" || (Boolean(routine) && !alreadyLogged));

  /**
   * Their own words, quoted back. This is the sobriety-app mechanism from the
   * deck (p9) and the reason the question is asked at all — an answer collected
   * once and never shown again is a form field, not a motivation feature.
   *
   * It moves. On an ordinary day it sits below the fold of the primary action,
   * quiet. After a gap it comes up above everything, because that is the day it
   * was written for. The model never touches the text either way.
   */
  const motivationCard = (
    <section className="rounded-2xl bg-card p-[18px]">
      {raised && (
        <div className="mb-3 flex justify-center">
          <Bull size={BULL.inline} />
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-dim">You workout because</p>
        {profile.motivation && !editingWhy && (
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
        )}
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
      ) : profile.motivation ? (
        <blockquote className="statement mt-2 text-[26px] leading-tight text-fg">
          &ldquo;{profile.motivation}&rdquo;
        </blockquote>
      ) : (
        /*
          Skipped at onboarding, and until now that left this screen with
          nothing personal on it at all — no reason and, before a first
          workout, no goal either. The way back was only ever the Change
          button on a card that did not render.

          It teaches what the card becomes rather than apologising for being
          empty, and it stays an invitation: the deck's whole point (p9,
          I Am Sober) is that the reason has to be hers, and a required field
          is the fastest way to get an answer nobody meant.
        */
        <>
          <p className="mt-2 text-[17px] leading-snug text-dim">
            One line, in your words. It comes back on the days you would rather not.
          </p>
          <button
            type="button"
            onClick={() => {
              setWhyDraft("");
              setEditingWhy(true);
            }}
            className="head tap mt-2.5 text-[15px] text-cyan transition-opacity hover:opacity-70"
          >
            Write your reason
          </button>
        </>
      )}
      {mood === "return" && profile.motivation && !editingWhy && (
        <p className="mt-2.5 text-[15px] text-dim">Still true. The gap does not undo it.</p>
      )}
    </section>
  );

  // What today came to, once it is finished.
  const todaySession = sessions.find((s) => s.date === today && s.completedAt);
  const loggedSets =
    todaySession?.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0) ?? 0;
  const loggedVolume =
    todaySession?.exercises.reduce(
      (n, e) => n + e.sets.filter((x) => x.done).reduce((v, x) => v + x.weight * x.reps, 0),
      0
    ) ?? 0;

  /**
   * Only when there is a real pattern and it disagrees with what she chose.
   * Silence is the right output most of the time.
   */
  /**
   * A generated plan is a proposal, not a fact.
   *
   * Onboarding builds a full-body week so nobody has to configure anything,
   * and that part is right — but showing it under "Today's lifts" as though it
   * were chosen presented "Hip Thrust 20 lb" to someone who had never asked
   * for a hip thrust. Interview finding six is that people reject generic
   * routines, and a list you did not pick is exactly that.
   *
   * So the plan is not shown until it is hers. The proposal is one tap away
   * and full body is already selected there, so agreeing costs a tap and
   * changing it costs the same tap.
   */
  /*
    Deliberately not gated on there being a routine for today. `placeDays`
    spreads three sessions across the week, so somebody who signs up on a
    Thursday was landing on "Rest day / Train anyway" as the very first thing
    the app ever said to them — told to rest before they had done anything.
    Whether today happens to be a scheduled day is a fact about a schedule
    nobody has agreed to yet.

    And "Build your workout" goes to the day picker, not the day-type editor.
    It used to open the editor with Monday, Thursday and Saturday already
    chosen by placeDays and no way to change them — the app had made the
    schedule and was calling it building. Choosing when you can train comes
    before choosing what each day is.
  */
  const unchosen = !profile.planChosen && sessions.length === 0;

  const seen = observedAnchor(sessions);
  const stated = profile.anchors;
  const drift = seen && stated && stated.length > 0 && !stated.includes(seen.anchor) ? seen : null;

  /**
   * Habit principle 4 (deck p12) does not say "have a goal" — it says the goal
   * is "displayed when the app is opened". It was living on Progress, one tap
   * away, which is one tap too many for something whose whole job is to be seen
   * without being looked for.
   */
  const goalCard = goal ? (
    <section className="rounded-2xl bg-card p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-dim">Your goal</p>
        <button
          type="button"
          onClick={onGoal}
          className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          Change
        </button>
      </div>
      <p className="statement mt-2 text-[26px] leading-tight text-fg">
        {nameOf(goal.exerciseId)} {goal.targetWeight} lb by{" "}
        {new Date(goal.targetDate + "T00:00:00").toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
        })}
      </p>
      <div className="mt-4">
        <GoalBar
          percent={goalProgress(sessions, goal)}
          caption={
            personalRecord(sessions, goal.exerciseId) > 0
              ? `${personalRecord(sessions, goal.exerciseId)} lb now`
              : "Nothing logged on this lift yet"
          }
          trailing={`${Math.round(goalProgress(sessions, goal))}% achieved`}
        />
      </div>
    </section>
  ) : null;

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
  const when = anchorLabel(profile.anchors);

  // "5 lifts" under a screen that says nothing is planned yet is the app
  // arguing with itself. Before the week is hers, the header states the
  // occasion and leaves the counting until there is something to count.
  const subtitle = unchosen
    ? null
    : routine
    ? [
        `${routine.exercises.length} ${routine.exercises.length === 1 ? "lift" : "lifts"}`,
        kit.length === 1 ? (kit[0] === "bodyweight" ? "just you" : `${kit[0]}s only`) : null,
        when && !alreadyLogged ? (profile.anchors?.length ? when : "whenever you can") : null,
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
          {unchosen
            ? "Your first workout"
            : routine
              ? routine.label
              : alreadyLogged
                ? "Logged"
                : "Rest day"}
        </h1>
        {subtitle && <p className="mt-1.5 text-[17px] text-dim">{subtitle}</p>}
      </header>

      {/*
        What she actually does, versus what she said she would. Stated
        intentions and real behaviour drift, and the honest move is to believe
        the behaviour — the timestamps were already there and nobody had to be
        asked twice. Offered, never applied silently: it is still her plan.
      */}
      {drift && (
        <button
          type="button"
          onClick={() =>
            onProfile({
              ...profile,
              // Added to what she said, not swapped for it — she may well train
              // in both, and the app has only seen one of them.
              anchors: [...(profile.anchors ?? []), drift.anchor],
              trainingMinute: anchorOf(drift.anchor).minute,
            })
          }
          className="mt-6 w-full rounded-2xl border border-line-strong p-[18px] text-left transition-colors hover:bg-raise/50"
        >
          <span className="label block text-cyan">Noticed</span>
          <span className="head mt-1.5 block text-[19px] text-fg">
            You train in the {anchorOf(drift.anchor).label.toLowerCase()}, not {anchorLabel(profile.anchors) ?? "when you planned"}.
          </span>
          <span className="mt-0.5 block text-[15px] text-dim">
            {drift.count} of your last {drift.total}. Make it the plan?
          </span>
        </button>
      )}

      {/*
        The schedule is offered after the first session, not at signup. Asking a
        beginner which days they will train before they have trained once asks
        for a commitment they have no basis to make.
      */}
      {done.length > 0 && profile.anchors === undefined && (
        <button
          type="button"
          onClick={onSetUpWeek}
          className="mt-6 w-full rounded-2xl border border-line-strong p-[18px] text-left transition-colors hover:bg-raise/50"
        >
          <span className="label block text-cyan">Now the useful bit</span>
          <span className="head mt-1.5 block text-[19px] text-fg">Set up your week</span>
          <span className="mt-0.5 block text-[15px] text-dim">
            You have done one. Pick the days you can actually keep.
          </span>
        </button>
      )}

      {/* After a gap, their reason goes above the action, not below it. */}
      {raised && motivationCard && <div className="mt-6">{motivationCard}</div>}

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
          <Pill onClick={unchosen ? onSetUpWeek : onStart}>
            {unchosen ? "Build your workout" : routine ? "Start workout" : "Train anyway"}
          </Pill>
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
              className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-[16px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
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
          // Nothing to swap before there is a plan to swap out of.
          !unchosen && (
            <Pill variant="ghost" onClick={() => setOpen(true)}>
              Swap today&apos;s plan
            </Pill>
          )
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

      <CrewToday date={today} onOpen={() => onOpenDay(today)} preview={crewPreview} />

      {!raised && motivationCard && <div className="mt-8">{motivationCard}</div>}

      {goalCard && <div className="mt-2.5">{goalCard}</div>}

      {unchosen ? (
        <section className="mt-8">
          <p className="label text-dim">Today&apos;s lifts</p>
          <button
            type="button"
            onClick={onSetUpWeek}
            className="mt-3 block w-full rounded-2xl border border-line-strong p-[18px] text-center transition-colors hover:bg-raise/50"
          >
            <span className="mb-3 flex justify-center">
              <Bull size={BULL.companion} />
            </span>
            <span className="head block text-[19px] text-fg">Nothing here yet</span>
            <span className="mt-1 block text-[15px] leading-snug text-dim">
              Say which days you can train, then what each one is — leg day, push day,
              cardio, or full body, which is where most people should start. Or describe
              the week you want and the app will build it.
            </span>
            <span className="head mt-2.5 block text-[15px] text-cyan">Build your workout →</span>
          </button>
        </section>
      ) : routine ? (
        <section className="mt-8">
          {!profile.planChosen && (
            <button
              type="button"
              onClick={onEditRoutine}
              className="mb-3 block w-full rounded-2xl border border-line-strong p-[18px] text-left transition-colors hover:bg-raise/50"
            >
              <span className="label block text-cyan">Before you start</span>
              <span className="head mt-1.5 block text-[19px] text-fg">Name your days</span>
              <span className="mt-0.5 block text-[15px] text-dim">
                Leg day, push day, cardio — or leave it full body, which is what the app picked.
              </span>
            </button>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Today&apos;s lifts</p>
            <button
              type="button"
              onClick={onEditRoutine}
              className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
            >
              Edit
            </button>
          </div>
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
        // He turns up where there is something to react to, and "not today,
        // and that is fine" is the sentence this whole product is arguing for.
        <Card className="mt-8 flex flex-col items-center p-[18px] text-center">
          <Bull size={BULL.companion} />
          <h2 className="head mt-3 text-[17px] text-fg">Nothing here.</h2>
          <p className="mt-1 text-[15px] text-dim">
            Rest is part of progress. If you want to train anyway, pull up your next session.
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
