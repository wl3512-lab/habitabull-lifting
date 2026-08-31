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
const RATIO = 824 / 1000;

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
