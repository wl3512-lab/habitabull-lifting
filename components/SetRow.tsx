"use client";

import PlateBar from "./PlateBar";
import Stepper from "./Stepper";
import { DEFAULT_BAR_LB } from "@/lib/plates";
import type { LoggedSet } from "@/lib/types";

/**
 * The active set, and only the active set.
 *
 * Earlier passes listed every set as a row and raised the current one. On a
 * phone that put the thing you are about to touch halfway down a list that
 * grows as the session goes. Now the sets you have finished live in the
 * segmented bar at the top of the screen and this panel is the whole of what
 * you are doing right now — two controls, stacked full width, no target
 * smaller than 56px.
 *
 * "Log set" is deliberately not here. It sits at the bottom of the screen with
 * every other primary action in the app, so the thumb finds it in the same
 * place on every screen.
 */
export default function SetRow({
  set,
  increment,
  cardio = false,
  incline = false,
  hold = false,
  lastTime,
  plates = false,
  bar = DEFAULT_BAR_LB,
  onBar,
  onChange,
}: {
  set: LoggedSet;
  increment: number;
  /** Cardio logs one duration in minutes, not weight and reps. */
  cardio?: boolean;
  /** A cardio machine with a settable incline — logs an incline % as well. */
  incline?: boolean;
  /** An isometric hold (plank, wall sit): logs time in seconds, not reps. */
  hold?: boolean;
  /** What this set was last time, if there is a last time. */
  lastTime?: string;
  /**
   * Load the bar instead of stepping the number. Barbell lifts only — the
   * caller decides, because a dumbbell press has no bar and a cable machine
   * has a pin, and offering plates there would be a lie about the equipment.
   */
  plates?: boolean;
  bar?: number;
  onBar?: (next: number) => void;
  onChange: (next: LoggedSet) => void;
}) {
  return (
    <div className="rise flex flex-col gap-3">
      {increment > 0 &&
        (plates ? (
          <PlateBar
            weight={set.weight}
            bar={bar}
            onWeight={(weight) => onChange({ ...set, weight })}
            onBar={(next) => onBar?.(next)}
          />
        ) : (
          <Stepper
            label="Weight"
            value={set.weight}
            step={increment}
            suffix="lb"
            onChange={(weight) => onChange({ ...set, weight })}
          />
        ))}
      <Stepper
        label={cardio ? "Duration" : hold ? "Time" : "Reps"}
        value={set.reps}
        step={cardio || hold ? 5 : 1}
        min={cardio || hold ? 5 : 1}
        suffix={cardio ? "min" : hold ? "sec" : "reps"}
        onChange={(reps) => onChange({ ...set, reps })}
      />
      {cardio && incline && (
        <Stepper
          label="Incline"
          value={set.weight}
          step={1}
          min={0}
          max={40}
          suffix="%"
          onChange={(weight) => onChange({ ...set, weight })}
        />
      )}
      {lastTime && (
        <p className="mt-1 flex items-center gap-2.5 text-body text-dim">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-dim" />
          Last time: {lastTime}
        </p>
      )}
    </div>
  );
}
