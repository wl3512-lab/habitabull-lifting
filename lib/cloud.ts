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

export const createCrew = (name: string) => call<{ code: string }>("create", { name });

export const joinCrew = (code: string, name: string) =>
  call<{ ok: true; code: string }>("join", { code, name });

export const leaveCrew = () => call<{ ok: true }>("leave", {});

/** Who is in the crew, and which days each of them trained. */
export const fetchCrew = () =>
  call<{ code: string | null; members: CrewMember[] }>("members", {});

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
