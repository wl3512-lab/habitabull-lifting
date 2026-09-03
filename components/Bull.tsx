import Image from "next/image";

/**
 * The mascot always comes from /public/mascot.png. The Figma copy has
 * transparent eyes and smile — never source him from there.
 *
 * His line inherits colour from whatever it is standing on, because he appears
 * on the charcoal ground and on the orange one and the text has to flip.
 */
/**
 * The trimmed artwork's aspect, which is also the Figma's: 206 × 250 on the
 * welcome screen, 180 × 218 on the PR. `size` is his width.
 */
// The artwork's own aspect. Get this wrong and every bull stretches. The 2026
// drawing is 531 x 634 after its background was cut and the canvas trimmed;
// the 2023 one it replaced was 824 x 1000, which is why this is a constant
// and not a guess.
const RATIO = 531 / 634;

/**
 * How big he gets, named for the job rather than the number.
 *
 * There were ten hand-typed widths — 206, 180, 168, 132, 120, 112, 104, 96,
 * 72 — which is not a scale, it is ten separate decisions that happened to be
 * near each other. Four steps at roughly 1.25 apart, matching the type ramp.
 *
 * `hero` came down from 206. At that width he was 53% of a 390px screen and
 * pushed the wordmark and the name field down the page; the new artwork is a
 * denser silhouette than the 2023 one, so the same number reads noticeably
 * larger than it used to.
 */
export const BULL = {
  /** Beside text he is not interrupting. The motivation card. */
  inline: 72,
  /** Speaking. Next to a bubble that carries the words. */
  speak: 96,
  /** Carrying an empty state on his own: rest, first run, a crew of one. */
  companion: 120,
  /** The screen is about him. Welcome, and a personal record. */
  hero: 152,
} as const;

export default function Bull({
  size = 132,
  say,
  react = false,
  className = "",
}: {
  size?: number;
  say?: string;
  react?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src="/mascot.png"
        alt=""
        width={size}
        height={Math.round(size / RATIO)}
        priority
        className={react ? "nod" : undefined}
        style={{ width: size, height: "auto" }}
      />
      {say && (
        <p className="head mt-3 max-w-[28ch] text-center text-[17px] leading-snug">{say}</p>
      )}
    </div>
  );
}
