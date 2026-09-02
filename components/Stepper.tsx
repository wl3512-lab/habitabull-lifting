"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The one-thumb control. 56px targets because this is used mid-set, sweaty, at
 * arm's length, and the round buttons sit at the outer edges of the card so the
 * thumb finds them without the eye having to.
 *
 * The value can also be tapped and typed into. DESIGN.md used to forbid that
 * outright — "the value is a button, not an input: tapping it opens a keyboard,
 * and a keyboard covering the screen between sets is the fastest way to lose
 * someone" — and the fear was right about the wrong thing. What loses people is
 * a keyboard they did not ask for. Getting to 200 lb at 2.5 a tap is eighty
 * taps, which loses them just as surely.
 *
 * So the keyboard is opt-in and nothing else changes: the steppers are still
 * the default path, still the only thing you can hit by accident, and the field
 * only exists after a deliberate tap on the number itself.
 */
export default function Stepper({
  label,
  value,
  step,
  min = 0,
  max = 2000,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  /** A ceiling for typed input. Nobody is logging a four-figure lift. */
  max?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typing) field.current?.select();
  }, [typing]);

  const bump = (dir: 1 | -1) => onChange(Math.max(min, value + dir * step));

  function open() {
    setDraft(String(value));
    setTyping(true);
  }

  /**
   * Whole numbers when the step is whole. Reps and sets have no halves, and a
   * decimal point on a rep count is a typo waiting to be logged. Weight keeps
   * one, and the typed number is taken as given rather than snapped to the
   * increment — someone entering 202.5 knows what was on the bar better than
   * the app does.
   */
  function commit() {
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    setTyping(false);
    if (!Number.isFinite(n)) return;
    const rounded = Number.isInteger(step) ? Math.round(n) : Math.round(n * 2) / 2;
    onChange(Math.min(max, Math.max(min, rounded)));
  }

  return (
    <div className="rounded-2xl bg-card p-[18px]">
      <span className="label text-dim">{label}</span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label}`}
          disabled={value <= min || typing}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raise text-[26px] leading-none text-cyan transition-colors duration-150 hover:bg-line active:bg-line disabled:opacity-30"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          {typing ? (
            <input
              ref={field}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setTyping(false);
              }}
              // decimal, not numeric: the iOS numeric pad has no point on it,
              // and half a pound is a real weight.
              inputMode="decimal"
              autoFocus
              aria-label={`${label} in ${suffix ?? "units"}`}
              className="tabular statement w-full rounded-xl bg-raise text-center text-[56px] text-fg focus:outline-none focus:ring-2 focus:ring-cyan"
            />
          ) : (
            <button
              type="button"
              onClick={open}
              aria-label={`Type ${label} instead`}
              className="tabular statement w-full rounded-xl text-center text-[56px] text-fg transition-colors hover:bg-raise/60"
            >
              {value}
            </button>
          )}
          {suffix && <span className="-mt-0.5 text-[14px] text-dim">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Increase ${label}`}
          disabled={typing}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raise text-[26px] leading-none text-cyan transition-colors duration-150 hover:bg-line active:bg-line disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
