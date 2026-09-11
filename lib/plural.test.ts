import { describe, expect, it } from "vitest";
import { count } from "./plural";

describe("count", () => {
  it("keeps the noun singular at one", () => {
    expect(count(1, "session")).toBe("1 session");
    expect(count(1, "day")).toBe("1 day");
    expect(count(1, "rep")).toBe("1 rep");
  });

  it("pluralises everything else", () => {
    expect(count(0, "session")).toBe("0 sessions");
    expect(count(2, "session")).toBe("2 sessions");
    expect(count(12, "week")).toBe("12 weeks");
  });

  it("takes an irregular plural when the s will not do", () => {
    expect(count(1, "person", "people")).toBe("1 person");
    expect(count(3, "person", "people")).toBe("3 people");
  });

  it("does not treat a negative one as singular", () => {
    // Nothing here counts backwards, but "-1 session" reading as singular
    // would be a quiet lie if anything ever did.
    expect(count(-1, "session")).toBe("-1 sessions");
  });
});
