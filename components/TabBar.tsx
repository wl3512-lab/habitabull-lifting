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
 * A dot rather than an icon, per the Figma: at this size a glyph set would be
 * four more things to draw badly, and the label already says it.
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
      className="sticky bottom-0 z-20 border-t border-line bg-ground/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm"
    >
      <ul className="mx-auto flex w-full max-w-[430px]">
        {TABS.map((t) => {
          const on = t.id === active;
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
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-150 ${
                    on ? "bg-cyan" : "bg-line-strong"
                  }`}
                />
                <span
                  className={`head text-[13px] transition-colors duration-150 ${
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
