"use client";

import { useCallback, useEffect, useState } from "react";
import CrewPost from "./CrewPost";
import { Pill } from "./ui";
import { enabled, fetchDay, sharePhoto, type CrewDay, type CrewPhoto } from "@/lib/cloud";
import { nameOf } from "@/lib/exercises";
import { listPhotos, photoData, photoUrl, type PhotoMeta } from "@/lib/photos";
import type { Session } from "@/lib/types";

/** One photo, owning its object URL so it can revoke it on unmount. */
function Shot({ id, className }: { id: string; className: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    photoUrl(id).then((u) => {
      if (!live) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      made = u;
      setUrl(u);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  // A blob from IndexedDB; next/image would only get in the way.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : <div className={className} />;
}

/** How a small number of names reads out loud. */
function nameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * A day, opened from the calendar (deck lo-fi p36).
 *
 * What you lifted, what you wrote, and what you looked like — the three things
 * the 2023 flow put behind a calendar day and the first redesign pass dropped.
 * A rest day is not an empty state to apologise for; it says so plainly and
 * leaves.
 *
 * With a crew, the day also holds the part the deck kept asking for and never
 * built: who else trained, their photo if they shared one, and what anybody
 * said about yours. Everything crew-shaped disappears completely when there is
 * no crew — not greyed out, not teased, absent — because the app has to be
 * whole for one person on their own.
 */
export default function DayDetail({
  date,
  session,
  onBack,
  crewPreview,
}: {
  date: string;
  session?: Session;
  onBack: () => void;
  /** Supplied instead of fetched, so /frames can show the crew day statically. */
  crewPreview?: CrewDay;
}) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [hero, setHero] = useState(0);
  const [crew, setCrew] = useState<CrewDay | null>(crewPreview ?? null);
  const [open, setOpen] = useState<CrewPhoto | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    listPhotos().then((all) => setPhotos(all.filter((p) => p.date === date)));
  }, [date]);

  const loadCrew = useCallback(() => {
    if (crewPreview || !enabled()) return;
    fetchDay(date).then(setCrew);
  }, [date, crewPreview]);

  useEffect(loadCrew, [loadCrew]);

  const d = new Date(date + "T00:00:00");
  const trained = Boolean(session?.completedAt);
  const lifts = (session?.exercises ?? []).filter((e) => e.sets.some((s) => s.done));

  const mineShared = crew?.photos.find((p) => p.mine);
  const theirs = (crew?.photos ?? []).filter((p) => !p.mine);
  const alsoTrained = (crew?.trained ?? []).filter((m) => !m.mine);

  async function share() {
    const photo = photos[hero];
    if (!photo || sharing) return;
    setSharing(true);
    const data = await photoData(photo.id);
    if (data) await sharePhoto(date, data);
    setSharing(false);
    loadCrew();
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 text-[15px] text-cyan transition-opacity hover:opacity-70"
        >
          ‹ {d.toLocaleDateString(undefined, { month: "long" })}
        </button>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close"
          // An explicit square: .tap grows the height but a ✕ is too narrow to
          // reach 44 on padding alone.
          className="head -mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[17px] text-dim transition-colors hover:bg-raise hover:text-fg"
        >
          ✕
        </button>
      </div>

      <h1 className="statement mt-2 text-[44px] text-fg">
        {d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
      </h1>
      <p className="mt-1.5 flex items-center gap-2.5 text-[17px] text-dim">
        <span
          aria-hidden
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${trained ? "bg-green" : "bg-raise"}`}
        />
        {trained ? `You trained${session?.label ? ` · ${session.label}` : ""}` : "Rest day"}
      </p>

      {photos.length > 0 && (
        <>
          <div className="mt-5 overflow-hidden rounded-2xl bg-card">
            <Shot id={photos[hero].id} className="aspect-[4/5] w-full object-cover" />
          </div>
          {photos.length > 1 && (
            <div className="mt-2.5 flex gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setHero(i)}
                  aria-label={`Photo ${i + 1} of ${photos.length}`}
                  aria-current={i === hero}
                  className={`h-11 w-11 shrink-0 overflow-hidden rounded-xl ${
                    i === hero ? "ring-2 ring-cyan" : "opacity-60"
                  }`}
                >
                  <Shot id={p.id} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

        </>
      )}

      {/*
        Her own photo when the local copy is gone — a new phone, or storage the
        browser evicted. What she shared is still hers to look at.
      */}
      {photos.length === 0 && mineShared && (
        <button
          type="button"
          onClick={() => setOpen(mineShared)}
          // The name says what pressing it does. "Your photo" describes the
          // picture, which a button is not.
          aria-label="Open the photo you shared"
          className="mt-5 block w-full overflow-hidden rounded-2xl bg-card"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mineShared.url} alt="" className="aspect-[4/5] w-full object-cover" />
        </button>
      )}

      {/*
        What the crew said about her photo, and the one control that put it
        there. Sharing is a deliberate act every time — the photo lives on her
        phone until she taps this, and nothing uploads on its own.
      */}
      {mineShared ? (
        <button
          type="button"
          onClick={() => setOpen(mineShared)}
          className="mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-card p-[18px] text-left transition-colors hover:bg-raise"
        >
          <span className="text-[19px] text-cyan" aria-hidden>
            {mineShared.likes > 0 ? "♥" : "♡"}
          </span>
          <span className="flex-1 text-[17px] text-fg">
            {mineShared.likes === 0 && mineShared.replies.length === 0
              ? "Shared with your crew"
              : [
                  mineShared.likes > 0 &&
                    `${mineShared.likes} ${mineShared.likes === 1 ? "like" : "likes"}`,
                  mineShared.replies.length > 0 &&
                    `${mineShared.replies.length} ${
                      mineShared.replies.length === 1 ? "reply" : "replies"
                    }`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
          <span className="head shrink-0 text-[15px] text-cyan">Open</span>
        </button>
      ) : (
        crew &&
        photos.length > 0 && (
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            className="head tap mt-2.5 self-start text-[15px] text-cyan transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {sharing ? "Sharing…" : "Share this with your crew"}
          </button>
        )
      )}

      {session?.note && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Notes</p>
          <p className="mt-2 text-[17px] italic leading-snug text-fg">{session.note}</p>
        </section>
      )}

      {/*
        Who else showed up. Names, and a photo if they shared one — never a
        weight, never a rank. This is the whole of what a crew is allowed to
        know about your training, and the schema has no column for more.
      */}
      {(alsoTrained.length > 0 || theirs.length > 0) && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Also trained</p>
          {alsoTrained.length > 0 && (
            <p className="mt-2 text-[17px] leading-snug text-fg">
              {nameList(alsoTrained.map((m) => m.name))}
              {alsoTrained.length === 1 ? " was in too." : " were in too."}
            </p>
          )}
          {theirs.length > 0 && (
            <div className="no-scrollbar -mx-[18px] mt-3.5 flex gap-2.5 overflow-x-auto px-[18px]">
              {theirs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpen(p)}
                  className="w-[92px] shrink-0 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/5] w-full rounded-xl object-cover"
                  />
                  <span className="head mt-1.5 block truncate text-[15px] text-dim">
                    {p.memberName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {lifts.length > 0 && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">What you lifted</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {lifts.map((e) => {
              const done = e.sets.filter((s) => s.done);
              const top = done.reduce((a, b) => (b.weight > a.weight ? b : a));
              return (
                <li key={e.exerciseId} className="flex items-baseline justify-between gap-3">
                  <span className="head text-[17px] text-fg">{nameOf(e.exerciseId)}</span>
                  <span className="tabular statement shrink-0 text-[20px] text-cyan">
                    {top.weight > 0 && `${top.weight} lb · `}
                    {done.length} × {top.reps}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!trained && photos.length === 0 && alsoTrained.length === 0 && (
        <p className="mt-5 text-[17px] text-dim">
          Nothing here. Rest is part of it.
        </p>
      )}

      <div className="mt-auto pt-8">
        <Pill variant="ghost" onClick={onBack}>
          Back to the calendar
        </Pill>
      </div>

      {open && (
        <CrewPost
          photo={open}
          preview={Boolean(crewPreview)}
          onClose={() => setOpen(null)}
          onChanged={loadCrew}
        />
      )}
    </main>
  );
}
