"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The screen you just switched to, arriving.
 *
 * Five tabs used to replace each other with no transition at all, which on a
 * phone leaves the same question every time: did I move, or did this screen
 * change under me? A short rise answers it. It is feedback, not choreography —
 * the same `rise` the app already uses for newly promoted content, at the same
 * 220ms, because a tab is exactly that.
 *
 * **It never fires on the first paint.** The rule in this app is that nothing
 * animates on its own; motion answers a tap. Opening the app is not a tap, so
 * the first screen is simply there, and only a switch you asked for moves. The
 * ref is the whole mechanism: it holds the tab that was last rendered, is null
 * before there is one, and updating it does not itself cause a render.
 *
 * The `key` is what re-fires the animation. Without it React reuses the same
 * element across tabs and a CSS animation that has already run does not run
 * again; with it each tab is its own element with its own one entrance.
 */
export default function TabView({ tab, children }: { tab: string; children: ReactNode }) {
  const shown = useRef<string | null>(null);
  const entering = shown.current !== null && shown.current !== tab;

  useEffect(() => {
    shown.current = tab;
  }, [tab]);

  return (
    // Transparent to layout: the screen inside is the flex child that matters,
    // and it still grows the same way it did as a direct child of #app-scroll.
    <div key={tab} className={`flex flex-1 flex-col ${entering ? "rise" : ""}`}>
      {children}
    </div>
  );
}
