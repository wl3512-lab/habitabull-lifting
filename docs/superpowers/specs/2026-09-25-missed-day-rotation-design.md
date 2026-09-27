# Missed-day rotation

**Date:** 2026-09-25
**Status:** design, awaiting implementation plan

## The problem

A tester reported that when he skips a training day and comes back, he wants to
do the day he skipped. The app gives him the opposite.

`app/page.tsx:218` picks the routine for a non-training day like this:

```ts
const routine = scheduled ?? byDay.find((r) => r.day > dow) ?? byDay[0] ?? null;
```

`byDay.find((r) => r.day > dow)` is the next routine on the calendar, not the
one that was missed. With Monday = A, Wednesday = B, Friday = C:

- Monday is skipped.
- Tuesday, "Train anyway" offers **B**.
- Wednesday, the scheduled day, also offers **B**.

A is never offered again that week. On a split this means a whole movement
pattern is dropped; on three full-body days it is close to invisible, so the
payoff of fixing it is concentrated on split users.

## The rule

What you are owed is the routine *after the last one you finished*. It is
derived on every render and never stored, so there is no backlog to accumulate
and nothing that can tell anyone they are behind.

Training days do not move. Only the content of a session slides. The app still
says nothing on a rest day unless asked, which keeps the rest-day argument the
product is built on.

| Situation | Last finished | Scheduled today | Offered |
| --- | --- | --- | --- |
| On schedule, Wednesday | A (Mon) | B | B, unchanged |
| Missed Monday, opens Tuesday (rest) | C (last Fri) | none | **A**, via "Train anyway" |
| Missed Monday, opens Wednesday | C (last Fri) | B | **A** |
| Did the Tuesday catch-up, opens Wednesday | A (Tue) | B | B, self-corrects |
| Away a month | C | B | **A**, with no mention of the gap |
| Never trained | none | B | B, the scheduled day |

The one-month row is the debt policy: the queue remembers a position in the
rotation, never a backlog. Returning after two days and after two months
produce the same screen.

## Where the logic lives

A pure function in `lib/schedule.ts`, which already owns when and what you
train, and is already pure and DOM-free like `lib/calendar.ts` and
`lib/arrival.ts`:

```ts
export function owedRoutine(
  routines: Routine[],
  sessions: Session[],
  dow: number
): Routine | null;
```

Rules, in order:

1. Sort routines by `day`.
2. Find the most recent session with `completedAt` set.
3. Map that session to its routine (see below). Call its index `i`.
4. Return `routines[(i + 1) % routines.length]`.
5. If there are no completed sessions, return the routine scheduled for `dow`,
   or the first routine if `dow` has none.
6. If `routines` is empty, return `null`.

`app/page.tsx:218` becomes:

```ts
const routine = owedRoutine(routines, sessions, dow);
```

`owedRoutine` owns every fallback that the old `?? scheduled ?? byDay[0] ?? null`
chain covered, including the empty case, so keeping any part of that chain would
be dead code. The local `byDay` becomes unused at this site and should be removed
if nothing else reads it.

## The one data change

`Session` records `label` but not which routine produced it, so step 3 above is
guesswork whenever labels repeat, which they do: three days can all be called
"Full Body".

Add an optional field to `Session` in `lib/types.ts`:

```ts
/** Which routine built this session, by weekday. Absent on sessions logged
    before the rotation needed to identify them. */
routineDay?: number;
```

`buildSession` in `lib/engine.ts:345` already receives the `Routine`, so it
writes `routineDay: routine.day` at the point the session is created. The field
is optional, so every session already in storage stays valid and every existing
backup still imports.

For sessions without it, `owedRoutine` falls back to matching on `label` plus
the weekday of the session's own `date`. That resolves duplicate labels for any
session logged on its scheduled day, which is all of them before this feature
existed.

## Copy

Nothing counts, and nothing scolds. `components/Comeback.tsx` already sets the
rule this follows: "No day count and no 'you missed N days' — the gap is not a
mark against anyone."

- Rest day: unchanged. Still "Rest day" and "Train anyway"; the button simply
  leads to the owed routine instead of the next one.
- Training day where the owed routine is not the scheduled one: one quiet line
  under the day name, "Picking up where you left off."
- Everywhere else: no change. No banner, no counter, no "you missed Monday".

## Testing

Added to the existing `lib/schedule.test.ts`:

- On schedule: owed equals scheduled, so nothing changes.
- One missed day, asked on a rest day.
- One missed day, asked on the next scheduled day.
- Catch-up completed, then the next scheduled day returns to normal.
- Month-long absence returns exactly one session, not a backlog.
- Never trained: falls back to the scheduled day.
- Duplicate labels across routines resolve by `routineDay`.
- Legacy sessions with no `routineDay` resolve by label plus weekday.
- Empty `routines` returns `null` rather than throwing.

## Out of scope

- Moving or adding training days. The schedule is untouched.
- Any UI that displays a count of missed sessions.
- Changing `Comeback.tsx`, which fires on a week-plus gap and only sets tone.
