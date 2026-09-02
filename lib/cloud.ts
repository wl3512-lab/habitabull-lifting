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
    else window.localStorage.removeItem(CREW_KEY);
  } catch {
    // Blocked storage costs a button, not the feature.
  }
}

async function call<T>(path: string, body: unknown): Promise<T | null> {
  if (!enabled()) return null;
  const device = deviceId();
  if (!device) return null;
  try {
    const res = await fetch(`/api/crew/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(body as object), device }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // A crew that cannot be reached is a crew that is not there today. The
    // calendar still shows her own training; it just shows nobody else's.
    return null;
  }
}

export const createCrew = async (name: string) => {
  const res = await call<{ code: string }>("create", { name });
  rememberCrew(res?.code ?? null);
  return res;
};

export const joinCrew = async (code: string, name: string) => {
  const res = await call<{ ok: true; code: string }>("join", { code, name });
  if (res) rememberCrew(res.code);
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

/** Push the days she has trained, so the crew sees presence and nothing else. */
export const pushCheckins = (days: string[]) => call<{ ok: true }>("checkin", { days });

export interface CrewDay {
  photos: CrewPhoto[];
  /** Who in the crew trained that day. A name, never a number. */
  trained: { id: string; name: string; mine: boolean }[];
}

/** Everyone's shared photos for one day, with reactions already counted. */
export const fetchDay = (day: string) => call<CrewDay>("day", { day });

export const sharePhoto = (day: string, dataUrl: string, caption?: string) =>
  call<{ id: string }>("share", { day, dataUrl, caption });

export const unsharePhoto = (photoId: string) => call<{ ok: true }>("unshare", { photoId });

export const likePhoto = (photoId: string, on: boolean) =>
  call<{ ok: true }>("like", { photoId, on });

export const replyToPhoto = (photoId: string, body: string) =>
  call<{ ok: true }>("reply", { photoId, body });
