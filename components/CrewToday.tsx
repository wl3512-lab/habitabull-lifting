"use client";

import { useEffect, useState } from "react";
import { crewCode, enabled, fetchDay, type CrewDay } from "@/lib/cloud";

/**
 * One line about the crew, on the screen the app actually opens to.
 *
 * Everything social was buried behind opening a specific calendar day, which
 * meant a reply nobody found was a reply nobody got. This is the surface for
 * it, and it is deliberately one line: who else showed up, and whether anyone
 * answered your photo.
 *
 * It is not a feed, and it never counts anyone's training against yours. The
 * deck's Competitor wanted a ranking; what the research supports is knowing
 * somebody else turned up too, which is a different feeling entirely.
 *
 * Renders nothing at all when there is no crew, no answer, or nothing to say —
 * an empty social card on a home screen is a reminder that nobody replied.
 */
export default function CrewToday({
  date,
  onOpen,
  preview,
}: {
  date: string;
  onOpen: () => void;
  /** Supplied instead of fetched, so /frames can show the line statically. */
  preview?: CrewDay;
}) {
  const [day, setDay] = useState<CrewDay | null>(preview ?? null);

  useEffect(() => {
    if (preview || !enabled() || !crewCode()) return;
    let live = true;
    fetchDay(date).then((d) => live && setDay(d));
    return () => {
      live = false;
    };
  }, [date, preview]);

  if (!day) return null;

  const others = day.trained.filter((m) => !m.mine).map((m) => m.name);
  const mine = day.photos.find((p) => p.mine);
  const likes = mine?.likes ?? 0;
  const replies = mine?.replies.length ?? 0;

  if (others.length === 0 && likes === 0 && replies === 0) return null;

  const who =
    others.length === 0
      ? null
      : others.length === 1
        ? `${others[0]} trained today.`
        : others.length === 2
          ? `${others[0]} and ${others[1]} trained today.`
          : `${others[0]}, ${others[1]} and ${others.length - 2} more trained today.`;

  const answered = [
    likes > 0 && `${likes} ${likes === 1 ? "like" : "likes"}`,
    replies > 0 && `${replies} ${replies === 1 ? "reply" : "replies"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-8 flex w-full items-center gap-3.5 rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
    >
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${others.length > 0 ? "bg-green" : "bg-cyan"}`}
      />
      <span className="flex-1">
        {who && <span className="block text-[17px] leading-snug text-fg">{who}</span>}
        {answered && (
          <span className={`block text-[15px] leading-snug ${who ? "mt-0.5 text-dim" : "text-fg"}`}>
            {answered} on your photo.
          </span>
        )}
      </span>
      <span className="head shrink-0 text-[15px] text-cyan">Open</span>
    </button>
  );
}
