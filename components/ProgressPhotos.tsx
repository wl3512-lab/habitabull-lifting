"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pill } from "./ui";
import { isoDate } from "@/lib/calendar";
import { addPhoto, deletePhoto, listPhotos, type PhotoMeta } from "@/lib/photos";
import { apart, byMonth, newestFirst, photoSpan } from "@/lib/photo-album";
import { usePhotoUrl } from "@/lib/use-photo-url";

/**
 * A photo as this page needs it. `url` is only ever set by /frames, which has
 * no IndexedDB of its own to read stand-ins from.
 */
export type AlbumPhoto = Pick<PhotoMeta, "id" | "date"> & { addedAt?: string; url?: string };

/** Everything a keyboard can land on, in order. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

const at = (iso: string) => new Date(iso + "T00:00:00");

/** "3 Mar", or "3 Mar 2025" once it is not this year. */
function shortDate(iso: string, today: string): string {
  return at(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  });
}

function longDate(iso: string): string {
  return at(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** One photo, from IndexedDB or from a fixture's own URL. Nothing until it has one. */
function Picture({
  photo,
  className,
  lazy = false,
}: {
  photo: AlbumPhoto;
  className: string;
  lazy?: boolean;
}) {
  const stored = usePhotoUrl(photo.url ? null : photo.id);
  const src = photo.url ?? stored;
  if (!src) return null;
  return (
    // A blob from IndexedDB; next/image would only get in the way.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      decoding="async"
      loading={lazy ? "lazy" : undefined}
      className={className}
    />
  );
}

/**
 * Her progress photos, on a page of their own (deck p21, p27, p36).
 *
 * The calendar card was a strip of 104px thumbnails, which is a fine way to
 * notice that photos exist and no way at all to look at them. This page is for
 * looking. It opens on the comparison, because the Miro sticky asked for
 * "compare pictures after each month" and a gallery alone is not that: her
 * first photo and her latest, side by side, with how far apart they are in
 * plain words. Every other photo follows, by month.
 *
 * The pair and the viewer never crop. A crop decides what a comparison is
 * about, and what a progress photo is about is hers to decide, so both sit
 * whole on the deepest ground with the leftover space showing. Grid tiles do
 * crop: they are for finding a photo, not for looking at one.
 *
 * Nothing here is scored, ranked, measured or set beside anybody else's. The
 * only numbers on the page count her own photos, and the only claim it makes
 * is the time between two of them.
 */
export default function ProgressPhotos({
  onBack,
  initialOpen,
  preview,
}: {
  onBack: () => void;
  /** A photo to open straight away: the calendar thumbnail she tapped to get here. */
  initialOpen?: string;
  /**
   * Supplied instead of read from IndexedDB, so /frames can show the page with
   * photos in it. Adding is off and removing touches only the copy in memory.
   */
  preview?: AlbumPhoto[];
}) {
  const today = isoDate(new Date());
  const [photos, setPhotos] = useState<AlbumPhoto[]>(preview ?? []);
  const [loaded, setLoaded] = useState(Boolean(preview));
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  // Which way the last step went, so the next photo arrives from that side.
  const [heading, setHeading] = useState<-1 | 1 | null>(null);
  // The photo she put beside her latest. Null is her first.
  const [thenId, setThenId] = useState<string | null>(null);
  // Counts Compare taps, so each one can bring the pair back into view.
  const [compared, setCompared] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    if (preview) return;
    // The calendar is usually scrolled down to its photos card when this
    // opens, and every screen shares one scroller, so without this the page
    // would open partway down itself.
    window.scrollTo(0, 0);
    document.getElementById("app-scroll")?.scrollTo(0, 0);
    listPhotos().then((all) => {
      setPhotos(all);
      setLoaded(true);
    });
  }, [preview]);

  /*
    The pair heads the page and she may have opened that photo from a long way
    down it, so the answer to the tap is brought to her. An effect rather than
    a line in the handler: the viewer's own cleanup has to give the page its
    scrolling back first, and a scroll asked for while the body is still
    locked goes nowhere.

    A jump, not a smooth scroll. Two thousand pixels of travel is
    choreography, which this app does not do, and the viewer closing is
    already the change she is watching for.
  */
  useEffect(() => {
    if (compared === 0) return;
    top.current?.scrollIntoView({ block: "start" });
  }, [compared]);

  const newest = useMemo(() => newestFirst(photos), [photos]);
  // Oldest first: the order the viewer steps through, left to right.
  const timeline = useMemo(() => [...newest].reverse(), [newest]);
  const months = useMemo(() => byMonth(photos, today), [photos, today]);

  const latest = newest[0];
  const first = timeline[0];
  const chosen = thenId && thenId !== latest?.id ? photos.find((p) => p.id === thenId) : undefined;
  const then = chosen ?? first;

  const pos = openId ? timeline.findIndex((p) => p.id === openId) : -1;
  const open = pos >= 0 ? timeline[pos] : null;

  function show(id: string) {
    setHeading(null);
    setOpenId(id);
  }

  function step(n: -1 | 1) {
    const next = timeline[pos + n];
    if (!next) return;
    setHeading(n);
    setOpenId(next.id);
  }

  function compare(id: string) {
    setThenId(id);
    setOpenId(null);
    setCompared((n) => n + 1);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || preview) return;
    setBusy(true);
    setFailed(false);
    const meta = await addPhoto(isoDate(new Date()), file);
    if (meta) setPhotos(await listPhotos());
    else setFailed(true);
    setBusy(false);
  }

  async function remove(id: string) {
    const i = timeline.findIndex((p) => p.id === id);
    // Carry on the way she was going, and turn round only at the end.
    const later = timeline[i + 1];
    const earlier = timeline[i - 1];
    const next = heading === 1 ? later ?? earlier : earlier ?? later;
    if (!preview) await deletePhoto(id);
    const rest = preview ? photos.filter((p) => p.id !== id) : await listPhotos();
    setPhotos(rest);
    setHeading(next === later ? 1 : -1);
    setOpenId(next && rest.some((p) => p.id === next.id) ? next.id : null);
  }

  return (
    <main
      ref={top}
      className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Progress photos</p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
        >
          Back
        </button>
      </div>
      <h1 className="statement mt-2 text-figure text-fg">Then and now</h1>
      <p className="mt-1.5 text-emphasis text-dim">
        {/* Held open before the read lands, so the cards below do not jump. */}
        {!loaded ? " " : photos.length > 0 ? photoSpan(photos, today) : "Nothing here yet"}
      </p>

      {loaded && (
        <section className="mt-5 rounded-2xl bg-card p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">Side by side</p>
            {chosen && (
              <button
                type="button"
                onClick={() => setThenId(null)}
                className="head tap shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
              >
                Show first
              </button>
            )}
          </div>

          {latest && then && then.id !== latest.id ? (
            <>
              <p className="statement mt-2.5 text-title text-fg">{apart(then.date, latest.date)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Whole
                  photo={then}
                  caption={then.id === first?.id ? "First" : undefined}
                  today={today}
                  onOpen={show}
                />
                <Whole photo={latest} caption="Latest" today={today} onOpen={show} />
              </div>
              {timeline.length > 2 && (
                <p className="mt-3 text-body leading-snug text-dim">
                  Open any photo to put it beside your latest.
                </p>
              )}
            </>
          ) : latest ? (
            /*
              One photo is a comparison waiting for its other half, so the
              empty half is drawn rather than the card being a single photo
              that looks like the whole idea.
            */
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Whole photo={latest} caption="First" today={today} onOpen={show} />
                <div className="grid aspect-[3/4] place-items-center rounded-xl bg-deep p-4 text-center text-body text-dim">
                  Your next one
                </div>
              </div>
              <p className="mt-3 text-body leading-snug text-dim">
                Add another in a few weeks and the two sit here side by side.
              </p>
            </>
          ) : (
            /*
              Empty, and teaching what it becomes: the two frames it will
              fill, and where the photos live. A progress photo is the most
              private thing this app holds, and the first thing worth knowing
              about one is who else can see it.
            */
            <>
              <div aria-hidden className="mt-3 grid grid-cols-2 gap-2">
                {["First", "Latest"].map((w) => (
                  <div key={w} className="flex aspect-[3/4] items-end rounded-xl bg-deep p-3">
                    <span className="text-caption text-dim">{w}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-emphasis leading-snug text-fg">
                One photo a month is plenty.
              </p>
              <p className="mt-1 text-body leading-snug text-dim">
                Your first and your latest sit here side by side, with every other one below by
                month. They stay on this phone unless you share one.
              </p>
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
      {/*
        Outlined, not the orange fill. This page is for looking, and adding is
        the calendar card's job too, so it does not get to be the loudest
        thing here. Named exactly as it is on the card: the same act, the same
        words, and "today's" says which day it will be filed under.
      */}
      <div className="mt-3">
        <Pill variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy || !loaded}>
          {busy ? "Saving…" : "Add today's photo"}
        </Pill>
      </div>
      {failed && (
        <p className="mt-2 text-body text-dim">
          Could not save that one. Private browsing blocks photo storage.
        </p>
      )}

      {/*
        The rest, by month. Only from three photos on: with one or two, every
        photo is already in the pair above, and a grid repeating them reads as
        the page not knowing what it has shown.

        On the ground under a label, the way PickWorkout and Profile list
        their groups, and not a card per month. One photo a month is what the
        empty state recommends, and a card per month turned that into a column
        of boxes, each two thirds empty.
      */}
      {timeline.length > 2 &&
        months.map((g) => (
          <section key={g.key} className="mt-6">
            <h2 className="label text-dim">{g.label}</h2>
            <ul className="mt-2.5 grid grid-cols-3 gap-2">
              {g.photos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => show(p.id)}
                    aria-label={`Open the photo from ${longDate(p.date)}`}
                    className="block aspect-[3/4] w-full overflow-hidden rounded-xl bg-card transition-transform duration-quick ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.97]"
                  >
                    <Picture photo={p} lazy className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {open && latest && (
        <Viewer
          photo={open}
          position={pos + 1}
          total={timeline.length}
          heading={heading}
          // Already beside the latest, or the latest itself: nothing to put.
          canCompare={open.id !== latest.id && open.id !== then?.id}
          framed={Boolean(preview)}
          onStep={step}
          onClose={() => setOpenId(null)}
          onRemove={remove}
          onCompare={compare}
        />
      )}
    </main>
  );
}

/** Half of the pair: the whole photo on the deep ground, and when it was taken. */
function Whole({
  photo,
  caption,
  today,
  onOpen,
}: {
  photo: AlbumPhoto;
  caption?: string;
  today: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(photo.id)}
      aria-label={`Open the photo from ${longDate(photo.date)}`}
      className="block min-w-0 text-left"
    >
      <span className="block aspect-[3/4] overflow-hidden rounded-xl bg-deep">
        <Picture photo={photo} className="h-full w-full object-contain" />
      </span>
      <span className="mt-2 block truncate text-body">
        {caption && <span className="text-dim">{caption} · </span>}
        <span className="head text-fg">{shortDate(photo.date, today)}</span>
      </span>
    </button>
  );
}

/**
 * One photo, full screen.
 *
 * The photo, its date, and the three things worth doing with it: move through
 * time, put it beside the latest, or remove it. Time runs oldest-left here as
 * it does in the calendar's months, so the arrows, the arrow keys and a swipe
 * all agree with the month grid about which way is earlier.
 *
 * Removing asks twice, the way removing a saved workout does. A photo has no
 * undo, and the second tap is the whole of the safety net.
 *
 * It is a dialog and behaves like one, as CrewPost does: focus moves in and is
 * kept there, the app behind is inert, Escape closes, and on a desktop it
 * stays inside the device rather than taking over the browser window.
 */
function Viewer({
  photo,
  position,
  total,
  heading,
  canCompare,
  framed,
  onStep,
  onClose,
  onRemove,
  onCompare,
}: {
  photo: AlbumPhoto;
  /** 1-based, oldest first. */
  position: number;
  total: number;
  heading: -1 | 1 | null;
  canCompare: boolean;
  /** Render inside the surrounding box rather than over the device. */
  framed: boolean;
  onStep: (n: -1 | 1) => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Which photo the first Remove tap was for. Stepping to another photo makes
  // this stale on its own, so a half-confirmed remove never follows her.
  const [sureFor, setSureFor] = useState<string | null>(null);
  const sure = sureFor === photo.id;

  // Once per opening, not per photo: stepping must not re-grab focus.
  useEffect(() => {
    // A framed copy is a picture of the dialog, not the dialog: it must not
    // grab focus, lock the page, or make the gallery around it inert.
    if (framed) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const behind = document.getElementById("app-scroll");
    sheet.current?.focus();
    behind?.setAttribute("inert", "");
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      behind?.removeAttribute("inert");
      document.body.style.overflow = prior;
      // Back to the tile she came from, without scrolling the page to it.
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [framed]);

  useEffect(() => {
    // Keys belong to the page, and a gallery of frames is not one: Escape on
    // /frames must not close the copy sitting open in 11c.
    if (framed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowLeft") return onStep(-1);
      if (e.key === "ArrowRight") return onStep(1);
      if (e.key !== "Tab" || !sheet.current) return;
      const stops = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (stops.length === 0) return;
      const head = stops[0];
      const tail = stops[stops.length - 1];
      if (e.shiftKey && (document.activeElement === head || document.activeElement === sheet.current)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, framed]);

  const arrive = heading === -1 ? "from-earlier" : heading === 1 ? "from-later" : "";
  const arrow =
    "head grid h-11 w-11 shrink-0 place-items-center rounded-full text-emphasis text-cyan transition-colors hover:bg-raise disabled:opacity-35 disabled:hover:bg-transparent";

  const el = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Progress photo from ${longDate(photo.date)}`}
      ref={sheet}
      tabIndex={-1}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const from = touch.current;
        touch.current = null;
        if (!from) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - from.x;
        const dy = t.clientY - from.y;
        // A deliberate sideways stroke, not a thumb drifting on its way to
        // Close. Leftward brings the later photo in from the right.
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        onStep(dx < 0 ? 1 : -1);
      }}
      // The deepest ground, solid: a photo is looked at against nothing, and a
      // scrim would leave the page behind showing through its edges. `veil`
      // fades the surface in; it is the answer to the tap that opened it.
      // Not when framed: a frame is a still of the dialog already open, and a
      // capture taken the moment the frame is ready landed halfway through
      // the fade, with the page showing through.
      className={`z-50 flex justify-center bg-deep outline-none ${
        framed ? "absolute inset-0" : "veil fixed inset-0 desk:absolute"
      }`}
    >
      <div className="flex w-full max-w-[430px] flex-col px-6 pb-6 pt-12">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="head text-emphasis text-fg">{longDate(photo.date)}</p>
            <p className="tabular mt-0.5 text-body text-dim">
              {position} of {total}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // An explicit square: a ✕ is too narrow to reach 44 on padding alone.
            className="head -mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-emphasis text-dim transition-colors hover:bg-raise hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 items-center justify-center">
          {/* Keyed, so each step is a new image arriving from its own side. */}
          <Picture
            key={photo.id}
            photo={photo}
            className={`max-h-full max-w-full rounded-xl object-contain ${arrive}`}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={position === 1}
            aria-label="Earlier photo"
            className={arrow}
          >
            ←
          </button>
          {canCompare && (
            <button
              type="button"
              onClick={() => onCompare(photo.id)}
              className="head tap min-w-0 truncate text-body text-cyan transition-opacity hover:opacity-70"
            >
              Compare with latest
            </button>
          )}
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={position === total}
            aria-label="Later photo"
            className={arrow}
          >
            →
          </button>
        </div>

        <button
          type="button"
          onClick={() => (sure ? onRemove(photo.id) : setSureFor(photo.id))}
          aria-label={sure ? "Confirm removing this photo" : "Remove this photo"}
          className={`head mx-auto mt-2 h-11 shrink-0 rounded-full px-3.5 text-body transition-colors duration-quick ${
            sure ? "text-action" : "text-dim hover:text-fg"
          }`}
        >
          {sure ? "Sure?" : "Remove"}
        </button>
      </div>
    </div>
  );

  // Before hydration there is no device element; render in place rather than
  // not at all.
  if (framed) return el;
  const host = typeof document === "undefined" ? null : document.getElementById("device");
  return host ? createPortal(el, host) : el;
}
