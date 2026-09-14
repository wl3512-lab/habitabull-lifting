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
