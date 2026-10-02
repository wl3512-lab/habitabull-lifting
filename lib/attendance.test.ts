import { describe, expect, it } from "vitest";
import { attended, checkinDates } from "./attendance";
import type { Session } from "./types";

const lift = (done: boolean[]) => ({
  exerciseId: "back-squat",
  sets: done.map((d) => ({ weight: 135, reps: 5, done: d })),
});

const base: Session = { date: "2026-09-28", label: "Leg day", exercises: [] };

describe("attended", () => {
  it("counts a finished session", () => {
    expect(
      attended({ ...base, completedAt: "2026-09-28T18:30:00.000Z", exercises: [lift([true, true])] })
    ).toBe(true);
  });

  it("counts a session she stopped partway, once a set is logged", () => {
    // What End leaves behind: no completedAt, sets still on the card.
    expect(attended({ ...base, exercises: [lift([true, false, false]), lift([false, false])] })).toBe(
      true
    );
  });

  it("counts a logged set on any lift, not only the first", () => {
    expect(attended({ ...base, exercises: [lift([false, false]), lift([false, true])] })).toBe(true);
  });

  it("does not count a session she started and logged nothing in", () => {
    expect(attended({ ...base, exercises: [lift([false, false, false])] })).toBe(false);
  });

  it("does not count an empty quick workout", () => {
    const quick: Session = { ...base, freestyle: true };
    expect(attended(quick)).toBe(false);
  });

  it("counts a finished day on completedAt alone", () => {
    // Finish used to stamp completedAt whether or not a set was logged, so older
    // saves can hold one with nothing in it. Those days were on the calendar
    // before this, and nothing here takes a day away from her.
    expect(attended({ ...base, completedAt: "2026-09-28T18:30:00.000Z" })).toBe(true);
  });
});

describe("checkinDates", () => {
  const TODAY = "2026-09-30";
  const day = (date: string, over: Partial<Session> = {}): Session => ({ ...base, date, ...over });

  it("tells the crew about a finished day, today included", () => {
    const s = [
      day("2026-09-28", { completedAt: "2026-09-28T18:30:00.000Z", exercises: [lift([true])] }),
      day(TODAY, { completedAt: `${TODAY}T18:30:00.000Z`, exercises: [lift([true])] }),
    ];
    expect(checkinDates(s, TODAY)).toEqual(["2026-09-28", TODAY]);
  });

  it("tells them about a day she stopped partway, once that day is over", () => {
    expect(checkinDates([day("2026-09-29", { exercises: [lift([true, false])] })], TODAY)).toEqual([
      "2026-09-29",
    ]);
  });

  it("keeps today's open session to herself until she finishes it", () => {
    expect(checkinDates([day(TODAY, { exercises: [lift([true, false])] })], TODAY)).toEqual([]);
  });

  it("never tells them about a day she logged nothing in", () => {
    expect(checkinDates([day("2026-09-29", { exercises: [lift([false])] })], TODAY)).toEqual([]);
  });
});
