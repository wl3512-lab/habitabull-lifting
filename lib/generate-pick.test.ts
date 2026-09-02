import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alternativesFor } from "./engine";
import { byId } from "./exercises";

/**
 * The rail on the "not sure?" helper.
 *
 * A live model can be prodded and will usually behave, which proves nothing —
 * the guard has to hold when the answer is wrong, and the only way to know is
 * to make it wrong on purpose. These stub the proxy and return exactly the
 * replies a model eventually will: an exercise we do not have, a sentence with
 * a weight in it, and malformed junk.
 */

const { POST } = await import("../app/api/generate/route");

let reply: unknown = null;
let prompts: string[] = [];

beforeEach(() => {
  prompts = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body));
    prompts.push(body.input?.system_prompt ?? "");
    return new Response(JSON.stringify({ output: JSON.stringify(reply) }), { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const pick = (text: string, muscle = "arms", equipment = ["dumbbell", "machine"]) =>
  POST(
    new Request("https://app.test/api/generate", {
      method: "POST",
      body: JSON.stringify({ intent: "pick", muscle, equipment, text }),
    })
  );

describe("the model may only choose from what we handed it", () => {
  it("passes an id that is on the list", async () => {
    reply = { id: "db-curl", why: "Elbows stay at your sides." };
    const out = await (await pick("something for biceps")).json();
    expect(out).toEqual({ id: "db-curl", why: "Elbows stay at your sides.", source: "ai" });
  });

  it("discards an exercise we do not have, however plausible", async () => {
    reply = { id: "cable-crossover", why: "Great for the chest." };
    const out = await (await pick("something for biceps")).json();
    expect(out.id).not.toBe("cable-crossover");
    expect(out.source).toBe("local");
    // Falls back to what the screen would have offered anyway.
    expect(out.id).toBe(alternativesFor("arms", ["dumbbell", "machine"])[0].id);
  });

  it("discards an id from the right library but the wrong muscle", async () => {
    reply = { id: "plank", why: "Hold it." };
    const out = await (await pick("something for biceps")).json();
    expect(out.id).not.toBe("plank");
    expect(out.source).toBe("local");
  });

  it("survives malformed json", async () => {
    reply = "not json at all";
    expect((await (await pick("help")).json()).source).toBe("local");
  });

  it("survives a missing id", async () => {
    reply = { why: "Just do something." };
    expect((await (await pick("help")).json()).source).toBe("local");
  });
});

describe("the model never gets to state a number", () => {
  it("throws away a sentence with a weight or a rep count in it", async () => {
    reply = { id: "db-curl", why: "Do 3 sets of 12 at 40 lb." };
    const out = await (await pick("biceps")).json();
    expect(out.id).toBe("db-curl");
    // The lift's own cue stands in, rather than a number the engine did not set.
    expect(out.why).toBe(byId("db-curl")!.cue);
    expect(out.why).not.toMatch(/\d/);
  });

  it("keeps a clean sentence", async () => {
    reply = { id: "db-curl", why: "Elbows pinned, palms up." };
    expect((await (await pick("biceps")).json()).why).toBe("Elbows pinned, palms up.");
  });

  it("caps a runaway sentence", async () => {
    reply = { id: "db-curl", why: "word ".repeat(200) };
    expect((await (await pick("biceps")).json()).why!.length).toBeLessThanOrEqual(120);
  });
});

describe("what the model is shown", () => {
  it("is given the shortlist and nothing beyond it", async () => {
    reply = { id: "db-curl", why: "fine" };
    await pick("biceps");
    const shown = prompts[0];
    const allowed = alternativesFor("arms", ["dumbbell", "machine"]).map((e) => e.id);
    for (const id of allowed) expect(shown).toContain(id);
    expect(shown).toContain("Never invent an exercise");
    // Nothing from another muscle group leaks in.
    expect(shown).not.toContain("back-squat");
  });

  it("respects what is already in the day", async () => {
    reply = { id: "db-curl", why: "fine" };
    await POST(
      new Request("https://app.test/api/generate", {
        method: "POST",
        body: JSON.stringify({
          intent: "pick", muscle: "arms", equipment: ["dumbbell", "machine"],
          exclude: ["db-curl"], text: "biceps",
        }),
      })
    );
    expect(prompts[0]).not.toContain("db-curl =");
  });

  it("does not call the model at all with nothing to go on", async () => {
    const out = await (await pick("   ")).json();
    expect(prompts).toHaveLength(0);
    expect(out.source).toBe("local");
  });
});
