"use client";

export type Tab = "today" | "calendar" | "progress" | "crew" | "profile";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "progress", label: "Progress" },
  { id: "crew", label: "Crew" },
  { id: "profile", label: "Profile" },
];

/**
 * The five places you can stand. Progress sits in the middle and is raised out
 * of the bar as the one big target, because seeing that you are showing up is
 * the whole point of the product — the record is the reward, so it gets the
 * centre. Two flat tabs fall on either side of it, which is the only reason the
 * raised circle reads as balanced rather than lopsided.
 *
 * It is deliberately absent mid-workout. Someone between sets has exactly one
 * thing to do, and offering five ways to leave the set they are halfway through
 * is how a logging screen becomes a browsing screen. The workout, the rest
 * timer and the celebration are modes, not places.
 *
 * Today keeps the bull mark as its glyph — the logo still means home — while
 * the rest are a dot and a label. The centre is a trend line, not the mark:
 * the mark is home, and putting it on a different tab would say the brand lives
 * on Progress instead.
 */
export default function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav
      aria-label="Main"
      // No backdrop blur. Under a 95% opaque bar it contributes about five
      // percent, and on a sticky element it re-composites on every scroll
      // frame. `overflow-visible` lets the raised centre break the top edge.
      className="sticky bottom-0 z-20 overflow-visible border-t border-line bg-ground/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <ul className="mx-auto flex w-full max-w-[430px] items-end">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? "page" : undefined}
                // Every tab is the same height and pins its label to the bottom,
                // so all five labels share one baseline. The raised centre pops
                // up out of this box (its negative margin only frees space above
                // it — justify-end keeps the label anchored to the floor).
                className="flex h-14 w-full flex-col items-center justify-end gap-1.5"
              >
                {t.id === "progress" ? (
                  <Raised active={on} />
                ) : t.id === "today" ? (
                  // The hand-drawn bull, light so it reads on the dark bar;
                  // opacity carries the active/inactive state.
                  <img
                    src="/tab-bull.png"
                    alt=""
                    aria-hidden
                    className={`h-5 w-auto transition-opacity duration-quick ${on ? "opacity-100" : "opacity-45"}`}
                  />
                ) : (
                  <TabGlyph id={t.id} active={on} />
                )}
                <span
                  className={`head text-caption transition-colors duration-quick ${
                    on ? "text-fg" : "text-dim"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Simple line glyphs for the flat tabs, drawn at the same weight as the raised
 * trend so the five icons read as one set. Colour carries the active state, the
 * same cyan the dots used to.
 */
function TabGlyph({ id, active }: { id: Tab; active: boolean }) {
  const cls = `h-5 w-5 transition-colors duration-quick ${active ? "text-cyan" : "text-dim"}`;
  if (id === "calendar")
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 9.5h17" />
        <path d="M8 3.5v3" />
        <path d="M16 3.5v3" />
      </svg>
    );
  if (id === "crew")
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8.5" cy="9" r="2.6" />
        <circle cx="15.5" cy="9" r="2.6" />
        <path d="M4 19a4.5 4.5 0 0 1 9 0" />
        <path d="M11 19a4.5 4.5 0 0 1 9 0" />
      </svg>
    );
  // profile
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/** The raised centre: Progress, as a rising trend line. */
function Raised({ active }: { active: boolean }) {
  return (
    <span
      // Lifted out of the bar; the negative margin is given back by the taller
      // box so every label sits on one baseline.
      className="relative -mt-5 grid h-14 w-14 place-items-center rounded-full border border-line-strong bg-card transition-colors duration-quick"
      style={{ boxShadow: "0 6px 16px -6px rgb(0 0 0 / 0.6)" }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`h-6 w-6 transition-colors duration-quick ${active ? "text-cyan" : "text-fg"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* A climbing line with an emphasised last point — the same shape the
            progress charts use, so the tab reads as what it opens. */}
        <path d="M4 15l4.5-5 3.5 3.5L20 6" />
        <circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
