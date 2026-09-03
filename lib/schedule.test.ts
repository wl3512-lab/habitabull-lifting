import { describe, expect, it } from "vitest";
import {
  ANCHORS,
  anchorOf,
  hasBackToBack,
  parseAvailability,
  placeDays,
  planWeek,
  spread,
  anchorForHour,
  observedAnchor,
  primaryAnchor,
  anchorLabel,
} from "./schedule";

describe("placeDays", () => {
  it("spreads two and three sessions with a rest day between each", () => {
    expect(hasBackToBack(placeDays(2))).toBe(false);
    expect(hasBackToBack(placeDays(3))).toBe(false);
  });

  it("returns the number of days asked for", () => {
    for (let n = 1; n <= 7; n++) expect(placeDays(n)).toHaveLength(n);
  });

  it("clamps nonsense counts instead of returning undefined", () => {
    expect(placeDays(0)).toHaveLength(1);
    expect(placeDays(99)).toHaveLength(7);
  });

  it("uses two pairs for four, since four non-consecutive days do not fit in a week", () => {
    expect(placeDays(4)).toEqual([1, 2, 4, 5]);
  });
});

describe("anchors", () => {
  it("every anchor has a usable hour for the calendar reminder", () => {
    for (const a of ANCHORS) {
      expect(a.minute).toBeGreaterThan(0);
      expect(a.minute).toBeLessThan(24 * 60);
    }
  });

  it("resolves by id", () => {
    expect(anchorOf("afterwork").minute).toBe(18 * 60);
  });
});

describe("parseAvailability", () => {
  it("reads named days", () => {
    expect(parseAvailability("mondays and thursdays").days).toEqual([1, 4]);
  });

  it("separates days ruled out from days chosen", () => {
    const a = parseAvailability("free most evenings but wednesdays are bad");
    expect(a.avoid).toContain(3);
    expect(a.days).not.toContain(3);
    expect(a.anchor).toBe("evening");
  });

  it("handles 'not' and 'except' phrasing", () => {
    expect(parseAvailability("any day except friday").avoid).toContain(5);
    expect(parseAvailability("not on sundays").avoid).toContain(0);
  });

  it("reads a session count as digits or words", () => {
    expect(parseAvailability("3 times a week").count).toBe(3);
    expect(parseAvailability("two days a week").count).toBe(2);
  });

  it("reads the shorthand people actually use", () => {
    expect(parseAvailability("twice a week, mornings").count).toBe(2);
    expect(parseAvailability("once a week").count).toBe(1);
  });

  it("ignores an absurd count rather than trusting it", () => {
    expect(parseAvailability("40 days a week").count).toBeUndefined();
  });

  it("picks up a routine anchor without any day named", () => {
    expect(parseAvailability("after work usually").anchor).toBe("afterwork");
    expect(parseAvailability("first thing in the morning").anchor).toBe("wake");
    expect(parseAvailability("around lunch").anchor).toBe("lunch");
  });

  it("returns empty rather than guessing when nothing is stated", () => {
    const a = parseAvailability("hello");
    expect(a.days).toEqual([]);
    expect(a.avoid).toEqual([]);
    expect(a.anchor).toBeUndefined();
    expect(a.count).toBeUndefined();
  });
});

describe("planWeek", () => {
  it("uses the days someone actually named when the count matches", () => {
    expect(planWeek({ days: [2, 4], avoid: [], count: 2 })).toEqual([2, 4]);
  });

  it("treats a long availability list as availability, not as frequency", () => {
    // "Free most evenings but not Wednesday" lists six days and asks for none.
    const week = planWeek({ days: [0, 1, 2, 4, 5, 6], avoid: [3] });
    expect(week).toHaveLength(3);
    expect(week).not.toContain(3);
  });

  it("spreads the chosen days instead of taking the first few in a row", () => {
    expect(hasBackToBack(planWeek({ days: [0, 1, 2, 4, 5, 6], avoid: [3] }))).toBe(false);
  });

  it("never schedules more than the guidance default without being asked", () => {
    expect(planWeek({ days: [0, 1, 2, 3, 4, 5, 6], avoid: [] })).toHaveLength(3);
  });

  it("falls back to the standard spread when no days are named", () => {
    expect(planWeek({ days: [], avoid: [] })).toEqual([1, 3, 5]);
  });

  it("steps around days that were ruled out", () => {
    const week = planWeek({ days: [], avoid: [3] });
    expect(week).not.toContain(3);
    expect(week).toHaveLength(3);
  });

  it("honours a stated count over the default", () => {
    expect(planWeek({ days: [], avoid: [], count: 2 })).toHaveLength(2);
  });

  it("still fills a week when most days are ruled out", () => {
    const week = planWeek({ days: [], avoid: [0, 1, 2, 3], count: 3 });
    expect(week).toHaveLength(3);
    expect(week.every((d) => ![0, 1, 2, 3].includes(d))).toBe(true);
  });

  it("trims to the count when more days were named than asked for", () => {
    expect(planWeek({ days: [1, 2, 3, 4, 5], avoid: [], count: 2 })).toHaveLength(2);
  });

  it("drops a named day that was also ruled out", () => {
    expect(planWeek({ days: [1, 3], avoid: [3], count: 2 })).not.toContain(3);
  });
});

describe("spread", () => {
  it("returns everything when there is nothing to trim", () => {
    expect(spread([1, 3], 3)).toEqual([1, 3]);
  });

  it("picks evenly spaced days from a full week", () => {
    expect(spread([0, 1, 2, 3, 4, 5, 6], 3)).toEqual([0, 2, 4]);
  });

  it("dedupes and sorts before choosing", () => {
    expect(spread([5, 1, 1, 3], 2)).toEqual([1, 3]);
  });
});

describe("anchorForHour", () => {
  it("buckets the day", () => {
    expect(anchorForHour(7)).toBe("wake");
    expect(anchorForHour(12)).toBe("lunch");
    expect(anchorForHour(18)).toBe("afterwork");
    expect(anchorForHour(21)).toBe("evening");
  });

  it("treats the small hours as evening, not morning", () => {
    expect(anchorForHour(0)).toBe("evening");
    expect(anchorForHour(4)).toBe("evening");
  });
});

describe("observedAnchor", () => {
  const at = (hour: number) => ({
    completedAt: new Date(2026, 8, 1, hour, 0).toISOString(),
  });

  it("says nothing without a real sample", () => {
    expect(observedAnchor([at(21), at(22)])).toBeNull();
  });

  it("ignores sessions that were never finished", () => {
    expect(observedAnchor([{}, {}, {}, {}, {}, at(21)])).toBeNull();
  });

  it("finds the part of the day she actually trains in", () => {
    const o = observedAnchor([at(21), at(22), at(20), at(23), at(21)]);
    expect(o?.anchor).toBe("evening");
    expect(o?.count).toBe(5);
    expect(o?.total).toBe(5);
  });

  it("stays quiet when the habit is genuinely scattered", () => {
    expect(observedAnchor([at(7), at(12), at(18), at(21), at(8), at(13)])).toBeNull();
  });

  it("reports a clear majority even with some spread", () => {
    const o = observedAnchor([at(21), at(22), at(20), at(7), at(12)]);
    expect(o?.anchor).toBe("evening");
    expect(o?.count).toBe(3);
  });
});

describe("multiple anchors", () => {
  it("takes the earliest slot when one hour is needed", () => {
    expect(primaryAnchor(["evening", "wake"])).toBe("wake");
  });

  it("has no primary when the day genuinely varies", () => {
    expect(primaryAnchor([])).toBeUndefined();
    expect(primaryAnchor(undefined)).toBeUndefined();
  });

  it("reads back the way someone would say it", () => {
    expect(anchorLabel(["afterwork"])).toBe("after work");
    expect(anchorLabel(["evening", "wake"])).toBe("first thing or evening");
    expect(anchorLabel(["wake", "lunch", "evening"])).toBe("first thing, lunchtime or evening");
  });

  it("treats an empty list as a real answer, not a missing one", () => {
    expect(anchorLabel([])).toBe("whenever you can");
    expect(anchorLabel(undefined)).toBeNull();
  });
});

describe("placeDays starting today", () => {
  const DAYS = [0, 1, 2, 3, 4, 5, 6];

  it("includes today whatever day it is", () => {
    // Signing up on a Thursday and being told "Rest day" was the app's first
    // sentence to someone who came to lift.
    for (const today of DAYS) {
      expect(placeDays(3, today)).toContain(today);
    }
  });

  it.each(DAYS)("keeps three non-consecutive days when starting on day %i", (today) => {
    const days = placeDays(3, today);
    expect(days).toHaveLength(3);
    expect(hasBackToBack(days)).toBe(false);
  });

  it("keeps the shape for every count", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      for (const today of DAYS) {
        const days = placeDays(n, today);
        expect(days).toHaveLength(placeDays(n).length);
        expect(new Set(days).size).toBe(days.length);
        expect(days).toContain(today);
        expect(days).toEqual([...days].sort((a, b) => a - b));
      }
    }
  });

  it("is unchanged when no day is given", () => {
    expect(placeDays(3)).toEqual([1, 3, 5]);
    expect(placeDays(2)).toEqual([1, 4]);
  });
});
