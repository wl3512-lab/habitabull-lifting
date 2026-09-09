"use client";

import Chart from "./Chart";
import { Card, GoalBar, Pill, Stat } from "./ui";
import YourData from "./YourData";
import { nameOf } from "@/lib/exercises";
import { goalProgress } from "@/lib/engine";
import type { AppState, Goal, Session } from "@/lib/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKS = 12;

/**
 * Progress over time, not just today — the third of the six interview findings.
 *
 * The grid is the argument. Twelve weeks of showing up, with the gaps left
 * visible and uncoloured: a missed day is drawn as an absence, never as a red
 * mark, because the users this is for have already quit six apps that treated
 * it as a failure. Comebacks get their own colour and their own counter. Coming
 * back after a gap is the harder skill and nothing else in the category counts
 * it.
 */
export default function Progress({
  sessions,
  goal,
  onGoal,
  state,
  onImport,
}: {
  sessions: Session[];
  goal: Goal | null;
  onGoal: () => void;
  state: AppState;
  onImport: (s: AppState) => void;
}) {
  const done = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
  const trained = new Set(done.map((s) => s.date));

  // A session that lands more than a week after the previous one is a comeback.
  const comebacks = new Set<string>();
  let longestGap = 0;
  for (let i = 1; i < done.length; i++) {
    const gap = Math.round(
      (Date.parse(done[i].date) - Date.parse(done[i - 1].date)) / 864e5
    );
    if (gap >= 7) {
      comebacks.add(done[i].date);
      longestGap = Math.max(longestGap, gap);
    }
  }

  // Twelve weeks, one column each, weekday down the rows.
  const today = new Date();
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - today.getDay()));
  const columns = Array.from({ length: WEEKS }, (_, w) => {
    const sunday = new Date(gridEnd);
    sunday.setDate(gridEnd.getDate() - (WEEKS - 1 - w) * 7 - 6);
    return Array.from({ length: 7 }, (_, d) => {
      const cell = new Date(sunday);
      cell.setDate(sunday.getDate() + d);
      const iso = cell.toISOString().slice(0, 10);
      return { iso, future: cell > today, trained: trained.has(iso), comeback: comebacks.has(iso) };
    });
  });

  // The most reliable weekday, once there is enough to call it one.
  const byDay = new Array(7).fill(0);
  for (const s of done) byDay[new Date(s.date + "T00:00:00").getDay()]++;
  const topDay = byDay.indexOf(Math.max(...byDay));
  const reliable = done.length >= 6 && byDay[topDay] >= 3;

  // exercise id -> best completed set per session, oldest first
  const tracks = new Map<string, { date: string; weight: number; reps: number }[]>();
  for (const s of done) {
    for (const e of s.exercises) {
      const sets = e.sets.filter((x) => x.done);
      if (sets.length === 0) continue;
      const top = sets.reduce((a, b) => (b.weight * b.reps > a.weight * a.reps ? b : a));
      const list = tracks.get(e.exerciseId) ?? [];
      list.push({ date: s.date, weight: top.weight, reps: top.reps });
      tracks.set(e.exerciseId, list);
    }
  }
  const ranked = [...tracks.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Last {WEEKS} weeks</p>
      </div>

      <h1 className="statement mt-2 text-figure text-fg">
        {reliable ? `You show up on ${WEEKDAYS[topDay]}s.` : "Progress"}
      </h1>
      <p className="mt-1.5 text-emphasis text-dim">
        {reliable
          ? `Your most reliable day, ${byDay[topDay]} sessions in. Protect it.`
          : done.length === 0
            ? "Nothing logged yet. One session and this page starts meaning something."
            : "A few more sessions and a pattern shows up here."}
      </p>

      <Card className="mt-6 p-[18px]">
        <div className="flex gap-1.5" aria-hidden>
          {columns.map((week, w) => (
            <div key={w} className="flex flex-1 flex-col gap-1.5">
              {week.map((cell) => {
                // Only a day she trained arrives; the lattice is already there.
                // Animating the gaps too would spend a third of a second
                // drawing attention to every one of them, in the one app built
                // for people who quit six others that did exactly that.
                const logged = cell.trained || cell.comeback;
                return (
                  <div
                    key={cell.iso}
                    // Missed days sit at `line`, not `raise`: enough to read the
                    // lattice so a green cell has a weekday, not enough to make
                    // an empty day shout. It measures 1.44:1 against the card and
                    // that is deliberate — the information here is the green, at
                    // 7:1, and absence is drawn as absence. Documented in
                    // DESIGN.md as a knowing deviation from 1.4.11.
                    className={`aspect-square w-full rounded-tick ${
                      logged ? "cell-in " : ""
                    }${
                      cell.comeback
                        ? "bg-cyan"
                        : cell.trained
                          ? "bg-done"
                          : cell.future
                            ? "bg-raise/40"
                            : "bg-line"
                    }`}
                    // Weeks land oldest first, so twelve weeks read left to
                    // right the way they were lived.
                    style={logged ? ({ "--week": w } as React.CSSProperties) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="sr-only">
          {done.length} sessions in the last {WEEKS} weeks, {comebacks.size} of them after a
          break of a week or more.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption text-dim">
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-tick bg-done" /> Trained
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-tick bg-cyan" /> Comeback
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-tick bg-line" /> Missed
          </li>
        </ul>
      </Card>


      <div className="mt-2.5 flex gap-2.5">
        <Stat value={done.length} label={done.length === 1 ? "session" : "sessions"} />
        <Stat
          value={comebacks.size}
          label={comebacks.size === 1 ? "comeback" : "comebacks"}
          accent
        />
        {longestGap > 0 && <Stat value={longestGap} label="day gap, survived" />}
      </div>

      {comebacks.size > 0 && (
        <p className="mt-3 text-body text-dim">
          Comebacks are counted on purpose. Coming back is the skill.
        </p>
      )}

      {goal ? (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <p className="label text-dim">Your goal</p>
            <button
              type="button"
              onClick={onGoal}
              className="head tap text-body text-cyan transition-opacity hover:opacity-70"
            >
              Change
            </button>
          </div>
          <Card className="mt-3 p-[18px]">
            <p className="statement text-title text-fg">
              {nameOf(goal.exerciseId)} {goal.targetWeight} lb by{" "}
              {new Date(goal.targetDate + "T00:00:00").toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })}
            </p>
            <div className="mt-4">
              <GoalBar
                percent={goalProgress(sessions, goal)}
                caption="Measured from where you started"
                trailing={`${Math.round(goalProgress(sessions, goal))}% there`}
              />
            </div>
          </Card>
        </section>
      ) : (
        done.length > 0 && (
          <div className="mt-8">
            <Pill variant="ghost" onClick={onGoal}>
              Set a goal to aim at
            </Pill>
          </div>
        )
      )}

      <div className="mt-8">
        <YourData state={state} onImport={onImport} />
      </div>

      {ranked.length > 0 && (
        <section className="mt-8 flex flex-col gap-2.5">
          <p className="label text-dim">Lift by lift</p>
          {ranked.map(([id, points]) => {
            const delta = points[points.length - 1].weight - points[0].weight;
            const latest = points[points.length - 1];
            return (
              <Card key={id} className="p-[18px]">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="head text-emphasis text-fg">{nameOf(id)}</h2>
                  <span className="tabular statement shrink-0 text-head text-fg">
                    {latest.weight > 0 ? `${latest.weight} lb` : `${latest.reps} reps`}
                    {delta > 0 && <span className="text-done"> +{delta}</span>}
                  </span>
                </div>
                <div className="mt-3.5">
                  <Chart
                    points={points.map((pt) => ({ date: pt.date, value: pt.weight }))}
                    label={nameOf(id)}
                    showDelta={false}
                  />
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
