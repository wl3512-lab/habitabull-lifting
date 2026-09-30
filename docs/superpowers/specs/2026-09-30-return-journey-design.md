# Coming back, and what fits today

**Date:** 2026-09-30
**Status:** design, awaiting implementation plan

## The problem

The 2026 competitive review found that habit support is no longer a difference.
Gravl tracks weekly consistency, Freeletics adapts a session to the day, Ray
advertises help rescheduling a missed workout. What the review recommends
instead is that this app be exceptionally good at one thing: helping somebody
who has fallen off complete the next session, especially the first one back.

Its P0 for that is a return state offering three ways in, resume, shorten or
adjust. The build has one.

| Piece | What exists now |
| --- | --- |
| The return | `components/Comeback.tsx`, 46 lines. A beat that auto-advances after 2.4s straight into the full planned session. |
| Limited time | Nothing. There is no way to say "I have twenty minutes". |
| Limited kit | "Something's different today" on Today, which rebuilds the day from a sentence. |
| Preview of a change | None. `applyConstraints` (`app/page.tsx:389`) writes the rebuilt day into the draft directly. |
| Undo of a change | None. |

The last two are what the audit writeup flags as the single incomplete item in
its evidence table: every state-changing suggestion is supposed to have a
concrete preview and a reliable way back, and this one has neither.

So somebody returning after three weeks is handed the same five lifts and
fifteen sets they were handed the week they stopped, with no way to say that
today is not that day short of abandoning the session.

## The rule

A return is a question, not an announcement. The app says what it knows, asks
what fits, and applies nothing until she picks.

### 1. The return screen

The beat keeps its trigger, a gap of a week or more, once a day, decided by
`comebackNow()` at `app/page.tsx:282`. What changes is where the 2.4s
auto-advance lands: the question, rather than the log screen.

```
Good to see you.
What fits today?
                                  LAST TIME
  [ Resume plan ]                 Full body A
  [ Shorter session ]             3 weeks ago
  [ Adjust today ]
```

Last time is shown so she can orient without leaving. The bull is present and
does not count the missed days, which is the existing voice rule in
`lib/voice.ts` and not up for renegotiation here.

- **Resume plan** does exactly what the beat does today.
- **Shorter session** opens the trim below.
- **Adjust today** opens the existing "What's different today?" flow.

### 2. Shorter cuts rest before it cuts work

Rest is the compressible part of a session. Cutting it keeps every lift and
every set, so the session she logs is still the session she planned, and
progression sees a complete day rather than a partial one.

```
Same lifts. Same sets.
Rest 1:30 -> 0:45
About 18 min instead of 27

[ Start this ]   [ Keep my rest ]
```

The rule, in order:

1. Halve her own rest. Someone resting 45s and someone resting 3:00 do not
   want the same "short", so this is relative, not a fixed number.
2. Floor at 30s, so it never lands on a number nobody can train on.
3. Round to `REST_STEP` (15s), so the timer shows a figure the app elsewhere
   lets her set.

Shorter is reachable from two places, because limited time is not only a
comeback problem: from the return screen, and from Today beside "Something's
different today", where it is the same size of decision about the same day.

This is written as `restSec` on the session, not on the profile. Her setting is
a preference and survives the day; this is one afternoon and expires with it.
`LogSession` reads the session's value first and falls back to
`restSeconds(profile)` (`components/LogSession.tsx:271`).

"Keep my rest" opens the two work-based cuts, each showing what it becomes:

| Cut | What it does | What survives |
| --- | --- | --- |
| Just the main lifts | Compounds keep their sets, every accessory goes, wherever it sits in the order | The point of the day. `Exercise.compound` already marks which is which |
| One set of each | Every lift keeps one working set | Every lift gets a logged set, so nothing vanishes from history |

A lift with a set already logged against it is never dropped by either. A
logged set is a fact and a trim is a plan.

Times are estimates and say "about": sets times a flat per-set figure plus the
rest between them. A hold or a cardio block uses its own duration, since its
reps field is seconds or minutes. No claim of precision, because there is none.

### 3. Preview and undo, on both paths

One shared change list, used by the trim and by the constraints rebuild:

```
Here is what changes

  Back Squat      kept, 3 x 8
  Bench Press     swapped for Dumbbell Press
  Leg Press       dropped, no machine
  Rest            1:30 -> 0:45

[ Use this ]   [ Keep my plan ]
```

Nothing is written until "Use this". After it is written, an undo stays on
screen for the rest of the session and restores the previous version in one
tap, so a wrong choice costs a tap rather than a rebuild.

Undo restores the plan and never a logged set. If she has logged against the
adapted session, undo keeps those sets and puts the untouched lifts back
around them, which is what `mergeRebuild` in `lib/engine.ts` already does for
the open-day case.

## What this deliberately does not do

- **It does not touch progression.** The rep-rewrite and the floorless deload
  found on 2026-09-26 are open on purpose and stay open. A shortened session
  must not become a third way for targets to drift.
- **It uses no model.** Shortening is arithmetic on her own numbers. The only
  language path here is the constraints sentence that already exists.
- **It adds no notification and no reminder.** The return screen is something
  she arrives at, not something that chases her.

## Where it lands

| File | Change |
| --- | --- |
| `lib/shorten.ts` | New. Pure: given a session and a profile, return each option with its resulting session and its estimate. Tested without a DOM, like the rest of `lib/` |
| `lib/types.ts` | `Session.restSec?: number` |
| `components/Comeback.tsx` | Gains the question and the three actions. The beat itself is unchanged |
| `components/ShorterSession.tsx` | New. The trim options and their previews |
| `components/ChangeList.tsx` | New. The shared preview and its two buttons |
| `components/LogSession.tsx` | Rest comes from the session when it has one |
| `components/Today.tsx` | "Shorter session" beside "Something's different today"; the constraints flow routes through the preview |
| `app/page.tsx` | Holds the pre-adaptation session for undo; wires the new views |
| `app/frames/page.tsx` | A frame each for the return screen, the trim, and the change list |

## How it gets checked

- `lib/shorten.ts` gets unit tests for each cut: rest halving and its floor,
  compounds kept, logged lifts never dropped, an all-compound day falling
  through to sets, and a one-lift session that cannot be cut at all.
- The three screens get frames, so they are in the gallery and in `shoot.mjs`.
- Driven in a real browser against `next start`, on a seeded state with a three
  week gap: the return screen appears, each of the three routes lands where it
  says, the trim writes only the session's rest, and undo puts the plan back
  with logged sets intact.
