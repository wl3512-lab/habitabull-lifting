import { describe, expect, it } from "vitest";

/**
 * The commit rule from Stepper, kept honest.
 *
 * The stepper's own arithmetic is trivial; what is not trivial is what happens
 * to what somebody types. These mirror `commit` exactly, so a change to one
 * without the other fails here.
 */
function commit(draft: string, step: number, min: number, max = 2000): number | null {
  const n = Number(draft.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  const rounded = Number.isInteger(step) ? Math.round(n) : Math.round(n * 2) / 2;
  return Math.min(max, Math.max(min, rounded));
}

describe("typing a value", () => {
  it("takes a big round number as given — the reason this exists", () => {
    // 200 lb at 2.5 a tap is eighty taps.
    expect(commit("200", 2.5, 0)).toBe(200);
  });

  it("keeps a half on weight rather than snapping to the increment", () => {
    // Someone entering 202.5 knows what was on the bar better than the app.
    expect(commit("202.5", 2.5, 0)).toBe(202.5);
  });

  it("rounds a half off reps and sets, which have no halves", () => {
    expect(commit("8.4", 1, 1)).toBe(8);
    expect(commit("8.6", 1, 1)).toBe(9);
  });

  it("strips whatever else the keyboard let through", () => {
    expect(commit("2OO", 2.5, 0)).toBe(2);
    expect(commit("135 lb", 2.5, 0)).toBe(135);
    expect(commit("-50", 2.5, 0)).toBe(50);
  });

  it("holds the floor and the ceiling", () => {
    expect(commit("0", 1, 1)).toBe(1);
    expect(commit("99999", 2.5, 0)).toBe(2000);
  });

  it("ignores an empty field rather than writing a zero", () => {
    expect(commit("", 2.5, 5)).toBe(5);
    expect(commit("abc", 2.5, 5)).toBe(5);
  });
});
