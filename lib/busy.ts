/**
 * Whether the app is in the middle of something it must not be interrupted in.
 *
 * Only one thing in this product is uninterruptible, and it is the one the
 * whole app is built around: a workout. Reloading the page during a set costs
 * somebody their place mid-session in a gym, which is precisely the friction
 * the research says loses people. Everywhere else a reload is invisible,
 * because every screen rebuilds from localStorage and lands where a resumed
 * app lands anyway.
 *
 * A module flag rather than context: the only reader is mounted at the root,
 * outside the view machine that knows the answer, and this is read once at the
 * moment a decision is made rather than rendered.
 */
let busy = false;

/** Called by the view machine whenever it enters or leaves a workout. */
export function setBusy(value: boolean): void {
  busy = value;
}

export function isBusy(): boolean {
  return busy;
}
