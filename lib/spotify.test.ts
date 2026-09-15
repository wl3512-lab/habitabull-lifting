import { describe, expect, it } from "vitest";
import { parsePlaylistId, playlistUrl } from "./spotify";

const ID = "37i9dQZF1DXcBWIGoYBM5M";

describe("parsePlaylistId", () => {
  it("reads every shape the share sheet produces", () => {
    for (const input of [
      `spotify:playlist:${ID}`,
      `spotify:user:lucy:playlist:${ID}`,
      `https://open.spotify.com/playlist/${ID}`,
      `https://open.spotify.com/playlist/${ID}?si=8f2a1c0d`,
      `https://open.spotify.com/intl-de/playlist/${ID}`,
      `https://open.spotify.com/user/lucy/playlist/${ID}`,
      `open.spotify.com/playlist/${ID}`,
      `  ${ID}  `,
    ]) {
      expect(parsePlaylistId(input), input).toBe(ID);
    }
  });

  it("refuses anything that is not a playlist", () => {
    for (const input of [
      "",
      "   ",
      "not a link",
      `https://open.spotify.com/track/${ID}`,
      `https://open.spotify.com/album/${ID}`,
      `https://example.com/playlist/${ID}`,
      // look-alike host: the suffix check must not match "notspotify.com"
      `https://notspotify.com/playlist/${ID}`,
      "https://open.spotify.com/playlist/",
      "spotify:playlist:",
    ]) {
      expect(parsePlaylistId(input), input).toBeNull();
    }
  });

  it("builds a universal link", () => {
    expect(playlistUrl(ID)).toBe(`https://open.spotify.com/playlist/${ID}`);
  });
});
