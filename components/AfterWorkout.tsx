"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, Stat } from "./ui";
import { crewCode, enabled, sharePhoto } from "@/lib/cloud";
import { nameOf } from "@/lib/exercises";
import { addPhoto, listPhotos, photoData } from "@/lib/photos";
import type { Session } from "@/lib/types";

/**
 * The session, written down (deck p29/p30: "option to write notes", "option to
 * upload pictures").
 *
 * It comes after the celebration, not before it. The bull reacts the moment the
 * last set lands, because that is the retention mechanism and it should never
 * be gated behind a form; this screen is the optional part, one tap away, for
 * the person who wants to record something. Skipping it costs nothing.
 *
 * The note is free text on purpose. Ryder (deck p21) keeps a paper journal
 * "because he can write anything he wants" — a mood picker or a tag list would
 * be the app deciding what is worth saying.
 *
 * Sharing is one switch, off every time. This is the only place a photo can
 * reach the crew, and it is deliberately a decision she makes about *this*
 * photo rather than a setting she turns on once and forgets — the difference
 * between choosing to be seen and having been opted in.
 */
export default function AfterWorkout({
  session,
  records,
  onSave,
  onSkip,
}: {
  session: Session;
  records: string[];
  onSave: (note: string | undefined) => void;
  onSkip: () => void;
}) {
  const [note, setNote] = useState(session.note ?? "");
  const [photoCount, setPhotoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  // Only a photo added on this screen can be shared from it.
  const [added, setAdded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasCrew = enabled() && Boolean(crewCode());

  useEffect(() => {
    listPhotos().then((all) => setPhotoCount(all.filter((p) => p.date === session.date).length));
  }, [session.date]);

  const lifts = session.exercises.filter((e) => e.sets.some((s) => s.done));
  const sets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const minutes =
    session.startedAt && session.completedAt
      ? Math.max(1, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60000))
      : null;

  const dayLabel = new Date(session.date + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFailed(false);
    const meta = await addPhoto(session.date, file);
    if (meta) {
      setPhotoCount((n) => n + 1);
      setAdded((ids) => [...ids, meta.id]);
    } else setFailed(true);
    setBusy(false);
  }

  /**
   * Save, and share if she asked for it. The share is awaited so a failure
   * cannot leave her believing the crew saw something they did not — but the
   * workout is saved either way, because a network is never a reason to lose a
   * session.
   */
  async function finish() {
    const text = note.trim() || undefined;
    if (share && added.length > 0) {
      setSaving(true);
      const data = await photoData(added[added.length - 1]);
      if (data) await sharePhoto(session.date, data, text);
      setSaving(false);
    }
    onSave(text);
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-green">
        Workout complete{minutes !== null && ` · ${minutes} min`}
      </p>
      <h1 className="statement mt-2 text-[44px] text-fg">{session.label}</h1>

      <div className="mt-5 flex gap-2.5">
        <Stat value={lifts.length} label={lifts.length === 1 ? "lift" : "lifts"} />
        <Stat value={sets} label={sets === 1 ? "set" : "sets"} />
        {records.length > 0 && (
          <div className="flex-1 rounded-2xl bg-card p-[18px]">
            <div className="tabular statement text-[40px] text-orange">{records.length}</div>
            <div className="mt-1 text-[15px] leading-tight text-dim">
              {records.length === 1 ? "PR" : "PRs"}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-2.5 rounded-2xl border border-dashed border-line-strong p-6 text-center transition-colors hover:bg-raise/40 disabled:opacity-50"
      >
        <span aria-hidden className="block text-[22px] leading-none text-cyan">
          +
        </span>
        <span className="head mt-2 block text-[17px] text-cyan">
          {busy ? "Saving…" : photoCount > 0 ? "Add another photo" : "Add a progress photo"}
        </span>
        <span className="mt-0.5 block text-[15px] text-dim">
          {photoCount > 0
            ? `${photoCount} on the calendar for ${dayLabel}`
            : `Goes on the calendar for ${dayLabel}`}
        </span>
      </button>
      {failed && (
        <p className="mt-2 text-[15px] text-dim">
          Could not save that one. Private browsing blocks photo storage.
        </p>
      )}

      <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <label htmlFor="note" className="label block text-dim">
          Notes
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Felt strong. Bar speed was good on the last set — go up 5 lb next time."
          className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-[17px] italic leading-snug text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
        />
      </div>

      {hasCrew && added.length > 0 && (
        <label className="mt-2.5 flex cursor-pointer items-center gap-3.5 rounded-2xl bg-card p-[18px]">
          {/*
            A native checkbox paints a light grey box that belongs to no part of
            this palette. Same element, same semantics, drawn in the system's
            own tokens.
          */}
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="peer h-6 w-6 shrink-0 appearance-none rounded-lg border-2 border-line-strong bg-transparent transition-colors checked:border-cyan checked:bg-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <span
            aria-hidden
            className="pointer-events-none -ml-[34px] mr-[10px] h-6 w-6 shrink-0 text-center text-[15px] leading-6 text-ground opacity-0 transition-opacity peer-checked:opacity-100"
          >
            ✓
          </span>
          <span className="flex-1">
            <span className="block text-[17px] leading-snug text-fg">
              Share this with your crew
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug text-dim">
              {note.trim()
                ? "The photo and this note. They can like it or reply."
                : "The photo. They can like it or reply."}
            </span>
          </span>
        </label>
      )}

      <div className="mt-auto pt-8">
        <Pill onClick={finish} disabled={saving}>
          {saving ? "Sharing…" : "Save workout"}
        </Pill>
        <button
          type="button"
          onClick={onSkip}
          className="head tap mt-2.5 block w-full text-center text-[15px] text-dim transition-colors hover:text-fg"
        >
          Nothing to add
        </button>
      </div>
    </main>
  );
}
