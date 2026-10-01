# One way to start, and screens that fit

**Date:** 2026-09-30
**Status:** design, awaiting implementation plan

## The problem

Four things Lucy found using the app, each measured on a real history at
390 × 844:

| Where | What is wrong | Measured |
| --- | --- | --- |
| Today, on a day with a plan | Three ways out under Start: "Something else today", "Something's different today", and the music line. The first two sound alike and do different jobs. Once in the picker (frame 05c), the plan is gone: it survives only as a small cyan line, and the way back to it is Cancel. | |
| Edit your week | The seven day types are tall cards with a sentence each. The first lift is below the first screen, and "Save the week" is at the very bottom. | 1,988px, first lift at 1,037px |
| Profile | Every setting is laid out in full. "Your workouts" prints every lift on every day, which the Calendar and the week editor already show. Rest is three screens down. | 3,241px |
| Setting a weight | A pick between two (+ / − or Load the bar) with a practice area, when the real question is whether she wants plates offered at all. Meanwhile every barbell set in a workout carries a two-button switch, whether she has ever used plates or not. | Profile card 336px |

The four parts below are independent. Each can be built and shipped alone.

## 1. Today: one button, and the plan first in the list

### Today

On a day with a plan that has not been started or logged, Today has one button,
**Start workout**, and it goes straight into the session as it does now.

- The top line reads **Planned for today · Week 5** (the week number only when
  there is one), with a cyan **Change** at the right of the same row. The header
  row is already a two-sided flex (`components/Today.tsx:412`) with nothing on
  the right.
- On that day, "Something else today" (`Today.tsx:573`) and "Something's
  different today" (`Today.tsx:651`) leave Today; Change is the way to both.
  "Something else today" goes everywhere, since Change replaces it. "Something's
  different today" stays on a rest day and on a started day, where there is no
  Change and it still rebuilds the session in front of her.
- Unchanged: rest days keep "Train anyway"; before there is a plan, "Quick
  workout" stays where it is; a started or logged day keeps "Continue workout"
  and "Add to today's session".

### The list (05c)

**Change** opens `PickWorkout` with `planned` set, as "Something else today"
does now. What changes is the top of it:

- The planned workout is the first card, outlined in orange, tagged **Planned
  for today**, showing its lifts. Tapping it starts the plan. This reverses the
  rule in `PickWorkout.tsx:75`, which left the plan out because "the button on
  Today already starts that": the point of the card is that changing your mind
  costs one tap, not a Cancel.
- Inside the card, under a hairline, **Adjust it for today** opens the existing
  sentence box ("I'm working from home, no machines, only dumbbells") in place.
- Everything else sits under one label, **Or switch to**, in the sections it
  has now: your workouts, from your week, you used to do, one of ours, log as
  you go.
- The headline stays "What are you doing?".

### Moving the sentence flow

`submitNote` (`Today.tsx:133`) moves out of Today into a function both screens
can call, so the network call, the local fallback and the "worked that out
offline" honesty stay in one place:

```ts
// lib/adjust.ts
export async function readConstraints(text: string): Promise<{ constraints: Constraints; offline: boolean }>
```

After "Rebuild today", the picker calls `onConstraints`, `app/page.tsx` returns
to Today, and Today shows the same "understood" line it shows now. That line
moves from Today's local state into `page.tsx` so it survives the trip back.

When the return-journey design (`2026-09-30-return-journey-design.md`) is
built, its "Shorter session" goes into this card beside "Adjust it for today",
not onto Today, and both go through its preview and undo. That spec puts
Shorter "beside Something's different today"; this design moves that spot.

### Frames

- **01** passes `onPickWorkout`, so the still shows the real Change instead of
  the Quick workout a planned day no longer has.
- **05c** shows the plan card on top.

## 2. Edit your week: chips, a link, and a save that stays put

All in the main pane of `components/RoutineEditor.tsx` (from line 625). The
workouts pane and the per-lift editor are untouched.

- **Day types as chips.** The seven become a wrap of chips with short names:
  Full body, Push, Pull, Legs, Upper, Lower, Cardio. Templates get a `short`
  field in `lib/templates.ts`; `label` stays everywhere else, so the Calendar
  still says "Leg day". The selected chip is filled cyan. Under the chips, only
  the selected type's `hint`, with **Recommended** after it on Full body. When
  she has saved workouts, a **Your workouts** chip comes first and opens the
  workouts pane as the card does now.
- **Or describe your week** becomes a cyan link. Tapping it shows the existing
  form in place with the field focused. It stays open while `weekWhy` or
  `weekOffline` has something to say.
- **Add a lift** becomes one dashed row, "+ Add a lift". Tapping it shows the
  nine muscle chips and what follows them now (`RoutineEditor.tsx:1089`).
  "Because of what you starred" stays visible: it is one suggestion, not a list.
- **Save the week** is pinned to the bottom of the screen
  (`RoutineEditor.tsx:1133`), over a fade into the ground colour, with bottom
  padding on the pane so the last lift is never under it.
- The "trains some muscles once" line stays under the chips.

Expected length: about 1,310px, from 1,988px. Measured again after building,
with the same seed, before claiming it.

### Frames

**14**, **14c** and **14d** re-shot. **14** shows a type selected with its hint.

## 3. Profile: rows that show their value

`components/Profile.tsx`.

The name and "You workout because" stay as they are at the top. Everything
under them becomes rows in four groups. Each row is a label, its current value
on the right, and a chevron.

| Group | Row | Value shown | Tapping it |
| --- | --- | --- | --- |
| You | Body weight | Latest weigh-in and its date, "165.5 lb · Sep 20", or "Add" | Opens `BodyWeight` in place |
| Your plan | One row per training day | "Full body A · 5 lifts" under the day name | Goes to that day in the week editor, `onEditPlan(day)`, as the schedule's day names do now |
| | Saved workouts (only if she has some) | How many | Opens the saved list in place, with "Put one on a day" |
| | Schedule | "3 days a week", then the anchors if set | Goes to week setup, `onEditWeek` |
| In the gym | Experience | "New to this", "Coming back" or "Experienced" | Opens the three choices and their note in place |
| | Equipment | First two, then "+n" | Opens the chips and their note in place |
| | Load the bar on barbell lifts | A switch | Flips the switch (part 4) |
| | Rest between sets | "60 sec" | Opens the stepper and its note in place |
| App | Gym playlist | Its name, or "Not set" | Opens `PlaylistRow` in place |
| | Your data | "Export, import" | Opens `YourData` in place |

- One row open at a time. Opening one closes the other. A row that opens in
  place has `aria-expanded`; one that goes somewhere else does not.
- With no plan yet, "Your plan" is a single row, **Set up your week**.
- The full lift lists under "Your workouts" go. The day rows replace them.
- Every explanation that exists now survives, inside its row. Nothing about
  what a setting does is lost, only where it waits.

The value strings are pure functions in a new `lib/profile-summary.ts`, tested:
the weigh-in line, the equipment line with its "+n", the schedule line, the
day line.

Expected length: about 1,110px with every row closed, from 3,241px.

### Frames

**08b** re-shot closed, and a new **08c** with Equipment open.

## 4. Load the bar: a switch, asked once where it means something

### The setting

A new profile field:

```ts
/** Whether barbell lifts offer the plate loader. Undefined until she has answered. */
loadTheBar?: boolean;
```

and one function in `lib/plates.ts` that every caller reads instead of the
field:

```ts
export function offersPlates(profile: Profile): boolean | undefined
```

It returns `loadTheBar` when it is set. When it is not, and `weightInput` is set,
she has already used the switch in a workout, so it returns `true` and nothing
changes under any current tester. Otherwise `undefined`: not asked yet.

- **Off:** barbell sets show + / − only, and the two-button switch above the set
  (`LogSession.tsx:897`) is not drawn.
- **On:** the switch is drawn as now, and remembers `weightInput` as now.
- In Profile it is the switch row from part 3. Turning it on also sets
  `weightInput` to "plates", since she has just asked for them. Turning it off
  leaves `weightInput` alone; nothing reads it while the switch is off.
- `components/WeightInputSettings.tsx` and its practice area are deleted. The
  first-time card teaches it with a real bar instead.

### Asking

The first time a barbell lift with an increment comes up and `offersPlates` is
`undefined`, one card sits above the weight:

> **This one's on a barbell**
> Want to tap plates onto the bar instead of typing the total? The app does the adding.
> [ Try it ] [ No thanks ]

- **Try it:** `loadTheBar: true`, `weightInput: "plates"`. The plate loader
  appears in place of the stepper for this set.
- **No thanks:** `loadTheBar: false`. The card goes and the stepper stays.
- Either answer is the answer. The card never comes back; the Profile switch is
  where she changes her mind.
- Both buttons are outlined, not orange. "Log set" is the one orange action on
  this screen.

### Onboarding

Unchanged. Onboarding is two screens on purpose (`components/Onboarding.tsx:27`):
her own testing found people want to log a workout before they will set
anything up, and somebody who has never loaded a bar has no basis to choose.

### Frames

**04** is unchanged: the frame passes no `onProfile`, so neither the switch nor
the card draws there. A new **04g** passes one and shows the first-time card.

## Data and compatibility

- `loadTheBar` is optional, so stored states without it load unchanged and are
  read through `offersPlates`.
- Export and import carry it like `weightInput`. `lib/session-memory.test.ts:96`
  round-trips `weightInput` through a restore; it gets a `loadTheBar` case.
- No other field changes meaning.

## Testing

Logic lives in `lib/` and is tested in node, the way the app is tested now:

| Module | Tests |
| --- | --- |
| `lib/plates.ts` | `offersPlates`: set true, set false, unset with `weightInput` (true), unset without (undefined) |
| `lib/adjust.ts` | The local fallback when the call throws, and `offline` set from `source` |
| `lib/profile-summary.ts` | Each value string, including no weigh-ins, one item of kit, five items of kit, no anchors |
| `lib/templates.ts` | Every template has a `short`, and none is longer than its `label` |
| `lib/session-memory.test.ts` | `loadTheBar` survives a restore |

The screens cannot be render-tested without adding a DOM stack, which this repo
does not have. They are checked in a built app (`next start`, one eval script
per flow, against the seeded history), and the page lengths above are measured
again the same way before they are quoted.

## Files

| File | Change |
| --- | --- |
| `components/Today.tsx` | One button on a planned day; Change in the header; the two doors and the constraints card leave |
| `components/PickWorkout.tsx` | The planned card on top, with Adjust it for today; "Or switch to" |
| `lib/adjust.ts` | New. The sentence call and its fallback, out of Today |
| `app/page.tsx` | Holds the "understood" line across the trip back to Today |
| `components/RoutineEditor.tsx` | Chips, the describe link, the Add a lift row, the pinned save |
| `lib/templates.ts` | `short` on each template |
| `components/Profile.tsx` | Rows in four groups, one open at a time |
| `lib/profile-summary.ts` | New. The value strings |
| `lib/types.ts` | `loadTheBar` |
| `lib/plates.ts` | `offersPlates` |
| `components/LogSession.tsx` | The switch only when offered; the first-time card |
| `components/WeightInputSettings.tsx` | Deleted |
| `app/frames/page.tsx` | 01, 04g, 05c, 08b, 08c, 14c (14 and 14d are re-shot, not changed) |

## Not in this

- The return screen, Shorter session, and preview and undo. They are the
  return-journey design; this only moves where Shorter will sit.
- Any change to rest days, Quick workout before a plan exists, or onboarding.
- Changing the Calendar, which keeps the full day labels and lift lists that
  Profile stops repeating.
