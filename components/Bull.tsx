import Image from "next/image";

/**
 * The mascot. Never source him from Figma: that copy has transparent eyes and
 * smile.
 *
 * His line inherits colour from whatever it is standing on, because he appears
 * on the charcoal ground and on the orange one and the text has to flip.
 */

/**
 * Three poses, each with its own aspect.
 *
 * The ratio has to travel with the pose rather than sit in one constant. The
 * poses are genuinely different shapes: standing is 0.8375, the thumbs-up is
 * wider than it is tall at 1.0791 because the arm is out, and the confused one
 * is 0.9101 because the question marks push the box sideways. One shared
 * number would squash two of the three, which is the same bug that stretched
 * him on two screens when the artwork last changed.
 */
const POSES = {
  /** Standing. The default everywhere. */
  stand:    { src: "/mascot.png",           ratio: 531 / 634 },
  /** Thumbs up, winking. For the moment something went well. */
  cheer:    { src: "/mascot-cheer.png",     ratio: 505 / 468 },
  /** Question marks. For when the app cannot answer, not when you got it wrong. */
  confused: { src: "/mascot-confused.png",  ratio: 425 / 467 },
} as const;

export type Pose = keyof typeof POSES;

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
  pose,
  className = "",
}: {
  size?: number;
  say?: string;
  /** He reacts to something that just happened, and stands taller for it. */
  react?: boolean;
  /** Overrides the pose `react` would pick. */
  pose?: Pose;
  className?: string;
}) {
  // `react` has always meant "something happened worth a reaction", and until
  // now that only changed how he moved. It changes who he is as well.
  const { src, ratio } = POSES[pose ?? (react ? "cheer" : "stand")];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src={src}
        alt=""
        width={size}
        height={Math.round(size / ratio)}
        priority
        className={react ? "nod" : undefined}
        style={{ width: size, height: "auto" }}
      />
      {say && (
        <p className="head mt-3 max-w-[28ch] text-center text-emphasis leading-snug">{say}</p>
      )}
    </div>
  );
}
