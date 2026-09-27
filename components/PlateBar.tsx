"use client";

import {
  addPlate,
  BAR_MAX,
  BAR_MIN,
  platesFor,
  PLATES_LB,
  removePlate,
  totalWeight,
} from "@/lib/plates";

/**
 * Loading the bar, drawn.
 *
 * The steppers ask "what number is this set?" and expect you to have worked it
 * out already. At a rack the question is the other way round — you have plates
 * in your hands and you want to know what they come to, or you want 185 and
 * you want to know what to put on. That arithmetic, done standing up between
 * sets, is why people open the calculator on their phone mid-workout.
 *
 * So: tap a plate to add one to each side, tap it on the bar to take it off,
 * and the total is a consequence rather than something typed. Everything is
 * per side except the total, because that is how a bar works and pretending
 * otherwise is the confusion this is here to remove.
 */
export default function PlateBar({
  weight,
  bar,
  onWeight,
  onBar,
}: {
  /** The set's weight, the same number the stepper edits. */
  weight: number;
  bar: number;
  onWeight: (next: number) => void;
  onBar: (next: number) => void;
}) {
  /*
    The plates are derived from the weight rather than held beside it.

    Holding a list of plates as its own state means two sources of truth for
    one number, and they come apart the moment anything else sets the weight —
    the progression engine seeding the next set, a swap, an import. The weight
    is the truth; the plates are a reading of it.
  */
  const { plates, achieved, exact } = platesFor(weight, bar);

  const set = (next: number[]) => onWeight(totalWeight(bar, next));

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-dim">On the bar</p>
        <p className="tabular statement text-title text-fg">
          {achieved} <span className="text-body text-dim">lb</span>
        </p>
      </div>

      {/*
        The bar itself, with the stack growing outward from the collar. Plate
        height is by denomination so the shape reads at a glance — a 45 is
        taller than a 10 on a real rack too. Only one side is drawn: drawing
        both would be symmetrical and twice as small on a 390px screen, and
        the label already says each side.
      */}
      <div className="relative h-24 overflow-hidden rounded-xl bg-ground">
        {/*
          The bar runs the whole width, so the space to the right of the stack
          reads as the rest of the sleeve rather than as emptiness. The collar
          is where the plates stop, which is the thing you are looking at when
          you check a load at a rack.
        */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 bg-line-strong"
        />
        <span
          aria-hidden
          className="absolute left-7 top-1/2 h-5 w-2 -translate-y-1/2 rounded-sm bg-dim"
        />
        <div className="absolute inset-y-0 left-9 flex items-center gap-0.5 pr-3">
          {plates.length === 0 ? (
            <span className="pl-2.5 text-body text-dim">Just the bar</span>
          ) : (
            plates.map((p, i) => (
              <button
                key={`${p}-${i}`}
                type="button"
                onClick={() => set(removePlate(plates, p))}
                aria-label={`Take off one ${p} pound plate`}
                className="shrink-0 rounded transition-opacity hover:opacity-70"
                style={{
                  width: p >= 25 ? 15 : p >= 10 ? 12 : 9,
                  // 45 fills the well, 2.5 keeps enough body to be tappable.
                  height: `${Math.max(30, Math.round((p / 45) * 82))}%`,
                  // Heavier plates read darker, the way a rack does.
                  background: p >= 25 ? "var(--color-cyan)" : "var(--color-cyan-soft)",
                }}
              />
            ))
          )}
        </div>
      </div>

      <p className="text-body text-dim">
        {plates.length === 0
          ? "Tap a plate to load it. Each one goes on both ends."
          : `${plates.map((p) => (p % 1 ? p : p.toFixed(0))).join(" · ")} a side`}
      </p>

      {/* Not every number is loadable, and saying so beats rounding in silence. */}
      {!exact && (
        <p className="text-body text-fault">
          {weight} lb needs a plate this gym may not have. Nearest is {achieved}.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PLATES_LB.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(addPlate(plates, p))}
            aria-label={`Add one ${p} pound plate to each side`}
            className="tabular head min-w-14 rounded-full bg-raise px-4 py-3 text-body text-fg transition-colors hover:bg-line"
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => set([])}
          disabled={plates.length === 0}
          className="head ml-auto rounded-full px-4 py-3 text-body text-dim transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          Strip
        </button>
      </div>

      <label className="mt-1 flex items-center justify-between gap-3">
        <span className="label text-dim">Bar</span>
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={bar}
            min={BAR_MIN}
            max={BAR_MAX}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onBar(Math.min(BAR_MAX, Math.max(BAR_MIN, n)));
            }}
            className="tabular head h-11 w-20 min-w-0 appearance-none rounded-xl bg-raise px-3 text-right text-body text-fg focus:outline-none focus:ring-2 focus:ring-cyan"
          />
          <span className="text-body text-dim">lb</span>
        </span>
      </label>
    </div>
  );
}
