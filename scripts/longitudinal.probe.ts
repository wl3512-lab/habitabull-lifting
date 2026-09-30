/**
 * A longitudinal probe: one persona, many weeks, one simulated day at a time.
 *
 * Every other test in this repo asks a function a question. This one asks the
 * app what happens to somebody over months — because the rules that matter most
 * here only exist across dates. Progressive overload, the back-off after three
 * tough sessions, a streak, a comeback after a gap, a week whose days get
 * moved: none can be seen in one session, and the 2026-09-20 UX run listed them
 * all as "needs several sessions across dates; not attempted this run".
 *
 * It drives the functions `app/page.tsx` drives, in the same order, and between
 * every simulated day it writes to storage and reads it back — which is what
 * the app really does when somebody closes it and opens it tomorrow. The
 * assertions are all about agreement: what a screen would show, what storage
 * holds, and what the rules say should have happened, being the same thing.
 */
import { describe, expect, it } from "vitest";
import {
  buildSession,
  generateRoutine,
  mergeDayLibrary,
  nextTarget,
  personalRecord,
  reconcileWeek,
  rememberLineup,
  repsFor,
  streakWeeks,
  topSet,
} from "@/lib/engine";
import { byId } from "@/lib/exercises";
import { comebackDates, monthMatrix, weekStrip, yearCounts } from "@/lib/calendar";
import { greetingMood } from "@/lib/voice";
import { arrivalMood, type Greeted } from "@/lib/arrival";
import { placeDays } from "@/lib/schedule";
import { EMPTY, load, save, sessionFor, upsertSession, upsertWeighIn } from "@/lib/storage";
import type { AppState, Profile, Session } from "@/lib/types";

/* ------------------------------------------------------------------ storage */

/**
 * The one thing node does not have that this app cannot do without. A real
 * round-trip through JSON and the `load()` sanitizers is the point: a drift
 * that only appears after a close and reopen is the drift a user meets.
 */
const mem = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  },
};

/* -------------------------------------------------------------------- dates */

const iso = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};
const plus = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};
const dow = (day: string) => new Date(day + "T00:00:00").getDay();

/* ------------------------------------------------- the app's own two moves */

/** "Start workout" — app/page.tsx:263. */
function startWorkout(state: AppState, today: string): AppState {
  const routine = state.routines.find((r) => r.day === dow(today));
  if (!routine || !state.profile) return state;
  if (sessionFor(state.sessions, today)) return state;
  return {
    ...state,
    sessions: upsertSession(state.sessions, {
      ...buildSession(routine, state.sessions, state.profile.level, today),
      startedAt: `${today}T18:00:00.000Z`,
    }),
  };
}

/** "Finish" — app/page.tsx:340. */
function finishWorkout(state: AppState, today: string): AppState {
  const draft = sessionFor(state.sessions, today);
  if (!draft) return state;
  const routines = rememberLineup(state.routines, draft);
  return {
    ...state,
    routines,
    dayLibrary: mergeDayLibrary(state.dayLibrary, routines),
    sessions: upsertSession(state.sessions, {
      ...draft,
      exercises: draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })),
      completedAt: `${today}T19:00:00.000Z`,
    }),
  };
}

/** What she did with the session in front of her. */
type Effort = "clear" | "miss" | "partial" | "abandon" | "skip" | "as-asked";

/** Tap through the sets the way a thumb would. */
function logSets(state: AppState, today: string, effort: Effort): AppState {
  const draft = sessionFor(state.sessions, today);
  if (!draft || !state.profile) return state;
  const level = state.profile.level;
  const onlyFirst = effort === "partial" || effort === "abandon";
  const logged: Session = {
    ...draft,
    exercises: draft.exercises.map((e) => {
      const ex = byId(e.exerciseId);
      const target = ex ? repsFor(ex, level) : 8;
      return {
        ...e,
        sets: e.sets.map((s, i) => {
          if (onlyFirst && i > 0) return s;
          // "as-asked" does exactly what the screen in front of her says, which
          // is not the same thing as clearing the engine's target once the two
          // have drifted apart.
          const reps =
            effort === "miss" ? Math.max(1, target - 2) : effort === "as-asked" ? s.reps : Math.max(s.reps, target);
          return { ...s, reps, done: true };
        }),
      };
    }),
  };
  return { ...state, sessions: upsertSession(state.sessions, logged) };
}

/* --------------------------------------------------------------- invariants */

type Run = {
  drift: string[];
  timeline: string[];
  note: (day: string, what: string) => void;
  say: (line: string) => void;
};

function newRun(): Run {
  const drift: string[] = [];
  const timeline: string[] = [];
  return {
    drift,
    timeline,
    note: (day, what) => drift.push(`${day}  ${what}`),
    say: (line) => timeline.push(line),
  };
}

/** Where two states differ, by path, so a drift reads as one line not two dumps. */
function diffPaths(a: unknown, b: unknown, path: string, out: string[] = []): string[] {
  if (a === b) return out;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}.length ${a.length} -> ${b.length}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) diffPaths(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
}

const empty = (o: Record<string, unknown> | undefined | null) => !o || Object.keys(o).length === 0;

/** Close the app, open it tomorrow. Anything that does not survive shows here. */
function roundTrip(run: Run, state: AppState, day: string): AppState {
  if (!save(state)) run.note(day, "save() reported a failed write");
  const back = load();
  const projection = (s: AppState) => ({
    profile: s.profile,
    routines: s.routines,
    sessions: s.sessions,
    goal: s.goal,
    weighIns: s.weighIns ?? [],
    // An absent library and an empty one mean the same thing; `load` normalises
    // one to the other and that is not a drift.
    dayLibrary: empty(s.dayLibrary) ? null : s.dayLibrary,
    challenge: s.challenge ?? null,
    customExercises: s.customExercises ?? [],
  });
  for (const d of diffPaths(projection(state), projection(back), "state"))
    run.note(day, `across save/load, ${d}`);
  return back;
}

/** Everything that has to be true of stored state on every single day. */
function checkInvariants(run: Run, state: AppState, today: string): void {
  const { sessions, profile } = state;
  if (!profile) return;

  const dates = sessions.map((s) => s.date);
  if (new Set(dates).size !== dates.length) run.note(today, `duplicate session dates: ${dates.join(",")}`);

  for (const s of sessions) {
    if (s.date > today) run.note(today, `a session is dated in the future: ${s.date}`);
    if (s.completedAt) {
      for (const e of s.exercises) {
        if (e.sets.some((x) => !x.done)) run.note(today, `${s.date} kept an unfinished set in history`);
        if (e.sets.length === 0) run.note(today, `${s.date} kept ${e.exerciseId} with no sets at all`);
      }
    }
  }

  const done = sessions.filter((s) => s.completedAt);

  // The month grid and the history must count the same days.
  let painted = 0;
  for (const m of new Set(done.map((s) => s.date.slice(0, 7)))) {
    const [y, mo] = m.split("-").map(Number);
    for (const row of monthMatrix(y, mo - 1, sessions, [], new Date(today + "T00:00:00")))
      for (const cell of row) if (cell.trained) painted++;
  }
  if (painted !== done.length)
    run.note(today, `month grid paints ${painted} trained days, history has ${done.length}`);

  // The year view must total the same as the history for that year.
  for (const y of new Set(done.map((s) => Number(s.date.slice(0, 4))))) {
    const counted = yearCounts(sessions, y).reduce((a, b) => a + b, 0);
    const real = done.filter((s) => s.date.startsWith(String(y))).length;
    if (counted !== real) run.note(today, `year view counts ${counted} for ${y}, history has ${real}`);
  }

  // The week strip and the history must agree about this week.
  for (const d of weekStrip(sessions, profile.trainingDays, today)) {
    const real = done.some((s) => s.date === d.iso);
    if (d.trained !== real) run.note(today, `week strip says ${d.iso} trained=${d.trained}, history says ${real}`);
  }

  // A personal record can only ever be the heaviest set in history.
  for (const id of new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))) {
    const pr = personalRecord(sessions, id);
    const best = topSet(
      done.flatMap((s) => s.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets))
    );
    if (best && pr < best.weight) run.note(today, `PR for ${id} is ${pr} but a set of ${best.weight} is in history`);
  }
}

/**
 * The tightest statement of "what it shows matches what it saved": every
 * session, when it opened, must have opened at exactly the weight the rules
 * derive from the sessions that came before it.
 */
function targetsAgainstHistory(sessions: Session[], level: Profile["level"]): string[] {
  const out: string[] = [];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    for (const e of s.exercises) {
      if (e.sets.length === 0) continue;
      const opened = Math.min(...e.sets.map((x) => x.weight));
      const t = nextTarget(e.exerciseId, ordered.slice(0, i), level);
      if (opened !== t.weight)
        out.push(`${s.date} ${e.exerciseId}: opened at ${opened}, rules said ${t.weight} (${t.note})`);
    }
  }
  return out;
}

/** One lift's whole arc, as a reader would follow it. */
function arc(done: Session[], id: string): string {
  return done
    .filter((s) => s.exercises.some((e) => e.exerciseId === id && e.sets.length))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const e = s.exercises.find((x) => x.exerciseId === id)!;
      return `${e.sets[0].weight}x${e.sets.map((x) => x.reps).join("/")}`;
    })
    .join(" -> ");
}

/* ------------------------------------------------------------------- driver */

interface Arc {
  start: string;
  /** One entry per week: what she did with each training day that week. */
  weeks: Effort[][];
  level?: Profile["level"];
  /** Day 0-6 to move the last training day to, and the week to do it in. */
  move?: { week: number; from: number; to: number };
}

function runArc(run: Run, a: Arc) {
  const level = a.level ?? "new";
  const profile: Profile = {
    name: "Erin",
    level,
    trainingDays: placeDays(3, dow(a.start)),
    equipment: ["barbell", "dumbbell", "bodyweight"],
    restSec: 60,
    planChosen: true,
    createdAt: `${a.start}T09:00:00.000Z`,
  };
  mem.clear();

  let state: AppState = {
    ...EMPTY,
    profile,
    routines: generateRoutine(level, profile.trainingDays, profile.equipment),
  };
  let greeted: Greeted | null = null;
  const comebacks: string[] = [];
  state = roundTrip(run, state, a.start);

  const days = a.weeks.length * 7;
  for (let d = 0; d < days; d++) {
    const today = plus(a.start, d);
    const week = Math.floor(d / 7);

    // Arrival: what the app says when it is opened, once a day.
    const mood = arrivalMood(state, today, { greeted, reduced: false });
    if (mood) greeted = { date: today, mood };

    // Moving a training day mid-arc, the way the schedule screen does.
    if (a.move && week === a.move.week && dow(today) === 0) {
      const before = state.sessions.filter((s) => s.completedAt).map((s) => s.date);
      const next = [...state.profile!.trainingDays.filter((x) => x !== a.move!.from), a.move!.to].sort(
        (x, y) => x - y
      );
      state = {
        ...state,
        profile: { ...state.profile!, trainingDays: next },
        routines: reconcileWeek(state.routines, next, level, state.profile!.equipment, [], state.dayLibrary ?? {}),
      };
      const after = state.sessions.filter((s) => s.completedAt).map((s) => s.date);
      if (before.join() !== after.join())
        run.note(today, "moving a training day changed which days had been trained");
      if (state.routines.length !== next.length)
        run.note(today, `after the move: ${state.routines.length} routines for ${next.length} training days`);
      run.say(`${today}  moved day ${a.move.from} to day ${a.move.to}: ${state.routines.map((r) => `${r.day}=${r.label}`).join(" ")}`);
    }

    /*
      Which session of the week is this — first, second, third? Counted forward
      from the start of the week window rather than read off the weekday, so a
      script reads in the order the days actually happen. Indexing by weekday
      put a scripted miss in the middle of a week that began on a Saturday, and
      a script nobody can read in order is a script that tests the wrong thing.
    */
    const trainingDays = new Set(state.profile!.trainingDays);
    let slot = -1;
    if (trainingDays.has(dow(today))) {
      slot = 0;
      for (let k = week * 7; k < d; k++) if (trainingDays.has(dow(plus(a.start, k)))) slot++;
    }
    const effort = slot === -1 ? undefined : (a.weeks[week]?.[slot] ?? "skip");
    const routine = state.routines.find((r) => r.day === dow(today));

    if (effort && effort !== "skip" && routine) {
      const lastDone = state.sessions
        .filter((x) => x.completedAt && x.date < today)
        .map((x) => x.date)
        .sort()
        .pop();
      const isComeback = greetingMood(lastDone, today) === "return";
      if (isComeback) comebacks.push(today);

      state = startWorkout(state, today);
      const opened = sessionFor(state.sessions, today)!;
      const shown = opened.exercises
        .map((e) => `${byId(e.exerciseId)?.name ?? e.exerciseId} ${e.sets.length}x${e.sets[0]?.reps}@${e.sets[0]?.weight}`)
        .join(", ");
      state = logSets(state, today, effort);
      if (effort === "abandon") {
        run.say(`${today}  ${opened.label}: started, walked out`);
      } else {
        state = finishWorkout(state, today);
        run.say(`${today}  ${opened.label} (${effort})${isComeback ? " [comeback]" : ""}: ${shown}`);
      }
    } else if (effort === "skip" && routine) {
      run.say(`${today}  ${routine.label} planned, skipped`);
    }

    if (dow(today) === 0)
      state = { ...state, weighIns: upsertWeighIn(state.weighIns ?? [], { date: today, lb: 168 - d * 0.05 }) };

    checkInvariants(run, state, today);
    state = roundTrip(run, state, today); // close the app, open it tomorrow
  }

  return { state, comebacks, last: plus(a.start, days - 1) };
}

function report(run: Run, label: string) {
  run.say("");
  run.say(run.drift.length ? `DRIFT (${run.drift.length}):` : "DRIFT: none");
  for (const d of run.drift) run.say(`  ${d}`);
  console.log(`\n===== ${label} =====\n` + run.timeline.join("\n") + "\n");
}

/* -------------------------------------------------------------- scenario 1 */

describe("eight weeks of one person using the app", () => {
  it("keeps its own story straight, day after day", () => {
    const run = newRun();
    const { state, comebacks, last } = runArc(run, {
      start: "2026-07-06", // a Monday
      move: { week: 5, from: 5, to: 6 }, // Friday becomes Saturday, mid-arc
      weeks: [
        ["clear", "clear", "clear"], // 1: turns up
        ["clear", "clear", "clear"], // 2: still turning up
        ["clear", "abandon", "skip"], // 3: ragged
        ["skip", "skip", "skip"], // 4: away
        ["miss", "miss", "miss"], // 5: back, and it is hard
        ["miss", "clear", "partial"], // 6: heavy going
        ["clear", "clear", "clear"], // 7: it comes back
        ["clear", "clear", "clear"], // 8
      ],
    });

    const done = state.sessions.filter((s) => s.completedAt);
    run.say("");
    run.say(`sessions stored: ${state.sessions.length}   completed: ${done.length}`);
    run.say(`streak in weeks, on ${last}: ${streakWeeks(state.sessions, new Date(last + "T00:00:00"))}`);
    run.say(`comebacks the app announced: ${comebacks.join(", ") || "none"}`);
    run.say(`comeback dates the calendar marks: ${[...comebackDates(state.sessions)].join(", ") || "none"}`);
    run.say(`weigh-ins kept: ${(state.weighIns ?? []).length}, sorted: ${
      JSON.stringify((state.weighIns ?? []).map((w) => w.date)) ===
      JSON.stringify([...(state.weighIns ?? [])].map((w) => w.date).sort())
    }`);
    run.say(`stored bytes: ${mem.get("habitabull.v1")?.length ?? 0}`);

    const mismatches = targetsAgainstHistory(done, "new");
    run.say("");
    run.say(`sessions that did not open at the weight the rules derive: ${mismatches.length}`);
    for (const m of mismatches) run.say(`  ${m}`);

    run.say("");
    for (const id of new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))) {
      const ex = byId(id);
      run.say(`${ex?.name ?? id}  (increment ${ex?.increment}, target ${ex ? repsFor(ex, "new") : "?"} reps)`);
      run.say(`  ${arc(done, id)}`);
    }

    report(run, "scenario 1: eight weeks, with a week away and a rough return");

    expect(mismatches).toEqual([]);
    expect(run.drift).toEqual([]);
    expect(comebacks).toEqual([...comebackDates(state.sessions)]);
  });
});

/* -------------------------------------------------------------- scenario 2 */

describe("a long rough patch", () => {
  it("shows what the back-off rule does when the misses do not stop", () => {
    const run = newRun();
    const { state } = runArc(run, {
      start: "2026-07-06",
      weeks: [
        ["clear", "clear", "clear"],
        ["clear", "clear", "clear"],
        ["miss", "miss", "miss"],
        ["miss", "miss", "miss"],
        ["miss", "miss", "miss"],
        ["miss", "miss", "miss"],
      ],
    });
    const done = state.sessions.filter((s) => s.completedAt);
    for (const id of ["back-squat", "deadlift", "bench-press"]) run.say(`${byId(id)!.name}\n  ${arc(done, id)}`);

    // How many separate 10% cuts did one lift take, and where did it end up?
    const squat = done
      .filter((s) => s.exercises.some((e) => e.exerciseId === "back-squat" && e.sets.length))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => s.exercises.find((e) => e.exerciseId === "back-squat")!.sets[0].weight);
    const cuts = squat.filter((w, i) => i > 0 && w < squat[i - 1]).length;
    run.say("");
    run.say(`back squat: peak ${Math.max(...squat)}, finished at ${squat.at(-1)}, separate cuts: ${cuts}`);
    run.say(`the bar alone is 45 lb; the app's starting load for a novice is 45 lb`);

    report(run, "scenario 2: twelve missed sessions in a row");
    expect(targetsAgainstHistory(done, "new")).toEqual([]);
    expect(run.drift).toEqual([]);
  });
});

/* -------------------------------------------------------------- scenario 3 */

describe("a full year", () => {
  it("stays consistent, and stays inside a localStorage quota", () => {
    const run = newRun();
    const weeks: Effort[][] = Array.from({ length: 52 }, (_, w) =>
      // Mostly turns up; an ordinary life, with a fortnight off in August and
      // the odd skipped Friday.
      w === 6 || w === 7
        ? ["skip", "skip", "skip"]
        : [w % 5 === 3 ? "miss" : "clear", "clear", w % 4 === 2 ? "skip" : "clear"]
    );
    const { state, last } = runArc(run, { start: "2026-01-05", weeks });
    const done = state.sessions.filter((s) => s.completedAt);
    const bytes = mem.get("habitabull.v1")?.length ?? 0;

    run.say("");
    run.say(`completed sessions in a year: ${done.length}`);
    run.say(`streak in weeks on ${last}: ${streakWeeks(state.sessions, new Date(last + "T00:00:00"))}`);
    run.say(`month by month: ${yearCounts(state.sessions, 2026).join(" ")}`);
    run.say(`stored bytes: ${bytes} (${(bytes / 1024).toFixed(1)} KB) — ${(bytes / done.length).toFixed(0)} per session`);
    run.say(`years before a 5 MB quota: ${(5 * 1024 * 1024 / bytes).toFixed(0)}`);
    run.say(`back squat over the year:\n  ${arc(done, "back-squat")}`);

    report(run, "scenario 3: a year");
    expect(targetsAgainstHistory(done, "new")).toEqual([]);
    expect(run.drift).toEqual([]);
    expect(bytes).toBeLessThan(1024 * 1024);
  });
});

/* -------------------------------------------------------------- scenario 4 */

describe("someone who does exactly what the app asks", () => {
  it("is told to do fewer reps than the engine is judging her against", () => {
    const run = newRun();
    const { state } = runArc(run, {
      start: "2026-07-06",
      weeks: [
        ["clear", "clear", "clear"],
        ["clear", "clear", "miss"], // one bad Friday, and nothing else goes wrong
        ["as-asked", "as-asked", "as-asked"],
        ["as-asked", "as-asked", "as-asked"],
        ["as-asked", "as-asked", "as-asked"],
        ["as-asked", "as-asked", "as-asked"],
        ["as-asked", "as-asked", "as-asked"],
        ["as-asked", "as-asked", "as-asked"],
      ],
    });
    const done = state.sessions.filter((s) => s.completedAt);

    run.say("");
    run.say("what the plan asks for, per lift, at the end:");
    for (const r of state.routines)
      run.say(`  day ${r.day} ${r.label}: ${r.exercises.map((e) => `${byId(e.exerciseId)?.name} ${e.sets}x${e.reps}`).join(", ")}`);

    run.say("");
    run.say("what the engine is judging her against:");
    for (const id of ["back-squat", "deadlift", "bench-press"]) {
      const ex = byId(id)!;
      const t = nextTarget(id, done, "new");
      run.say(`  ${ex.name}: target ${repsFor(ex, "new")} reps, next weight ${t.weight} — "${t.note}"`);
    }

    run.say("");
    for (const id of ["back-squat", "deadlift", "bench-press", "plank"])
      run.say(`${byId(id)!.name}\n  ${arc(done, id)}`);

    const squat = done
      .filter((s) => s.exercises.some((e) => e.exerciseId === "back-squat" && e.sets.length))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => s.exercises.find((e) => e.exerciseId === "back-squat")!.sets[0].weight);
    run.say("");
    run.say(`back squat: peak ${Math.max(...squat)} lb, finished at ${squat.at(-1)} lb, and she missed nothing after week 2`);
    run.say(`an empty barbell is 45 lb`);

    report(run, "scenario 4: one missed Friday, then perfect compliance");
    expect(targetsAgainstHistory(done, "new")).toEqual([]);
    expect(run.drift).toEqual([]);
  });
});

/* --------------------------------------------------------------------- seed */

/**
 * Write the end state of an arc to disk so the real UI can be pointed at it.
 *
 * The clock is not faked anywhere. The arc is anchored to the real calendar
 * instead — it starts on a Saturday eight weeks back and ends yesterday, so
 * "today" in the browser is a genuine training day with a genuine history
 * behind it. Faking `Date` in the page would test a page that does not exist.
 */
describe("seed states for a run against the real UI", () => {
  const out = process.env.SEED_DIR;
  const on = Boolean(out);

  it.skipIf(!on)("writes a healthy arc and a slid arc, both ending yesterday", async () => {
    const { writeFileSync } = await import("node:fs");
    const real = iso(new Date());
    // Back up to a Saturday, then eight whole weeks before that, so the
    // weekdays the plan is built on line up with the real ones.
    const sat = plus(real, -((dow(real) - 6 + 7) % 7));
    const start = plus(sat, -56);

    const healthy: Effort[][] = [
      ["clear", "clear", "clear"],
      ["clear", "clear", "clear"],
      ["clear", "abandon", "skip"],
      ["skip", "skip", "skip"],
      ["clear", "clear", "clear"],
      ["clear", "miss", "clear"],
      ["clear", "clear", "clear"],
      ["clear", "clear", "clear"],
    ];
    // The miss lands on the day that carries the deadlift, and is the last
    // session of that day type before the compliant run begins.
    const slid: Effort[][] = [
      ["clear", "clear", "clear"],
      ["clear", "miss", "clear"],
      ...Array.from({ length: 6 }, () => ["as-asked", "as-asked", "as-asked"] as Effort[]),
    ];

    for (const [name, weeks] of [["healthy", healthy], ["slid", slid]] as const) {
      const run = newRun();
      const { state } = runArc(run, { start, weeks });
      writeFileSync(`${out}/seed-${name}.json`, mem.get("habitabull.v1")!);
      const done = state.sessions.filter((s) => s.completedAt);
      console.log(
        `seed-${name}.json  start ${start}  last session ${done.at(-1)!.date}  ` +
          `completed ${done.length}  drift ${run.drift.length}\n` +
          `  next targets: ${["back-squat", "deadlift", "bench-press"]
            .map((id) => `${byId(id)!.name} ${nextTarget(id, done, "new").weight}`)
            .join(", ")}`
      );
    }
  });
});
