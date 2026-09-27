"use client";

import { useEffect, useRef } from "react";
import { isBusy } from "@/lib/busy";

/**
 * Picks up a new build for people who installed the app and never close it.
 *
 * A home-screen app is resumed, not reloaded. iOS restores the page it had,
 * often from weeks ago, so a fix that is live on the server is not a fix that
 * anybody has. The HTML is served `must-revalidate` with an ETag and there is
 * no service worker holding a stale shell, which means a genuine load always
 * gets the current build; the gap is only that a page already open never
 * performs one.
 *
 * So: on coming back to the app, ask what is live, and if it is not what this
 * page booted with, reload. Quietly. A banner offering an update is chrome
 * about the app rather than the app, and this product does not spend a screen
 * on itself.
 *
 * Three things keep the reload from ever being a surprise:
 *
 *   - Never during a workout. That is the one place losing your position
 *     costs something, and `isBusy` is the view machine saying so.
 *   - Only after a real absence. A glance at a notification and back is not a
 *     resume, and reloading under someone's thumb would be.
 *   - Only ever a reload. Every screen rebuilds from localStorage, so the app
 *     comes back where a resumed app comes back anyway.
 *
 * Nothing is rendered. If the network is down or the endpoint fails, the
 * answer is simply "don't know", and not knowing means leaving well alone.
 */

/** Below this, coming back is a glance rather than a return. */
const AWAY_MS = 60_000;

async function liveBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const build = (body as { build?: unknown })?.build;
    return typeof build === "string" && build.length > 0 ? build : null;
  } catch {
    return null;
  }
}

export default function StayFresh() {
  const booted = useRef<string | null>(null);
  const hiddenAt = useRef(0);

  useEffect(() => {
    let alive = true;

    // What this page is running. Read once, and never replaced: the whole
    // question is whether the server has moved on from it.
    void liveBuild().then((b) => {
      if (alive) booted.current = b;
    });

    async function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = Date.now() - hiddenAt.current;
      if (!hiddenAt.current || away < AWAY_MS) return;

      const live = await liveBuild();
      if (!alive || live === null || booted.current === null) return;
      if (live === booted.current) return;
      if (isBusy()) return;

      window.location.reload();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
