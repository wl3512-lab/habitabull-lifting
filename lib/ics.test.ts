import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, firstOccurrence, foldLine } from "./ics";

const profile = { trainingDays: [1, 3, 5], trainingMinute: 18 * 60 + 30, motivation: "It clears my head." };

describe("escapeText", () => {
  it("escapes the RFC 5545 specials", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
  });

  it("escapes backslashes before anything else, so they do not double", () => {
    expect(escapeText("\\,")).toBe("\\\\\\,");
  });

  it("turns newlines into literal \\n", () => {
    expect(escapeText("one\ntwo")).toBe("one\\ntwo");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Training")).toBe("SUMMARY:Training");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldLine("X:" + "a".repeat(200)).split("\r\n");
    expect(folded[0]).toHaveLength(75);
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });
});

describe("firstOccurrence", () => {
  it("uses today when today is a training day and the time has not passed", () => {
    // 2026-09-02 is a Wednesday.
    const d = firstOccurrence([1, 3, 5], 18 * 60 + 30, new Date(2026, 8, 2, 9, 0));
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(18);
  });

  it("rolls to the next training day once today's time has passed", () => {
    const d = firstOccurrence([1, 3, 5], 18 * 60 + 30, new Date(2026, 8, 2, 20, 0));
    expect(d.getDate()).toBe(4); // Friday
  });

  it("wraps across the week boundary", () => {
    // Saturday 2026-09-05 -> next is Monday the 7th.
    const d = firstOccurrence([1], 18 * 60 + 30, new Date(2026, 8, 5, 9, 0));
    expect(d.getDate()).toBe(7);
  });
});

describe("buildIcs", () => {
  const now = new Date(2026, 8, 2, 9, 0);

  it("returns null when there is nothing to schedule", () => {
    expect(buildIcs({ trainingDays: [], trainingMinute: 1110 }, now)).toBeNull();
    expect(buildIcs({ trainingDays: [1], trainingMinute: undefined }, now)).toBeNull();
  });

  it("emits a weekly rule for the chosen days", () => {
    expect(buildIcs(profile, now)).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("uses a floating local start so the hour survives a timezone change", () => {
    const ics = buildIcs(profile, now)!;
    expect(ics).toContain("DTSTART:20260902T183000");
    expect(ics).not.toContain("DTSTART;TZID");
  });

  it("carries an alarm before the session", () => {
    expect(buildIcs(profile, now)).toContain("TRIGGER:-PT15M");
  });

  it("quotes her reason verbatim and escapes it", () => {
    const ics = buildIcs({ ...profile, motivation: "Strong; steady, always" }, now)!;
    expect(ics).toContain("DESCRIPTION:You said: Strong\\; steady\\, always");
  });

  it("falls back to a neutral line when no reason was given", () => {
    const ics = buildIcs({ trainingDays: [1], trainingMinute: 1110 }, now)!;
    expect(ics).toContain("Showing up is the whole thing.");
  });

  it("is a well-formed calendar with CRLF endings", () => {
    const ics = buildIcs(profile, now)!;
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n");
  });

  it("sorts days regardless of the order they were tapped", () => {
    const ics = buildIcs({ ...profile, trainingDays: [5, 1, 3] }, now)!;
    expect(ics).toContain("BYDAY=MO,WE,FR");
  });
});
