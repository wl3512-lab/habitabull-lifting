"use client";

import { useEffect, useRef, useState } from "react";
import { likePhoto, replyToPhoto, unsharePhoto, type CrewPhoto } from "@/lib/cloud";

/**
 * Somebody else's day, opened.
 *
 * The photo, who took it, and the two things you can do about it: say you saw
 * it, or say something. That is the whole interaction, and the restraint is the
 * point — the deck's Competitor archetype wanted a leaderboard and got a crew
 * instead, so this must never become a place to compare. There is no number on
 * this screen except a count of people who liked a picture.
 *
 * Both actions are optimistic. A like that waits on a round trip feels broken
 * on gym wifi, and the worst case of getting it wrong is a heart that comes
 * back unfilled.
 */
export default function CrewPost({
  photo,
  onClose,
  onChanged,
  preview = false,
}: {
  photo: CrewPhoto;
  onClose: () => void;
  onChanged: () => void;
  /** /frames renders this against fixtures; nothing should reach the network. */
  preview?: boolean;
}) {
  const [liked, setLiked] = useState(photo.likedByMe);
  const [likes, setLikes] = useState(photo.likes);
  const [replies, setReplies] = useState(photo.replies);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape closes, and focus moves into the sheet so a keyboard is not left
    // behind on the calendar underneath it.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prior;
    };
  }, [onClose]);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    const ok = preview || (await likePhoto(photo.id, next));
    if (!ok) {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = preview || (await replyToPhoto(photo.id, body));
    setSending(false);
    if (!ok) return;
    setDraft("");
    // Shown immediately under her own name; the next open reads the real row.
    setReplies((r) => [...r, { id: `local-${Date.now()}`, memberName: "You", mine: true, body }]);
    onChanged();
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    const ok = preview || (await unsharePhoto(photo.id));
    setRemoving(false);
    if (ok) {
      onChanged();
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.memberName}'s photo`}
      ref={sheet}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex justify-center bg-ground/95 backdrop-blur-sm outline-none"
    >
      <div className="no-scrollbar flex w-full max-w-[430px] flex-col overflow-y-auto px-6 pb-8 pt-12">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="head truncate text-[17px] text-fg">
              {photo.mine ? "You" : photo.memberName}
            </p>
            <p className="label text-dim">Shared with your crew</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="head -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[17px] text-dim transition-colors hover:bg-raise hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-card">
          {/* A signed URL from object storage; next/image would only proxy it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`${photo.memberName} on this day`}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label={liked ? "Undo your like" : "Like this"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] transition-colors ${
              liked ? "bg-cyan text-ground" : "bg-raise text-dim hover:text-fg"
            }`}
          >
            {liked ? "♥" : "♡"}
          </button>
          <p className="tabular flex-1 text-right text-[15px] text-dim">
            {likes === 0 ? "No likes yet" : `${likes} ${likes === 1 ? "like" : "likes"}`}
          </p>
        </div>

        {photo.caption && (
          <p className="mt-3 text-[17px] leading-snug text-fg">
            <span className="head text-dim">{photo.mine ? "You" : photo.memberName} </span>
            {photo.caption}
          </p>
        )}

        {replies.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            {replies.map((r) => (
              <li key={r.id} className="text-[17px] leading-snug text-fg">
                <span className="head text-dim">{r.mine ? "You" : r.memberName} </span>
                {r.body}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="mt-4 flex items-center gap-2.5"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder={photo.mine ? "Add a note" : `Say something to ${photo.memberName}`}
            aria-label="Your reply"
            className="min-w-0 flex-1 rounded-full bg-card px-[18px] py-3 text-[17px] text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-[15px] text-ground transition-opacity disabled:opacity-30"
          >
            Send
          </button>
        </form>

        {photo.mine && (
          <button
            type="button"
            onClick={remove}
            className="tap mt-6 self-start text-[15px] text-dim underline underline-offset-4 transition-colors hover:text-fg"
          >
            {removing ? "Removing…" : "Stop sharing this photo"}
          </button>
        )}
      </div>
    </div>
  );
}
