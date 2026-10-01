import { describe, expect, it } from "vitest";
import { strengthPicks } from "./LiftSearch";
import { byId } from "@/lib/exercises";
import type { Equipment } from "@/lib/types";

/**
 * What the add-a-lift picker offers before anything is typed, in the editor
 * and mid-session. These are the real library, so a change to the data that
 * would put a treadmill under "Suggested for leg day" fails here first.
 */
const kit: Equipment[] = ["barbell", "dumbbell", "machine"];

describe("what the picker suggests", () => {
  it("never offers a cardio machine as a strength lift", () => {
    // Treadmill is filed under quads and Stairmaster under glutes.
    const legs = strengthPicks(["quads", "hamstrings", "glutes"], kit, [], [], 6, 20);
    expect(legs.length).toBeGreaterThan(0);
    expect(legs.some((e) => e.cardio)).toBe(false);
    expect(legs.map((e) => e.id)).not.toContain("treadmill");
    expect(legs.map((e) => e.id)).not.toContain("stairmaster");
  });

  it("leaves out what is already on the day", () => {
    const first = strengthPicks(["back"], kit, [], [], 2);
    const after = strengthPicks(["back"], kit, [first[0].id], [], 2);
    expect(after.map((e) => e.id)).not.toContain(first[0].id);
  });

  it("takes the asked-for number per muscle, each lift once, up to the cap", () => {
    const pull = strengthPicks(["back", "hamstrings", "back", "arms"], kit, [], [], 2);
    const ids = pull.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pull.length).toBeLessThanOrEqual(6);
    for (const m of ["back", "hamstrings", "arms"]) {
      expect(pull.filter((e) => e.primary === m).length).toBeLessThanOrEqual(2);
    }
  });

  it("puts a starred lift first for its muscle", () => {
    const plain = strengthPicks(["arms"], kit, [], [], 3);
    const last = plain[plain.length - 1];
    const starred = strengthPicks(["arms"], kit, [], [last.id], 3);
    expect(starred[0].id).toBe(last.id);
  });

  it("only offers what the kit allows", () => {
    const bodyweightOnly = strengthPicks(["chest", "back", "quads"], [], [], [], 2);
    expect(bodyweightOnly.every((e) => byId(e.id)!.equipment === "bodyweight")).toBe(true);
  });
});
