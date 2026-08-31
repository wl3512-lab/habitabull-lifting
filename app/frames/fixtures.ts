import type { AppState, Profile, Routine, Session } from "@/lib/types";

/**
 * Stand-in data for the frame gallery.
 *
 * Deliberately plausible rather than pretty: real exercise ids, real weights
 * that the rules engine would actually produce, and a history with a gap in it
 * so the comeback and calendar screens have something true to draw. A gallery
 * fed on perfect data hides exactly the states worth looking at.
 */

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const at = (daysAgo: number, hour = 20) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

export const profile: Profile = {
  name: "Lucy",
  level: "returning",
  trainingDays: [1, 3, 5],
  equipment: ["barbell", "dumbbell", "machine", "bodyweight"],
  motivation: "It clears my head.",
  anchors: ["evening"],
  trainingMinute: 20 * 60,
  favourites: ["back-squat"],
  createdAt: at(90),
};

export const routines: Routine[] = [
  {
    day: 1,
    label: "Full body A",
    exercises: [
      { exerciseId: "back-squat", sets: 3, reps: 6, weight: 145 },
      { exerciseId: "deadlift", sets: 3, reps: 5, weight: 185 },
      { exerciseId: "bench-press", sets: 3, reps: 6, weight: 105 },
      { exerciseId: "barbell-row", sets: 3, reps: 6, weight: 95 },
      { exerciseId: "plank", sets: 3, reps: 30, weight: 0 },
    ],
  },
  {
    day: 3,
    label: "Full body B",
    exercises: [
      { exerciseId: "hip-thrust", sets: 3, reps: 10, weight: 135 },
      { exerciseId: "goblet-squat", sets: 3, reps: 6, weight: 60 },
      { exerciseId: "overhead-press", sets: 3, reps: 6, weight: 65 },
      { exerciseId: "db-row", sets: 3, reps: 6, weight: 45 },
      { exerciseId: "db-curl", sets: 3, reps: 10, weight: 25 },
    ],
  },
  {
    day: 5,
    label: "Full body A",
    exercises: [
      { exerciseId: "back-squat", sets: 3, reps: 6, weight: 145 },
      { exerciseId: "deadlift", sets: 3, reps: 5, weight: 185 },
      { exerciseId: "bench-press", sets: 3, reps: 6, weight: 105 },
      { exerciseId: "barbell-row", sets: 3, reps: 6, weight: 95 },
      { exerciseId: "plank", sets: 3, reps: 30, weight: 0 },
    ],
  },
];

/** Twelve weeks of history with a two-week hole in it, so gaps are visible. */
export const sessions: Session[] = (() => {
  const out: Session[] = [];
  for (let back = 84; back >= 2; back--) {
    const day = new Date();
    day.setDate(day.getDate() - back);
    if (![1, 3, 5].includes(day.getDay())) continue;
    if (back > 30 && back < 44) continue; // the gap she came back from
    const load = 120 + Math.floor((84 - back) / 7) * 2.5;
    out.push({
      date: iso(back),
      label: back % 2 ? "Full body A" : "Full body B",
      startedAt: at(back, 20),
      completedAt: at(back, 21),
      ...(back === 4 ? { note: "Felt strong. Bar speed was good on the last set — go up 5 lb next time." } : {}),
      exercises: [
        { exerciseId: "back-squat", sets: [{ weight: load, reps: 6, done: true }, { weight: load, reps: 6, done: true }, { weight: load, reps: 6, done: true }] },
        { exerciseId: "deadlift", sets: [{ weight: load + 40, reps: 5, done: true }, { weight: load + 40, reps: 5, done: true }] },
        { exerciseId: "bench-press", sets: [{ weight: load - 40, reps: 6, done: true }, { weight: load - 40, reps: 6, done: true }] },
      ],
    });
  }
  return out;
})();

export const lastSession = sessions[sessions.length - 1];

/** A session mid-flight: first exercise done, second in progress. */
export const draft: Session = {
  date: iso(0),
  label: "Full body A",
  startedAt: at(0, 20),
  exercises: [
    { exerciseId: "back-squat", sets: [
      { weight: 145, reps: 6, done: true },
      { weight: 145, reps: 6, done: true },
      { weight: 145, reps: 6, done: false },
    ] },
    { exerciseId: "deadlift", sets: [{ weight: 185, reps: 5, done: false }] },
    { exerciseId: "bench-press", sets: [{ weight: 105, reps: 6, done: false }] },
  ],
};

export const goal = { exerciseId: "back-squat", targetWeight: 185, targetDate: iso(-70) };

export const state: AppState = { profile, routines, sessions, goal, challenge: undefined };

/** A profile that has trained in the evening while claiming "after work". */
export const driftProfile: Profile = { ...profile, anchors: ["afterwork"] };

/** Long enough away that Today switches to its comeback state. */
export const lapsedSessions: Session[] = sessions.filter((s) => {
  const gap = Math.round((Date.now() - Date.parse(s.date)) / 864e5);
  return gap > 11;
});

export const noop = () => {};
