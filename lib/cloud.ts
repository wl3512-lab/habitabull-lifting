import { deviceId } from "./joincode";

/**
 * The crew client.
 *
 * Everything here is optional. With no credentials configured, `enabled()` is
 * false, every call returns an empty result, and the app behaves exactly as it
 * did before any of this existed — solo, offline, nothing shared. That is not a
 * degraded mode bolted on afterwards; it is the mode the whole product was
 * built in, and it stays the one that works when the network does not.
 *
 * Nothing talks to Supabase from the browser. The anon key would let any
 * visitor read any crew's rows, so the tables are closed and every call goes
 * through this app's own API routes, which hold the service key server-side and
 * check membership before touching anything.
 */

export interface CrewMember {
  id: string;
  name: string;
  /** Whether this row is the person asking. */
  mine: boolean;
  /** Days this member trained, ISO dates. Never what they lifted. */
  days: string[];
}

export interface CrewReply {
  id: string;
  memberName: string;
  mine: boolean;
  body: string;
}

export interface CrewPhoto {
  id: string;
  memberId: string;
  memberName: string;
  /** Yours, which is the only kind you can unshare. */
  mine: boolean;
  day: string;
  url: string;
  caption?: string;
  likes: number;
  likedByMe: boolean;
  replies: CrewReply[];
}

/** Whether a crew backend is configured for this deployment. */
export function enabled(): boolean {
  return process.env.NEXT_PUBLIC_CREW_ENABLED === "1";
}

/**
 * The crew's code, remembered on this device.
 *
 * Screens that only need to know *whether* there is a crew — should this button
 * exist at all — must not each pay for a request to find out. This is a cache
 * of the last answer, not the truth; the truth is the member row on the server,
 * and every call re-checks it there.
 */
const CREW_KEY = "habitabull.crew";

export function crewCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CREW_KEY);
  } catch {
    return null;
  }
}

function rememberCrew(code: string | null) {
  try {
    if (code) window.localStorage.setItem(CREW_KEY, code);
    else {
      window.localStorage.removeItem(CREW_KEY);
      // A new crew has been told nothing yet.
      window.localStorage.removeItem(SENT_KEY);
    }
  } catch {
    // Blocked storage costs a button, not the feature.
  }
}

/**
 * A refusal and a failure are different things, and only one of them is the
 * user's doing. "No crew with that code" is true of a 404 and a lie about a
 * dropped connection, so the two paths that report to a person — joining and
 * creating — get the status, and everything else keeps the simpler shape.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number };

const UNREACHABLE = 0;

async function request<T>(path: string, body: unknown): Promise<Result<T>> {
  if (!enabled()) return { ok: false, status: UNREACHABLE };
  const device = deviceId();
  if (!device) return { ok: false, status: UNREACHABLE };
  try {
    const res = await fetch(`/api/crew/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(body as object), device }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: UNREACHABLE };
  }
}

/**
 * For everything that can fail quietly. A crew that cannot be reached is a
 * crew that is not there today: the calendar still shows her own training, it
 * just shows nobody else's.
 */
async function call<T>(path: string, body: unknown): Promise<T | null> {
  const res = await request<T>(path, body);
  return res.ok ? res.data : null;
}

export const createCrew = async (name: string) => {
  const res = await request<{ code: string }>("create", { name });
  if (res.ok) rememberCrew(res.data.code);
  return res;
};

export const joinCrew = async (code: string, name: string) => {
  const res = await request<{ ok: true; code: string }>("join", { code, name });
  if (res.ok) rememberCrew(res.data.code);
  return res;
};

export const leaveCrew = async () => {
  const res = await call<{ ok: true }>("leave", {});
  rememberCrew(null);
  return res;
};

/** Who is in the crew, and which days each of them trained. */
export const fetchCrew = async () => {
  const res = await call<{ code: string | null; members: CrewMember[] }>("members", {});
  // Only a real answer corrects the cache; a network failure is not a departure.
  if (res) rememberCrew(res.code);
  return res;
};

/**
 * Push the days she has trained, so the crew sees presence and nothing else.
 *
 * Only what the server has not already been told. Sending the whole history on
 * every launch is correct — the upsert is idempotent — but it costs bandwidth
 * proportional to how long someone has been using the app, forever, which is
 * exactly backwards: the loyal user pays the most. The acknowledged set lives
 * beside the crew code and is cleared when she leaves.
 */
const SENT_KEY = "habitabull.checkins";

function acknowledged(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function pushCheckins(days: string[]) {
  if (!enabled()) return null;
  const sent = acknowledged();
  const fresh = days.filter((d) => !sent.has(d));
  if (fresh.length === 0) return { ok: true } as const;

  const res = await call<{ ok: true }>("checkin", { days: fresh });
  // Only a confirmed write may be remembered, or a dropped request would
  // silently lose a day forever.
  if (res) {
    try {
      window.localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...fresh]));
    } catch {
      // Unremembered means re-sent next time. Wasteful, never wrong.
    }
  }
  return res;
}

export interface CrewDay {
  photos: CrewPhoto[];
  /** Who in the crew trained that day. A name, never a number. */
  trained: { id: string; name: string; mine: boolean }[];
}

/**
 * Everyone's shared photos for one day, with reactions already counted.
 *
 * Today and the calendar's day view both want today, and opening one from the
 * other asked twice for the same answer. In-flight requests are shared and the
 * result is held very briefly — long enough to cover a navigation, far too
 * short to show anyone a stale like.
 */
const inFlight = new Map<string, Promise<CrewDay | null>>();
const FRESH_MS = 3000;
let last: { day: string; at: number; value: CrewDay | null } | null = null;

export function fetchDay(day: string, force = false): Promise<CrewDay | null> {
  if (!force && last && last.day === day && Date.now() - last.at < FRESH_MS) {
    return Promise.resolve(last.value);
  }
  const pending = inFlight.get(day);
  if (pending && !force) return pending;

  const req = call<CrewDay>("day", { day }).then((value) => {
    last = { day, at: Date.now(), value };
    inFlight.delete(day);
    return value;
  });
  inFlight.set(day, req);
  return req;
}

/**
 * What the crew has posted lately, newest first.
 *
 * A photo used to be reachable only through the calendar day it was taken on,
 * which means guessing when somebody trained in order to find out that they
 * did.
 */
export const fetchFeed = () => call<{ photos: CrewPhoto[] }>("feed", {});

/** After acting on a day, the cached copy is a lie. */
export const invalidateDay = () => {
  last = null;
  inFlight.clear();
};

/** Every write to a day makes the cached copy of it a lie. */
async function mutateDay<T>(path: string, body: unknown): Promise<T | null> {
  const res = await call<T>(path, body);
  invalidateDay();
  return res;
}

export const sharePhoto = (day: string, dataUrl: string, caption?: string) =>
  mutateDay<{ id: string }>("share", { day, dataUrl, caption });

export const unsharePhoto = (photoId: string) => mutateDay<{ ok: true }>("unshare", { photoId });

export const likePhoto = (photoId: string, on: boolean) =>
  mutateDay<{ ok: true }>("like", { photoId, on });

export const replyToPhoto = (photoId: string, body: string) =>
  mutateDay<{ ok: true }>("reply", { photoId, body });
