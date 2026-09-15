/**
 * A soft bell when a rest ends.
 *
 * Synthesised with Web Audio rather than shipped as an audio file — two sine
 * notes are a few lines and no asset, and unlike the Vibration API this works
 * on iOS. The catch iOS adds is that an AudioContext starts suspended until a
 * user gesture resumes it, so `unlock()` is called from the tap that begins the
 * rest (logging a set); by the time the timer fires two minutes later the
 * context is already awake.
 *
 * Everything is wrapped and swallowed. A workout does not stop because a phone
 * would not make a sound, and a gym is loud anyway — the bell is a nicety, the
 * visual "Ready when you are" is the real signal.
 */

let ctx: AudioContext | null = null;

function get(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a real tap so iOS lets the later chime through. */
export function unlockAudio(): void {
  const c = get();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

/** A rising two-note bell. Brief, and never loops. */
export function chime(): void {
  const c = get();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const t0 = c.currentTime;
    for (const [freq, at] of [[880, t0], [1318.51, t0 + 0.13]] as const) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      osc.connect(gain).connect(c.destination);
      osc.start(at);
      osc.stop(at + 0.55);
    }
  } catch {
    // No sound is an acceptable outcome; never let it surface.
  }
}
