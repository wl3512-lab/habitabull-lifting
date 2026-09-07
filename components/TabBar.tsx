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
          if (t.id === "progress") {
            return (
              <li key={t.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onChange(t.id)}
                  aria-current={on ? "page" : undefined}
                  className="flex w-full flex-col items-center justify-end gap-1.5"
                >
                  <Raised active={on} />
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
          }
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? "page" : undefined}
                className="flex h-14 w-full flex-col items-center justify-center gap-1.5"
              >
                {t.id === "today" ? (
                  <svg
                    viewBox="0 0 100 88"
                    aria-hidden
                    className={`h-[18px] w-5 transition-colors duration-quick ${on ? "text-cyan" : "text-line-strong"}`}
                    fill="currentColor"
                    fillRule="evenodd"
                  >
                    <path d="M50 26 C43 26 38 27 35 30 C32 33 30 37 30 43 C29 39 25 39 23 42 C26 43 29 44 31 47 C33 54 35 60 39 65 C43 70 47 73 50 73 C53 73 57 70 61 65 C65 60 67 54 69 47 C71 44 74 43 77 42 C75 39 71 39 70 43 C70 37 68 33 65 30 C62 27 57 26 50 26 Z M43 46 C39 45 36 48 38 51 C42 50 45 48 45 46 Z M57 46 C61 45 64 48 62 51 C58 50 55 48 55 46 Z" />
                    <path d="M37 29 C29 22 17 14 5 12 C7 19 12 27 21 32 C26 35 30 36 34 37 C34 34 35 31 37 29 Z" />
                    <path transform="translate(100,0) scale(-1,1)" d="M37 29 C29 22 17 14 5 12 C7 19 12 27 21 32 C26 35 30 36 34 37 C34 34 35 31 37 29 Z" />
                  </svg>
                ) : (
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-quick ${
                      on ? "bg-cyan" : "bg-line-strong"
                    }`}
                  />
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
