"use client";

import { useState } from "react";
import { Pill } from "./ui";
import { SHORT_DAYS } from "@/lib/engine";
import {
  ANCHORS,
  anchorLabel,
  anchorOf,
  parseAvailability,
  placeDays,
  planWeek,
  primaryAnchor,
  type Anchor,
  type Availability,
} from "@/lib/schedule";
import type { Profile } from "@/lib/types";

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Setting up the week, after the first session rather than before it.
 *
 * The order of the controls is the argument. Someone who knows their schedule
 * can tap three chips and be done. Someone who does not — which is most
 * beginners, and the reason this screen exists at all — can say "free most
 * evenings but Wednesdays are bad" and let the app work it out.
 *
 * The AI rails are the same as everywhere else in this product: the model only
 * turns language into days and an anchor, and a deterministic function decides
 * what the week actually looks like. It never picks a number of sessions the
 * guidance would not, and the local parser handles the whole thing when the
 * network is gone.
 *
 * Body-part splits are not offered. ACSM's 2026 update puts novices on full-body
 * work across non-consecutive days and says plainly that training every major
 * group twice a week matters far more than the shape of the split — so asking a
 * beginner to choose one is offering a decision that can only make things worse.
 */
export default function WeekSetup({
  profile,
  onSave,
  onSkip,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [count, setCount] = useState(profile.trainingDays.length || 3);
  const [days, setDays] = useState<number[]>(profile.trainingDays.length ? profile.trainingDays : placeDays(3));
  const [anchors, setAnchors] = useState<Anchor[] | undefined>(profile.anchors);

  function apply(a: Availability) {
    const week = planWeek(a, count);
    setDays(week);
    setCount(week.length);
    if (a.anchor) setAnchors((prev) => (prev?.includes(a.anchor!) ? prev : [...(prev ?? []), a.anchor!]));
  }

  async function askAi() {
    const t = text.trim();
    if (!t) return;
    setAsking(true);
    setOffline(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, intent: "availability" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const a = (await res.json()) as Availability & { source?: string };
      setOffline(a.source === "local");
      apply(a);
    } catch {
      // Same hard rule as the rest of the app: it works with the model dead.
      setOffline(true);
      apply(parseAvailability(t));
    } finally {
      setAsking(false);
    }
  }

  function setCountAndPlace(n: number) {
    setCount(n);
    setDays(placeDays(n));
  }

  const toggleDay = (d: number) =>
    setDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      const sorted = next.sort((a, b) => a - b);
      setCount(sorted.length || 1);
      return sorted;
    });

  const when = anchorLabel(anchors);
  const summary =
    days.length === 0
      ? "Pick at least one day."
      : `${days.map((d) => FULL[d]).join(", ")}${when ? ` — ${when}` : ""}`;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-cyan">Your week</p>
        <button
          type="button"
          onClick={onSkip}
          className="head tap shrink-0 text-[15px] text-dim transition-colors hover:text-fg"
        >
          Later
        </button>
      </div>

      <h1 className="statement mt-2 text-[44px] text-fg">When can you train?</h1>
      <p className="mt-1.5 text-[17px] text-dim">
        Roughly is fine. A day you keep beats an hour you miss.
      </p>

      {/* The way in for anyone who cannot answer the chips below. */}
      <div className="mt-6 rounded-2xl bg-card p-[18px]">
        <label htmlFor="free" className="label block text-dim">
          Or just tell me
        </label>
        <textarea
          id="free"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Free most evenings, but Wednesdays are bad"
          className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-[16px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
        />
        <div className="mt-2.5">
          <Pill variant="ghost" onClick={askAi} disabled={asking || !text.trim()}>
            {asking ? "Working it out…" : "Work out my week"}
          </Pill>
        </div>
        {offline && (
          <p className="mt-2 text-[15px] text-dim">Worked that out offline.</p>
        )}
      </div>

      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">How often</p>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCountAndPlace(n)}
              aria-pressed={count === n}
              className={`head h-11 flex-1 rounded-full border text-[17px] transition-colors duration-150 ${
                count === n ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="mt-3 text-[15px] text-dim">
          Three is the number beginners actually keep. Two is enough to make progress.
        </p>

        {/*
          Seven across a 390px phone. At 18px card padding there are 322px to
          share, so 48px each (336) does not fit and never will — the gap goes
          to 2px and the row borrows 12px back from the padding, which lands
          each day at 45px. Under WCAG 2.5.5's 44, over 2.5.8's 24.
        */}
        <div className="mt-4 -mx-3 flex gap-0.5">
          {SHORT_DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(i)}
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
      </section>

      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">When in the day</p>
        <p className="mt-1 text-[15px] text-dim">Pick as many as genuinely work.</p>
        <div className="mt-3 flex flex-col gap-2">
          {ANCHORS.map((a) => {
            const on = anchors?.includes(a.id) ?? false;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setAnchors((prev) => {
                    const list = prev ?? [];
                    return list.includes(a.id)
                      ? list.filter((x) => x !== a.id)
                      : [...list, a.id];
                  })
                }
                aria-pressed={on}
                className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
                  on ? "border-cyan bg-raise" : "border-transparent bg-raise/40 hover:bg-raise/70"
                }`}
              >
                <span className="head block text-[17px] text-fg">{a.label}</span>
                <span className="block text-[15px] text-dim">{a.hint}</span>
              </button>
            );
          })}
          {/*
            A real answer, not an opt-out. Plenty of weeks genuinely move, and
            the research is clear that a rigid plan breaks when circumstances
            change — so someone whose day varies should be able to say so
            rather than pick a slot they will not keep.
          */}
          <button
            type="button"
            onClick={() => setAnchors(anchors?.length === 0 ? undefined : [])}
            aria-pressed={anchors?.length === 0}
            className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
              anchors?.length === 0
                ? "border-cyan bg-raise"
                : "border-transparent bg-raise/40 hover:bg-raise/70"
            }`}
          >
            <span className="head block text-[17px] text-fg">Whenever I can</span>
            <span className="block text-[15px] text-dim">It changes week to week</span>
          </button>
        </div>
        <p className="mt-3 text-[15px] text-dim">
          A slot in your day sticks better than a time on a clock. Two slots stick better than
          one you keep missing.
        </p>
      </section>

      <div className="mt-auto pt-8">
        <p className="mb-3 text-[15px] text-dim">{summary}</p>
        <Pill
          onClick={() =>
            onSave({
              ...profile,
              trainingDays: days,
              anchors,
              trainingMinute: primaryAnchor(anchors)
                ? anchorOf(primaryAnchor(anchors)!).minute
                : undefined,
            })
          }
          disabled={days.length === 0}
        >
          That&apos;s my week
        </Pill>
      </div>
    </main>
  );
}
