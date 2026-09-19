import { describe, expect, it } from "vitest";
import { line, midsetLine } from "./voice";

describe("midsetLine", () => {
  /*
    The bug: "One more set." and "Halfway. Stay with it." sat in the random
    `midset` pool, so both were said with four lifts still to go. A voice that
    states a number has to be right about it.
  */
  it("counts only when the count is true", () => {
    expect(midsetLine(1, 0)).toBe("One lift left.");
    expect(midsetLine(2, 0)).toBe("Two lifts to go.");
  });

  /*
    "Next one." is in the pool and is fine: it points at the next lift without
    claiming how many there are. What may never appear is a quantity — a digit,
    or a number word doing the work of one.
  */
  const COUNTS = /\d|one more|two (?:to go|left)|halfway|last (?:lift|set)/i;

  it("never counts once the number is too big to be encouraging", () => {
    for (const left of [3, 4, 7]) {
      for (let seed = 0; seed < 6; seed++) {
        expect(midsetLine(left, seed)).not.toMatch(COUNTS);
      }
    }
  });

  it("has no numeric claim anywhere in the pool it falls back to", () => {
    for (let seed = 0; seed < 12; seed++) {
      expect(line("midset", seed)).not.toMatch(COUNTS);
    }
  });
});
