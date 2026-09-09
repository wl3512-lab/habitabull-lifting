"use client";

import { useEffect, useState } from "react";
import { watchSaves } from "@/lib/storage";

/**
 * The one thing this app cannot fail at quietly.
 *
 * Everything the product knows lives in this browser, so a device that will
 * not write is a device where the week she just built, the weight she just
 * corrected and the session she just finished are all gone at the next launch
 * — with the app looking perfectly healthy the entire time. Losing history is
 * bad and blocking a workout log is worse, which is why the write still never
 * throws; but saying nothing is the version where the cost lands later and
 * cannot be undone.
 *
 * It is not a rare case for a deployed link, either. Safari in private
 * browsing throws on the first write, and iOS evicts a web app's storage after
 * seven idle days unless it has been added to the home screen.
 *
 * `fault`, which is exactly what that colour is reserved for: a machine that
 * did not do its job, never user behaviour. A missed day stays an absence.
 *
 * It names the fix rather than offering a button for it. Exporting needs the
 * photos out of IndexedDB and the profile screen already does that properly,
 * so pointing at it beats a second half-built copy of it here.
 *
 * It can be put away, and that is not a softening. It covers the top of every
 * screen while it is up, which is a real cost on an 844px phone, and somebody
 * who has read it and is on their way to export needs to see the screen they
 * are exporting from. Dismissing costs nothing because the next write brings
 * it straight back: on a device in this state that is the next thing she
 * changes, which is exactly when it is worth saying again.
 */
export default function NotSaving() {
  const [failing, setFailing] = useState(false);

  useEffect(() => watchSaves((ok) => setFailing(!ok)), []);

  if (!failing) return null;

  return (
    <div
      role="alert"
      // Pinned to the top of the device: the bottom of every screen belongs to
      // the primary action and the tab bar, and this must cover neither.
      className="rise absolute inset-x-0 top-0 z-40 border-b border-fault/40 bg-ground px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="head text-emphasis text-fault">This phone isn&apos;t saving</p>
        <button
          type="button"
          onClick={() => setFailing(false)}
          aria-label="Dismiss"
          className="head -mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-emphasis text-dim transition-colors hover:bg-raise hover:text-fg"
        >
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-body leading-snug text-dim">
        What you change stays on screen, then goes when you close the app. Storage is
        full, or switched off for this site.
      </p>
      <p className="mt-1.5 text-body leading-snug text-cyan">
        Everything is still here until then. Profile → Save a copy.
      </p>
    </div>
  );
}
