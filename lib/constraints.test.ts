import { describe, expect, it } from "vitest";
import { parseLocally, sanitize } from "./constraints";

describe("sanitize", () => {
  it("keeps values inside the allowed enums", () => {
    expect(sanitize({ equipment: ["dumbbell"], avoid: ["shoulders"] })).toEqual({
      equipment: ["dumbbell"],
      avoid: ["shoulders"],
    });
  });

  it("drops anything the model invented", () => {
    const out = sanitize({ equipment: ["dumbbell", "resistance band", 7], avoid: ["neck", null] });
    expect(out).toEqual({ equipment: ["dumbbell"], avoid: [] });
  });

  it("returns null when nothing usable survives, so we fall back", () => {
    expect(sanitize({ equipment: ["sandbag"], avoid: ["soul"] })).toBeNull();
    expect(sanitize({ equipment: [], avoid: [] })).toBeNull();
    expect(sanitize("just some prose")).toBeNull();
    expect(sanitize(null)).toBeNull();
  });

  it("never lets sets, reps or weight through", () => {
    const out = sanitize({ equipment: ["barbell"], avoid: [], sets: 12, weight: 500, reps: 1 });
    expect(out).toEqual({ equipment: ["barbell"], avoid: [] });
  });

  it("dedupes repeats", () => {
    expect(sanitize({ equipment: ["dumbbell", "dumbbell"], avoid: [] })?.equipment).toEqual(["dumbbell"]);
  });
});

describe("parseLocally — the offline path the app depends on", () => {
  it("reads equipment out of plain speech", () => {
    expect(parseLocally("I only have dumbbells today").equipment).toEqual(["dumbbell"]);
  });

  it("treats travel as bodyweight", () => {
    expect(parseLocally("in a hotel room, no equipment").equipment).toContain("bodyweight");
  });

  it("catches an injury near a complaint word", () => {
    expect(parseLocally("my shoulder is tweaked").avoid).toEqual(["shoulders"]);
  });

  it("does not flag a body part mentioned without complaint", () => {
    expect(parseLocally("want to train shoulders").avoid).toEqual([]);
  });

  it("handles equipment and injury together", () => {
    const c = parseLocally("only dumbbells today and my knee hurts");
    expect(c.equipment).toEqual(["dumbbell"]);
    expect(c.avoid).toEqual(["quads"]);
  });

  it("always reports itself as local so the UI can be honest", () => {
    expect(parseLocally("anything").source).toBe("local");
  });

  it("returns empty arrays rather than throwing on nonsense", () => {
    const c = parseLocally("asdfgh");
    expect(c.equipment).toEqual([]);
    expect(c.avoid).toEqual([]);
  });
});
