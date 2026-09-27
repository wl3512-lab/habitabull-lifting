import { describe, expect, it } from "vitest";
import {
  comebackDates,
  longestComebackGap,
  monthMatrix,
  sessionsInMonth,
  weekStrip,
  yearCounts,
} from "./calendar";
import type { Session } from "./types";

const session = (date: string, completed = true): Session => ({
  date,
  label: "Test",
  exercises: [],
  ...(completed ? { completedAt: `${date}T18:30:00.000Z` } : {}),
});

describe("monthMatrix", () => {
  it("pads to whole weeks and starts on Sunday", () => {
    // May 2024: 1st is a Wednesday, 31 days.
    const rows = monthMatrix(2024, 4, [], [], new Date(2024, 4, 15));
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows[0].slice(0, 3).every((c) => c.iso === null)).toBe(true);
    expect(rows[0][3].day).toBe(1);
    expect(rows.flat().filter((c) => c.day !== null)).toHaveLength(31);
  });

  it("handles a month that starts on Sunday with no leading pad", () => {
    // September 2024 starts on a Sunday.
    const rows = monthMatrix(2024, 8, [], [], new Date(2024, 8, 10));
    expect(rows[0][0].day).toBe(1);
  });

  it("handles February in a leap year", () => {
    const rows = monthMatrix(2024, 1, [], [], new Date(2024, 1, 10));
    expect(rows.flat().filter((c) => c.day !== null)).toHaveLength(29);
  });

  it("marks trained days, today and future days", () => {
    const rows = monthMatrix(
      2024,
      4,
      [session("2024-05-06"), session("2024-05-08")],
      [],
      new Date(2024, 4, 10)
    );
    const cells = rows.flat();
    expect(cells.find((c) => c.day === 6)?.trained).toBe(true);
    expect(cells.find((c) => c.day === 7)?.trained).toBe(false);
    expect(cells.find((c) => c.day === 10)?.today).toBe(true);
    expect(cells.find((c) => c.day === 11)?.future).toBe(true);
    expect(cells.find((c) => c.day === 9)?.future).toBe(false);
  });

  it("does not mark an uncompleted draft session as trained", () => {
    const rows = monthMatrix(2024, 4, [session("2024-05-06", false)], [], new Date(2024, 4, 10));
    expect(rows.flat().find((c) => c.day === 6)?.trained).toBe(false);
  });

  it("flags days that have a progress photo", () => {
    const rows = monthMatrix(2024, 4, [], ["2024-05-03"], new Date(2024, 4, 10));
    expect(rows.flat().find((c) => c.day === 3)?.hasPhoto).toBe(true);
    expect(rows.flat().find((c) => c.day === 4)?.hasPhoto).toBe(false);
  });
});

describe("comebackDates", () => {
  it("marks the first session back after a week or more", () => {
    const s = [session("2024-05-01"), session("2024-05-03"), session("2024-05-20")];
    expect([...comebackDates(s)]).toEqual(["2024-05-20"]);
  });

  it("ignores normal rest gaps", () => {
    const s = [session("2024-05-01"), session("2024-05-04"), session("2024-05-06")];
    expect(comebackDates(s).size).toBe(0);
  });

  it("counts a gap of exactly seven days", () => {
    const s = [session("2024-05-01"), session("2024-05-08")];
    expect(comebackDates(s).has("2024-05-08")).toBe(true);
  });

  it("is order-independent", () => {
    const s = [session("2024-05-20"), session("2024-05-01")];
    expect([...comebackDates(s)]).toEqual(["2024-05-20"]);
  });
});

describe("longestComebackGap", () => {
  it("returns the biggest break actually returned from", () => {
    const s = [session("2024-05-01"), session("2024-05-12"), session("2024-06-05")];
    expect(longestComebackGap(s)).toBe(24);
  });

  it("is zero when she has never taken a week off", () => {
    expect(longestComebackGap([session("2024-05-01"), session("2024-05-03")])).toBe(0);
  });

  it("is zero with a single session, because a gap needs two ends", () => {
    expect(longestComebackGap([session("2024-05-01")])).toBe(0);
  });
});

describe("month and year counts", () => {
  it("counts only completed sessions inside the month", () => {
    const s = [
      session("2024-05-01"),
      session("2024-05-30"),
      session("2024-06-01"),
      session("2024-05-15", false),
    ];
    expect(sessionsInMonth(s, 2024, 4)).toBe(2);
    expect(sessionsInMonth(s, 2024, 5)).toBe(1);
  });

  it("does not confuse months across years", () => {
    expect(sessionsInMonth([session("2023-05-01")], 2024, 4)).toBe(0);
  });

  it("returns twelve months in order", () => {
    const counts = yearCounts([session("2024-01-02"), session("2024-12-31")], 2024);
    expect(counts).toHaveLength(12);
    expect(counts[0]).toBe(1);
    expect(counts[11]).toBe(1);
    expect(counts[5]).toBe(0);
  });
});

describe("weekStrip", () => {
  // Wednesday 2024-05-15. The week containing it runs Sun 12th to Sat 18th.
  const WED = "2024-05-15";

  it("runs Sunday to Saturday around the given day", () => {
    const days = weekStrip([], [], WED);
    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe("2024-05-12");
    expect(days[6].iso).toBe("2024-05-18");
    expect(days.map((d) => d.initial).join("")).toBe("SMTWTFS");
  });

  it("indexes Sunday-first so trainingDays lines up with getDay()", () => {
    // Monday and Thursday.
    const days = weekStrip([], [1, 4], WED);
    expect(days.filter((d) => d.planned).map((d) => d.iso)).toEqual([
      "2024-05-13",
      "2024-05-16",
    ]);
    expect(days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("marks today, and only today", () => {
    const days = weekStrip([], [], WED);
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual([WED]);
  });

  it("counts only completed sessions as trained", () => {
    const days = weekStrip([session("2024-05-13"), session("2024-05-14", false)], [], WED);
    expect(days.filter((d) => d.trained).map((d) => d.iso)).toEqual(["2024-05-13"]);
  });

  it("ignores sessions from other weeks", () => {
    const days = weekStrip([session("2024-05-11"), session("2024-05-19")], [], WED);
    expect(days.some((d) => d.trained)).toBe(false);
  });

  it("calls a planned day upcoming only while it is still ahead", () => {
    // Every day planned: Mon and Tue are behind Wednesday, Thu onward is not.
    const days = weekStrip([], [0, 1, 2, 3, 4, 5, 6], WED);
    expect(days.filter((d) => d.upcoming).map((d) => d.iso)).toEqual([
      "2024-05-16",
      "2024-05-17",
      "2024-05-18",
    ]);
  });

  /*
    The version that lived inside Today built each date with `toISOString()` on
    a Date at local midnight, which is a UTC conversion: east of UTC it rolled
    every day in the strip back by one, so a Wednesday session lit up Tuesday's
    dot. This runs the whole strip through the same local-time helper the rest
    of the file uses, and the assertion that catches a regression is that the
    day marked today is the day that was asked for.
  */
  it("holds in a timezone east of UTC", () => {
    const tz = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      const days = weekStrip([session(WED)], [3], WED);
      expect(days[3].iso).toBe(WED);
      expect(days[3].isToday).toBe(true);
      expect(days[3].trained).toBe(true);
      expect(days[3].planned).toBe(true);
    } finally {
      process.env.TZ = tz;
    }
  });
});
