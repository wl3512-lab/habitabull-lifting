import { describe, expect, it } from "vitest";
import { CODE_LENGTH, formatCode, isValidCode, makeCode, normaliseCode } from "./joincode";

describe("makeCode", () => {
  it("is the right length and always valid", () => {
    for (let i = 0; i < 200; i++) {
      const c = makeCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect(isValidCode(c)).toBe(true);
    }
  });

  it("never contains the characters people misread", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeCode()).not.toMatch(/[OIL01UV]/);
    }
  });

  it("is not obviously predictable", () => {
    const seen = new Set(Array.from({ length: 300 }, () => makeCode()));
    expect(seen.size).toBeGreaterThan(290);
  });
});

describe("normaliseCode", () => {
  it("forgives case, spaces and punctuation", () => {
    expect(normaliseCode("k4m-9tx")).toBe(normaliseCode("K4M 9TX"));
    expect(normaliseCode("K4M9TX")).toHaveLength(CODE_LENGTH);
  });

  it("folds the characters that get mistyped for each other", () => {
    // O reads as zero, which is not in the alphabet, so it lands on Q.
    expect(normaliseCode("QQQQQQ")).toBe(normaliseCode("OOOOOO"));
    // I and L both read as one, which lands on 7.
    expect(normaliseCode("777777")).toBe(normaliseCode("IILLII"));
  });

  it("does not run past the code length", () => {
    expect(normaliseCode("ABCDEFGHIJ")).toHaveLength(CODE_LENGTH);
  });
});

describe("isValidCode", () => {
  it("rejects anything short or empty", () => {
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("K4M")).toBe(false);
  });

  it("accepts a code typed back sloppily", () => {
    const c = makeCode();
    expect(isValidCode(formatCode(c).toLowerCase())).toBe(true);
  });
});

describe("formatCode", () => {
  it("groups a full code for reading aloud", () => {
    expect(formatCode("K4M9TX")).toBe("K4M-9TX");
  });

  it("leaves a part-typed code alone rather than mangling it", () => {
    expect(formatCode("K4M")).toBe("K4M");
  });
});
