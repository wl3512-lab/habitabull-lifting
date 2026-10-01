import type { Profile } from "./types";

/**
 * Loading a barbell, which is the one piece of arithmetic this app asks people
 * to do in their head.
 *
 * A bar is loaded symmetrically, so the number on the screen and the number of
 * plates in your hands are never the same number. "185" means a 45 bar and
 * 45+20+5 a side, and working that out at a rack — or working out what to take
 * off to drop ten pounds — is the moment people reach for the calculator app.
 * Everything here is per side; the totals are the only place both sides exist.
 */

/** Pounds, heaviest first, which is the order a greedy load wants them in. */
export const PLATES_LB = [45, 25, 10, 5, 2.5] as const;

/** The bar nearly every gym has, and the default until she says otherwise. */
export const DEFAULT_BAR_LB = 45;

/** A bar can be a training bar or a stripped-down one; it is hers to set. */
export const BAR_MIN = 0;
export const BAR_MAX = 100;

/**
 * How many plates one end of the bar takes before the sleeve is full.
 *
 * A sleeve is about sixteen inches of loadable steel, which is ten iron 45s
 * and not many more. It used to be unlimited, and a tester tapped the 45 until
 * the bar said 13,545 lb: every tap another plate, another "45 ·" in the line
 * under the drawing, until the list had pushed the rest of the screen out of
 * reach. Ten 45s a side is 945 lb on a 45 bar, which is more than anybody
 * logging a set in this app is going to put on it.
 */
export const MAX_PLATES_PER_SIDE = 10;

/** What is actually on the bar: the bar itself, plus both sides. */
export function totalWeight(bar: number, perSide: number[]): number {
  return round(bar + 2 * perSide.reduce((n, p) => n + p, 0));
}

/**
 * The plates that make a target, heaviest first, one side.
 *
 * Greedy, which is optimal for a real plate set because every denomination
 * divides the ones above it. Returns what it could actually load as well as
 * the plates, because not every number is loadable: 47.5 on a 45 bar needs
 * 1.25 a side and most gyms do not have them. Saying so is better than
 * silently rounding a number somebody typed.
 *
 * It also stops at a full sleeve. The stepper goes to 2000, and a number that
 * big read as plates used to come back as twenty-odd 45s a side, a drawing
 * with no room for them. So it loads what fits, says it is not exact, and
 * `full` tells the screen why.
 */
export function platesFor(
  target: number,
  bar: number = DEFAULT_BAR_LB,
  available: readonly number[] = PLATES_LB
): { plates: number[]; achieved: number; exact: boolean; full: boolean } {
  const perSide = (target - bar) / 2;
  if (!Number.isFinite(perSide) || perSide <= 0) {
    return { plates: [], achieved: round(bar), exact: round(bar) === round(target), full: false };
  }
  const plates: number[] = [];
  let left = perSide;
  for (const p of [...available].sort((a, b) => b - a)) {
    while (round(left) >= p && plates.length < MAX_PLATES_PER_SIDE) {
      plates.push(p);
      left = round(left - p);
    }
  }
  const achieved = totalWeight(bar, plates);
  return {
    plates,
    achieved,
    exact: round(achieved) === round(target),
    full: plates.length >= MAX_PLATES_PER_SIDE,
  };
}

/**
 * Add a plate to a side, keeping the stack heaviest-first.
 *
 * Order matters only because it is drawn: plates go on the bar big end in, so
 * a stack that is not sorted looks wrong to anybody who has loaded one.
 *
 * A full sleeve comes back as it was. Not a lighter plate swapped out to make
 * room, because at a rack nobody takes a plate off by putting one on.
 */
export function addPlate(perSide: number[], plate: number): number[] {
  if (perSide.length >= MAX_PLATES_PER_SIDE) return perSide;
  return [...perSide, plate].sort((a, b) => b - a);
}

/** Take one plate off, the first of that denomination. */
export function removePlate(perSide: number[], plate: number): number[] {
  const i = perSide.indexOf(plate);
  if (i === -1) return perSide;
  return [...perSide.slice(0, i), ...perSide.slice(i + 1)];
}

/**
 * Whether barbell lifts offer the plate loader.
 *
 * `loadTheBar` is her answer once she has given one. Before it existed the
 * switch sat on every barbell set, so anybody with a `weightInput` has already
 * met it and keeps it: nothing changes under a current tester. `undefined`
 * means not asked yet, which is what puts the question on her first bar.
 */
export function offersPlates(
  profile: Pick<Profile, "loadTheBar" | "weightInput">
): boolean | undefined {
  if (profile.loadTheBar !== undefined) return profile.loadTheBar;
  return profile.weightInput ? true : undefined;
}

/**
 * Two decimal places, then trimmed.
 *
 * 2.5 plates make thirds of a pound out of floating point — 47.5 - 45 lands on
 * 2.4999999999999996 — and a set of plates that never quite empties is the
 * kind of bug that only shows up at the bottom of the stack.
 */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
