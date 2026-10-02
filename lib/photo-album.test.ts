import { describe, expect, it } from "vitest";
import { apart, byMonth, newestFirst, photoSpan } from "./photo-album";

const TODAY = "2026-10-02";

describe("newestFirst", () => {
  it("orders by day, then by when the photo was added", () => {
    const out = newestFirst([
      { date: "2026-09-01", addedAt: "2026-09-01T08:00:00Z" },
      { date: "2026-10-01", addedAt: "2026-10-01T08:00:00Z" },
      { date: "2026-09-01", addedAt: "2026-09-01T19:00:00Z" },
    ]);
    expect(out.map((p) => `${p.date} ${p.addedAt?.slice(11, 13)}`)).toEqual([
      "2026-10-01 08",
      "2026-09-01 19",
      "2026-09-01 08",
    ]);
  });

  it("leaves the input alone", () => {
    const input = [{ date: "2026-01-01" }, { date: "2026-02-01" }];
    newestFirst(input);
    expect(input[0].date).toBe("2026-01-01");
  });
});

describe("byMonth", () => {
  it("groups newest month first, newest photo first inside each", () => {
    const groups = byMonth(
      [
        { date: "2026-08-03" },
        { date: "2026-10-01" },
        { date: "2026-08-28" },
        { date: "2026-09-15" },
        { date: "2026-10-02" },
      ],
      TODAY
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(groups[0].photos.map((p) => p.date)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(groups[2].photos.map((p) => p.date)).toEqual(["2026-08-28", "2026-08-03"]);
  });

  it("names this year's months plainly and older ones with their year", () => {
    const groups = byMonth([{ date: "2026-03-09" }, { date: "2025-12-30" }], TODAY);
    expect(groups.map((g) => g.label)).toEqual(["March", "December 2025"]);
  });

  it("keeps the same month of different years apart", () => {
    const groups = byMonth([{ date: "2026-03-01" }, { date: "2025-03-01" }], TODAY);
    expect(groups.map((g) => g.label)).toEqual(["March", "March 2025"]);
  });

  it("returns nothing for no photos", () => {
    expect(byMonth([], TODAY)).toEqual([]);
  });
});

describe("apart", () => {
  it("calls one day the same day", () => {
    expect(apart("2026-10-02", "2026-10-02")).toBe("Same day");
  });

  it("counts days under two weeks, singular at one", () => {
    expect(apart("2026-10-01", "2026-10-02")).toBe("1 day apart");
    expect(apart("2026-09-19", "2026-10-02")).toBe("13 days apart");
  });

  it("counts whole weeks from two weeks to a month", () => {
    expect(apart("2026-09-18", "2026-10-02")).toBe("2 weeks apart");
    expect(apart("2026-09-05", "2026-10-02")).toBe("3 weeks apart");
  });

  it("counts whole calendar months and never rounds up", () => {
    expect(apart("2026-09-02", "2026-10-02")).toBe("1 month apart");
    expect(apart("2026-03-03", "2026-07-02")).toBe("3 months apart");
    expect(apart("2026-03-03", "2026-07-03")).toBe("4 months apart");
  });

  it("does not call the end of one month to the end of a shorter one a month", () => {
    expect(apart("2026-01-31", "2026-02-28")).toBe("4 weeks apart");
  });

  it("says years, and the months left over", () => {
    expect(apart("2025-10-02", "2026-10-02")).toBe("1 year apart");
    expect(apart("2024-06-10", "2026-09-12")).toBe("2 years and 3 months apart");
    expect(apart("2025-09-02", "2026-10-02")).toBe("1 year and 1 month apart");
  });

  it("reads the same whichever photo is passed first", () => {
    expect(apart("2026-10-02", "2026-03-03")).toBe(apart("2026-03-03", "2026-10-02"));
  });

  it("is not thrown by a daylight saving change", () => {
    // 29 March 2026 is 23 hours long in most of Europe.
    expect(apart("2026-03-20", "2026-04-02")).toBe("13 days apart");
  });
});

describe("photoSpan", () => {
  it("is empty with nothing to count", () => {
    expect(photoSpan([], TODAY)).toBe("");
  });

  it("says so for a single photo", () => {
    expect(photoSpan([{ date: "2026-03-03" }], TODAY)).toBe("1 photo so far");
  });

  it("names the month of the first photo", () => {
    expect(
      photoSpan([{ date: "2026-10-01" }, { date: "2026-03-03" }, { date: "2026-06-11" }], TODAY)
    ).toBe("3 photos since March");
  });

  it("adds the year once the first photo is from another one", () => {
    expect(photoSpan([{ date: "2026-10-01" }, { date: "2025-11-20" }], TODAY)).toBe(
      "2 photos since November 2025"
    );
  });

  it("says this month rather than since this month", () => {
    expect(photoSpan([{ date: "2026-10-01" }, { date: "2026-10-02" }], TODAY)).toBe(
      "2 photos this month"
    );
  });
});
