import { afterEach, describe, expect, it, vi } from "vitest";
import { resumePosition, replaceSessionSets, unfinishedSessions, finishSession, secondsRemaining, endTimedWork } from "./session-memory";
import type { Session } from "./types";

const session = (): Session => ({ date: "2026-09-28", label: "Push", startedAt: "2026-09-28T18:00:00Z", exercises: [
  { exerciseId: "bench-press", sets: [{ weight: 115, reps: 6, done: true }, { weight: 115, reps: 6, done: false }] },
  { exerciseId: "plank", sets: [{ weight: 0, reps: 45, done: false }] },
] });

describe("session recovery", () => {
  it("recovers the chosen exercise and timer after serialization", () => {
    const s = { ...session(), checkpoint: { exerciseIndex: 1, timer: { seconds: 120, endsAt: 200000, exerciseId: "plank", weight: 0, reps: 45 } } };
    expect(resumePosition(JSON.parse(JSON.stringify(s)))).toEqual(s.checkpoint);
  });
  it("falls back to the next unlogged exercise for older saves", () => {
    const s = session(); s.exercises[0].sets.forEach(x => x.done = true);
    expect(resumePosition(s)).toEqual({ exerciseIndex: 1, timer: null });
  });
  it("ignores a stale checkpoint after the exercise list changed", () => {
    const s = { ...session(), checkpoint: { exerciseIndex: 99, timer: { seconds: 60, endsAt: 200000, exerciseId: "gone", weight: 0, reps: 1 } } };
    expect(resumePosition(s)).toEqual({ exerciseIndex: 0, timer: null });
  });
  it("offers older unfinished workouts without mixing them into today", () => {
    const old = session();
    const current = { ...session(), date: "2026-09-29" };
    const finished = { ...session(), date: "2026-09-27", completedAt: "2026-09-27T19:00:00Z" };
    expect(unfinishedSessions([current, finished, old], "2026-09-29").map(s => s.date)).toEqual(["2026-09-28"]);
  });
  it("adding an unfinished set reopens a completed day without losing logged sets", () => {
    const s = session(); s.exercises.forEach(e => e.sets.forEach(x => x.done = true));
    s.completedAt = "2026-09-28T19:00:00Z";
    const out = replaceSessionSets(s, 0, [...s.exercises[0].sets, { weight: 120, reps: 5, done: false }]);
    expect(out.completedAt).toBeUndefined();
    expect(out.exercises[0].sets.slice(0, 2)).toEqual(s.exercises[0].sets);
  });
  it("finishing retains the original date and only completed sets, clearing recovery state", () => {
    const s = { ...session(), checkpoint: { exerciseIndex: 1, timer: null } };
    const out = finishSession(s, "2026-09-29T12:00:00Z");
    expect(out.date).toBe("2026-09-28");
    expect(out.completedAt).toBe("2026-09-29T12:00:00Z");
    expect(out.exercises).toEqual([{ exerciseId: "bench-press", sets: [{ weight: 115, reps: 6, done: true }] }]);
    expect(out.checkpoint).toBeUndefined();
  });
  it("uses the original timer deadline rather than restarting after a reload", () => {
    expect(secondsRemaining(200000, 155000)).toBe(45);
    expect(secondsRemaining(200000, 210000)).toBe(0);
  });
});


it("ending a cardio timer logs elapsed minutes before finishing", () => {
  const s: Session = { date: "2026-09-29", label: "Cardio", exercises: [{ exerciseId: "treadmill", sets: [{ weight: 4, reps: 20, done: false }] }] };
  const timer = { seconds: 1200, endsAt: 1200000, exerciseId: "treadmill", weight: 4, reps: 20, mode: "work" as const };
  const out = finishSession(endTimedWork(s, 0, timer, 260000), "2026-09-29T12:00:00Z");
  expect(out.exercises[0].sets).toEqual([{ weight: 4, reps: 4, done: true }]);
});

it("does not count an empty workout as completed", () => {
  const s = session(); s.exercises.forEach(e => e.sets.forEach(set => set.done = false));
  expect(finishSession(s, "2026-09-29T12:00:00Z").completedAt).toBeUndefined();
});


it("keeps session checkpoints, notes and weight-input preference through save/load and backup restore", async () => {
  const { EMPTY, save, load } = await import("./storage");
  const { buildBackup, parseBackup } = await import("./backup");
  const memory = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { setItem: (k: string, v: string) => memory.set(k, v), getItem: (k: string) => memory.get(k) ?? null } });
  const s = { ...session(), note: "Keep this", checkpoint: { exerciseIndex: 1, timer: { seconds: 120, endsAt: 200000, exerciseId: "plank", weight: 0, reps: 45 } } };
  const state = { ...EMPTY, profile: { name: "QA", level: "new" as const, equipment: [], trainingDays: [1], createdAt: "2026-09-28T12:00:00Z", weightInput: "plates" as const }, sessions: [s] };
  expect(save(state)).toBe(true);
  const reopened = load();
  expect(reopened.sessions).toEqual([s]);
  const restored = parseBackup(JSON.parse(JSON.stringify(buildBackup(reopened))))!.state;
  expect(restored.sessions).toEqual([s]);
  expect(restored.profile?.weightInput).toBe("plates");
  expect(resumePosition(restored.sessions[0]).timer?.endsAt).toBe(200000);
});

afterEach(() => vi.unstubAllGlobals());
