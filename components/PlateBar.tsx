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
        The whole bar: a short loaded sleeve at each end of a long bare shaft,
        which is the shape you recognise at a rack. It used to draw one side,
        plates at a collar and bar running off the edge, and that read as a
        lopsided bar rather than as equipment. One side was meant to save room
        on a 390px screen, but the plates never needed it: five of them take
        about a quarter of the well. Plate height is by denomination so the
        shape reads at a glance, a 45 taller than a 10 as on a real rack.
      */}
      <div className="flex h-24 items-center rounded-xl bg-ground px-3">
        <Sleeve side="left" plates={plates} onRemove={(p) => set(removePlate(plates, p))} />
        <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-sm bg-dim" />
        <span aria-hidden className="h-1.5 min-w-8 flex-1 bg-line-strong" />
        <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-sm bg-dim" />
        <Sleeve side="right" plates={plates} onRemove={(p) => set(removePlate(plates, p))} />
      </div>

      {/* What is on the bar in words, the empty bar included, so nothing is written over the drawing. */}
      <p className="text-body text-dim">
        {plates.length === 0
          ? "Just the bar. Tap a plate below to put one on each end."
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

/**
 * One loaded end of the bar. The sleeve is thicker than the shaft and a quarter
 * of the well, so the bare shaft between the collars is always the long part.
 * Plates stack outward from the collar, heaviest against it, the order you load
 * them in; a heavy load squeezes them to fit rather than running off the end.
 *
 * Both ends can be tapped to take a plate off, since either is where a thumb
 * lands. The right-hand one is a mirror, kept out of the tab order and the
 * accessibility tree, so each plate is announced once.
 */
function Sleeve({
  side,
  plates,
  onRemove,
}: {
  side: "left" | "right";
  plates: number[];
  onRemove: (plate: number) => void;
}) {
  const mirror = side === "right";
  return (
    <div
      aria-hidden={mirror || undefined}
      className={`relative flex h-full shrink-0 basis-[24%] items-center gap-0.5 ${
        mirror ? "" : "flex-row-reverse"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 bg-line-strong ${
          mirror ? "rounded-r-sm" : "rounded-l-sm"
        }`}
      />
      {plates.map((p, i) => (
        <button
          key={`${p}-${i}`}
          type="button"
          tabIndex={mirror ? -1 : undefined}
          onClick={() => onRemove(p)}
          aria-label={`Take off one ${p} pound plate`}
          className="relative min-w-[3px] rounded transition-opacity hover:opacity-70"
          style={{
            flex: `0 1 ${p >= 25 ? 15 : p >= 10 ? 12 : 9}px`,
            // 45 fills the well, 2.5 keeps enough body to be tappable.
            height: `${Math.max(30, Math.round((p / 45) * 82))}%`,
            // Heavier plates read darker, the way a rack does.
            background: p >= 25 ? "var(--color-cyan)" : "var(--color-cyan-soft)",
          }}
        />
      ))}
    </div>
  );
}
