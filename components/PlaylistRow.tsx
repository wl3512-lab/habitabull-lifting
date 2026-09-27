"use client";

import { useState } from "react";
import { Card, Pill } from "./ui";
import { parsePlaylistId } from "@/lib/spotify";
import type { Profile } from "@/lib/types";

/**
 * Where the gym playlist gets attached, one line under the action.
 *
 * A row and not a screen. Music is a nice-to-have on the way into a set, and
 * anything that turns "start workout" into a two-step flow is competing with
 * the habit loop — which the product's first principle says loses. Once it is
 * set, this is a label you never touch again.
 *
 * It asks for a link rather than listing the user's playlists because listing
 * needs OAuth and OAuth needs accounts. Pasting is one paste, works offline,
 * and — the part that matters — cannot fail on the way into a workout.
 */
export default function PlaylistRow({
  profile,
  onProfile,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [bad, setBad] = useState(false);

  const id = profile.playlistId;

  function attach() {
    const parsed = parsePlaylistId(link);
    if (!parsed) {
      setBad(true);
      return;
    }
    onProfile({
      ...profile,
      playlistId: parsed,
      // Their words for it, or a neutral stand-in. We cannot read the title
      // without their library, and inventing one would be a small lie on a
      // screen whose whole voice is not doing that.
      playlistName: name.trim() || "Your gym playlist",
    });
    setOpen(false);
    setLink("");
    setName("");
    setBad(false);
  }

  function detach() {
    const { playlistId: _id, playlistName: _name, ...rest } = profile;
    onProfile(rest);
  }

  // A caption, not a settings row. It sits directly under the Start button and
  // reads as a footnote to it — small, centred, dim — so tapping Start with a
  // playlist set feels like one intent ("start, with my music") rather than two
  // controls stacked. When Spotify takes the foreground on the tap, the person
  // has already been told here that it would.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          id
            ? `${profile.playlistName} plays when you start. Tap to change.`
            : "Add a gym playlist to play when you start"
        }
        className="tap mx-auto flex items-center justify-center gap-2 text-caption transition-opacity hover:opacity-80"
      >
        <Note />
        {id ? (
          <span className="truncate">
            <span className="text-dim">Plays when you start · </span>
            <span className="text-cyan">{profile.playlistName}</span>
          </span>
        ) : (
          <span className="text-cyan">Add music for when you start</span>
        )}
      </button>
    );
  }

  return (
    <Card className="rise p-[18px]">
      <label htmlFor="pl" className="label block text-dim">
        Paste a Spotify playlist link
      </label>
      <input
        id="pl"
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          setBad(false);
        }}
        autoFocus
        inputMode="url"
        placeholder="open.spotify.com/playlist/…"
        className="mt-2.5 w-full rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What do you call it? (optional)"
        className="mt-2 w-full rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
      />
      {bad && (
        <p className="mt-2.5 text-body text-dim">
          That is not a playlist link. In Spotify: Share → Copy link to playlist.
        </p>
      )}
      <p className="mt-2.5 text-body text-dim">
        Opens in Spotify when you start. Skip it and the workout starts the same.
      </p>
      <div className="mt-2.5 flex gap-2">
        <Pill size="sm" onClick={attach} disabled={!link.trim()} className="h-12 flex-1">
          Save
        </Pill>
        {id && (
          <button
            type="button"
            onClick={detach}
            className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
          >
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

/** Line weight matched to the rest of the app's few glyphs. */
function Note() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-cyan" fill="currentColor" aria-hidden>
      <path d="M13 2.2 5.6 3.9a.6.6 0 0 0-.47.59v6.24a2.2 2.2 0 1 0 1.2 1.96V6.2l6.2-1.42v4.63a2.2 2.2 0 1 0 1.2 1.96V2.79A.6.6 0 0 0 13 2.2Z" />
    </svg>
  );
}
