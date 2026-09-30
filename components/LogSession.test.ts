import { describe, expect, it } from "vitest";
import { lastAttempt, loadNext } from "./LogSession";
import type { Session } from "@/lib/types";

const session = (date: string, exerciseId: string, sets: [number, number][]): Session => ({
  date,
  label: "Day",
  completedAt: `${date}T18:00:00.000Z`,
  exercises: [{ exerciseId, sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })) }],
});

describe("lastAttempt", () => {
  /*
    The reported bug. Push-ups, planks and cardio all store weight 0, and the
    old ranking compared weight x reps — so every product was 0, the "is this
    set better" test was never true, and it returned whichever set came first.
    A plank held 20s, 45s, 60s reported 20 sec.
  */
  it("finds the best hold when every set weighs nothing", () => {
    const h = [session("2026-09-10", "plank", [[0, 20], [0, 45], [0, 60]])];
    expect(lastAttempt(h, "plank", 0)).toBe("60 sec");
  });

  it("finds the best set of a bodyweight lift, which also weighs nothing", () => {
    const h = [session("2026-09-10", "push-up", [[0, 8], [0, 15], [0, 11]])];
    expect(lastAttempt(h, "push-up", 0)).toBe("15 reps");
  });

  it("ranks by weight before reps, not by volume", () => {
    // 135 x 5 is the better set. Volume said 95 x 10, because 950 beats 675.
    const h = [session("2026-09-10", "back-squat", [[135, 5], [95, 10]])];
    expect(lastAttempt(h, "back-squat", 5)).toBe("135 lb × 5");
  });

  it("breaks a tie on weight with the higher reps", () => {
    const h = [session("2026-09-10", "back-squat", [[135, 5], [135, 8]])];
    expect(lastAttempt(h, "back-squat", 5)).toBe("135 lb × 8");
  });

  it("reads the most recent session, not the best one ever", () => {
    const h = [
      session("2026-09-01", "back-squat", [[225, 5]]),
      session("2026-09-10", "back-squat", [[135, 5]]),
    ];
    expect(lastAttempt(h, "back-squat", 5)).toBe("135 lb × 5");
  });

  it("skips a session that logged nothing for this lift", () => {
    const skipped = session("2026-09-12", "back-squat", []);
    skipped.exercises[0].sets = [{ weight: 135, reps: 5, done: false }];
    const h = [skipped, session("2026-09-10", "back-squat", [[115, 5]])];
    expect(lastAttempt(h, "back-squat", 5)).toBe("115 lb × 5");
  });

  it("says nothing at all the first time", () => {
    expect(lastAttempt([], "back-squat", 5)).toBeUndefined();
  });
});

describe("changing the weight during rest", () => {
  const rest = (): Session => ({
    date: "2026-09-26",
    label: "Leg day",
    exercises: [
      {
        exerciseId: "back-squat",
        sets: [
          { weight: 45, reps: 8, done: true },
          { weight: 45, reps: 8, done: false },
          { weight: 45, reps: 8, done: false },
        ],
      },
      { exerciseId: "bench-press", sets: [{ weight: 45, reps: 8, done: false }] },
    ],
  });

  it("loads the set she is about to do, and the ones after it", () => {
    const out = loadNext(rest(), 0, "back-squat", 55);
    expect(out.exercises[0].sets.map((s) => s.weight)).toEqual([45, 55, 55]);
  });

  it("never touches a set already logged", () => {
    const out = loadNext(rest(), 0, "back-squat", 95);
    expect(out.exercises[0].sets[0]).toEqual({ weight: 45, reps: 8, done: true });
  });

  it("leaves every other lift where it was", () => {
    const out = loadNext(rest(), 0, "back-squat", 95);
    expect(out.exercises[1]).toEqual(rest().exercises[1]);
  });

  it("changes the lift the rest is open on, not another copy of it", () => {
    // A session can hold the same lift twice; the index is the one resting.
    const twice = rest();
    twice.exercises[1] = { exerciseId: "back-squat", sets: [{ weight: 45, reps: 8, done: false }] };
    const out = loadNext(twice, 1, "back-squat", 65);
    expect(out.exercises[0].sets.map((s) => s.weight)).toEqual([45, 45, 45]);
    expect(out.exercises[1].sets[0].weight).toBe(65);
  });

  it("does nothing when that lift has no set left to load", () => {
    const finished = rest();
    finished.exercises[0].sets = finished.exercises[0].sets.map((s) => ({ ...s, done: true }));
    expect(loadNext(finished, 0, "back-squat", 95)).toEqual(finished);
  });
});
