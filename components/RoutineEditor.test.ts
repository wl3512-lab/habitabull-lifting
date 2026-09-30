import { describe, expect, it } from "vitest";
import { byId, EXERCISES } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

/**
 * The rep stepper's step, from the routine editor, kept honest.
 *
 * Mirrors the rule in RoutineEditor (and the one in SetRow, which is the same
 * rule): fives for anything counted in time, ones for anything counted in
 * reps. It used to read `increment === 0`, which is a test for "no weight on
 * it" and not for "counted in seconds", so every unloaded lift stepped in
 * fives. The cases below are the real library, so the next person who reaches
 * for `increment` here fails on a pull-up rather than shipping it.
 */
function repStep(ex: Exercise): number {
  return ex.cardio || ex.hold ? 5 : 1;
}

describe("stepping the planned reps", () => {
  it("moves a pull-up by one, not five", () => {
    // Six pull-ups is a number people have; the old rule skipped it for ten.
    expect(repStep(byId("pull-up")!)).toBe(1);
  });

  it("moves every other unloaded lift by one too", () => {
    for (const id of ["push-up", "dip", "inverted-row", "bodyweight-squat", "pike-push-up"]) {
      expect(repStep(byId(id)!), id).toBe(1);
    }
  });

  it("keeps fives for the things counted in time", () => {
    expect(repStep(byId("plank")!)).toBe(5);
    expect(repStep(byId("treadmill")!)).toBe(5);
  });

  it("gives fives to nothing else in the library", () => {
    const fives = EXERCISES.filter((e) => repStep(e) === 5).map((e) => e.id);
    expect(fives.every((id) => byId(id)!.hold || byId(id)!.cardio)).toBe(true);
    expect(fives).not.toContain("pull-up");
  });
});
