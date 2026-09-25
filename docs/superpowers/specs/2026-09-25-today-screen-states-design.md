# Today, split by state

**Date:** 2026-09-25
**Status:** design, awaiting implementation plan

## The problem

A tester said the main function of the app should be easier to navigate, that
it is confusing, and that he does not want to think hard while he is trying to
work out. He was talking about opening the app, not about logging a set.

The screens state the right intent and do not deliver it:

| Screen | Lines | Interactive elements | Stacked sections |
| --- | --- | --- | --- |
| `components/Today.tsx` | 659 | 27 | ~10 |
| `components/LogSession.tsx` | 888 | 27 | set card plus 8 controls |

`Today.tsx` renders, in order: date and week number, a statement headline, the
goal bar, the motivation card, the primary action, the playlist row, the
constraints panel, the week strip, today's lifts, the crew preview, and the
streak card.

The cause is structural, not a lapse of taste. One component renders all four
states of the screen through interleaved conditionals, so every new idea lands
as one more card in the stack and no trade-off is ever forced. The clearest
symptom is `motivationCard`, built once at line 127 and rendered from two
different places, line 423 and line 541, depending on a `raised` flag.

## The rule

Each state of Today is its own screen with its own first screenful. The first
screenful holds the action and what the action is. Everything else goes below
the fold or to another tab.

```
TRAINING                    REST                  DONE                 UNCHOSEN
WED 24 SEP · Week 3         WED 24 SEP            WED 24 SEP           WED 24 SEP
Full Body A                 Rest day              4 sets done,         <headline>
5 lifts · about 40 min      Not today, and        2,400 lb moved
[  Start workout  ]          that is fine.        That is the whole    [ Build your
Bench · Row · Squat ·       [ Train anyway ]       job. See you Fri.      workout ]
Press · Curl                                      [ Add to session ]   <bull>
── fold ──                  ── fold ──            ── fold ──           (nothing else)
week, goal, motivation,     week, goal, crew      week, crew, streak
crew, streak
```

The goal stays on Today, below the fold. The deck's habit principle 4 asks for
the goal to be displayed when the app is opened; it does not ask for it to
outrank the button. The motivation card keeps its place on the training screen
for the same reason.

## The state becomes data

A pure function in a new `lib/today.ts`, tested the way the rest of this
codebase is tested:

```ts
export type TodayState = "unchosen" | "training" | "rest" | "done";

export function todayState(
  profile: Profile,
  routine: Routine | null,
  sessions: Session[],
  today: string
): TodayState;
```

All four conditions already exist inside the component and only need lifting
out:

- `unchosen`: `!profile.planChosen && sessions.length === 0` (line 259)
- `done`: a session dated today with `completedAt` set (line 73)
- `rest`: `!unchosen && !routine` (line 336)
- `training`: everything else

Order matters: `done` is checked before `rest`, so someone who trained anyway on
a rest day and finished sees the finished screen rather than being told to rest.

## Structure

```
components/
  Today.tsx              router, under 120 lines
  today/
    TodayTraining.tsx
    TodayRest.tsx
    TodayDone.tsx
    TodayUnchosen.tsx
    parts.tsx            DayHeader, WeekStrip, GoalCard, MotivationCard, StreakCard
lib/
  today.ts               todayState
  today.test.ts
```

`Today.tsx` keeps its current path and its current fifteen props, so
**`app/page.tsx` does not change.** It computes the shared derived values that
more than one state needs (`weeks`, `week`, `nextDayLabel`) and picks one child,
passing each only what that child uses. No state component receives the full
prop bag.

## What leaves Today

- `PlaylistRow` moves to Profile. It already navigates there via `onProfile`,
  and choosing music is not part of starting a workout.
- The constraints panel's three controls ("What's different today?", "Rebuild
  today", "Swap today's plan") collapse to a single line on the training screen
  that opens the existing panel as a sheet. The panel itself is unchanged.

Together these take the common training screen from 27 interactive elements to
roughly 8.

## Testing

`lib/today.test.ts` covers `todayState` exhaustively: first run with no plan and
no sessions, first run with sessions imported, a training day with a routine, a
rest day with no routine, a finished session on a training day, a finished
session on a rest day (the ordering edge above), and a day with a started but
unfinished draft, which is still `training`.

The per-screen density cap is a documented rule in each file's docstring, held
by the files being small and single-purpose. It is **not** an automated
assertion: this project has no jsdom and no testing-library, and all 541
existing tests are pure-function tests. Making density testable would mean
adding a DOM test stack, which is a separate decision and is not part of this
design.

## Ordering

The missed-day rotation design (`2026-09-25-missed-day-rotation-design.md`)
should land first. It changes which routine `Today` receives; this design
changes how `Today` renders it. They do not conflict, but doing this refactor
first would mean redoing part of it.

## Out of scope

- `LogSession.tsx`, which has the same density problem and deserves its own
  design. The tester was describing the home screen.
- The tab bar and the seventeen app views.
- Any change to what the copy says. This is about what is on screen and in what
  order, not about rewording it.
