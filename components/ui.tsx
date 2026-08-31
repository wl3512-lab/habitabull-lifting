import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The 2026 language, in three primitives.
 *
 * One orange action per screen and never two — orange is the only fill in the
 * system that isn't a shade of the ground, so a second one on the same screen
 * costs the first one its meaning. Everything else that is pressable is an
 * outline in cyan. The 2023 guide's light pills are gone with the light field:
 * on charcoal they read as disabled.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "lg" | "sm";
  /**
   * primary  — the one action. Orange, ink text.
   * ghost    — everything else. Hairline border, cyan text.
   * onCyan   — for the cyan welcome ground, where orange would fight the field.
   * onOrange — for the celebration ground, where the whole screen is the accent
   *            and the button has to invert to stay the loudest thing on it.
   */
  variant?: "primary" | "ghost" | "onCyan" | "onOrange";
};

export function Pill({
  size = "lg",
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const dims =
    size === "lg" ? "h-14 w-full px-8 text-[17px]" : "h-10 px-5 text-[13px]";
  const skin = {
    primary: "bg-orange text-ground border-orange hover:bg-orange/90",
    ghost: "border-line-strong bg-transparent text-cyan hover:bg-raise/60",
    onCyan: "border-ground bg-ground text-fg hover:bg-ground/90",
    onOrange: "border-ground bg-ground text-orange hover:bg-ground/90",
  }[variant];
  return (
    <button
      type="button"
      className={`head rounded-full border transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.985] disabled:opacity-35 disabled:active:scale-100 ${dims} ${skin} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
  tone = "card",
}: {
  children: ReactNode;
  className?: string;
  /** card = the standard panel. raise = one step up, for anything you press. */
  tone?: "card" | "raise";
}) {
  return (
    <div
      className={`rounded-2xl ${tone === "raise" ? "bg-raise" : "bg-card"} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A counted thing. The figure is the whole point, so it gets the condensed
 * face at a size you can read across a room and the label gets out of its way.
 *
 * `accent` is for numbers that are good news in a way the raw count doesn't
 * carry on its own — comebacks, most of all. Coming back is the skill.
 */
export function Stat({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-card p-[18px]">
      <div className={`tabular statement text-[40px] ${accent ? "text-cyan" : "text-fg"}`}>
        {value}
      </div>
      <div className="mt-1 text-[15px] leading-tight text-dim">{label}</div>
    </div>
  );
}

/**
 * Goal progress.
 *
 * The 2023 guide drew this as a triangle filling from the base. It was the
 * right instinct and the wrong shape: a triangle's area grows as the square of
 * its height, so a bar filled to 90% by area sits at 68% by height and the
 * graphic quietly understates every number it is given. A bar is boring and
 * correct, and correct is what a number you are chasing has to be.
 *
 * Measured from where you started, not from zero, so a slow week never
 * subtracts.
 */
export function GoalBar({
  percent,
  caption,
  trailing,
  size = "md",
}: {
  percent: number;
  caption?: string;
  trailing?: string;
  size?: "md" | "lg";
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div
        className={`w-full overflow-hidden rounded-full bg-raise ${size === "lg" ? "h-3" : "h-2"}`}
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={caption ? `${caption} — ${p}% there` : `${p}% there`}
      >
        <div
          className="h-full rounded-full bg-cyan transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ width: `${p}%` }}
        />
      </div>
      {(caption || trailing) && (
        <div className="mt-2 flex items-baseline justify-between gap-3">
          {caption && <span className="text-[14px] text-dim">{caption}</span>}
          {trailing && (
            <span className="head tabular shrink-0 text-[14px] text-cyan">{trailing}</span>
          )}
        </div>
      )}
    </div>
  );
}
