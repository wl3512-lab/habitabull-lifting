"use client";

import { useId, useLayoutEffect, useState } from "react";
import PlateBar from "./PlateBar";
import { SwitchRow } from "./ProfileRows";
import { DEFAULT_BAR_LB, offersPlates, totalWeight, withLoadTheBar } from "@/lib/plates";
import type { Profile } from "@/lib/types";

/**
 * Load the bar, shown before it is asked of her.
 *
 * It was a switch in Profile with one line under it, which asks somebody to
 * decide about a control she may never have seen. Here it is the real loader
 * with nothing riding on it, then the same switch. Trying it costs nothing,
 * so deciding happens after she has tapped a few plates rather than before.
 */
export default function LoadTheBar({
  profile,
  onProfile,
  onBack,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
  onBack: () => void;
}) {
  const tryId = useId();
  const bar = profile.barLb ?? DEFAULT_BAR_LB;
  /*
    The demo's weight is this screen's own and nobody else's. It is not a set,
    so nothing tapped here can reach a session, a lift's next weight or her
    history. It opens with one 45 a side on whatever her bar weighs, which is
    135 on a standard bar and a load most people have seen at a rack.
  */
  const [weight, setWeight] = useState(() => totalWeight(bar, [45]));
  const offered = offersPlates(profile);

  /*
    It opens from a row halfway down Profile, and the scroll outlives the
    screen it belonged to: on a 667px phone this opened 200px down, with its
    own headline above the fold. So it starts at the top, before first paint.
    The document scrolls on a phone and #app-scroll in the desktop frame.
  */
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("app-scroll")?.scrollTo(0, 0);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <div className="flex items-start justify-between gap-4">
        <p className="label text-cyan">Barbell lifts</p>
        <button
          type="button"
          onClick={onBack}
          className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
        >
          Back
        </button>
      </div>
      <h1 className="statement mt-2 text-figure text-fg">Load the bar</h1>
      <p className="mt-1.5 text-emphasis leading-snug text-dim">
        Tap plates onto the bar and the app does the adding, bar included. It only shows on
        barbell lifts; everything else keeps + and −.
      </p>

      {/*
        The heading and the instruction sit above the loader, not in a card
        around it: PlateBar is a card already, and cards are never nested.
      */}
      <section aria-labelledby={tryId} className="mt-8">
        <h2 id={tryId} className="label text-dim">
          Try it
        </h2>
        <p className="mt-1.5 text-body leading-snug text-dim">
          Tap a plate to put one on each end, and tap one on the bar to take it off. Nothing
          here is logged.
        </p>
        <div className="mt-2.5">
          {/*
            The bar weight is the exception, and it saves. It is a real setting
            that otherwise only turns up mid-workout, and this is the one place
            she is looking at a bar with time to get it right.
          */}
          <PlateBar
            weight={weight}
            bar={bar}
            onWeight={setWeight}
            onBar={(barLb) => onProfile({ ...profile, barLb })}
          />
        </div>
        <p className="mt-2.5 text-caption leading-snug text-dim">
          The bar weight is saved, so set it to what yours weighs. Every barbell lift adds it in.
        </p>
      </section>

      {/*
        The switch that used to sit in Profile, meaning what it meant there. A
        switch rather than a pick between two, because the question is whether
        plates are offered at all, not which way she enters a weight: off, a
        barbell set shows + and − and nothing else; on, the pick between them
        sits above every barbell set. The hint says which, and says plainly
        when she has not answered, since the first barbell lift still asks.
      */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-card">
        <SwitchRow
          label="Use it on barbell lifts"
          hint={
            offered === undefined
              ? "Not set yet. Your first barbell lift will ask."
              : offered
                ? "+ and − stay a tap away on every set."
                : "Barbell lifts use + and − like everything else."
          }
          on={offered === true}
          onChange={(on) => onProfile(withLoadTheBar(profile, on))}
        />
      </div>
    </main>
  );
}
