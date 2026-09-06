"use client";

export type Tab = "today" | "calendar" | "progress" | "crew";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "progress", label: "Progress" },
  { id: "crew", label: "Crew" },
];

/**
 * The four places you can stand. Nothing more: the 2023 hi-fi shipped a nav
 * whose tabs led nowhere, and the redesign held the bar off until every
 * destination existed.
 *
 * It is deliberately absent mid-workout. Someone between sets has exactly one
 * thing to do, and offering three ways to leave the set they are halfway
 * through is how a logging screen becomes a browsing screen. The workout, the
 * rest timer and the celebration are modes, not places.
 *
 * Three tabs are a dot and a label. Home is the mark, raised out of the bar,
 * carrying the week as a ring around it — so the one control that is always on
 * screen also answers the only question the product cares about: are you
 * showing up. A glyph set for all four would be four more things to draw
 * badly; one mark that already exists is not.
 *
 * The ring is `done`, not `action`. The action colour means the one action on
 * the screen, and Today already has it on "Start workout" — a permanently
 * action-coloured home button would be the second, which is the one colour
 * rule this system does not bend. `done` already means done, which is what
 * the ring counts.
 */
export default function TabBar({
  active,
  onChange,
  week,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  /**
   * Sessions done and training days planned, this week. Omitted before a week
   * exists, in which case the ring is not drawn at all rather than drawn empty
   * — an empty ring on a brand new account reads as a scolding.
   */
  week?: { done: number; total: number };
}) {
  return (
    <nav
      aria-label="Main"
      // No backdrop blur. Under a 95% opaque bar it contributes about five
      // percent, and on a sticky element it re-composites on every scroll
      // frame — the most expensive way in the app to render almost nothing.
      // `overflow-visible` so the raised home button can break the top edge.
      className="sticky bottom-0 z-20 overflow-visible border-t border-line bg-ground/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <ul className="mx-auto flex w-full max-w-[430px] items-end">
        {TABS.map((t) => {
          const on = t.id === active;
          if (t.id === "today") {
            return (
              <li key={t.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onChange(t.id)}
                  aria-current={on ? "page" : undefined}
                  className="flex w-full flex-col items-center justify-end gap-1.5"
                >
                  <HomeMark active={on} week={week} />
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
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-quick ${
                    on ? "bg-cyan" : "bg-line-strong"
                  }`}
                />
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

/** Circle radius and circumference for the week ring, in the 56-box below. */
const R = 25;
const C = 2 * Math.PI * R;

function HomeMark({ active, week }: { active: boolean; week?: { done: number; total: number } }) {
  // Clamped because an extra session in a two-day week is a real thing that
  // happens, and a ring past full draws as a gap.
  const frac = week && week.total > 0 ? Math.min(1, week.done / week.total) : 0;
  const show = Boolean(week && week.total > 0);

  return (
    <span
      // Lifted out of the bar. The negative margin is given back by the taller
      // box so the labels stay on one baseline with the other three.
      className="relative -mt-5 grid h-14 w-14 place-items-center rounded-full border border-line-strong bg-card transition-colors duration-quick"
      style={{ boxShadow: "0 6px 16px -6px rgb(0 0 0 / 0.6)" }}
    >
      {show && (
        <svg viewBox="0 0 56 56" className="absolute inset-0 h-14 w-14 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--color-raise)" strokeWidth="3" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke="var(--color-done)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-deliberate ease-[cubic-bezier(0.25,1,0.5,1)]"
          />
        </svg>
      )}
      <svg
        viewBox="0 0 100 80"
        className={`relative h-6 w-[30px] transition-colors duration-quick ${active ? "text-fg" : "text-dim"}`}
        fill="currentColor"
        aria-hidden
      >
        <path d="M50 28 C62 28 70 34 70 44 C70 60 61 73 50 73 C39 73 30 60 30 44 C30 34 38 28 50 28 Z" />
        <path d="M32 46 C21 47 11 42 5 32 C1 25 0 15 3 8 C8 19 15 27 25 31 C29 33 32 36 33 39 Z" />
        <path d="M68 46 C79 47 89 42 95 32 C99 25 100 15 97 8 C92 19 85 27 75 31 C71 33 68 36 67 39 Z" />
      </svg>
      {/* The ring is decorative; the count belongs in the accessible name. */}
      {show && (
        <span className="sr-only">
          {week!.done} of {week!.total} sessions done this week
        </span>
      )}
    </span>
  );
}
