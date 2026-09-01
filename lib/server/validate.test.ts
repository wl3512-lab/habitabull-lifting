import { describe, expect, it } from "vitest";
import { cleanName, cleanText, decodeImage, isDay, isDeviceId, isUuid } from "./validate";

describe("isDeviceId", () => {
  it("accepts what deviceId() writes", () => {
    expect(isDeviceId("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("rejects anything that could carry a filter into PostgREST", () => {
    for (const v of [
      "0123456789abcdef0123456789abcde",       // short
      "0123456789ABCDEF0123456789abcdef",      // upper
      "0123456789abcdef0123456789abcdef,x",    // comma
      "eq.x)or(true",
      "",
      null,
      42,
    ]) {
      expect(isDeviceId(v)).toBe(false);
    }
  });
});

describe("isUuid", () => {
  it("accepts a uuid", () => {
    expect(isUuid("3f1a2b4c-5d6e-4f70-8901-abcdef123456")).toBe(true);
  });

  it("rejects a uuid with anything appended", () => {
    expect(isUuid("3f1a2b4c-5d6e-4f70-8901-abcdef123456,00000000-0000-0000-0000-000000000000")).toBe(
      false
    );
  });
});

describe("isDay", () => {
  it("accepts a real date", () => {
    expect(isDay("2026-02-28")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
  });

  it("rejects a shape that is not a date at all", () => {
    expect(isDay("2026-2-8")).toBe(false);
    expect(isDay("yesterday")).toBe(false);
  });
});

describe("cleanName", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanName("  Lucy   Liu ")).toBe("Lucy Liu");
  });

  it("caps the length so one person cannot wreck a list", () => {
    expect(cleanName("a".repeat(200))).toHaveLength(40);
  });

  it("never returns blank", () => {
    expect(cleanName("   ")).toBe("Someone");
    expect(cleanName(undefined)).toBe("Someone");
  });
});

describe("cleanText", () => {
  it("returns undefined for nothing, so a column stays null", () => {
    expect(cleanText("  ")).toBeUndefined();
    expect(cleanText(null)).toBeUndefined();
  });

  it("flattens newlines rather than storing a wall", () => {
    expect(cleanText("one\n\ntwo")).toBe("one two");
  });

  it("caps at the column width", () => {
    expect(cleanText("x".repeat(500))).toHaveLength(200);
  });
});

describe("decodeImage", () => {
  // A 1x1 GIF is the shortest real image; PNG here keeps it to allowed types.
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("decodes an allowed image to bytes", () => {
    const out = decodeImage(png);
    expect(out?.type).toBe("image/png");
    expect(out?.ext).toBe("png");
    expect(out!.bytes.length).toBeGreaterThan(0);
  });

  it("names jpeg files .jpg", () => {
    expect(decodeImage(png.replace("image/png", "image/jpeg"))?.ext).toBe("jpg");
  });

  it("refuses anything that is not a raster image", () => {
    expect(decodeImage("javascript:alert(1)")).toBeNull();
    expect(decodeImage("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(decodeImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
  });

  it("refuses a payload that is not base64", () => {
    expect(decodeImage("data:image/png,<not base64>")).toBeNull();
  });

  it("refuses an empty payload", () => {
    expect(decodeImage("data:image/png;base64,")).toBeNull();
  });

  it("refuses a payload past the size cap", () => {
    expect(decodeImage(`data:image/png;base64,${"A".repeat(4_500_000)}`)).toBeNull();
  });
});
