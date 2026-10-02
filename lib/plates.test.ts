import { describe, expect, it } from "vitest";
import {
  addPlate,
  DEFAULT_BAR_LB,
  MAX_PLATES_PER_SIDE,
  offersPlates,
  platesFor,
  PLATES_LB,
  removePlate,
  totalWeight,
  withLoadTheBar,
} from "./plates";
import type { Profile } from "./types";

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

/*
  A tester tapped the 45 until the bar said 13,545 lb. Nothing in here knew a
  sleeve fills up, so every tap was another plate, another "45 ·" in the line
  under the drawing, and another sliver squeezed into a sleeve that had run out
  of room long before.
*/
describe("a full bar", () => {
  it("stops taking plates once the sleeve is full", () => {
    let side: number[] = [];
    for (let i = 0; i < 150; i++) side = addPlate(side, 45);
    expect(side).toHaveLength(MAX_PLATES_PER_SIDE);
    expect(totalWeight(DEFAULT_BAR_LB, side)).toBe(DEFAULT_BAR_LB + 2 * 45 * MAX_PLATES_PER_SIDE);
  });

  it("keeps a full sleeve as it was rather than swapping a plate out", () => {
    const full = Array.from({ length: MAX_PLATES_PER_SIDE }, () => 45);
    expect(addPlate(full, 2.5)).toBe(full);
  });

  it("never reads a number as more plates than a sleeve holds", () => {
    const { plates, achieved, exact, full } = platesFor(2000);
    expect(plates).toHaveLength(MAX_PLATES_PER_SIDE);
    expect(achieved).toBe(DEFAULT_BAR_LB + 2 * 45 * MAX_PLATES_PER_SIDE);
    expect(exact).toBe(false);
    expect(full).toBe(true);
  });

  it("is full, and exact, at exactly what the sleeve holds", () => {
    const most = DEFAULT_BAR_LB + 2 * 45 * MAX_PLATES_PER_SIDE;
    expect(platesFor(most).exact).toBe(true);
    expect(platesFor(most).full).toBe(true);
  });

  it("is not full on a heavy day that still fits", () => {
    expect(platesFor(585).plates).toEqual([45, 45, 45, 45, 45, 45]);
    expect(platesFor(585).full).toBe(false);
  });
});

/*
  The plate loader used to be a pick between two that sat on every barbell
  set whether she had ever wanted plates or not. Now it is offered or it is
  not, and the first barbell lift asks.
*/
describe("offering plates", () => {
  it("is her answer once she has given one", () => {
    expect(offersPlates({ loadTheBar: true })).toBe(true);
    expect(offersPlates({ loadTheBar: false, weightInput: "plates" })).toBe(false);
  });

  it("counts somebody who already used the switch as a yes", () => {
    expect(offersPlates({ weightInput: "plates" })).toBe(true);
    expect(offersPlates({ weightInput: "steppers" })).toBe(true);
  });

  it("is not asked yet when nothing says otherwise", () => {
    expect(offersPlates({})).toBeUndefined();
  });
});

/*
  The page in Profile writes the same answer the first barbell lift does, so
  turning it on there and saying yes at the rack cannot mean different things.
*/
describe("answering load the bar", () => {
  const her: Profile = {
    name: "QA",
    level: "new",
    equipment: ["barbell"],
    trainingDays: [1],
    createdAt: "2026-09-28T12:00:00Z",
    barLb: 35,
  };

  it("starts her on plates when she says yes", () => {
    const on = withLoadTheBar(her, true);
    expect(on.loadTheBar).toBe(true);
    expect(on.weightInput).toBe("plates");
    expect(offersPlates(on)).toBe(true);
  });

  it("is a yes even after she chose + and − on a set", () => {
    expect(withLoadTheBar({ ...her, loadTheBar: false, weightInput: "steppers" }, true).weightInput).toBe("plates");
  });

  it("says no without forgetting how she entered weights", () => {
    const off = withLoadTheBar({ ...her, loadTheBar: true, weightInput: "plates" }, false);
    expect(off.loadTheBar).toBe(false);
    expect(off.weightInput).toBe("plates");
    expect(offersPlates(off)).toBe(false);
  });

  it("leaves the rest of her profile alone, the bar included", () => {
    expect(withLoadTheBar(her, true)).toMatchObject({ name: "QA", barLb: 35 });
    expect(withLoadTheBar(her, false)).toMatchObject({ name: "QA", barLb: 35 });
    expect(her.loadTheBar).toBeUndefined();
  });
});
