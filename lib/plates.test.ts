import { describe, expect, it } from "vitest";
import { addPlate, DEFAULT_BAR_LB, platesFor, PLATES_LB, removePlate, totalWeight } from "./plates";

describe("totalWeight", () => {
  it("counts both sides, which is the whole point", () => {
    expect(totalWeight(45, [45])).toBe(135);
    expect(totalWeight(45, [45, 25, 5])).toBe(195);
  });

  it("is the bare bar with nothing on it", () => {
    expect(totalWeight(45, [])).toBe(45);
  });

  it("handles a bar that is not 45", () => {
    expect(totalWeight(35, [10])).toBe(55);
    expect(totalWeight(0, [10, 10])).toBe(40);
  });
});

describe("platesFor", () => {
  it("loads the numbers people actually call out", () => {
    expect(platesFor(135).plates).toEqual([45]);
    expect(platesFor(225).plates).toEqual([45, 45]);
    expect(platesFor(185).plates).toEqual([45, 25]);
    expect(platesFor(95).plates).toEqual([25]);
  });

  it("reaches the awkward ones with the small plates", () => {
    const { plates, achieved, exact } = platesFor(100);
    expect(totalWeight(DEFAULT_BAR_LB, plates)).toBe(100);
    expect(achieved).toBe(100);
    expect(exact).toBe(true);
  });

  /*
    2.5s make thirds of a pound out of floating point: 47.5 - 45 is
    2.4999999999999996, and a greedy loop that compares against 2.5 leaves the
    last plate off forever.
  */
  it("does not lose the last small plate to floating point", () => {
    expect(platesFor(50).plates).toEqual([2.5]);
    expect(platesFor(50).exact).toBe(true);
  });

  it("says so when a number cannot be loaded", () => {
    const { achieved, exact } = platesFor(47.5);
    expect(exact).toBe(false);
    expect(achieved).toBe(45);
  });

  it("is an empty bar below the bar's own weight", () => {
    expect(platesFor(20).plates).toEqual([]);
    expect(platesFor(45).plates).toEqual([]);
    expect(platesFor(45).exact).toBe(true);
  });

  it("respects a different bar", () => {
    expect(platesFor(75, 35).plates).toEqual([10, 10]);
    expect(totalWeight(35, platesFor(75, 35).plates)).toBe(75);
  });

  it("respects a gym that has no 25s", () => {
    const kit = [45, 10, 5, 2.5];
    const { plates } = platesFor(135, 45, kit);
    expect(plates).toEqual([45]);
    const { plates: p2 } = platesFor(95, 45, kit);
    expect(totalWeight(45, p2)).toBe(95);
    expect(p2).toEqual([10, 10, 5]);
  });
});

describe("adding and taking off", () => {
  it("keeps the stack heaviest first, because it is drawn", () => {
    expect(addPlate([45], 25)).toEqual([45, 25]);
    expect(addPlate([25], 45)).toEqual([45, 25]);
  });

  it("takes off one plate, not every plate of that size", () => {
    expect(removePlate([45, 45, 25], 45)).toEqual([45, 25]);
  });

  it("ignores a plate that is not on the bar", () => {
    expect(removePlate([45], 25)).toEqual([45]);
  });

  it("round-trips every denomination", () => {
    for (const p of PLATES_LB) {
      expect(removePlate(addPlate([], p), p)).toEqual([]);
    }
  });
});
