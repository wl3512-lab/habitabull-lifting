/**
 * A number and its noun, agreeing.
 *
 * The app got this right in thirty places by writing the conditional out each
 * time, and wrong in thirteen by forgetting to. That ratio is the argument for
 * a function: the pattern was never in doubt, only whether whoever wrote the
 * line remembered it, and "remember it every time" is not a mechanism.
 *
 * Some of the misses were invisible. Two were `sr-only` lines, so the only
 * person who ever heard "1 sessions logged this week" was somebody using a
 * screen reader, and nobody looking at the screen could have caught it. One
 * was the message you send a friend to invite them. One was not an edge case
 * at all: cardio is one set by definition, so "All 1 sets done" was what every
 * cardio lift finished with.
 *
 * Existing correct sites were left as they are. They work, and churning thirty
 * of them to look tidier is a diff with no reader on the other end.
 */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
