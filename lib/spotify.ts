/**
 * Music at the start of a workout, without an account.
 *
 * The brief was "the playlist they already have" — so the app's job is to
 * launch something the user curated, not to build a library, recommend tracks
 * or hold a session. That rules the Web API out: listing somebody's playlists
 * needs OAuth, OAuth needs accounts, and accounts are v2. It would also make
 * the first thing that happens when you tap Start workout a network round trip
 * that can fail, in a product whose one hard rule is that logging must survive
 * a bad signal.
 *
 * So: the user pastes a link once, we keep the id, and starting a workout
 * opens it. An `https://open.spotify.com/...` link is a universal link — iOS
 * and Android hand it to the installed app, and anyone without the app gets
 * the web player. That is one code path, no SDK, no token, and it degrades to
 * "nothing happens" rather than to an error.
 */

/** A Spotify id is base62 and, in practice, 22 characters. */
const ID = /^[A-Za-z0-9]{16,40}$/;

/**
 * Pull the playlist id out of whatever the share sheet produced.
 *
 * Five shapes reach us in the wild: the `spotify:` URI, the plain web link, a
 * web link carrying `?si=` tracking, a locale-prefixed link (`/intl-de/`), and
 * the legacy `/user/<name>/playlist/<id>` form. Returns null for anything
 * else, including an album or track link — pointing "start workout" at a
 * single track is a mistake worth catching at the input rather than at play.
 */
export function parsePlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // spotify:playlist:ID  (also tolerates spotify:user:x:playlist:ID)
  const uri = raw.match(/^spotify:(?:user:[^:]+:)?playlist:([A-Za-z0-9]+)$/i);
  if (uri) return ID.test(uri[1]) ? uri[1] : null;

  // Bare id pasted on its own.
  if (ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/(^|\.)spotify\.com$/i.test(url.hostname)) return null;

  // /playlist/ID, /intl-xx/playlist/ID, /user/name/playlist/ID
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.lastIndexOf("playlist");
  if (i === -1 || i === parts.length - 1) return null;
  const id = parts[i + 1];
  return ID.test(id) ? id : null;
}

/** The universal link. Opens the app when installed, the web player when not. */
export function playlistUrl(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}

/**
 * Open the playlist, and never let it stop a workout starting.
 *
 * Called on the same tick as the Start tap so the browser still counts it as
 * user-activated — deferring it behind an await is what gets a popup blocked.
 * Every failure path is swallowed on purpose: a blocked popup, a missing id or
 * a webview with no opener is a workout that begins in silence, which is the
 * behaviour anyone without music already gets.
 */
export function launchPlaylist(id: string | undefined): void {
  if (!id || typeof window === "undefined") return;
  try {
    window.open(playlistUrl(id), "_blank", "noopener,noreferrer");
  } catch {
    // Silence is the fallback. Nothing here is worth interrupting a set for.
  }
}
