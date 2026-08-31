"use client";

import Stepper from "./Stepper";
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
  lastTime,
  onChange,
}: {
  set: LoggedSet;
  increment: number;
  /** What this set was last time, if there is a last time. */
  lastTime?: string;
  onChange: (next: LoggedSet) => void;
}) {
  return (
    <div className="rise flex flex-col gap-3">
      {increment > 0 && (
        <Stepper
          label="Weight"
          value={set.weight}
          step={increment}
          suffix="lb"
          onChange={(weight) => onChange({ ...set, weight })}
        />
      )}
      <Stepper
        label="Reps"
        value={set.reps}
        step={1}
        min={1}
        suffix="reps"
        onChange={(reps) => onChange({ ...set, reps })}
      />
      {lastTime && (
        <p className="mt-1 flex items-center gap-2.5 text-[15px] text-dim">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-dim" />
          Last time: {lastTime}
        </p>
      )}
    </div>
  );
}
