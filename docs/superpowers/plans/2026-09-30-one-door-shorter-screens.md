# One way to start, and screens that fit: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four parts of `docs/superpowers/specs/2026-09-30-one-door-shorter-screens-design.md`: a Load the bar switch asked once at the first barbell lift, Profile as rows, Edit your week with chips, and Today with one button and the plan first in the list.

**Architecture:** Every piece of logic goes into a pure, tested module in `lib/` first (`offersPlates`, `profile-summary`, template `short` names, `adjust`), and the components read from those. Components are not render-tested in this repo (no DOM stack); each screen is checked in a built app through `/frames` and a seeded session, and the page lengths the spec quotes are measured before and after the same way.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, vitest 4, TypeScript. `agent-browser` for checking screens.

---

## Before you start

- Repo: `~/Desktop/habitabull`, branch `feat/oxide-brand-and-workout-features`.
- Run tests with `npx vitest run` (expect **706 passed** before Task 1). Type-check with `npx tsc --noEmit`.
- Screens are checked against a production build, never `npm run dev`: StayFresh reloads the page on every HMR build id and every click appears to do nothing. Build with `npx next build`, serve with `npx next start -p 3111`.
- `node scripts/shoot.mjs --only <id> --port 3111` writes a 390 × 844 @2x still into `~/Desktop/Portfolio Documentation/habitabull redesign/redesign-screens/`. That folder is not under git, so a bad shot overwrites a good one with no way back. Only shoot the ids a task names.
- House style for comments and copy: say why, plainly, no em dashes. Commit messages are lowercase-prefixed and describe the human problem. End each with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The four parts are independent except that Part B's switch row uses `offersPlates` from Task 1. Do the parts in order A, B, C, D.

## File map

| File | Part | Responsibility |
| --- | --- | --- |
| `lib/types.ts` | A | `loadTheBar` on `Profile` |
| `lib/plates.ts` | A | `offersPlates`: the one reader of the setting |
| `components/PlatesOffer.tsx` | A | New. The once-only question on the first barbell lift |
| `components/LogSession.tsx` | A | Draws the switch only when offered; draws the question when not asked |
| `lib/profile-summary.ts` | B | New. Level, equipment and anchor labels, and the value line each row shows |
| `components/ProfileRows.tsx` | B | New. `RowGroup`, `ExpandRow`, `LinkRow`, `SwitchRow` |
| `components/BodyWeight.tsx`, `components/YourData.tsx` | B | A `bare` prop so they sit inside a row without their own heading |
| `components/Profile.tsx` | B | Rows in four groups, one open at a time |
| `components/WeightInputSettings.tsx` | B | Deleted |
| `lib/templates.ts` | C | `short` name on every day type |
| `components/RoutineEditor.tsx` | C | Chips, describe link, collapsed Add a lift, pinned Save |
| `lib/adjust.ts` | D | New. The sentence call and its offline fallback, shared by Today and the list |
| `components/Today.tsx` | D | One button and a Change on a planned day |
| `components/PickWorkout.tsx` | D | The planned card first, with Adjust it for today |
| `app/page.tsx` | D | Wires the planned card, the adjust, and the line Today shows after |
| `app/frames/page.tsx`, `scripts/shoot.mjs` | all | Frames 01, 04g, 05c, 08b, 08c, 14c |

---

## Task 0: Baseline measurements

**Files:** none changed.

- [ ] **Step 1: Build and serve**

```bash
cd ~/Desktop/habitabull && npx next build && (npx next start -p 3111 > /tmp/next-3111.log 2>&1 &)
```

Expected: build ends with the route table; `curl -sf -o /dev/null http://localhost:3111/frames && echo up` prints `up`.

- [ ] **Step 2: Measure the two long screens in their frames**

```bash
for shot in 14 08b; do
  agent-browser --session plan open "http://localhost:3111/frames?shot=$shot" >/dev/null
  agent-browser --session plan set viewport 390 844 >/dev/null
  echo "$shot: $(agent-browser --session plan eval "document.querySelector('main').scrollHeight")"
done
```

Expected: `14: "1988"` (give or take a few px). Write down the `08b` number; the frame fixture differs from the seeded history the spec measured (3,241px), so the before and after of this run are what get compared.

---

## Part A: Load the bar

### Task 1: `offersPlates` and the `loadTheBar` field

**Files:**
- Modify: `lib/types.ts` (after `weightInput`, around line 258)
- Modify: `lib/plates.ts`
- Test: `lib/plates.test.ts`, `lib/session-memory.test.ts`

- [ ] **Step 1: Write the failing tests**

In `lib/plates.test.ts`, add `offersPlates` to the import list:

```ts
import {
  addPlate,
  DEFAULT_BAR_LB,
  MAX_PLATES_PER_SIDE,
  offersPlates,
  platesFor,
  PLATES_LB,
  removePlate,
  totalWeight,
} from "./plates";
```

and append:

```ts
/*
  The plate loader used to be a pick between two that sat on every barbell
  set whether she had ever wanted plates or not. Now it is offered or it is
  not, and the first barbell lift asks.
*/
describe("offering plates", () => {
  it("is her answer once she has given one", () => {
    expect(offersPlates({ loadTheBar: true })).toBe(true);
    expect(offersPlates({ loadTheBar: false, weightInput: "plates" })).toBe(false);
  });

  it("counts somebody who already used the switch as a yes", () => {
    expect(offersPlates({ weightInput: "plates" })).toBe(true);
    expect(offersPlates({ weightInput: "steppers" })).toBe(true);
  });

  it("is not asked yet when nothing says otherwise", () => {
    expect(offersPlates({})).toBeUndefined();
  });
});
```

In `lib/session-memory.test.ts`, add after the test that ends with `expect(resumePosition(restored.sessions[0]).timer?.endsAt).toBe(200000);`:

```ts
it("keeps the load-the-bar answer through a backup restore", async () => {
  const { EMPTY } = await import("./storage");
  const { buildBackup, parseBackup } = await import("./backup");
  const state = {
    ...EMPTY,
    profile: { name: "QA", level: "new" as const, equipment: [], trainingDays: [1], createdAt: "2026-09-28T12:00:00Z", loadTheBar: false },
  };
  const restored = parseBackup(JSON.parse(JSON.stringify(buildBackup(state))))!.state;
  expect(restored.profile?.loadTheBar).toBe(false);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/plates.test.ts lib/session-memory.test.ts`
Expected: FAIL. `offersPlates` is not exported; the restore test fails type-checking on `loadTheBar` only under `tsc`, so vitest may pass it. That is fine: it guards that storage keeps passing unknown profile fields through.

- [ ] **Step 3: Add the field**

In `lib/types.ts`, directly after the `weightInput?: "steppers" | "plates";` line:

```ts
  /**
   * Whether barbell lifts offer the plate loader at all. Undefined until she
   * has answered, which the first barbell lift asks once. Read it through
   * `offersPlates`, which also counts somebody who already used the switch.
   */
  loadTheBar?: boolean;
```

- [ ] **Step 4: Add `offersPlates`**

At the top of `lib/plates.ts`, before the first doc comment:

```ts
import type { Profile } from "./types";
```

At the end of `lib/plates.ts`, before `function round`:

```ts
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
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/plates.test.ts lib/session-memory.test.ts && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/plates.ts lib/plates.test.ts lib/session-memory.test.ts
git commit -m "feat: whether the bar is offered is its own answer, not a side effect of a pick

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Ask once, on the first barbell lift

**Files:**
- Create: `components/PlatesOffer.tsx`
- Modify: `components/LogSession.tsx` (imports line 12; `usePlates` around line 177; the switch around line 897; the footnote around line 908)
- Modify: `app/frames/page.tsx` (after the `n="04"` frame, around line 268), `scripts/shoot.mjs` (the `SHOTS` list)

- [ ] **Step 1: Create the question**

`components/PlatesOffer.tsx`:

```tsx
"use client";

/**
 * Asked once, on her first barbell lift, with the bar in front of her.
 *
 * Onboarding is two screens on purpose and this is not one of them: somebody
 * who has never loaded a bar has nothing to choose between at signup. Here
 * there is a bar, a number and a reason to care. Either answer is the answer,
 * and the switch in Profile is where she changes her mind.
 *
 * Both buttons are outlined. "Log set" is the one orange action on this screen.
 */
export default function PlatesOffer({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  return (
    <section aria-label="Load the bar" className="mb-3 rounded-2xl bg-card p-[18px]">
      <p className="head text-emphasis text-fg">This one&apos;s on a barbell</p>
      <p className="mt-1 text-body leading-snug text-dim">
        Want to tap plates onto the bar instead of typing the total? The app does the adding.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className="head min-h-11 flex-1 rounded-full border border-line-strong px-3 text-body text-cyan transition-colors hover:border-fg"
        >
          Try it
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="head min-h-11 flex-1 rounded-full border border-line-strong px-3 text-body text-dim transition-colors hover:border-fg hover:text-fg"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Gate the switch and draw the question in `LogSession`**

Imports: replace `import { DEFAULT_BAR_LB } from "@/lib/plates";` with

```tsx
import { DEFAULT_BAR_LB, offersPlates } from "@/lib/plates";
import PlatesOffer from "./PlatesOffer";
```

Replace

```tsx
  const usePlates = profile.weightInput === "plates" && meta?.equipment === "barbell";
```

with

```tsx
  const offered = offersPlates(profile);
  const usePlates = offered === true && profile.weightInput === "plates" && meta?.equipment === "barbell";
```

Replace the opening line of the switch block

```tsx
            {meta?.equipment === "barbell" && increment > 0 && onProfile && (
              <div className="mb-3 flex gap-2" aria-label="Weight entry method">
```

with

```tsx
            {meta?.equipment === "barbell" && increment > 0 && onProfile && offered === undefined && (
              <PlatesOffer
                onAnswer={(yes) =>
                  onProfile(
                    yes
                      ? { ...profile, loadTheBar: true, weightInput: "plates" }
                      : { ...profile, loadTheBar: false }
                  )
                }
              />
            )}
            {meta?.equipment === "barbell" && increment > 0 && onProfile && offered === true && (
              <div className="mb-3 flex gap-2" aria-label="Weight entry method">
```

Replace

```tsx
            {profile.weightInput === "plates" && meta?.equipment !== "barbell" && (
```

with

```tsx
            {offered === true && profile.weightInput === "plates" && meta?.equipment !== "barbell" && (
```

- [ ] **Step 3: Add frame 04g**

In `app/frames/page.tsx`, directly after the closing `</Frame>` of `n="04"`:

```tsx
            <Frame n="04g" name="Logging · the first bar" note="Asked once, on the first barbell lift, with the bar in front of her. Onboarding stays two screens: somebody who has never loaded a bar has nothing to choose between at signup. Either answer sets the switch in Profile.">
              <LogSession
                session={f.draft}
                history={f.sessions}
                profile={f.profile}
                onProfile={f.noop}
                onChange={f.noop}
                setsLeft={2}
                onDone={f.noop}
                onEnd={f.noop}
              />
            </Frame>
```

In `scripts/shoot.mjs`, after `["04f", "04f-quick-workout"],` add:

```js
  ["04g", "04g-first-bar"],
```

- [ ] **Step 4: Check it**

```bash
npx tsc --noEmit && npx vitest run && npx next build && (lsof -tiTCP:3111 -sTCP:LISTEN | xargs kill 2>/dev/null; npx next start -p 3111 > /tmp/next-3111.log 2>&1 &) && until curl -sf -o /dev/null http://localhost:3111/frames; do /bin/sleep 1; done && node scripts/shoot.mjs --only 04g --port 3111
```

Expected: tests pass; the still `04g-first-bar.png` shows Back Squat with the "This one's on a barbell" card above the weight and no "Use + / −" switch. Open it and look.

- [ ] **Step 5: Commit**

```bash
git add components/PlatesOffer.tsx components/LogSession.tsx app/frames/page.tsx scripts/shoot.mjs
git commit -m "feat: the first barbell lift asks about plates once, and nobody else sees the switch

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Part B: Profile as rows

### Task 3: The value lines

**Files:**
- Create: `lib/profile-summary.ts`
- Test: `lib/profile-summary.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/profile-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayLine, equipmentLine, levelLabel, LEVELS, scheduleLine, weighInLine } from "./profile-summary";
import type { PlannedExercise } from "./types";

const lift = (exerciseId: string): PlannedExercise => ({ exerciseId, sets: 3, reps: 5, weight: 100 });

describe("what each Profile row says when it is closed", () => {
  it("reads the latest weigh-in with its date, or nothing", () => {
    expect(weighInLine([])).toBeNull();
    expect(
      weighInLine([
        { date: "2026-09-13", lb: 165.85 },
        { date: "2026-09-20", lb: 165.5 },
      ])
    ).toBe("165.5 lb · Sep 20");
  });

  it("names up to two pieces of kit and counts the rest", () => {
    expect(equipmentLine(["dumbbell"])).toBe("Dumbbells");
    expect(equipmentLine(["dumbbell", "barbell"])).toBe("Barbells, Dumbbells");
    expect(equipmentLine(["barbell", "dumbbell", "machine", "bodyweight", "kettlebell"])).toBe(
      "Barbells, Dumbbells +3"
    );
  });

  it("counts days a week, and adds when if she said", () => {
    expect(scheduleLine([1, 3, 5])).toBe("3 days a week");
    expect(scheduleLine([2], [])).toBe("1 day a week");
    expect(scheduleLine([1, 3, 5], ["evening", "lunch"])).toBe("3 days a week · Evening, Lunchtime");
  });

  it("describes a day by its name and its lifts", () => {
    expect(dayLine({ label: "Full body A", exercises: ["a", "b", "c", "d", "e"].map(lift) })).toBe(
      "Full body A · 5 lifts"
    );
    expect(dayLine({ label: "Leg day", exercises: [] })).toBe("Leg day · nothing on it yet");
  });

  it("labels every level, and only these three", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(["new", "returning", "experienced"]);
    expect(levelLabel("returning")).toBe("Coming back");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/profile-summary.test.ts`
Expected: FAIL, cannot find module `./profile-summary`.

- [ ] **Step 3: Write the module**

`lib/profile-summary.ts`:

```ts
import { count } from "./plural";
import type { Anchor } from "./schedule";
import type { Equipment, Level, Routine, WeighIn } from "./types";

/**
 * What each Profile row says while it is closed.
 *
 * Profile used to lay every setting out in full, which made it 3,241px on a
 * real history: Rest was three screens down. Now each setting is one row with
 * its current value, and these are those values. They live here, not in the
 * component, so they are tested and so the labels are written once.
 */

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "new", label: "New to this", hint: "Fewer sets, lighter starts, full body days." },
  { id: "returning", label: "Coming back", hint: "You have lifted before and stopped." },
  { id: "experienced", label: "Experienced", hint: "More sets, and the app assumes less." },
];

/** In the order the chips are drawn, which is also the order the line names them. */
export const EQUIPMENT_LABELS: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Barbells" },
  { id: "dumbbell", label: "Dumbbells" },
  { id: "machine", label: "Machines" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "bodyweight", label: "Bodyweight" },
];

export const ANCHOR_LABELS: Record<Anchor, string> = {
  wake: "First thing",
  lunch: "Lunchtime",
  afterwork: "After work",
  evening: "Evening",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function levelLabel(level: Level): string {
  return LEVELS.find((l) => l.id === level)?.label ?? LEVELS[0].label;
}

/**
 * "165.5 lb · Sep 20", or null with no weigh-ins, so the row can say Add.
 * The date is built by hand rather than with the locale, so it reads the same
 * in a test as on her phone.
 */
export function weighInLine(weighIns: WeighIn[]): string | null {
  const latest = weighIns[weighIns.length - 1];
  if (!latest) return null;
  const [, month, day] = latest.date.split("-").map(Number);
  return `${latest.lb} lb · ${MONTHS[month - 1]} ${day}`;
}

/** Two names and a count, so the row stays one line whatever her gym has. */
export function equipmentLine(kit: Equipment[]): string {
  const names = EQUIPMENT_LABELS.filter((e) => kit.includes(e.id)).map((e) => e.label);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function scheduleLine(trainingDays: number[], anchors?: Anchor[]): string {
  const days = `${count(new Set(trainingDays).size, "day")} a week`;
  if (!anchors?.length) return days;
  return `${days} · ${anchors.map((a) => ANCHOR_LABELS[a]).join(", ")}`;
}

/** A day type can arrive blank, and the row should say so rather than "0 lifts". */
export function dayLine(routine: Pick<Routine, "label" | "exercises">): string {
  if (routine.exercises.length === 0) return `${routine.label} · nothing on it yet`;
  return `${routine.label} · ${count(routine.exercises.length, "lift")}`;
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run lib/profile-summary.test.ts && npx tsc --noEmit`
Expected: 5 passed, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/profile-summary.ts lib/profile-summary.test.ts
git commit -m "feat: what each Profile setting says in one line

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 4: The row pieces

**Files:**
- Create: `components/ProfileRows.tsx`

- [ ] **Step 1: Write the components**

`components/ProfileRows.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

/**
 * Profile as rows: a label, its value, and a way in.
 *
 * Three kinds, because there are three things a row can do. One opens its
 * controls in place (`ExpandRow`, which says so with aria-expanded). One goes
 * to another screen that already does the job, the week editor or week setup
 * (`LinkRow`, which does not claim to expand). One is a switch, where the
 * value and the control are the same thing (`SwitchRow`).
 *
 * Every row is at least 56px tall, over the 44px minimum, because these are
 * the targets on a screen people visit rarely and should not have to aim at.
 */

const ROW = "flex min-h-14 w-full items-center justify-between gap-3 px-[18px] py-3 text-left";
const DIVIDED = "border-t border-line first:border-t-0";

export function RowGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <p className="label text-dim">{title}</p>
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-card">{children}</div>
    </section>
  );
}

function Value({ value, turned }: { value: string; turned?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-body text-dim">
      <span className="truncate">{value}</span>
      <span
        aria-hidden
        className={`text-head leading-none text-cyan transition-transform duration-quick ${turned ? "rotate-90" : ""}`}
      >
        ›
      </span>
    </span>
  );
}

export function ExpandRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={DIVIDED}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${ROW} transition-colors hover:bg-raise/40`}
      >
        <span className="shrink-0 text-emphasis text-fg">{label}</span>
        <Value value={value} turned={open} />
      </button>
      {open && <div className="px-[18px] pb-[18px]">{children}</div>}
    </div>
  );
}

export function LinkRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <div className={DIVIDED}>
      <button type="button" onClick={onClick} className={`${ROW} transition-colors hover:bg-raise/40`}>
        <span className="shrink-0 text-emphasis text-fg">{label}</span>
        <Value value={value} />
      </button>
    </div>
  );
}

export function SwitchRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={DIVIDED}>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={ROW}>
        <span className="min-w-0">
          <span className="block text-emphasis text-fg">{label}</span>
          {hint && <span className="mt-0.5 block text-caption leading-snug text-dim">{hint}</span>}
        </span>
        <span
          aria-hidden
          className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-quick ${on ? "bg-cyan" : "bg-raise"}`}
        >
          <span
            className={`absolute top-[3px] h-6 w-6 rounded-full bg-ground transition-[left] duration-quick ${on ? "left-[25px]" : "left-[3px]"}`}
          />
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ProfileRows.tsx
git commit -m "feat: rows that show a setting's value and open, go, or switch

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Let Body weight and Your data sit inside a row

**Files:**
- Modify: `components/BodyWeight.tsx` (props around line 22; heading around line 49)
- Modify: `components/YourData.tsx` (props line 22; section line 84)

- [ ] **Step 1: `BodyWeight` gets `bare`**

Change the signature to:

```tsx
export default function BodyWeight({
  weighIns,
  today,
  onSave,
  bare = false,
}: {
  weighIns: WeighIn[];
  /** ISO date, so "today" agrees with the rest of the app's local-date rule. */
  today: string;
  onSave: (lb: number) => void;
  /** Inside a Profile row, which already says "Body weight". */
  bare?: boolean;
}) {
```

Replace

```tsx
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-dim">Body weight</p>
```

with

```tsx
    <section className={bare ? "" : "mt-8"}>
      <div className="flex items-center justify-between gap-4">
        {!bare && <p className="label text-dim">Body weight</p>}
```

and add `ml-auto ` to the start of the Update/Add today button's `className`, so it stays on the right when the label is gone:

```tsx
            className="ml-auto head tap text-body text-cyan transition-opacity hover:opacity-70"
```

- [ ] **Step 2: `YourData` gets `bare`**

```tsx
export default function YourData({
  state,
  onImport,
  bare = false,
}: {
  state: AppState;
  onImport: (next: AppState) => void;
  /** Inside a Profile row, which already says "Your data" and is already a card. */
  bare?: boolean;
}) {
```

Replace

```tsx
    <section className="rounded-2xl bg-card p-[18px]">
      <p className="label text-dim">Your data</p>
      <p className="mt-2 text-body text-dim">
```

with

```tsx
    <section className={bare ? "" : "rounded-2xl bg-card p-[18px]"}>
      {!bare && <p className="label text-dim">Your data</p>}
      <p className={`${bare ? "" : "mt-2 "}text-body text-dim`}>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Every existing caller passes no `bare`, so nothing else moves.

- [ ] **Step 4: Commit**

```bash
git add components/BodyWeight.tsx components/YourData.tsx
git commit -m "refactor: body weight and your data can sit inside a row without a second heading

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 6: Profile as rows

**Files:**
- Modify (rewrite): `components/Profile.tsx`
- Delete: `components/WeightInputSettings.tsx`

- [ ] **Step 1: Replace `components/Profile.tsx` with this**

```tsx
"use client";

import { useState } from "react";
import BodyWeight from "./BodyWeight";
import PlaylistRow from "./PlaylistRow";
import YourData from "./YourData";
import Stepper from "./Stepper";
import { ExpandRow, LinkRow, RowGroup, SwitchRow } from "./ProfileRows";
import { Card, Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import { count } from "@/lib/plural";
import { offersPlates } from "@/lib/plates";
import { REST_MAX, REST_MIN, REST_STEP, restSeconds, SHORT_DAYS } from "@/lib/engine";
import {
  dayLine,
  equipmentLine,
  EQUIPMENT_LABELS,
  levelLabel,
  LEVELS,
  scheduleLine,
  weighInLine,
} from "@/lib/profile-summary";
import type { AppState, Profile as ProfileT } from "@/lib/types";

/** The rows that open in place. Links and the switch are not in here. */
export type ProfileRowId = "weight" | "saved" | "level" | "kit" | "rest" | "playlist" | "data";

/**
 * You, and the setup that is yours rather than today's.
 *
 * It used to lay every setting out in full, 3,241px on a real history, with
 * Rest three screens down and the whole week printed lift by lift a second
 * time. Now the name and the reason stay as they were, because they are who
 * she is, and everything under them is a row with its value showing. A row
 * opens the same controls and the same explanation it always had, one at a
 * time, so nothing about what a setting does is lost, only where it waits.
 */
export default function Profile({
  profile,
  state,
  today,
  onProfile,
  onWeighIn,
  onImport,
  onEditPlan,
  onEditWeek,
  initialOpen = null,
}: {
  profile: ProfileT;
  state: AppState;
  today: string;
  onProfile: (p: ProfileT) => void;
  onWeighIn: (lb: number) => void;
  onImport: (s: AppState) => void;
  onEditPlan: (day?: number) => void;
  onEditWeek: () => void;
  /** Which row starts open. Only /frames uses it, to show one open. */
  initialOpen?: ProfileRowId | null;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [editingWhy, setEditingWhy] = useState(false);
  const [why, setWhy] = useState(profile.motivation ?? "");
  const [openRow, setOpenRow] = useState<ProfileRowId | null>(initialOpen);
  const toggle = (id: ProfileRowId) => setOpenRow((o) => (o === id ? null : id));

  function saveName() {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean) onProfile({ ...profile, name: clean });
    else setName(profile.name);
    setEditingName(false);
  }
  function saveWhy() {
    onProfile({ ...profile, motivation: why.trim().slice(0, 120) || undefined });
    setEditingWhy(false);
  }

  const routines = [...state.routines].sort((a, b) => a.day - b.day);
  const kit = [...new Set(profile.equipment)];
  const saved = state.workouts ?? [];

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pb-10 pt-12">
      <p className="label text-cyan">Profile</p>

      {/* Name: the one identifying thing, editable in place. */}
      {editingName ? (
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="statement mt-2 w-full border-b-2 border-line-strong bg-transparent pb-1 text-figure text-fg focus:border-cyan focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setName(profile.name);
            setEditingName(true);
          }}
          className="mt-2 text-left"
        >
          <span className="statement text-figure text-fg">{profile.name}</span>
          <span className="head ml-3 align-middle text-caption text-cyan">Edit</span>
        </button>
      )}

      {/* Why: quoted back on the hard days; her words, never rewritten. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label text-dim">You workout because</p>
          {!editingWhy && (
            <button
              type="button"
              onClick={() => {
                setWhy(profile.motivation ?? "");
                setEditingWhy(true);
              }}
              className="head tap text-caption text-cyan transition-opacity hover:opacity-70"
            >
              {profile.motivation ? "Change" : "Add"}
            </button>
          )}
        </div>
        {editingWhy ? (
          <div className="mt-2.5">
            <textarea
              value={why}
              autoFocus
              rows={2}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="It clears my head."
              className="w-full resize-none rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            <div className="mt-2.5 flex gap-2">
              <Pill size="sm" onClick={saveWhy} className="h-12 flex-1">
                Save
              </Pill>
              <button
                type="button"
                onClick={() => setEditingWhy(false)}
                className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="statement mt-1.5 text-title text-fg">
            {profile.motivation ? `“${profile.motivation}”` : "Not said yet"}
          </p>
        )}
      </section>

      <RowGroup title="You">
        <ExpandRow
          label="Body weight"
          value={weighInLine(state.weighIns ?? []) ?? "Add"}
          open={openRow === "weight"}
          onToggle={() => toggle("weight")}
        >
          <BodyWeight bare weighIns={state.weighIns ?? []} today={today} onSave={onWeighIn} />
        </ExpandRow>
      </RowGroup>

      {/*
        The week, one row a day. Each goes straight to that day in the editor,
        which is where its lifts are, so they are not printed here a second
        time. A trained day with no routine yet is possible (the schedule is
        saved before the plan is built on first run), which is why there is a
        "Set up your week" row rather than an empty group.
      */}
      <RowGroup title="Your plan">
        {routines.length === 0 ? (
          <LinkRow label="Set up your week" value="" onClick={onEditWeek} />
        ) : (
          <>
            {routines.map((r) => (
              <LinkRow
                key={`${r.day}-${r.label}`}
                label={SHORT_DAYS[r.day]}
                value={dayLine(r)}
                onClick={() => onEditPlan(r.day)}
              />
            ))}
            {saved.length > 0 && (
              <ExpandRow
                label="Saved workouts"
                value={String(saved.length)}
                open={openRow === "saved"}
                onToggle={() => toggle("saved")}
              >
                <div className="flex flex-col gap-2.5">
                  {saved.map((w) => {
                    const on = routines.filter((r) => r.label === w.name).map((r) => SHORT_DAYS[r.day]);
                    return (
                      <Card key={w.id} className="bg-raise/40 p-3.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <h2 className="head text-emphasis text-fg">{w.name}</h2>
                          <span className="label shrink-0 text-dim">{count(w.exercises.length, "lift")}</span>
                        </div>
                        <p className="mt-1.5 text-body leading-snug text-dim">
                          {w.exercises.map((e) => nameOf(e.exerciseId)).join(", ")}
                        </p>
                        {on.length > 0 && <p className="mt-1.5 text-body text-cyan">On {on.join(", ")}</p>}
                      </Card>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onEditPlan()}
                  className="head tap mt-3 text-body text-cyan transition-opacity hover:opacity-70"
                >
                  Put one on a day
                </button>
              </ExpandRow>
            )}
            <LinkRow
              label="Schedule"
              value={scheduleLine(profile.trainingDays, profile.anchors)}
              onClick={onEditWeek}
            />
          </>
        )}
      </RowGroup>

      {/*
        Experience and equipment were set for her at signup and then frozen:
        onboarding never asks, and this screen drew them as text. Changing
        either changes what the app chooses next, never the week she has,
        because a setting that quietly rebuilds her days is the plan changing
        itself, which this app does not do.
      */}
      <RowGroup title="In the gym">
        <ExpandRow
          label="Experience"
          value={levelLabel(profile.level)}
          open={openRow === "level"}
          onToggle={() => toggle("level")}
        >
          <div className="flex flex-col gap-2">
            {LEVELS.map(({ id, label, hint }) => {
              const on = profile.level === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onProfile({ ...profile, level: id })}
                  className={`rounded-xl border p-3.5 text-left transition-colors duration-quick ${
                    on ? "border-cyan bg-raise" : "border-transparent bg-raise/40 hover:bg-raise/70"
                  }`}
                >
                  <span className="head block text-emphasis text-fg">{label}</span>
                  <span className="block text-body text-dim">{hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body text-dim">
            Your weights come from what you have actually lifted, so changing this moves the
            shape of a new day rather than the numbers on it.
          </p>
        </ExpandRow>

        <ExpandRow
          label="Equipment"
          value={equipmentLine(kit)}
          open={openRow === "kit"}
          onToggle={() => toggle("kit")}
        >
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_LABELS.map(({ id, label }) => {
              const on = kit.includes(id);
              /*
                The last one cannot be turned off. An empty gym leaves the
                generator nothing to pick from, and a screen that lets you
                arrive at a plan it cannot build is a screen that breaks later
                and somewhere else.
              */
              const last = on && kit.length === 1;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  disabled={last}
                  onClick={() =>
                    onProfile({
                      ...profile,
                      equipment: on ? kit.filter((k) => k !== id) : [...kit, id],
                    })
                  }
                  className={`head h-11 rounded-full border px-4 text-body transition-colors duration-quick disabled:opacity-60 ${
                    on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-body text-dim">
            What the gym you actually go to has. New lifts and swaps come from this; the days
            you have already built keep whatever is on them.
          </p>
        </ExpandRow>

        {/*
          A switch, not a pick between two. The question was never which way
          she enters a weight; it is whether plates are offered at all. Off,
          barbell sets show + and minus and nothing else. On, the switch sits
          above the set as it always has. Turning it on starts her on plates,
          since she has just asked for them.
        */}
        <SwitchRow
          label="Load the bar on barbell lifts"
          hint="Tap plates onto the bar instead of typing the total."
          on={offersPlates(profile) === true}
          onChange={(on) =>
            onProfile(on ? { ...profile, loadTheBar: true, weightInput: "plates" } : { ...profile, loadTheBar: false })
          }
        />

        <ExpandRow
          label="Rest between sets"
          value={`${restSeconds(profile)} sec`}
          open={openRow === "rest"}
          onToggle={() => toggle("rest")}
        >
          <Stepper
            label="Rest"
            value={restSeconds(profile)}
            step={REST_STEP}
            min={REST_MIN}
            max={REST_MAX}
            suffix="sec"
            onChange={(sec) => onProfile({ ...profile, restSec: sec })}
          />
          <p className="mt-3 text-body text-dim">
            The same on every lift. Take longer when you need it; nothing here counts it against you.
          </p>
        </ExpandRow>
      </RowGroup>

      <RowGroup title="App">
        <ExpandRow
          label="Gym playlist"
          value={profile.playlistName ?? "Not set"}
          open={openRow === "playlist"}
          onToggle={() => toggle("playlist")}
        >
          <PlaylistRow profile={profile} onProfile={onProfile} />
        </ExpandRow>
        <ExpandRow
          label="Your data"
          value="Export, import"
          open={openRow === "data"}
          onToggle={() => toggle("data")}
        >
          <YourData bare state={state} onImport={onImport} />
        </ExpandRow>
      </RowGroup>
    </main>
  );
}
```

Note two copy changes, both to drop a character the old screen used: the empty reason reads "Not said yet" instead of a dash, and the rest note's em dash becomes a semicolon. Everything else is the old copy moved.

- [ ] **Step 2: Delete the old setting**

```bash
git rm components/WeightInputSettings.tsx
grep -rn "WeightInputSettings" app components lib || echo "no references left"
```

Expected: `no references left`.

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/Profile.tsx
git commit -m "feat: Profile is rows with their values, so Rest is not three screens down

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 7: Profile frames, and measure it

**Files:**
- Modify: `app/frames/page.tsx` (the `n="08b"` frame, around line 515)
- Modify: `scripts/shoot.mjs`

- [ ] **Step 1: Update 08b's note and add 08c**

Replace the `note` on `<Frame n="08b" name="Profile" ...>` with:

```tsx
note="You, and the setup that is yours rather than today's. The name and the reason stay as they were; everything under them is a row with its value showing, so the screen is about one page and Rest is not three screens down."
```

Directly after that frame's closing `</Frame>`, add:

```tsx
            <Frame n="08c" name="Profile · a row open" tab="profile" note="A row opens the same controls and the same explanation it always had, and closes whichever was open. Nothing about what a setting does is lost, only where it waits.">
              <ProfileScreen
                profile={f.profile}
                state={f.state}
                today={f.today}
                onProfile={f.noop}
                onWeighIn={f.noop}
                onImport={f.noop}
                onEditPlan={f.noop}
                onEditWeek={f.noop}
                initialOpen="kit"
              />
            </Frame>
```

- [ ] **Step 2: Point the shot list at it**

In `scripts/shoot.mjs`, replace

```js
  ["08b", "08c-profile-you", 1790],
```

with

```js
  ["08c", "08c-profile-row-open"],
```

The old `08c-profile-you.png` was a scroll of the long page; leave the file where it is, since docs may link it.

- [ ] **Step 3: Build, measure, shoot**

```bash
npx next build && (lsof -tiTCP:3111 -sTCP:LISTEN | xargs kill 2>/dev/null; npx next start -p 3111 > /tmp/next-3111.log 2>&1 &) && until curl -sf -o /dev/null http://localhost:3111/frames; do /bin/sleep 1; done
agent-browser --session plan open "http://localhost:3111/frames?shot=08b" >/dev/null && agent-browser --session plan set viewport 390 844 >/dev/null
agent-browser --session plan eval "document.querySelector('main').scrollHeight"
node scripts/shoot.mjs --only 08b,08c --port 3111
```

Expected: the height is well under Task 0's `08b` number and close to one screen and a third (about 1,110px on the seeded history). Look at both stills: 08b shows four groups of rows with values; 08c shows Equipment open with its chips and note.

- [ ] **Step 4: Check the switch and one row by hand**

```bash
agent-browser --session plan eval "(() => { const sw = document.querySelector('[role=switch]'); const before = sw.getAttribute('aria-checked'); return before; })()"
```

Expected: `"false"` (the fixture profile has no `loadTheBar` and no `weightInput`). The frame's `onProfile` is a no-op, so the switch will not move here; Task 15 checks it in the real app.

- [ ] **Step 5: Commit**

```bash
git add app/frames/page.tsx scripts/shoot.mjs
git commit -m "chore(frames): Profile as rows, closed and with one open

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Part C: Edit your week

### Task 8: Short names for the chips

**Files:**
- Modify: `lib/templates.ts` (the `DayTemplate` interface and each entry of `TEMPLATES`)
- Test: `lib/templates.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe("templates", ...)` block in `lib/templates.test.ts`:

```ts
  it("gives every day type a short name for its chip, never longer than its label", () => {
    expect(TEMPLATES.map((t) => t.short)).toEqual(["Full body", "Push", "Pull", "Legs", "Upper", "Lower", "Cardio"]);
    for (const t of TEMPLATES) expect(t.short.length).toBeLessThanOrEqual(t.label.length);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/templates.test.ts`
Expected: FAIL, the mapped array is all `undefined`.

- [ ] **Step 3: Add the field**

In `interface DayTemplate`, after `label: string;`:

```ts
  /**
   * What the chip in the week editor says. Seven full names wrapped into four
   * rows of chips; these wrap into two. Everywhere else, the Calendar
   * included, still says `label`, so a day is "Leg day" and not "Legs".
   */
  short: string;
```

Then add `short` to each entry, directly after its `label` line:

```ts
    label: "Full body",
    short: "Full body",
```
```ts
    label: "Push day",
    short: "Push",
```
```ts
    label: "Pull day",
    short: "Pull",
```
```ts
    label: "Leg day",
    short: "Legs",
```
```ts
    label: "Upper body",
    short: "Upper",
```
```ts
    label: "Lower body",
    short: "Lower",
```
```ts
    label: "Cardio",
    short: "Cardio",
```

- [ ] **Step 4: Run it**

Run: `npx vitest run lib/templates.test.ts && npx tsc --noEmit`
Expected: pass, no type errors (`DayTemplate` is only built in this file).

- [ ] **Step 5: Commit**

```bash
git add lib/templates.ts lib/templates.test.ts
git commit -m "feat: day types have short names for chips, and keep their full names everywhere else

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 9: Chips and the describe link

**Files:**
- Modify: `components/RoutineEditor.tsx` (props around line 55; state around line 122; the "What kind of day" section, lines 678 to 772)

- [ ] **Step 1: Add the prop and state**

In the destructured props add `initialDescribing = false,` after `initialAdding = null,`, and in the props type add after `initialAdding?: Muscle | null;`:

```tsx
  /** Opens with the describe-your-week field showing. Only /frames uses it. */
  initialDescribing?: boolean;
```

After `const [weekOffline, setWeekOffline] = useState(false);` add:

```tsx
  /*
    "Or describe your week" is for the person who does not know what a split
    is, and it used to sit open under the list for everybody. It is a link
    now; it stays open while it has something to say back.
  */
  const [describing, setDescribing] = useState(initialDescribing);
```

- [ ] **Step 2: Replace the "What kind of day" section**

Replace everything from `<section className="mt-4 rounded-2xl bg-card p-[18px]">` (the one that opens with `<p className="label text-dim">What kind of day</p>`) through its closing `</section>` with:

```tsx
      {/*
        The seven shapes used to be tall cards with a sentence each, 802px of
        list before a single lift. As chips they take two rows, and only the
        chosen one says what it is, which is the sentence that matters.
      */}
      <section className="mt-4 rounded-2xl bg-card p-[18px]">
        <p className="label text-dim">What kind of day</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ownWorkouts && (
            <button
              type="button"
              onClick={() => {
                closeAdd();
                setPane("workouts");
                setRemoving(null);
              }}
              className="head h-11 rounded-full border border-line-strong px-4 text-body text-fg transition-colors duration-quick hover:border-fg"
            >
              {ownWorkouts.label}
            </button>
          )}
          {TEMPLATES.map((t) => {
            const on = (routine.template ?? "full-body") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                aria-pressed={on}
                aria-label={t.label}
                className={`head h-11 rounded-full border px-4 text-body transition-colors duration-quick ${
                  on ? "border-cyan bg-cyan text-ground" : "border-line-strong text-dim hover:border-fg hover:text-fg"
                }`}
              >
                {t.short}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-body leading-snug text-dim">
          {templateOf(routine.template ?? "full-body").hint}
          {templateOf(routine.template ?? "full-body").recommended && (
            <span className="label ml-2 text-cyan">Recommended</span>
          )}
        </p>

        {describing || weekWhy || weekOffline ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="label text-dim">Or describe your week</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void buildWeek();
              }}
              className="mt-2.5 flex items-center gap-2.5"
            >
              <input
                value={weekAsk}
                onChange={(e) => setWeekAsk(e.target.value)}
                maxLength={200}
                autoFocus={describing && !initialDescribing}
                placeholder="I want to focus on legs, and one easy day"
                aria-label="Describe the week you want"
                className="min-w-0 flex-1 rounded-full bg-raise px-[18px] py-3 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
              />
              <button
                type="submit"
                disabled={!weekAsk.trim() || weekBusy}
                className="head grid h-11 shrink-0 place-items-center rounded-full bg-cyan px-5 text-body text-ground transition-opacity disabled:opacity-30"
              >
                {weekBusy ? "…" : "Build"}
              </button>
            </form>
            {weekWhy && (
              <p role="status" className="mt-2.5 text-body leading-snug text-dim">
                {weekWhy} Change any day above.
              </p>
            )}
            {weekOffline && (
              <p role="status" className="mt-2.5 text-body leading-snug text-dim">
                No signal, so this one cannot answer. Pick the day types above and you
                get the same week without it.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDescribing(true)}
            className="head tap mt-3 text-body text-cyan transition-opacity hover:opacity-70"
          >
            Or describe your week
          </button>
        )}

        {/*
          One honest line, not a block. Three days of push/pull/legs trains each
          group once a week, and ACSM's whole point is that twice is what counts.
          She should know that and then decide for herself.
        */}
        {!thorough && (
          <p className="mt-3 text-body text-dim">
            This week trains some muscles once. Twice a week is what makes the difference —
            full body, or run these days again.
          </p>
        )}
      </section>
```

The "trains some muscles once" sentence and the offline sentence are the existing copy, unchanged.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/RoutineEditor.tsx
git commit -m "feat: day types are chips in the week editor, and describing the week is a link

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 10: Add a lift as one row, and Save pinned

**Files:**
- Modify: `components/RoutineEditor.tsx` (state; the day buttons around line 649; the Add a lift card around line 1087; the Save block around line 1133)

- [ ] **Step 1: State**

After the `describing` state from Task 9 add:

```tsx
  /*
    The nine muscle chips were open under every day, between the last lift and
    Save. They are one row now, and open when she wants to add something.
  */
  const [showMuscles, setShowMuscles] = useState(false);
```

In the day buttons' `onClick` (the block that calls `setDayIndex(i)`), add `setShowMuscles(false);` after `setRemoving(null);`.

- [ ] **Step 2: The Add a lift card**

Replace

```tsx
        <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
          <p className="label text-dim">Add a lift</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => (setHunt(""), setAdding(m.id))}
                className="head rounded-full border border-line-strong px-4 py-2.5 text-body text-dim transition-colors hover:border-fg hover:text-fg"
              >
                {m.label}
              </button>
            ))}
          </div>
```

with

```tsx
        <div className="mt-2.5 rounded-2xl bg-card p-[18px]">
          {showMuscles ? (
            <>
              <p className="label text-dim">Add a lift</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MUSCLES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => (setHunt(""), setAdding(m.id))}
                    className="head rounded-full border border-line-strong px-4 py-2.5 text-body text-dim transition-colors hover:border-fg hover:text-fg"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowMuscles(true)}
              className="head flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-line-strong text-body text-cyan transition-colors hover:border-fg"
            >
              + Add a lift
            </button>
          )}
```

Leave everything after it in that card ("Because of what you starred", the full-body note) as it is.

- [ ] **Step 3: Pin Save**

Replace

```tsx
      <div className="mt-auto pt-8">
        <Pill onClick={() => onSave(draft)}>Save the week</Pill>
      </div>
    </main>
  );
}
```

(the last one in the file's main pane, around line 1133) with

```tsx
      {/*
        Pinned, over a fade into the ground, so saving is never a scroll to the
        bottom. The pane's own bottom padding keeps the last lift clear of it.
      */}
      <div className="sticky bottom-0 -mx-6 mt-auto bg-gradient-to-t from-ground from-60% to-transparent px-6 pb-6 pt-8">
        <Pill onClick={() => onSave(draft)}>Save the week</Pill>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors; all pass.

- [ ] **Step 5: Commit**

```bash
git add components/RoutineEditor.tsx
git commit -m "feat: adding a lift is one row until wanted, and Save the week stays on screen

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 11: Editor frames, and measure it

**Files:**
- Modify: `app/frames/page.tsx` (the `n="14c"` frame, around line 603)

- [ ] **Step 1: 14c opens with the describe field showing**

In `<Frame n="14c" ...>`, add `initialDescribing` to its `<RoutineEditor`:

```tsx
              <RoutineEditor
                initialDescribing
                profile={f.profile}
                routines={f.routines}
                onSave={f.noop}
                onBack={f.noop}
              />
```

- [ ] **Step 2: Build, measure, shoot**

```bash
npx next build && (lsof -tiTCP:3111 -sTCP:LISTEN | xargs kill 2>/dev/null; npx next start -p 3111 > /tmp/next-3111.log 2>&1 &) && until curl -sf -o /dev/null http://localhost:3111/frames; do /bin/sleep 1; done
agent-browser --session plan open "http://localhost:3111/frames?shot=14" >/dev/null && agent-browser --session plan set viewport 390 844 >/dev/null
agent-browser --session plan eval "(() => { const m = document.querySelector('main'); const lift = [...m.querySelectorAll('li button')][0]; return JSON.stringify({ height: m.scrollHeight, firstLiftTop: lift && Math.round(lift.getBoundingClientRect().top - m.getBoundingClientRect().top) }); })()"
node scripts/shoot.mjs --only 14,14c,14d --port 3111
```

Expected: `height` well under 1,988 (spec target about 1,310); `firstLiftTop` under 844, so a lift is on the first screen. In `14-routine-editor.png`, Full body is the filled chip with its sentence and "Recommended" under the chips, "+ Add a lift" is one dashed row, and "Save the week" sits at the bottom of the screen. In `14c-build-the-week.png` the describe field is open.

- [ ] **Step 3: Check Save stays pinned**

```bash
agent-browser --session plan eval "(async () => { const m = document.querySelector('main'); const save = [...m.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save the week'); const a = Math.round(save.getBoundingClientRect().bottom); m.scrollTop = 0; (m.closest('[class*=overflow]') || document.scrollingElement).scrollTop = 0; await new Promise(r => setTimeout(r, 100)); return JSON.stringify({ bottomAtTop: Math.round(save.getBoundingClientRect().bottom), before: a }); })()"
```

Expected: `bottomAtTop` is within the 844px screen (under 844), so Save shows without scrolling.

- [ ] **Step 4: Commit**

```bash
git add app/frames/page.tsx
git commit -m "chore(frames): the week editor with chips, and the describe field open in 14c

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Part D: Today, and the plan first in the list

### Task 12: `readConstraints`, out of Today

**Files:**
- Create: `lib/adjust.ts`
- Test: `lib/adjust.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/adjust.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adjustedLine, readConstraints } from "./adjust";
import type { Constraints } from "./constraints";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe("reading what is different today", () => {
  it("uses the model's answer, and says it was not offline", async () => {
    const out = await readConstraints("only dumbbells", reply({ equipment: ["dumbbell"], avoid: [], source: "ai" }));
    expect(out.offline).toBe(false);
    expect(out.constraints.equipment).toEqual(["dumbbell"]);
  });

  it("is honest when the server fell back on its own", async () => {
    const out = await readConstraints("only dumbbells", reply({ equipment: ["dumbbell"], avoid: [], source: "local" }));
    expect(out.offline).toBe(true);
  });

  it("parses locally when the call fails", async () => {
    const out = await readConstraints("only dumbbells today", reply({}, false));
    expect(out.offline).toBe(true);
    expect(out.constraints.source).toBe("local");
    expect(out.constraints.equipment).toContain("dumbbell");
  });

  it("parses locally with no network at all", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const out = await readConstraints("only dumbbells today", down);
    expect(out.offline).toBe(true);
    expect(out.constraints.equipment).toContain("dumbbell");
  });

  it("adds the offline sentence only when it was offline", () => {
    const c: Constraints = { equipment: ["dumbbell"], avoid: [], source: "local" };
    expect(adjustedLine(c, false)).toBe("Rebuilt using dumbbell.");
    expect(adjustedLine(c, true)).toMatch(/^Rebuilt using dumbbell\. Worked that out offline/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/adjust.test.ts`
Expected: FAIL, cannot find module `./adjust`.

- [ ] **Step 3: Write the module**

`lib/adjust.ts`:

```ts
import { describe, parseLocally, type Constraints } from "./constraints";

/**
 * Turning "only dumbbells today, my shoulder is tweaked" into constraints.
 *
 * This lived inside Today. The list now asks the same question from the plan
 * card ("Adjust it for today"), so the call, the local fallback and the
 * honesty about which one answered live here, once. `post` is a parameter so
 * the tests can stand in for the network.
 */
export async function readConstraints(
  text: string,
  post: typeof fetch = fetch
): Promise<{ constraints: Constraints; offline: boolean }> {
  try {
    const res = await post("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const constraints = (await res.json()) as Constraints;
    return { constraints, offline: constraints.source === "local" };
  } catch {
    // Hard requirement: the app works with the AI layer completely dead.
    return { constraints: parseLocally(text), offline: true };
  }
}

/** What Today says back after a rebuild, the same words wherever it was asked. */
export function adjustedLine(c: Constraints, offline: boolean): string {
  return offline
    ? `${describe(c)} Worked that out offline — the smart parser was unreachable.`
    : describe(c);
}
```

The offline sentence is Today's existing copy, moved word for word.

- [ ] **Step 4: Run it**

Run: `npx vitest run lib/adjust.test.ts && npx tsc --noEmit`
Expected: 5 passed, no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/adjust.ts lib/adjust.test.ts
git commit -m "refactor: reading what is different today lives in one place

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 13: Today with one button and a Change

**Files:**
- Modify: `components/Today.tsx`

- [ ] **Step 1: Imports and props**

Replace

```tsx
import { describe, parseLocally, type Constraints } from "@/lib/constraints";
```

with

```tsx
import type { Constraints } from "@/lib/constraints";
import { adjustedLine, readConstraints } from "@/lib/adjust";
```

Add `adjusted,` to the destructured props after `crewPreview,`, and in the props type after `crewPreview?: CrewDay;`:

```tsx
  /**
   * What a rebuild asked for from the list understood. The list hands it to
   * the page, the page comes back here, and this is where she reads it.
   */
  adjusted?: string;
```

Replace the doc comment on `onPickWorkout?: () => void;` with:

```tsx
  /**
   * Choose what to train instead of the plan, or on a day without one. On a
   * rest day it is "Train anyway". On a day with a plan it is the Change
   * beside the date line, which opens the same list with the plan first in
   * it. Optional for the same reason `onQuick` is.
   */
```

- [ ] **Step 2: The sentence flow uses `readConstraints`**

Delete `const [offline, setOffline] = useState(false);` and replace the whole `async function submitNote() { ... }` with:

```tsx
  async function submitNote() {
    const text = note.trim();
    if (!text) return;
    setAsking(true);
    const { constraints, offline } = await readConstraints(text);
    setUnderstood(adjustedLine(constraints, offline));
    onConstraints(constraints);
    setAsking(false);
    setNote("");
    setOpen(false);
  }
```

Replace the display block

```tsx
        {understood && (
          <p className="text-body text-dim">
            {understood}
            {offline && " Worked that out offline — the smart parser was unreachable."}
          </p>
        )}
```

with

```tsx
        {(understood || adjusted) && <p className="text-body text-dim">{understood || adjusted}</p>}
```

- [ ] **Step 3: When Change shows**

Directly after `const toBuild = Boolean(routine && routine.exercises.length === 0);` add:

```tsx
  /*
    A planned day nobody has started. Start is the one button, and the way to
    anything else (another workout, or this one adjusted) is the Change beside
    the date, which opens the list with the plan first. It used to be two
    doors under Start with nearly the same name and different jobs.
  */
  const changeable = Boolean(onPickWorkout && routine && !toBuild && !started && !alreadyLogged && !unchosen);
```

- [ ] **Step 4: The header line**

Replace

```tsx
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">
            {new Date(today + "T00:00:00")
              .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
              .toUpperCase()}
            {weeks > 0 && ` · Week ${weeks}`}
          </p>
        </div>
```

with

```tsx
        <div className="flex items-start justify-between gap-4">
          <p className="label text-cyan">
            {changeable
              ? "Planned for today"
              : new Date(today + "T00:00:00")
                  .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
                  .toUpperCase()}
            {weeks > 0 && ` · Week ${weeks}`}
          </p>
          {changeable && (
            <button
              type="button"
              onClick={onPickWorkout}
              className="head tap -mt-0.5 shrink-0 text-body text-cyan transition-opacity hover:opacity-70"
            >
              Change
            </button>
          )}
        </div>
```

- [ ] **Step 5: The two doors go**

Delete the comment that begins `On a day with a plan, the alternative to the plan is the picker` and the block under it:

```tsx
        {onPickWorkout && !started && !unchosen && routine && (
          <Pill variant="ghost" onClick={onPickWorkout}>
            Something else today
          </Pill>
        )}
```

Then change the condition that draws "Something's different today", from

```tsx
          !unchosen && (
```

to

```tsx
          !unchosen && !changeable && (
```

Leave the Quick workout condition `onQuick && !started && (!onPickWorkout || unchosen)` as it is: before there is a plan it stays.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors; all pass. (`describe` and `parseLocally` are no longer imported here; if the compiler reports either as missing, a use was missed in Step 2.)

- [ ] **Step 7: Commit**

```bash
git add components/Today.tsx
git commit -m "feat: a planned day has one button, and Change beside the date for anything else

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 14: The plan first in the list

**Files:**
- Modify: `components/PickWorkout.tsx`

- [ ] **Step 1: Imports, props, state**

Replace the first two lines

```tsx
"use client";

import { nameOf } from "@/lib/exercises";
```

with

```tsx
"use client";

import { useState } from "react";
import { adjustedLine, readConstraints } from "@/lib/adjust";
import type { Constraints } from "@/lib/constraints";
import { nameOf } from "@/lib/exercises";
```

Add `onStartPlanned,` and `onAdjust,` to the destructured props after `planned,`, and in the props type after the `planned?: ...` line:

```tsx
  /** Start the planned workout as planned, which is not a one-off. */
  onStartPlanned?: () => void;
  /**
   * Rebuild today's plan from a sentence. The list reads it and hands back
   * the constraints with the line Today will show; the page applies them.
   */
  onAdjust?: (c: Constraints, line: string) => void;
```

Replace the doc comment on `planned?:` with:

```tsx
  /**
   * What today is already planned as, on a training day.
   *
   * Not everybody's Monday is the same workout every week, so the list is
   * reachable with a plan on the day. The plan is the first card in it: it
   * used to be left out, because the button on Today starts it, and that made
   * changing your mind a Cancel instead of a tap.
   */
```

At the top of the function body, before `const isPlanned = ...`:

```tsx
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  async function submitAdjust() {
    const text = note.trim();
    if (!text || !onAdjust) return;
    setAsking(true);
    const { constraints, offline } = await readConstraints(text);
    setAsking(false);
    onAdjust(constraints, adjustedLine(constraints, offline));
  }
```

- [ ] **Step 2: The eyebrow names the day**

Replace

```tsx
          {planned ? `Today is ${planned.label}` : `${SHORT[today]} is a rest day`}
```

with

```tsx
          {planned ? SHORT[today] : `${SHORT[today]} is a rest day`}
```

- [ ] **Step 3: The planned card**

Directly after the subline paragraph (the `<p className="mt-2 text-body leading-snug text-dim">` that ends with the rest-day sentence) and before `{mine.length > 0 && (`, insert:

```tsx
      {planned && (
        <section className="mt-6">
          <div className="rounded-2xl border-[1.5px] border-action bg-card">
            <button
              type="button"
              onClick={onStartPlanned}
              aria-label={`Start ${planned.label}, planned for today: ${lifts(planned.exercises)}`}
              className="w-full p-[18px] text-left"
            >
              <span className="label inline-block rounded-full border border-action px-2 py-0.5 text-action">
                Planned for today
              </span>
              <span className="mt-2.5 flex items-baseline justify-between gap-3">
                <span className="head text-head text-fg">{planned.label}</span>
                <span className="tabular shrink-0 text-body text-cyan">
                  {planned.exercises.length} {planned.exercises.length === 1 ? "lift" : "lifts"}
                </span>
              </span>
              <span className="mt-1 block text-body leading-snug text-dim">{lifts(planned.exercises)}</span>
            </button>
            {onAdjust && (
              <div className="mx-[18px] border-t border-line pb-[18px] pt-3">
                {adjusting ? (
                  <>
                    <label htmlFor="adjust-note" className="label block text-dim">
                      What&apos;s different today?
                    </label>
                    <textarea
                      id="adjust-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="I'm working from home, no machines, only dumbbells"
                      className="mt-2.5 w-full resize-none rounded-xl bg-raise p-3.5 text-emphasis text-fg placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-cyan"
                    />
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void submitAdjust()}
                        disabled={asking || !note.trim()}
                        className="head h-12 flex-1 rounded-full border border-line-strong text-body text-cyan transition-opacity disabled:opacity-40"
                      >
                        {asking ? "Rebuilding…" : "Rebuild today"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjusting(false)}
                        className="head h-12 shrink-0 px-4 text-body text-dim transition-colors hover:text-fg"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdjusting(true)}
                    className="head tap text-body text-cyan transition-opacity hover:opacity-70"
                  >
                    Adjust it for today
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {planned && <p className="label mt-8 text-dim">Or switch to</p>}
```

"Rebuild today" is outlined here, not orange as it is on Today: on this screen the plan card's orange outline is the emphasis, and a second orange shape inside it would compete with it.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/PickWorkout.tsx
git commit -m "feat: the list opens with today's plan, so changing your mind is one tap

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 15: Wire it in the page, frames, and check the flows

**Files:**
- Modify: `app/page.tsx` (state near line 122; `startLogging` near line 322; the `pick` view near line 881; `Today` near line 903)
- Modify: `app/frames/page.tsx` (frames `01` and `05c`)

- [ ] **Step 1: The page**

After `const [arrival, setArrival] = useState<ArrivalMood | null>(null);` add:

```tsx
  /*
    What a rebuild from the list understood. Today used to hold this itself,
    but the sentence can now be asked from the list, and the line has to
    survive the trip back to Today to be read.
  */
  const [adjusted, setAdjusted] = useState("");
```

At the start of `startLogging`'s body, after `if (!profile) return;`, add:

```tsx
    setAdjusted("");
```

In the `view === "pick"` block, add two props to `<PickWorkout`:

```tsx
        onStartPlanned={startLogging}
        onAdjust={(c, line) => {
          applyConstraints(c);
          setAdjusted(line);
          setView("today");
        }}
```

On `<Today`, add `adjusted={adjusted}`, and replace the comment above `onPickWorkout={` with:

```tsx
      /*
        "Train anyway" on a rest day, and Change on a day with a plan. Only with
        something to choose from: with an empty week and nothing saved the list
        would be an empty screen between her and a workout.
      */
```

- [ ] **Step 2: Frames**

On frame `n="01"`'s `<Today`, add `onPickWorkout={f.noop}` after `onQuick={f.noop}`, and change its note to:

```tsx
note="“Full body A”, not “Monday”. A weekday is not a description of a workout. One button, and Change beside the date for anything else."
```

On frame `n="05c"`'s `<PickWorkout`, add after `planned={...}`:

```tsx
                onStartPlanned={f.noop}
                onAdjust={f.noop}
```

and change its note to:

```tsx
note="Change on Today opens this. The plan is the first card, outlined and tagged, so changing your mind is one tap rather than a Cancel, and adjusting it for a sore shoulder or a hotel gym happens on the card itself. Everything else is under Or switch to, and none of it moves the week."
```

- [ ] **Step 3: Tests, types, build, stills**

```bash
npx tsc --noEmit && npx vitest run && npx next build && (lsof -tiTCP:3111 -sTCP:LISTEN | xargs kill 2>/dev/null; npx next start -p 3111 > /tmp/next-3111.log 2>&1 &) && until curl -sf -o /dev/null http://localhost:3111/frames; do /bin/sleep 1; done && node scripts/shoot.mjs --only 01,05c --port 3111
```

Expected: all tests pass (706 at the start of this plan, plus the new ones); `01-today.png` shows "PLANNED FOR TODAY · WEEK n" with Change on the right, one orange Start, the music line, and neither "Something else today" nor "Something's different today"; `05c-training-day-pick.png` shows the orange-outlined plan card first with "Adjust it for today", then "OR SWITCH TO".

- [ ] **Step 4: Check the real flows on a seeded history**

Seed a real history (this writes `seed-healthy.json` into the folder you name):

```bash
mkdir -p /tmp/hb-seed && SEED_DIR=/tmp/hb-seed npx vitest run --config vitest.probe.mts > /dev/null 2>&1; ls /tmp/hb-seed/seed-healthy.json
```

Load it, go to a planned day's Today, and run the Change → adjust → back flow in one script (one script per flow, so a click and the look after it land on the same page):

```bash
SEED=$(node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/tmp/hb-seed/seed-healthy.json','utf8')))")
agent-browser --session flow open http://localhost:3111/ >/dev/null && agent-browser --session flow set viewport 390 844 >/dev/null
agent-browser --session flow eval "localStorage.clear(); localStorage.setItem('habitabull.v1', $SEED); 'seeded'"
agent-browser --session flow reload >/dev/null; /bin/sleep 2
agent-browser --session flow eval "(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.innerText.trim()));
  const log = [];
  if (btn(/^Tap to skip$/)) { btn(/^Tap to skip$/).click(); await wait(900); }
  log.push('change on Today: ' + Boolean(btn(/^Change$/)));
  log.push('old doors gone: ' + !btn(/^Something else today$/) + ' ' + !btn(/^Something.s different today$/));
  if (!btn(/^Change$/)) return log.join(' | ') + ' | today is not a planned day in this seed; pick a date that is';
  btn(/^Change$/).click(); await wait(700);
  log.push('plan card first: ' + /Planned for today/i.test(document.querySelector('main section')?.innerText || ''));
  btn(/^Adjust it for today$/).click(); await wait(300);
  const ta = document.querySelector('#adjust-note');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'only dumbbells today');
  ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
  btn(/^Rebuild today$/).click(); await wait(2500);
  log.push('back on Today with: ' + ([...document.querySelectorAll('main p')].map((p) => p.innerText).find((t) => /^Rebuilt|Nothing to change/.test(t)) || 'NO LINE'));
  return log.join(' | ');
})()"
```

Expected: `change on Today: true | old doors gone: true true | plan card first: true | back on Today with: Rebuilt using dumbbell.` (with the offline sentence after it if the generate route is unreachable, which on a local `next start` without the proxy key it will be). If the seed's today is a rest day, the script says so; Change only exists on a planned day. If it ends `NO LINE`, the generate call was still waiting on the network after 2.5s (it has no timeout, as before); run `agent-browser --session flow eval "[...document.querySelectorAll('main p')].map(p => p.innerText).find(t => /^Rebuilt|Nothing to change/.test(t))"` again after a few seconds.

Then check the plan card starts the plan as planned. Reload the seed (the step above adapted today), and:

```bash
agent-browser --session flow eval "localStorage.clear(); localStorage.setItem('habitabull.v1', $SEED); 'seeded'"
agent-browser --session flow reload >/dev/null; /bin/sleep 2
agent-browser --session flow eval "(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.innerText.trim()) || re.test(b.getAttribute('aria-label') || ''));
  if (btn(/^Tap to skip$/)) { btn(/^Tap to skip$/).click(); await wait(900); }
  btn(/^Change$/).click(); await wait(700);
  btn(/planned for today/i).click(); await wait(1200);
  const s = JSON.parse(localStorage.getItem('habitabull.v1')).sessions;
  const today = s[s.length - 1];
  return 'logging: ' + Boolean(btn(/^Log set$/)) + ' | adapted: ' + Boolean(today.adapted);
})()"
```

Expected: `logging: true | adapted: false`. The plan was started as the plan, not as a one-off.

Last, the Load the bar switch in the real app: go to Profile, flip it, and read it back.

```bash
agent-browser --session flow eval "(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.innerText.trim()));
  btn(/^Profile$/).click(); await wait(800);
  const sw = document.querySelector('[role=switch]');
  const before = sw.getAttribute('aria-checked'); sw.click(); await wait(300);
  const after = document.querySelector('[role=switch]').getAttribute('aria-checked');
  const p = JSON.parse(localStorage.getItem('habitabull.v1')).profile;
  return before + ' -> ' + after + ' | loadTheBar=' + p.loadTheBar + ' weightInput=' + p.weightInput;
})()"
agent-browser --session flow eval "localStorage.clear(); 'cleared'"; agent-browser --session flow close
```

Expected: `false -> true | loadTheBar=true weightInput=plates` (the seed has no `weightInput`, so it starts unasked, which reads as off).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/frames/page.tsx
git commit -m "feat: Change opens the list with the plan first, and an adjust there lands back on Today

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Finish

- [ ] **Step 1: Everything green**

```bash
npx tsc --noEmit && npx vitest run 2>&1 | tail -4
```

Expected: no type errors. Record the new test count: anything that quotes it (the deck's slide 38 and the portfolio's With AI page) needs the number, and it is not this plan's job to change them.

- [ ] **Step 2: Measured lengths, for the record**

Re-run the Task 0 measurement for `14` and `08b` and write both before/after pairs into the commit body of the next step. Quote these, not the spec's estimates.

- [ ] **Step 3: Stop the server and close the browser sessions**

```bash
lsof -tiTCP:3111 -sTCP:LISTEN | xargs kill 2>/dev/null; agent-browser --session plan close; agent-browser --session flow close 2>/dev/null; true
```

- [ ] **Step 4: Do not deploy from here**

Testers use habitabull.vercel.app. Ask Lucy whether a tester wave is running before `npx vercel --prod --yes`; during a wave, deploy a preview with `npx vercel` and promote deliberately.
