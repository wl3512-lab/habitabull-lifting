import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What gets told to a crew that did not exist yet.
 *
 * `cloud.ts` had no tests, which is how F-1 survived: a crew created after a
 * workout showed its creator as "trained 0 times this week" to everyone who
 * joined, until the creator happened to reload. The week had a pending buffer
 * and a flush; the days trained did not, so they were dropped on the floor.
 *
 * There is no jsdom here, so `window` and `fetch` are stood up by hand, and
 * the module is re-imported per test because the pending buffers are module
 * state and a stale one would leak between cases.
 */

type Store = Map<string, string>;

function stubWindow(store: Store) {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
}

/** Every call the client made, in order. */
type Sent = { path: string; body: Record<string, unknown> };

function stubFetch(sent: Sent[], reply: (path: string) => unknown = () => ({ ok: true })) {
  vi.stubGlobal("fetch", (url: string, init: { body: string }) => {
    const path = url.replace("/api/crew/", "");
    sent.push({ path, body: JSON.parse(init.body) as Record<string, unknown> });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(reply(path)),
    });
  });
}

let store: Store;

beforeEach(() => {
  vi.resetModules();
  store = new Map();
  // deviceId() persists one; any stable value will do.
  store.set("habitabull.device", "device-under-test");
  process.env.NEXT_PUBLIC_CREW_ENABLED = "1";
  stubWindow(store);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_CREW_ENABLED;
});

describe("days trained, when the crew arrives afterwards", () => {
  it("sends the days already trained the moment a crew is created", async () => {
    const sent: Sent[] = [];
    stubFetch(sent, (p) => (p === "create" ? { code: "ABC123" } : { ok: true }));
    const cloud = await import("./cloud");

    // She trained twice, with no crew to tell.
    await cloud.pushCheckins(["2026-09-18", "2026-09-19"]);
    expect(sent.filter((s) => s.path === "checkin")).toHaveLength(0);

    await cloud.createCrew("Iso A");
    // Flushed on the microtask the flush schedules.
    await Promise.resolve();
    await Promise.resolve();

    const checkins = sent.filter((s) => s.path === "checkin");
    expect(checkins).toHaveLength(1);
    expect(checkins[0].body.days).toEqual(["2026-09-18", "2026-09-19"]);
  });

  it("sends them when a crew is joined by code, not only when one is created", async () => {
    const sent: Sent[] = [];
    stubFetch(sent, (p) => (p === "join" ? { ok: true, code: "ABC123" } : { ok: true }));
    const cloud = await import("./cloud");

    await cloud.pushCheckins(["2026-09-19"]);
    await cloud.joinCrew("ABC123", "Iso B");
    await Promise.resolve();
    await Promise.resolve();

    const checkins = sent.filter((s) => s.path === "checkin");
    expect(checkins).toHaveLength(1);
    expect(checkins[0].body.days).toEqual(["2026-09-19"]);
  });

  it("sends the week that was waiting too, which always worked and must keep working", async () => {
    const sent: Sent[] = [];
    stubFetch(sent, (p) => (p === "create" ? { code: "ABC123" } : { ok: true, shared: true }));
    const cloud = await import("./cloud");

    await cloud.publishPlan([{ day: 1, label: "Full body A", exercises: ["back-squat"] }]);
    expect(sent.filter((s) => s.path === "publish")).toHaveLength(0);

    await cloud.createCrew("Iso A");
    await Promise.resolve();
    await Promise.resolve();

    expect(sent.filter((s) => s.path === "publish")).toHaveLength(1);
  });

  it("does not hold anything when there is no backend at all", async () => {
    delete process.env.NEXT_PUBLIC_CREW_ENABLED;
    const sent: Sent[] = [];
    stubFetch(sent);
    const cloud = await import("./cloud");

    // A solo build must never queue a write it will replay at somebody later.
    expect(await cloud.pushCheckins(["2026-09-19"])).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("forgets what was waiting when she leaves, so it is not replayed at the next crew", async () => {
    const sent: Sent[] = [];
    stubFetch(sent, (p) => (p === "create" ? { code: "ABC123" } : { ok: true }));
    const cloud = await import("./cloud");

    await cloud.pushCheckins(["2026-09-19"]);
    await cloud.leaveCrew();
    await cloud.createCrew("Somebody else's crew");
    await Promise.resolve();
    await Promise.resolve();

    expect(sent.filter((s) => s.path === "checkin")).toHaveLength(0);
  });
});
