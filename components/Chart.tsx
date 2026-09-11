/**
 * A line, because the app already promised one.
 *
 * The progress card used to draw fourteen bars while its own empty state said
 * "come back and this becomes a line". Bars are the wrong mark here anyway:
 * they read as independent quantities, and the thing worth seeing across a
 * training block is the direction between the points, not the height of each.
 *
 * Deliberately unlabelled on the x axis. These series are irregular — you
 * train when you train — so evenly spaced points are already a small lie, and
 * hanging dates under them would make it a confident one. The card states the
 * span in words underneath instead.
 */

export interface Point {
  /** ISO date, used for the accessible summary rather than for geometry. */
  date: string;
  value: number;
}

export default function Chart({
  points,
  height = 116,
  label,
  unit = "lb",
  showDelta = true,
}: {
  points: Point[];
  height?: number;
  /** What the series is, for screen readers. "Back Squat", "Body weight". */
  label: string;
  unit?: string;
  /**
   * Off where the card's own header already states the change — repeating it
   * under the line makes the reader check whether the two numbers agree.
   */
  showDelta?: boolean;
}) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  /*
    A flat series is the common case early on — three sessions at the same
    weight — and it would divide by zero here. Giving it a span of 1 puts the
    line through the middle of the box, which is the honest picture: nothing
    moved. Padding the range by a tenth otherwise keeps the peak off the
    ceiling, where a line touching the edge reads as clipped.
  */
  const span = hi - lo || 1;
  const pad = span * 0.1;
  const top = hi + pad;
  const bottom = lo - pad;

  const W = 300;
  const H = height;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - ((v - bottom) / (top - bottom)) * H;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  // Closed back along the floor so the fill has a baseline to sit on.
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.value - first.value;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        // Fills the card and scales with it; the stroke is unscaled so the
        // line stays the same weight whatever width the card ends up.
        preserveAspectRatio="none"
        className="block h-[116px] w-full overflow-visible"
        role="img"
        aria-label={`${label}: ${points.length} entries, ${first.value} to ${last.value} ${unit}.`}
      >
        {points.length > 1 && (
          <>
            <path d={area} fill="var(--color-cyan)" opacity="0.12" />
            <path
              d={line}
              fill="none"
              stroke="var(--color-cyan)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {/* The latest reading, which is the number anyone actually looks for. */}
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--color-fg)" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-2.5 flex items-baseline justify-between text-caption text-dim">
        <span>
          {points.length === 1
            ? "First one logged. Come back and this becomes a line."
            : `${points.length} entries`}
        </span>
        {showDelta && points.length > 1 && (
          <span className="tabular">
            {/* No sign on a flat run: "+0" reads as a result, and it isn't one. */}
            {delta === 0 ? "level" : `${delta > 0 ? "+" : ""}${round(delta)} ${unit}`}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Half-pound plates exist; thousandths of one do not. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}
