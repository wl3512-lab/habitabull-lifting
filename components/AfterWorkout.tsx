"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, Stat } from "./ui";
import { crewCode, enabled, sharePhoto, type SharedDay } from "@/lib/cloud";
import { nameOf } from "@/lib/exercises";
import { addPhoto, listPhotos, photoData } from "@/lib/photos";
import {
  NAME_MAX,
  cleanName,
  fromSession,
  makeWorkout,
  savedAs,
  shareableFromSession,
} from "@/lib/workouts";
import type { Profile, SavedWorkout, Session } from "@/lib/types";

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
 * Sharing is one switch. It remembers where she left it, because somebody who
 * shares every session should not re-tick the same box three times a week —
 * but remembering a position is not the same as a setting she turns on once
 * and forgets. The switch only exists on screen when a photo does, it sits
 * beside that photo naming exactly what will travel, and she passes it on the
 * way to Save. A checkbox she can see is the difference between choosing to be
 * seen and having been opted in; a preference buried on the crew screen would
 * be invisible at the only moment it matters.
 */
export default function AfterWorkout({
  session,
  records,
  profile,
  onProfile,
  onSave,
  onSkip,
  workouts,
  onSaveWorkout,
  onShareWorkout,
}: {
  session: Session;
  records: string[];
  profile: Profile;
  onProfile: (p: Profile) => void;
  onSave: (note: string | undefined) => void;
  onSkip: () => void;
  /** What she has already saved, so an identical workout is not offered twice. */
  workouts?: SavedWorkout[];
  /**
   * Keep what she just trained as a workout of her own. Committed the moment
   * she presses it, not with the note — "Nothing to add" is a real way off this
   * screen and a workout she asked to keep must not leave with it.
   */
  onSaveWorkout?: (w: SavedWorkout) => void;
  /** Share the named workout to the crew as copyable lifts, never numbers. */
  onShareWorkout?: (w: SharedDay) => Promise<boolean | void> | boolean | void;
}) {
  const remembered = profile.sharePhotos === true;
  const [note, setNote] = useState(session.note ?? "");
  const [photoCount, setPhotoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [share, setShare] = useState(remembered);
  const [saving, setSaving] = useState(false);
  // Only a photo added on this screen can be shared from it.
  const [added, setAdded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  /*
    Keeping this workout.

    A quick workout is improvised lift by lift and deliberately does not write
    itself back over the day it landed on, and neither does a day rebuilt around
    something that hurts. Both are right, and both mean the session she just
    trained exists nowhere once this screen closes — so this is where to ask. A
    planned day needs no asking: it already comes back next week on its own.

    "Quick workout" is the app's word for a session it had no plan for, so it is
    not a name for hers. The field starts empty and says what a name looks like.
  */
  const lineup = fromSession(session);
  const impromptu = Boolean(session.freestyle || session.adapted);
  const held = savedAs(workouts ?? [], lineup);
  const [workoutName, setWorkoutName] = useState("");
  const [kept, setKept] = useState<string | null>(null);
  const [crewShare, setCrewShare] = useState<"idle" | "sharing" | "shared" | "failed">("idle");

  const hasCrew = enabled() && Boolean(crewCode());
  // The switch is drawn and remembered on the same condition, so a remembered
  // "on" can never survive into a session where nothing was there to tick.
  const canShare = hasCrew && added.length > 0;
  const canShareWorkout = Boolean(hasCrew && onShareWorkout && impromptu && lineup.length > 0);
  const named = kept ?? held?.name ?? cleanName(workoutName);

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

  // The finish tiles: minutes (when timed) + lifts + sets + PRs (on a PR day).
  // Three fit one even row; two or four read best two-up. Fitting the columns to
  // the count keeps the tiles roomy instead of letting a long minute count push
  // the row past the screen edge.
  const statCount = (minutes !== null ? 1 : 0) + 2 + (records.length > 0 ? 1 : 0);

  function keepWorkout() {
    const name = cleanName(workoutName);
    if (!name || !onSaveWorkout || lineup.length === 0) return;
    onSaveWorkout(makeWorkout(name, lineup));
    setKept(name);
  }

  function keepWorkoutNamed(name: string): string | null {
    const existing = kept ?? held?.name;
    if (existing) return existing;
    const clean = cleanName(name);
    if (!clean || !onSaveWorkout || lineup.length === 0) return null;
    onSaveWorkout(makeWorkout(clean, lineup));
    setKept(clean);
    return clean;
  }

  async function shareWorkout() {
    if (!onShareWorkout) return;
    const name = keepWorkoutNamed(workoutName);
    if (!name) return;
    const shareable = shareableFromSession(session, name);
    if (!shareable) return;
    setCrewShare("sharing");
    const ok = await onShareWorkout(shareable);
    setCrewShare(ok === false ? "failed" : "shared");
  }

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
   *
   * The switch's position is remembered only when the switch was on screen to
   * be moved. A session with no photo had nothing to decide, and should not
   * quietly rewrite a decision made on the last one.
   */
  async function finish() {
    const text = note.trim() || undefined;
    if (canShare && share !== remembered) onProfile({ ...profile, sharePhotos: share });
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
      <p className="label text-done">Workout complete</p>
      <h1 className="statement mt-2 text-figure text-fg">{session.label}</h1>

      <div className={`mt-5 grid gap-2.5 ${statCount === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {minutes !== null && <Stat value={minutes} label="min" />}
        <Stat value={lifts.length} label={lifts.length === 1 ? "lift" : "lifts"} />
        <Stat value={sets} label={sets === 1 ? "set" : "sets"} />
        {records.length > 0 && (
          <div className="flex-1 rounded-2xl bg-card p-[18px]">
            <div className="tabular statement text-figure text-action">{records.length}</div>
            <div className="mt-1 text-body leading-tight text-dim">
              {records.length === 1 ? "PR" : "PRs"}
            </div>
          </div>
        )}
      </div>

      {/*
        The one question this screen asks about the training rather than about
        recording it: was that a workout you want again? It sits above the photo
        and the note because it is about what just happened, and it is skippable
        by being ignored, like everything else here.
      */}
      {(onSaveWorkout || onShareWorkout) && impromptu && lineup.length > 0 && (
        <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
          {(kept ?? held) ? (
            <>
              <p className="label text-done">Kept</p>
              <p className="mt-1.5 text-emphasis leading-snug text-fg">
                Saved as {kept ?? held?.name}.
              </p>
              <p className="mt-1 text-body leading-snug text-dim">
                It is in your saved workouts. Put it on any day from your plan.
              </p>
              {canShareWorkout && (
                <div className="mt-4 border-t border-line pt-3.5">
                  <p className="label text-dim">Crew</p>
                  <p className="mt-1 text-body leading-snug text-dim">
                    Share the lifts so they can copy it. Never your weights.
                  </p>
                  <Pill
                    size="sm"
                    variant="ghost"
                    onClick={() => void shareWorkout()}
                    disabled={crewShare === "sharing" || crewShare === "shared"}
                    className="mt-3 h-11 w-full"
                  >
                    {crewShare === "sharing"
                      ? "Sharing..."
                      : crewShare === "shared"
                        ? "Shared with crew"
                        : "Share with crew"}
                  </Pill>
                  {crewShare === "failed" && (
                    <p role="status" className="mt-2 text-body text-dim">
                      Could not reach your crew. The workout is still saved here.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="label text-dim">Keep this one?</p>
              <p className="mt-1.5 text-emphasis leading-snug text-fg">
                {session.freestyle
                  ? "You made this up as you went. Name it and you can train it again."
                  : "Today was rebuilt, so it is not on your plan. Name it and you can put it on a day."}
              </p>
              <p className="mt-1 text-body leading-snug text-dim">
                {lineup.map((e) => nameOf(e.exerciseId)).join(", ")}
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <input
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  maxLength={NAME_MAX}
                  placeholder="Hotel gym day"
                  aria-label="Name this workout"
                  className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <button
                  type="button"
                  onClick={keepWorkout}
                  disabled={!onSaveWorkout || !cleanName(workoutName)}
                  className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
                >
                  Save
                </button>
              </div>
              {canShareWorkout && (
                <div className="mt-3 border-t border-line pt-3.5">
                  <p className="text-body leading-snug text-dim">
                    Share it with your crew too. They get the lifts to copy, not your
                    weights.
                  </p>
                  <Pill
                    size="sm"
                    variant="ghost"
                    onClick={() => void shareWorkout()}
                    disabled={!named || crewShare === "sharing" || crewShare === "shared"}
                    className="mt-3 h-11 w-full"
                  >
                    {crewShare === "sharing"
                      ? "Sharing..."
                      : crewShare === "shared"
                        ? "Shared with crew"
                        : "Share with crew"}
                  </Pill>
                  {crewShare === "failed" && (
                    <p role="status" className="mt-2 text-body text-dim">
                      Could not reach your crew. The workout is still saved here.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

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
        <span aria-hidden className="block text-head leading-none text-cyan">
          +
        </span>
        <span className="head mt-2 block text-emphasis text-cyan">
          {busy ? "Saving…" : photoCount > 0 ? "Add another photo" : "Add a progress photo"}
        </span>
        <span className="mt-0.5 block text-body text-dim">
          {photoCount > 0
            ? `${photoCount} on the calendar for ${dayLabel}`
            : `Goes on the calendar for ${dayLabel}`}
        </span>
      </button>
      {failed && (
        <p className="mt-2 text-body text-dim">
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
          className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-emphasis italic leading-snug text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
        />
      </div>

      {canShare && (
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
            className="peer h-6 w-6 shrink-0 appearance-none rounded-xl border-2 border-line-strong bg-transparent transition-colors checked:border-cyan checked:bg-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <span
            aria-hidden
            className="pointer-events-none -ml-[34px] mr-[10px] h-6 w-6 shrink-0 text-center text-body leading-6 text-ground opacity-0 transition-opacity peer-checked:opacity-100"
          >
            ✓
          </span>
          <span className="flex-1">
            <span className="block text-emphasis leading-snug text-fg">
              Share this photo with your crew
            </span>
            <span className="mt-0.5 block text-body leading-snug text-dim">
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
          className="head tap mt-2.5 block w-full text-center text-body text-dim transition-colors hover:text-fg"
        >
          Nothing to add
        </button>
      </div>
    </main>
  );
}
