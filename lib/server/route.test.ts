import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The crew routes, against a stand-in Supabase.
 *
 * These exist because the service key bypasses row-level security, so the only
 * thing keeping one crew out of another's photos is the code in this handler.
 * That code had never executed once — no project is provisioned — and untested
 * authorisation is the class of thing that is quietly, badly wrong.
 *
 * The fake answers PostgREST-shaped requests and records every call, so a test
 * can assert not only what came back but what was *not* asked for: a refused
 * delete must issue no DELETE, and a day must only ever query its own crew.
 */

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";

const { POST } = await import("../../app/api/crew/[action]/route");

const ME = "0123456789abcdef0123456789abcdef";
const MY_CREW = "11111111-1111-4111-8111-111111111111";
const OTHER_CREW = "22222222-2222-4222-8222-222222222222";
const MY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MAYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PHOTO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];
type Handler = (url: string, method: string, body: unknown) => unknown | undefined;
let handlers: Handler[] = [];

/** Add a canned answer. First match wins; anything unmatched is an empty table. */
const on = (match: string | RegExp, answer: unknown, method = "GET") =>
  handlers.push((url, m) => {
    if (m !== method) return undefined;
    return (typeof match === "string" ? url.includes(match) : match.test(url))
      ? answer
      : undefined;
  });

beforeEach(() => {
  calls = [];
  handlers = [];
  vi.stubGlobal("fetch", async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const raw = init.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    calls.push({ url, method, body });
    for (const h of handlers) {
      const answer = h(url, method, body);
      if (answer !== undefined) {
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  });
});

afterEach(() => vi.unstubAllGlobals());

/** I am in MY_CREW; so is Maya. */
function amMember() {
  on("members?device_id=eq." + ME, [{ id: MY_ID, crew_id: MY_CREW, name: "Cathy" }]);
}

const post = (action: string, body: object) =>
  POST(
    new Request(`https://app.test/api/crew/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) }
  );

const sent = (method: string, fragment: string) =>
  calls.some((c) => c.method === method && c.url.includes(fragment));

// ── the front door ───────────────────────────────────────────────────────────

describe("the request itself", () => {
  it("refuses a device id that is not one", async () => {
    const res = await post("day", { device: "not-a-device", day: "2026-09-01" });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("refuses an action that does not exist", async () => {
    amMember();
    expect((await post("drop-tables", { device: ME })).status).toBe(404);
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(
      new Request("https://app.test/api/crew/day", { method: "POST", body: "{" }),
      { params: Promise.resolve({ action: "day" }) }
    );
    expect(res.status).toBe(400);
  });

  it("answers 503, not 500, when no backend is configured", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    const fresh = await import("../../app/api/crew/[action]/route");
    const res = await fresh.POST(
      new Request("https://app.test/api/crew/day", {
        method: "POST",
        body: JSON.stringify({ device: ME }),
      }),
      { params: Promise.resolve({ action: "day" }) }
    );
    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("treats a copied .env template as not set up, not as an error", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "your-service-role-key");
    const fresh = await import("../../app/api/crew/[action]/route");
    const res = await fresh.POST(
      new Request("https://app.test/api/crew/members", {
        method: "POST",
        body: JSON.stringify({ device: ME }),
      }),
      { params: Promise.resolve({ action: "members" }) }
    );
    // 503 says "nobody set this up". 500 says "we are broken", which sends
    // someone hunting a bug that is really an empty field in .env.local.
    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("never repeats the database's own words back to the phone", async () => {
    amMember();
    handlers.unshift((url, m) => (m === "GET" && url.includes("photos") ? undefined : undefined));
    vi.stubGlobal("fetch", async () => new Response("relation crews does not exist", { status: 500 }));
    const res = await post("day", { device: ME, day: "2026-09-01" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});

// ── who can see what ─────────────────────────────────────────────────────────

describe("day", () => {
  it("is empty rather than an error when this device is in no crew", async () => {
    const res = await post("day", { device: ME, day: "2026-09-01" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photos: [], trained: [] });
  });

  it("refuses a day that is not a date", async () => {
    amMember();
    expect((await post("day", { device: ME, day: "2026-02-30" })).status).toBe(400);
    expect((await post("day", { device: ME, day: "'; drop table" })).status).toBe(400);
  });

  it("only ever asks for photos belonging to this device's own crew", async () => {
    amMember();
    on(`members?crew_id=eq.${MY_CREW}`, [
      { id: MY_ID, name: "Cathy", checkins: [{ day: "2026-09-01" }] },
      { id: MAYA, name: "Maya", checkins: [] },
    ]);
    await post("day", { device: ME, day: "2026-09-01" });

    const photoQuery = calls.find((c) => c.url.includes("/photos?"))!;
    expect(photoQuery.url).toContain(`in.(${MY_ID},${MAYA})`);
    expect(photoQuery.url).not.toContain(OTHER_CREW);
  });

  it("reports who trained, and never anything they lifted", async () => {
    amMember();
    on(`members?crew_id=eq.${MY_CREW}`, [
      { id: MY_ID, name: "Cathy", checkins: [{ day: "2026-09-01" }] },
      { id: MAYA, name: "Maya", checkins: [{ day: "2026-09-01" }] },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Sam", checkins: [{ day: "2026-08-30" }] },
    ]);
    const { trained } = (await (await post("day", { device: ME, day: "2026-09-01" })).json()) as {
      trained: { name: string; mine: boolean }[];
    };
    expect(trained.map((t) => t.name)).toEqual(["Cathy", "Maya"]);
    expect(trained.find((t) => t.name === "Cathy")!.mine).toBe(true);
    expect(JSON.stringify(trained)).not.toMatch(/weight|reps|lb/i);
  });

  it("marks my own photo mine, counts likes, and knows if one is mine", async () => {
    amMember();
    on(`members?crew_id=eq.${MY_CREW}`, [{ id: MY_ID, name: "Cathy", checkins: [] }]);
    on("/photos?", [
      {
        id: PHOTO,
        member_id: MY_ID,
        path: "p.jpg",
        caption: "Squats moved.",
        members: { name: "Cathy" },
        reactions: [
          { id: "r1", kind: "like", body: null, member_id: MAYA, members: { name: "Maya" } },
          { id: "r2", kind: "like", body: null, member_id: MY_ID, members: { name: "Cathy" } },
          { id: "r3", kind: "reply", body: "go on", member_id: MAYA, members: { name: "Maya" } },
        ],
      },
    ]);
    on("/storage/v1/object/sign/", { signedURL: "/object/sign/p.jpg?token=x" }, "POST");

    const { photos } = (await (await post("day", { device: ME, day: "2026-09-01" })).json()) as {
      photos: {
        mine: boolean;
        likes: number;
        likedByMe: boolean;
        url: string;
        replies: { mine: boolean }[];
      }[];
    };
    expect(photos).toHaveLength(1);
    expect(photos[0].mine).toBe(true);
    expect(photos[0].likes).toBe(2);
    expect(photos[0].likedByMe).toBe(true);
    expect(photos[0].replies).toEqual([{ id: "r3", memberName: "Maya", mine: false, body: "go on" }]);
    expect(photos[0].url).toBe("https://test.supabase.co/storage/v1/object/sign/p.jpg?token=x");
  });

  it("drops a photo whose object has gone rather than serving a broken image", async () => {
    amMember();
    on(`members?crew_id=eq.${MY_CREW}`, [{ id: MY_ID, name: "Cathy", checkins: [] }]);
    on("/photos?", [
      { id: PHOTO, member_id: MY_ID, path: "gone.jpg", caption: null, members: null, reactions: [] },
    ]);
    // No signing handler: the sign call falls through and returns nothing usable.
    const { photos } = (await (await post("day", { device: ME, day: "2026-09-01" })).json()) as {
      photos: unknown[];
    };
    expect(photos).toEqual([]);
  });
});

// ── acting on somebody else's things ─────────────────────────────────────────

describe("unshare", () => {
  it("cannot delete a photo that is not mine, and issues no delete trying", async () => {
    amMember();
    on("/photos?", []); // the lookup is scoped member_id=eq.me, so it finds nothing
    const res = await post("unshare", { device: ME, photoId: PHOTO });
    expect(res.status).toBe(404);
    expect(sent("DELETE", "photos")).toBe(false);
    expect(sent("DELETE", "/storage/")).toBe(false);
  });

  it("scopes the lookup to this member, not just the photo id", async () => {
    amMember();
    await post("unshare", { device: ME, photoId: PHOTO });
    expect(calls.find((c) => c.url.includes("/photos?"))!.url).toContain(`member_id=eq.${MY_ID}`);
  });

  it("removes the row and the object together", async () => {
    amMember();
    on("/photos?", [{ path: "mine.jpg" }]);
    expect((await post("unshare", { device: ME, photoId: PHOTO })).status).toBe(200);
    expect(sent("DELETE", `photos?id=eq.${PHOTO}`)).toBe(true);
    expect(sent("DELETE", "/storage/v1/object/crew-photos/mine.jpg")).toBe(true);
  });
});

describe("like", () => {
  it("refuses a photo belonging to another crew", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: OTHER_CREW } }]);
    const res = await post("like", { device: ME, photoId: PHOTO, on: true });
    expect(res.status).toBe(404);
    expect(sent("POST", "/reactions")).toBe(false);
  });

  it("refuses a photo id that is not a uuid before it reaches a filter", async () => {
    amMember();
    const res = await post("like", { device: ME, photoId: "*)or(1=1", on: true });
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.url.includes("or(1=1"))).toBe(false);
  });

  it("clears then sets, so the same tap twice lands in the same place", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: MY_CREW } }]);
    await post("like", { device: ME, photoId: PHOTO, on: true });
    expect(sent("DELETE", "kind=eq.like")).toBe(true);
    expect(calls.find((c) => c.method === "POST" && c.url.includes("/reactions"))?.body).toEqual({
      photo_id: PHOTO,
      member_id: MY_ID,
      kind: "like",
    });
  });

  it("only clears when the like is being taken back", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: MY_CREW } }]);
    await post("like", { device: ME, photoId: PHOTO, on: false });
    expect(sent("DELETE", "kind=eq.like")).toBe(true);
    expect(sent("POST", "/reactions")).toBe(false);
  });
});

describe("reply", () => {
  it("refuses a photo in another crew", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: OTHER_CREW } }]);
    expect((await post("reply", { device: ME, photoId: PHOTO, body: "hi" })).status).toBe(404);
  });

  it("refuses an empty reply rather than storing a blank row", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: MY_CREW } }]);
    expect((await post("reply", { device: ME, photoId: PHOTO, body: "   " })).status).toBe(400);
    expect(sent("POST", "/reactions")).toBe(false);
  });

  it("stores the cleaned text", async () => {
    amMember();
    on("/photos?", [{ id: PHOTO, members: { crew_id: MY_CREW } }]);
    await post("reply", { device: ME, photoId: PHOTO, body: " see you\nFriday " });
    expect(calls.find((c) => c.method === "POST" && c.url.includes("/reactions"))?.body).toMatchObject(
      { kind: "reply", body: "see you Friday" }
    );
  });
});

// ── joining and leaving ──────────────────────────────────────────────────────

describe("create", () => {
  it("makes a crew and puts this device in it", async () => {
    on("/crews", [{ id: MY_CREW, code: "K4M9TX" }], "POST");
    const res = await post("create", { device: ME, name: "  Cathy  " });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { code: string }).code).toBe("K4M9TX");

    const member = calls.find((c) => c.method === "POST" && c.url.includes("/members"))!.body;
    expect(member).toEqual({ crew_id: MY_CREW, device_id: ME, name: "Cathy" });
  });

  it("makes a code from the readable alphabet only", async () => {
    let made = "";
    handlers.push((url, m, body) => {
      if (m !== "POST" || !url.includes("/crews")) return undefined;
      made = (body as { code: string }).code;
      return [{ id: MY_CREW, code: made }];
    });
    await post("create", { device: ME, name: "Cathy" });
    expect(made).toHaveLength(6);
    expect(made).not.toMatch(/[OIL01UV]/);
  });

  it("tries again rather than handing two groups of strangers the same code", async () => {
    let lookups = 0;
    handlers.push((url, m) => {
      if (m !== "GET" || !url.includes("/crews?code=eq.")) return undefined;
      // The first two codes are taken.
      return ++lookups <= 2 ? [{ id: OTHER_CREW }] : [];
    });
    on("/crews", [{ id: MY_CREW, code: "K4M9TX" }], "POST");
    expect((await post("create", { device: ME, name: "Cathy" })).status).toBe(200);
    expect(lookups).toBe(3);
  });

  it("gives up honestly rather than looping forever", async () => {
    on("/crews?code=eq.", [{ id: OTHER_CREW }]);
    const res = await post("create", { device: ME, name: "Cathy" });
    expect(res.status).toBe(503);
    expect(sent("POST", "/members")).toBe(false);
  });

  it("leaves any previous crew first", async () => {
    amMember();
    on("/crews", [{ id: MY_CREW, code: "K4M9TX" }], "POST");
    await post("create", { device: ME, name: "Cathy" });
    expect(sent("DELETE", "/members")).toBe(true);
  });
});

describe("join", () => {
  it("rejects a malformed code without asking the database", async () => {
    const res = await post("join", { device: ME, code: "ABC" });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes("/crews"))).toBe(false);
  });

  it("says so when no crew has that code", async () => {
    on("/crews?", []);
    expect((await post("join", { device: ME, code: "K4M9TX" })).status).toBe(404);
  });

  it("forgives the characters people mistype when reading a code out", async () => {
    on("/crews?", [{ id: OTHER_CREW }]);
    const res = await post("join", { device: ME, code: "k4m-9tx" });
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.url.includes("/crews?"))!.url).toContain("code=eq.K4M9TX");
  });

  it("leaves the previous crew first, so a device is never in two", async () => {
    amMember();
    on("/crews?", [{ id: OTHER_CREW }]);
    await post("join", { device: ME, code: "K4M9TX" });
    const leave = calls.findIndex((c) => c.method === "DELETE" && c.url.includes("/members"));
    const joined = calls.findIndex((c) => c.method === "POST" && c.url.includes("/members"));
    expect(leave).toBeGreaterThan(-1);
    expect(leave).toBeLessThan(joined);
  });
});

describe("leave", () => {
  it("deletes the objects before the row that would orphan them", async () => {
    amMember();
    on("/photos?", [{ path: "a.jpg" }, { path: "b.jpg" }]);
    await post("leave", { device: ME });
    const objects = calls.findIndex((c) => c.url.includes("/storage/v1/object/crew-photos/a.jpg"));
    const row = calls.findIndex((c) => c.method === "DELETE" && c.url.includes("/members"));
    expect(objects).toBeGreaterThan(-1);
    expect(objects).toBeLessThan(row);
  });

  it("is quiet about a device that was never in a crew", async () => {
    expect((await post("leave", { device: ME })).status).toBe(200);
  });
});

// ── what gets stored ─────────────────────────────────────────────────────────

describe("checkin", () => {
  it("drops days that are not days and keeps the rest", async () => {
    amMember();
    await post("checkin", { device: ME, days: ["2026-09-01", "2026-02-30", "nope", "2026-08-30"] });
    const body = calls.find((c) => c.method === "POST" && c.url.includes("/checkins"))?.body;
    expect(body).toEqual([
      { member_id: MY_ID, day: "2026-09-01" },
      { member_id: MY_ID, day: "2026-08-30" },
    ]);
  });

  it("stores a date and nothing else — no weight column to fill", async () => {
    amMember();
    await post("checkin", { device: ME, days: ["2026-09-01"] });
    const body = calls.find((c) => c.method === "POST" && c.url.includes("/checkins"))!.body as object[];
    expect(Object.keys(body[0]).sort()).toEqual(["day", "member_id"]);
  });

  it("writes nothing when every day was rubbish", async () => {
    amMember();
    await post("checkin", { device: ME, days: ["yesterday", 7, null] });
    expect(sent("POST", "/checkins")).toBe(false);
  });

  it("refuses a device that is in no crew", async () => {
    expect((await post("checkin", { device: ME, days: ["2026-09-01"] })).status).toBe(403);
  });
});

describe("share", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("refuses anything that is not a photo, and uploads nothing", async () => {
    amMember();
    const res = await post("share", { device: ME, day: "2026-09-01", dataUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
    expect(sent("POST", "/storage/")).toBe(false);
  });

  it("refuses an SVG, which is a script in an image's clothing", async () => {
    amMember();
    const svg = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    expect((await post("share", { device: ME, day: "2026-09-01", dataUrl: svg })).status).toBe(400);
    expect(sent("POST", "/storage/")).toBe(false);
  });

  it("files the object under the crew and member that own it", async () => {
    amMember();
    on("/photos", [{ id: PHOTO }], "POST");
    const res = await post("share", { device: ME, day: "2026-09-01", dataUrl: png, caption: " nice " });
    expect(res.status).toBe(200);

    const upload = calls.find((c) => c.url.includes("/storage/v1/object/crew-photos/"))!;
    expect(upload.url).toContain(`crew-photos/${MY_CREW}/${MY_ID}/2026-09-01-`);
    expect(upload.url.endsWith(".png")).toBe(true);

    const row = calls.find((c) => c.method === "POST" && c.url.includes("/photos"))!.body;
    expect(row).toMatchObject({ member_id: MY_ID, day: "2026-09-01", caption: "nice" });
  });

  it("refuses a device that is in no crew", async () => {
    expect(
      (await post("share", { device: ME, day: "2026-09-01", dataUrl: png })).status
    ).toBe(403);
  });
});
