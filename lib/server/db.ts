/**
 * The server side of the crew, spoken over Supabase's REST interface.
 *
 * There is no client library here on purpose. Everything this app needs is
 * four HTTP verbs against PostgREST and two against object storage, and a
 * dependency that ships an auth stack, a realtime socket and a query builder
 * to do that would be more code than the feature.
 *
 * The service key lives only in this module and only on the server. It bypasses
 * row-level security entirely, which is exactly why nothing that reaches it is
 * trusted: every route checks crew membership before it composes a query, and
 * every value that lands in a filter is validated first.
 */

const URL_ = process.env.SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const BUCKET = "crew-photos";

/**
 * The values `.env.example` ships with. A copied template is *not* a
 * configured backend, and treating it as one turns "you have not set this up"
 * into "something went wrong" — the least useful sentence a server can say.
 */
const PLACEHOLDERS = new Set(["https://your-project.supabase.co", "your-service-role-key"]);

export const configured = () =>
  Boolean(URL_ && KEY) && !PLACEHOLDERS.has(URL_) && !PLACEHOLDERS.has(KEY);

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

export const select = <T>(table: string, query: string) => rest<T[]>(`${table}?${query}`);

export const insert = <T>(table: string, row: object, returning = true) =>
  rest<T[]>(table, {
    method: "POST",
    headers: { Prefer: returning ? "return=representation" : "return=minimal" },
    body: JSON.stringify(row),
  });

/** Insert, or update the row that collides on `conflict`. */
export const upsert = <T>(table: string, row: object, conflict: string) =>
  rest<T[]>(`${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });

export const update = <T>(table: string, query: string, patch: object) =>
  rest<T[]>(`${table}?${query}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });

export const remove = (table: string, query: string) =>
  rest<null>(`${table}?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

// ── object storage ───────────────────────────────────────────────────────────

export async function putObject(path: string, body: Uint8Array, type: string): Promise<void> {
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": type },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
}

export async function deleteObject(path: string): Promise<void> {
  await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  }).catch(() => {});
}

/**
 * A time-limited URL for one object. The bucket is private, so a photo is
 * readable only for as long as someone is looking at the day it belongs to —
 * an hour — and a link that leaks stops working on its own.
 */
export async function signObject(path: string, seconds = 3600): Promise<string | null> {
  try {
    const res = await fetch(`${URL_}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ expiresIn: seconds }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { signedURL } = (await res.json()) as { signedURL?: string };
    return signedURL ? `${URL_}/storage/v1${signedURL}` : null;
  } catch {
    return null;
  }
}
