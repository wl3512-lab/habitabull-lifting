"use client";

/**
 * The one-thumb control. 56px targets because this is used mid-set, sweaty, at
 * arm's length, and the round buttons sit at the outer edges of the card so the
 * thumb finds them without the eye having to.
 *
 * The value is a button, not an input: tapping it opens a keyboard, and a
 * keyboard covering the screen between sets is the fastest way to lose someone.
 * Long-press-free, no drag, no gestures to learn.
 */
export default function Stepper({
  label,
  value,
  step,
  min = 0,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  const bump = (dir: 1 | -1) => onChange(Math.max(min, value + dir * step));

  return (
    <div className="rounded-2xl bg-card p-[18px]">
      <span className="label text-dim">{label}</span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raise text-[26px] leading-none text-cyan transition-colors duration-150 hover:bg-line active:bg-line disabled:opacity-30"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="tabular statement text-[56px] text-fg">{value}</span>
          {suffix && <span className="-mt-0.5 text-[14px] text-dim">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Increase ${label}`}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raise text-[26px] leading-none text-cyan transition-colors duration-150 hover:bg-line active:bg-line"
        >
          +
        </button>
      </div>
    </div>
  );
}
