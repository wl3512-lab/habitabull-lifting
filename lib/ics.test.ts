import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, firstOccurrence, foldLine, googleUrl } from "./ics";

const profile = {
  trainingDays: [1, 3, 5],
  trainingMinute: 18 * 60 + 30,
  motivation: "It clears my head.",
};

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

  it("returns null only when there are no training days", () => {
    expect(buildIcs({ trainingDays: [], trainingMinute: 1110 }, now)).toBeNull();
  });

  it("still writes a reminder when the day genuinely varies", () => {
    // "Whenever I can" gets a calendar entry she can drag, not silence.
    const ics = buildIcs({ trainingDays: [1], trainingMinute: undefined, anchors: [] }, now);
    expect(ics).toContain("DTSTART:");
    expect(ics).toContain("BYDAY=MO");
  });

  it("takes its hour from the earliest slot she chose", () => {
    const ics = buildIcs(
      { trainingDays: [3], trainingMinute: undefined, anchors: ["evening", "wake"] },
      now
    )!;
    // wake is 07:00 and comes before evening.
    expect(ics).toMatch(/DTSTART:\d{8}T0700/);
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

describe("googleUrl", () => {
  const now = new Date(2026, 8, 2, 9, 0); // Wednesday

  it("returns null only when there are no training days", () => {
    expect(googleUrl({ trainingDays: [], trainingMinute: 1110 }, now)).toBeNull();
  });

  it("carries the same recurrence rule as the .ics, so the two cannot drift", () => {
    const url = googleUrl(profile, now)!;
    const recur = new URL(url).searchParams.get("recur");
    expect(recur).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(buildIcs(profile, now)).toContain(recur!.replace("RRULE:", "RRULE:"));
  });

  it("starts at the same moment the .ics does", () => {
    const dates = new URL(googleUrl(profile, now)!).searchParams.get("dates")!;
    const [start] = dates.split("/");
    expect(buildIcs(profile, now)).toContain(`DTSTART:${start}`);
  });

  it("books 45 minutes", () => {
    const [start, end] = new URL(googleUrl(profile, now)!).searchParams.get("dates")!.split("/");
    const mins = (s: string) => Number(s.slice(9, 11)) * 60 + Number(s.slice(11, 13));
    expect(mins(end) - mins(start)).toBe(45);
  });

  it("uses local wall-clock, never UTC, so the hour survives a timezone change", () => {
    expect(new URL(googleUrl(profile, now)!).searchParams.get("dates")).not.toContain("Z");
  });

  it("quotes her reason without the app rewriting it", () => {
    const url = googleUrl({ ...profile, motivation: "It clears my head." }, now)!;
    expect(new URL(url).searchParams.get("details")).toBe("You said: It clears my head.");
  });

  it("still builds when no time was ever set — the whenever-I-can case", () => {
    const url = googleUrl({ trainingDays: [1], trainingMinute: undefined, anchors: [] }, now);
    expect(url).not.toBeNull();
    expect(new URL(url!).searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO");
  });

  it("takes its hour from the slot she chose", () => {
    const url = googleUrl({ trainingDays: [3], trainingMinute: undefined, anchors: ["wake"] }, now)!;
    expect(new URL(url).searchParams.get("dates")).toMatch(/^\d{8}T0700/);
  });

  it("is a real Google Calendar template link", () => {
    const url = new URL(googleUrl(profile, now)!);
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toContain("HabitaBull");
  });
});
