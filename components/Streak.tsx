import { Stat } from "./ui";

/**
 * Stated plainly. No flame, no countdown, no "don't lose it" warning — the
 * whole premise of this app is that guilt is what made people quit the last
 * six apps they tried.
 *
 * Counted in weeks, so a four-day lifter never sees a broken streak for
 * resting, and a missed week costs a number rather than an achievement.
 */
export default function Streak({ weeks, sessions }: { weeks: number; sessions: number }) {
  return (
    <div className="flex gap-2.5">
      <Stat value={weeks} label={weeks === 1 ? "week running" : "weeks running"} />
      <Stat value={sessions} label={sessions === 1 ? "session" : "sessions"} />
    </div>
  );
}
