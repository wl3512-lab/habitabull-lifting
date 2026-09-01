/**
 * Everything that arrives from a browser, checked before it reaches a query.
 *
 * The service key bypasses row-level security, so these functions are the only
 * thing standing between a hand-written request and the whole table. They are
 * pure and separately tested for that reason: an id that reaches a PostgREST
 * filter unvalidated is an injected filter.
 */

/** 16 random bytes, hex, as `deviceId()` writes them. */
export const isDeviceId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{32}$/.test(v);

/** A uuid, and nothing that could carry a comma or a parenthesis into a filter. */
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** YYYY-MM-DD, and a date that actually exists. */
export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A display name someone typed for themselves. Never blank, never a wall. */
export function cleanName(v: unknown): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return s || "Someone";
}

/** Optional free text — a caption or a reply. Empty becomes absent. */
export function cleanText(v: unknown, max = 200): string | undefined {
  const s = typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "";
  return s || undefined;
}

/** Base64 payload cap. A shrunk photo is a few hundred KB; this is generous. */
const MAX_BYTES = 3_000_000;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Decode a data URL into bytes, or refuse.
 *
 * Only real raster images, only base64, and only up to a size a phone photo
 * actually reaches. `javascript:` and `data:text/html` are the reason this is a
 * whitelist rather than a prefix check.
 */
export function decodeImage(v: unknown): { bytes: Uint8Array; type: string; ext: string } | null {
  if (typeof v !== "string" || v.length > MAX_BYTES * 1.4) return null;
  const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) return null;
  const type = m[1];
  if (!ALLOWED.has(type)) return null;
  try {
    const raw = Buffer.from(m[2], "base64");
    if (raw.length === 0 || raw.length > MAX_BYTES) return null;
    return { bytes: new Uint8Array(raw), type, ext: type.split("/")[1].replace("jpeg", "jpg") };
  } catch {
    return null;
  }
}
