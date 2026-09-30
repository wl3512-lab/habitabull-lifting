import { expect, it } from "vitest";
import { exerciseTrack } from "./progress";
import type { Session } from "./types";

it("plots one best set per day even when the exercise appears twice", () => {
  const sessions: Session[] = [{ date: "2026-09-28", label: "Push", completedAt: "2026-09-28T12:00:00Z", exercises: [
    { exerciseId: "bench-press", sets: [{ weight: 95, reps: 8, done: true }] },
    { exerciseId: "bench-press", sets: [{ weight: 135, reps: 5, done: true }] },
  ] }];
  expect(exerciseTrack(sessions, "bench-press")).toEqual([{ date: "2026-09-28", weight: 135, reps: 5 }]);
});
