"use client";

import { useEffect, useState } from "react";
import { Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { listPhotos, photoUrl, type PhotoMeta } from "@/lib/photos";
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

/**
 * A day, opened from the calendar (deck lo-fi p36).
 *
 * What you lifted, what you wrote, and what you looked like — the three things
 * the 2023 flow put behind a calendar day and the first redesign pass dropped.
 * A rest day is not an empty state to apologise for; it says so plainly and
 * leaves.
 */
export default function DayDetail({
  date,
  session,
  onBack,
}: {
  date: string;
  session?: Session;
  onBack: () => void;
}) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [hero, setHero] = useState(0);

  useEffect(() => {
    listPhotos().then((all) => setPhotos(all.filter((p) => p.date === date)));
  }, [date]);

  const d = new Date(date + "T00:00:00");
  const trained = Boolean(session?.completedAt);
  const lifts = (session?.exercises ?? []).filter((e) => e.sets.some((s) => s.done));

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

      {session?.note && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Notes</p>
          <p className="mt-2 text-[17px] italic leading-snug text-fg">{session.note}</p>
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

      {!trained && photos.length === 0 && (
        <p className="mt-5 text-[17px] text-dim">
          Nothing here. Rest is part of it.
        </p>
      )}

      <div className="mt-auto pt-8">
        <Pill variant="ghost" onClick={onBack}>
          Back to the calendar
        </Pill>
      </div>
    </main>
  );
}
