"use client";

import { useEffect } from "react";

/**
 * Registers the worker that lets the app open without a signal.
 *
 * Renders nothing, and fails quietly. A browser with no service worker support,
 * a private window that refuses to register one, an insecure origin: in every
 * one of those the app behaves exactly as it did before this existed, which is
 * fine everywhere except a basement.
 *
 * Registration waits for `load`. A service worker installing during the first
 * paint competes with the very requests it is there to cache, and the first
 * visit is the one visit where somebody is watching the screen.
 */
export default function Offline() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    /*
      Never in development, and this is not tidiness.

      The worker treats everything under /_next/static as immutable and serves
      it cache-first, which is safe by construction in a build because Next
      puts a content hash in every filename. Dev chunks have no hash: the URL
      for a module stays the same while the module changes underneath it, so
      the worker pins the first version it ever saw and keeps serving it
      through edits, restarts, and `rm -rf .next`. What that looks like is a
      browser throwing errors that quote source you already deleted.
    */
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No offline, but the app is otherwise untouched. Nothing to say.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
