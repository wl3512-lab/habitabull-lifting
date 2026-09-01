/**
 * Crew join codes.
 *
 * A crew is joined by typing a short code someone reads out or texts you, not
 * by making an account. There are no passwords anywhere in this product and
 * there is no reason a gym app should hold one.
 *
 * The alphabet drops every character that gets misread aloud or mistyped —
 * no O/0, no I/1/L, no U/V confusion — because the failure mode is somebody
 * reading a code across a gym floor and getting it wrong.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
export const CODE_LENGTH = 6;

/** A code, grouped for reading aloud: "K4M-9TX". */
export function formatCode(code: string): string {
  const c = normaliseCode(code);
  return c.length === CODE_LENGTH ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

/** Strip punctuation and case, and fold the characters people mistype. */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/0/g, "Q")
    .replace(/1/g, "7")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(input: string): boolean {
  const c = normaliseCode(input);
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch));
}

/** Cryptographically random where available; never Math.random for an id. */
export function makeCode(random: () => number = secureRandom): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

function secureRandom(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

/**
 * A per-device key, which is the whole of identity here. It never leaves the
 * device except as an opaque id on a check-in, and it is not tied to a person
 * — losing the device means losing the crew membership, which is the honest
 * trade for having no accounts.
 */
const DEVICE_KEY = "habitabull.device";

export function deviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    // Private mode, or storage blocked. No identity means no crew, and the
    // rest of the app carries on exactly as it does offline.
    return null;
  }
}
