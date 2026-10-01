import { describe, expect, it } from "vitest";
import { adjustedLine, readConstraints } from "./adjust";
import type { Constraints } from "./constraints";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe("reading what is different today", () => {
  it("uses the model's answer, and says it was not offline", async () => {
    const out = await readConstraints("only dumbbells", reply({ equipment: ["dumbbell"], avoid: [], source: "ai" }));
    expect(out.offline).toBe(false);
    expect(out.constraints.equipment).toEqual(["dumbbell"]);
  });

  it("is honest when the server fell back on its own", async () => {
    const out = await readConstraints("only dumbbells", reply({ equipment: ["dumbbell"], avoid: [], source: "local" }));
    expect(out.offline).toBe(true);
  });

  it("parses locally when the call fails", async () => {
    const out = await readConstraints("only dumbbells today", reply({}, false));
    expect(out.offline).toBe(true);
    expect(out.constraints.source).toBe("local");
    expect(out.constraints.equipment).toContain("dumbbell");
  });

  it("parses locally with no network at all", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const out = await readConstraints("only dumbbells today", down);
    expect(out.offline).toBe(true);
    expect(out.constraints.equipment).toContain("dumbbell");
  });

  it("adds the offline sentence only when it was offline", () => {
    const c: Constraints = { equipment: ["dumbbell"], avoid: [], source: "local" };
    expect(adjustedLine(c, false)).toBe("Rebuilt using dumbbell.");
    expect(adjustedLine(c, true)).toMatch(/^Rebuilt using dumbbell\. Worked that out offline/);
  });
});
