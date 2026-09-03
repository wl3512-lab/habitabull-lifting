"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pill } from "./ui";
import { streakWeeks } from "@/lib/engine";
import {
  isoDate,
  longestComebackGap,
  monthMatrix,
  sessionsInMonth,
  yearCounts,
} from "@/lib/calendar";
import { addPhoto, deletePhoto, listPhotos, photoUrl, type PhotoMeta } from "@/lib/photos";
import { buildIcs, googleUrl } from "@/lib/ics";
import type { Profile, Session } from "@/lib/types";

const DAY_HEADS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** One thumbnail. Owns its object URL so it can revoke it on unmount. */
function Thumb({
  photo,
  onOpen,
}: {
  photo: PhotoMeta;
  onOpen: (id: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    photoUrl(photo.id).then((u) => {
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
  }, [photo.id]);

  const label = new Date(photo.date + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

  return (
    <button
      type="button"
      onClick={() => onOpen(photo.id)}
      className="relative aspect-[3/4] w-[104px] shrink-0 overflow-hidden rounded-xl bg-raise"
      aria-label={`Progress photo from ${label}`}
    >
      {url ? (
        // Blobs from IndexedDB, so next/image would only get in the way.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ground/90 to-transparent px-2 pb-1.5 pt-5 text-left text-[13px] text-fg">
        {label}
      </span>
    </button>
  );
}

/**
 * The calendar the 2023 flow had and the first redesign pass dropped: month
 * view, streak, and progress photos in one place (deck p27, p36).
 *
 * The photos are the point. Cathy wants them, the flow had them, and the Miro
 * sticky asked for "compare pictures after each month" — so the strip has two
 * modes, and the second one shows a single photo per month oldest to newest,
 * which is the comparison rather than another gallery.
 */
export default function Calendar({
  profile,
  sessions,
  onOpenDay,
}: {
  profile: Profile;
  sessions: Session[];
  onOpenDay: (date: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState<"month" | "year">("month");
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [compare, setCompare] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listPhotos().then(setPhotos);
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const photoDates = useMemo(() => photos.map((p) => p.date), [photos]);
  const rows = useMemo(
    () => monthMatrix(year, month, sessions, photoDates, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, month, sessions, photoDates]
  );
  const weeks = streakWeeks(sessions);
  const longest = longestComebackGap(sessions);
  const thisMonth = sessionsInMonth(sessions, year, month);
  const counts = useMemo(() => yearCounts(sessions, year), [sessions, year]);

  // One photo per month, oldest first — the comparison the sticky asked for.
  const strip = useMemo(() => {
    if (!compare) return photos;
    const seen = new Set<string>();
    return [...photos]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((p) => {
        const key = p.date.slice(0, 7);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [photos, compare]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFailed(false);
    const meta = await addPhoto(isoDate(today), file);
    if (meta) setPhotos(await listPhotos());
    else setFailed(true);
    setBusy(false);
  }

  async function remove(id: string) {
    await deletePhoto(id);
    setPhotos(await listPhotos());
    setOpenId(null);
  }

  const shift = (n: number) => setCursor(new Date(year, month + n, 1));

  /*
    Training days are the only thing a reminder actually needs. This used to
    also demand an explicit clock time, which hid the button from everyone who
    answered "whenever I can" — the people most likely to need a nudge. buildIcs
    has always handled a missing time by taking the hour from their chosen slot,
    or 18:00, so the gate was stricter than the thing it was gating.
  */
  const reminderReady = profile.trainingDays.length > 0;

  function saveReminder() {
    const ics = buildIcs(profile);
    if (!ics) return;
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "habitabull-training.ics";
    // Firefox ignores a click on an anchor that is not in the document, and a
    // silent no-op is the worst possible outcome for a button whose entire job
    // is to hand over a file.
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking in the same tick can cancel the download on Safari.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Calendar</p>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        {/* 34px, not the usual 44: "September 2026" plus the toggle has to
            hold one line at 390px, and a wrapped month name reads as a bug. */}
        <h1 className="statement min-w-0 text-[34px] text-fg">
          {view === "month" ? MONTHS[month] : year}{" "}
          {view === "month" && <span className="text-dim">{year}</span>}
        </h1>
        <div className="flex shrink-0 rounded-full bg-card p-1" role="tablist">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`head h-11 rounded-full px-4 text-[15px] capitalize transition-colors duration-150 ${
                view === v ? "bg-raise text-fg" : "text-dim hover:text-fg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="mt-4 rounded-2xl bg-card p-[18px]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shift(-1)}
                aria-label="Previous month"
                className="head grid h-11 w-11 place-items-center rounded-full text-[17px] text-cyan transition-colors hover:bg-raise"
              >
                ←
              </button>
              <p className="text-[15px] text-dim">
                {thisMonth} {thisMonth === 1 ? "session" : "sessions"}
              </p>
              <button
                type="button"
                onClick={() => shift(1)}
                aria-label="Next month"
                className="head grid h-11 w-11 place-items-center rounded-full text-[17px] text-cyan transition-colors hover:bg-raise"
              >
                →
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-y-1">
              {DAY_HEADS.map((d, i) => (
                <div key={i} className="pb-1 text-center text-[13px] text-dim">
                  {d}
                </div>
              ))}
              {rows.flat().map((c, i) => (
                // A leading blank in the month grid is spacing, not a control.
                // Rendering it as a disabled, nameless button puts an unlabelled
                // stop in the accessibility tree for nothing.
                c.iso === null ? (
                  <div key={`pad-${i}`} aria-hidden className="min-h-12" />
                ) : (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => onOpenDay(c.iso!)}
                  aria-label={`${c.day} ${MONTHS[month]}${c.trained ? ", trained" : ""}`}
                  className="flex min-h-12 flex-col items-center justify-center py-0.5"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-[15px] ${
                      c.trained
                        ? "bg-green text-ground"
                        : c.comeback
                          ? "bg-cyan text-ground"
                          : c.today
                            ? "text-fg ring-2 ring-cyan"
                            : c.future
                              ? "text-dim/50"
                              : "text-dim"
                    }`}
                  >
                    {c.day ?? ""}
                  </span>
                  <span
                    aria-hidden
                    className={`mt-0.5 h-1 w-1 rounded-full ${c.hasPhoto ? "bg-cyan" : "bg-transparent"}`}
                  />
                </button>
                )
              ))}
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] text-dim">
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-full bg-green" /> Trained
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-full bg-cyan" /> Came back
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan" /> Photo
              </li>
            </ul>
          </div>

          {/*
            The Figma card reads "6 day streak · You're on fire". Weeks, not
            days, per the sobriety-app model — and no hype line, which PRODUCT.md
            rules out by name. The line underneath it was already right.
          */}
          <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <p className="statement text-[30px] text-fg">
              {weeks} {weeks === 1 ? "week" : "weeks"} running
            </p>
            <p className="mt-1.5 text-[15px] text-dim">
              {longest > 0
                ? `Longest gap you have come back from: ${longest} days. A streak is a nice-to-have, not the score.`
                : "A streak is a nice-to-have, not the score."}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl bg-card p-[18px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(year - 1, month, 1))}
              aria-label="Previous year"
              className="head grid h-11 w-11 place-items-center rounded-full text-[17px] text-cyan transition-colors hover:bg-raise"
            >
              ←
            </button>
            <p className="text-[15px] text-dim">
              {counts.reduce((a, b) => a + b, 0)} sessions in {year}
            </p>
            <button
              type="button"
              onClick={() => setCursor(new Date(year + 1, month, 1))}
              aria-label="Next year"
              className="head grid h-11 w-11 place-items-center rounded-full text-[17px] text-cyan transition-colors hover:bg-raise"
            >
              →
            </button>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {counts.map((n, m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => {
                    setCursor(new Date(year, m, 1));
                    setView("month");
                  }}
                  className={`w-full rounded-xl p-3 text-left transition-colors duration-150 ${
                    n > 0 ? "bg-raise hover:bg-line" : "bg-ground hover:bg-raise/60"
                  }`}
                >
                  <span className="block text-[14px] text-dim">{MONTHS[m].slice(0, 3)}</span>
                  <span
                    className={`tabular statement block text-[24px] ${n > 0 ? "text-fg" : "text-dim/50"}`}
                  >
                    {n}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-dim">Progress photos</p>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setCompare(!compare)}
              aria-pressed={compare}
              className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
            >
              {compare ? "Show all" : "Compare months"}
            </button>
          )}
        </div>

        {strip.length > 0 ? (
          <div className="-mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1">
            {strip.map((p) => (
              <Thumb key={p.id} photo={p} onOpen={setOpenId} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-dim">
            Nothing yet. One photo a month is enough to see the thing that daily
            mirrors hide.
          </p>
        )}

        {compare && strip.length > 1 && (
          <p className="mt-2.5 text-[15px] text-dim">
            One photo per month, oldest first.
          </p>
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
        <div className="mt-3">
          <Pill variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Saving…" : "Add today's photo"}
          </Pill>
        </div>
        {failed && (
          <p className="mt-2 text-[15px] text-dim">
            Could not save that one. Private browsing blocks photo storage.
          </p>
        )}
      </section>

      {/*
        Habit principle 5, "repeat consistently". A web app cannot honestly
        schedule a local notification — Notification Triggers never shipped and
        Web Push needs a server — so the reminder goes where reminders actually
        fire. A calendar event works offline, on every platform, and outlives
        the app being deleted.
      */}
      <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">Reminders</p>
        {reminderReady ? (
          <>
            <p className="mt-2 text-[17px] leading-snug text-fg">
              Put your training days in the calendar you already look at, with a
              nudge fifteen minutes before.
            </p>
            <p className="mt-1.5 text-[15px] leading-snug text-dim">
              {profile.trainingMinute === undefined && (profile.anchors?.length ?? 0) === 0
                ? "You said whenever you can, so it lands at six and you can drag it."
                : "It repeats weekly, and you can move it whenever you like."}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {/*
                Google first because it is what most people actually open, and
                a link beats a downloaded file on a phone. The file stays for
                Apple Calendar, Outlook, and anyone who wants it to keep working
                after this app is gone.
              */}
              {/*
                Two doors to the same event, weighted the same. Which one is
                right depends on the phone in your hand, not on what the app
                would prefer — and this screen is for looking at, so it does
                not get a loud action.
              */}
              <Pill variant="ghost" href={googleUrl(profile) ?? undefined}>
                Add to Google Calendar
              </Pill>
              <Pill variant="ghost" onClick={saveReminder}>
                Download for Apple or Outlook
              </Pill>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-dim">
            Pick your training days in setup and this becomes a calendar reminder.
          </p>
        )}
      </section>

      {openId && <Lightbox id={openId} onClose={() => setOpenId(null)} onDelete={remove} />}
    </main>
  );
}

function Lightbox({
  id,
  onClose,
  onDelete,
}: {
  id: string;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-deep/95 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Progress photo"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="head tap text-[17px] text-fg"
          autoFocus
        >
          Close
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(id)}
        className="head tap mx-auto mt-4 text-[15px] text-dim transition-colors hover:text-fg"
      >
        Delete this photo
      </button>
    </div>
  );
}
