# Progression Rules and Second Device Crew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining UX retest gaps from `ux-tests/2026-09-20-habitabull-ux-retest.md`: progression rules over dated sessions, second-device crew rendering, and second-device crew feed/photo rendering.

**Architecture:** Add one pure Vitest scenario file for progression-over-time, then add one browser-driven two-device crew script that uses isolated `agent-browser --session` profiles against the local app. Keep API privacy checks in `scripts/smoke-crew.mjs`; use the browser script only for UI/rendering proof that the retest explicitly did not cover.

**Tech Stack:** Next.js 16, React 19, Vitest 4, Node 24, existing `agent-browser` CLI pattern from `scripts/shoot.mjs`, live Supabase backend through existing `/api/crew/[action]` routes.

**Spec:** `/Users/lucyliu/Desktop/Portfolio Documentation/habitabull redesign/ux-tests/2026-09-20-habitabull-ux-retest.md`

## Global Constraints

- The app has no account system; second device identity is localStorage device id.
- Crew privacy boundary: days trained and chosen shared photos may cross; weights, reps, sets, rankings, PRs, and private notes must not.
- Copying a crew workout copies lift selection only; recipient weights come from their own engine.
- Photo sharing must be explicit; B may see only A's chosen photo, caption, author, likes/replies, and trained-day presence.
- Progression rule: clear target reps -> add one weight increment next time.
- Progression rule: miss three consecutive sessions -> cut 10% and rebuild.
- Tests must clean up any live crew rows/photos they create.
- Do not introduce Playwright unless separately approved; this repo already uses `agent-browser` for visual/browser scripts.

---

## File Map

- Create: `lib/progression-flow.test.ts`
  - User-level pure tests for progression across dated sessions.
  - Keeps `lib/engine.test.ts` from growing further.
- Create: `scripts/ux-crew-two-devices.mjs`
  - Browser-driven second-device crew test using two isolated `agent-browser --session` profiles.
  - Seeds localStorage through browser JS, drives actual UI create/join/copy/photo feed, captures screenshots, cleans up via `/api/crew/leave`.
- Modify: `package.json`
  - Add `ux:crew-devices` script.
- Modify: `ux-tests/2026-09-20-habitabull-ux-retest.md`
  - After running the new checks, replace the relevant "Couldn't test" bullets with evidence.

---

### Task 1: Add Dated Progression Flow Tests

**Files:**
- Create: `lib/progression-flow.test.ts`

**Interfaces:**
- Consumes: `buildSession(routine, sessions, level, date)`, `nextTarget(exerciseId, sessions, level)`, `byId(exerciseId)`.
- Produces: Vitest coverage proving progression over a sequence of dated completed sessions.

- [ ] **Step 1: Create the failing progression flow test**

Create `lib/progression-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSession, nextTarget } from "./engine";
import { byId } from "./exercises";
import type { Routine, Session } from "./types";

const routine: Routine = {
  day: 1,
  label: "Full body A",
  template: "full-body",
  exercises: [{ exerciseId: "back-squat", sets: 3, reps: 8, weight: 45 }],
};

function completed(date: string, weight: number, reps: number): Session {
  return {
    date,
    label: "Full body A",
    startedAt: `${date}T18:00:00.000Z`,
    completedAt: `${date}T19:00:00.000Z`,
    exercises: [
      {
        exerciseId: "back-squat",
        sets: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
      },
    ],
  };
}

function draft(date: string, weight: number, reps: number): Session {
  return {
    date,
    label: "Full body A",
    startedAt: `${date}T18:00:00.000Z`,
    exercises: [
      {
        exerciseId: "back-squat",
        sets: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
      },
    ],
  };
}

describe("progression over dated sessions", () => {
  it("raises the next workout after every target rep is cleared", () => {
    const history = [completed("2026-09-07", 100, 8)];
    const target = nextTarget("back-squat", history, "new");
    const increment = byId("back-squat")!.increment;

    expect(target.weight).toBe(100 + increment);
    expect(target.reps).toBe(8);

    const next = buildSession(routine, history, "new", "2026-09-14");
    expect(next.exercises[0].sets.map((s) => s.weight)).toEqual([100 + increment, 100 + increment, 100 + increment]);
    expect(next.exercises[0].sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it("holds the load after one or two missed sessions", () => {
    const oneMiss = [completed("2026-09-07", 100, 7)];
    const twoMisses = [
      completed("2026-09-14", 100, 7),
      completed("2026-09-07", 100, 7),
    ];

    expect(nextTarget("back-squat", oneMiss, "new").weight).toBe(100);
    expect(nextTarget("back-squat", twoMisses, "new").weight).toBe(100);
    expect(buildSession(routine, twoMisses, "new", "2026-09-21").exercises[0].sets[0].weight).toBe(100);
  });

  it("cuts 10 percent after three consecutive misses", () => {
    const history = [
      completed("2026-09-21", 100, 7),
      completed("2026-09-14", 100, 7),
      completed("2026-09-07", 100, 7),
    ];

    const target = nextTarget("back-squat", history, "new");
    expect(target.weight).toBe(90);
    expect(target.reps).toBe(8);
    expect(target.note).toMatch(/Backing off 10%/);

    const next = buildSession(routine, history, "new", "2026-09-28");
    expect(next.exercises[0].sets.map((s) => s.weight)).toEqual([90, 90, 90]);
  });

  it("ignores an unfinished draft when deciding progression", () => {
    const history = [
      draft("2026-09-14", 200, 8),
      completed("2026-09-07", 100, 8),
    ];

    expect(nextTarget("back-squat", history, "new").weight).toBe(102.5);
    expect(buildSession(routine, history, "new", "2026-09-21").exercises[0].sets[0].weight).toBe(102.5);
  });
});
```

- [ ] **Step 2: Run the new test to verify current behavior**

Run:

```bash
npm test -- lib/progression-flow.test.ts
```

Expected: PASS if the rules are already correct. If any test fails, keep the failing test output and fix `lib/engine.ts` before continuing.

- [ ] **Step 3: Run the full engine suite**

Run:

```bash
npm test -- lib/engine.test.ts lib/progression-flow.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/progression-flow.test.ts
git commit -m "test: cover progression across dated sessions"
```

---

### Task 2: Add Second-Device Crew Browser Script

**Files:**
- Create: `scripts/ux-crew-two-devices.mjs`

**Interfaces:**
- Consumes: a running local app at `UX_BASE` or `http://localhost:3000`.
- Consumes: `agent-browser` CLI installed on PATH.
- Produces: screenshots and assertions for actual A/B browser rendering.

- [ ] **Step 1: Create the script**

Create `scripts/ux-crew-two-devices.mjs`:

```js
/**
 * Browser-level two-device crew UX check.
 *
 * Run:
 *   npm run dev
 *   node scripts/ux-crew-two-devices.mjs
 *
 * Requires agent-browser on PATH. Uses two isolated sessions so A and B have
 * different localStorage device ids. Cleans up through /api/crew/leave.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.UX_BASE ?? "http://localhost:3000";
const OUT = resolve("ux-tests/artifacts/2026-09-20-second-device-crew");
const A = "habitabull-crew-a";
const B = "habitabull-crew-b";

mkdirSync(OUT, { recursive: true });

function ab(session, args, opts = {}) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
    stdio: opts.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function oneLine(s) {
  return s.replace(/\s+/g, " ").trim();
}

function assert(name, ok, detail = "") {
  if (!ok) {
    console.error(`✗ ${name}`);
    if (detail) console.error(detail);
    process.exitCode = 1;
    throw new Error(name);
  }
  console.log(`✓ ${name}`);
}

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function seedState(name, completed) {
  const today = todayLocal();
  const now = new Date().toISOString();
  return `
    localStorage.clear();
    localStorage.setItem('habitabull.greeted', JSON.stringify({ date: '${today}', mood: 'greet' }));
    localStorage.setItem('habitabull.v1', JSON.stringify({
      profile: {
        name: ${JSON.stringify(name)},
        level: 'new',
        trainingDays: [new Date().getDay()],
        equipment: ['barbell','dumbbell','machine','bodyweight'],
        motivation: 'Testing the crew.',
        restSec: 90,
        createdAt: ${JSON.stringify(now)},
        planChosen: true
      },
      routines: [{
        day: new Date().getDay(),
        label: ${completed ? "'Full body A'" : "'Full body B'"},
        template: 'full-body',
        exercises: ${completed
          ? "[{ exerciseId: 'back-squat', sets: 3, reps: 8, weight: 45 }, { exerciseId: 'bench-press', sets: 3, reps: 8, weight: 45 }]"
          : "[{ exerciseId: 'deadlift', sets: 3, reps: 5, weight: 45 }, { exerciseId: 'plank', sets: 3, reps: 30, weight: 0 }]"}
      }],
      sessions: ${completed ? `[{
        date: '${today}',
        label: 'Full body A',
        startedAt: ${JSON.stringify(now)},
        completedAt: ${JSON.stringify(now)},
        note: 'Private note with 135 x 5',
        exercises: [
          { exerciseId: 'back-squat', sets: [{ weight: 135, reps: 5, done: true }] },
          { exerciseId: 'bench-press', sets: [{ weight: 95, reps: 8, done: true }] }
        ]
      }]` : "[]"},
      goal: null
    }));
  `;
}

function text(session) {
  return JSON.parse(ab(session, ["eval", "JSON.stringify(document.body.innerText)"]));
}

async function main() {
  for (const session of [A, B]) {
    ab(session, ["set", "viewport", "390", "844"]);
    ab(session, ["open", BASE]);
    ab(session, ["wait", "300"]);
  }

  ab(A, ["eval", seedState("Device A", true)]);
  ab(B, ["eval", seedState("Device B", false)]);
  ab(A, ["reload"]);
  ab(B, ["reload"]);
  ab(A, ["wait", "800"]);
  ab(B, ["wait", "800"]);

  ab(A, ["find", "text", "Crew", "click"]);
  ab(A, ["wait", "900"]);
  ab(A, ["find", "text", "Or start one and get a code", "click"]);
  ab(A, ["wait", "1600"]);
  ab(A, ["screenshot", "body", `${OUT}/a-created.png`]);

  const aCreated = text(A);
  const code = aCreated.match(/[A-Z2-9]{3}-[A-Z2-9]{3}/)?.[0];
  assert("A gets a visible crew code", Boolean(code), aCreated);
  assert("A immediately sees own trained day", /Device A\s+in today|Device A trained 1 time/.test(aCreated), aCreated);

  ab(B, ["find", "text", "Crew", "click"]);
  ab(B, ["wait", "900"]);
  ab(B, ["find", "label", "A crew code", "fill", code]);
  ab(B, ["find", "text", "Join", "click"]);
  ab(B, ["wait", "1600"]);
  ab(B, ["screenshot", "body", `${OUT}/b-joined.png`]);

  const bJoined = text(B);
  assert("B sees A as in today", /Device A\s+in today|Device A trained 1 time/.test(bJoined), bJoined);
  assert("B roster has no private numbers", !/135|95|weight|reps|sets|rank|Private note/i.test(bJoined), bJoined);

  ab(B, ["find", "text", "Device A", "click"]);
  ab(B, ["wait", "500"]);
  ab(B, ["screenshot", "body", `${OUT}/b-friend-sheet.png`]);

  const friend = text(B);
  assert("Friend sheet shows shared lift names", /Back Squat, Bench Press/.test(friend), friend);
  assert("Friend sheet explains recipient weights", /Their lifts, your weights/.test(friend), friend);
  assert("Friend sheet does not leak private performance", !/135|95|Private note|rank/i.test(friend), friend);

  ab(B, ["find", "text", "Copy this workout", "click"]);
  ab(B, ["wait", "500"]);
  ab(B, ["screenshot", "body", `${OUT}/b-copy-workout.png`]);

  const copy = text(B);
  assert("Copy screen names lifts only", /Back Squat, Bench Press/.test(copy), copy);
  assert("Copy screen has no A performance numbers", !/135|95|Private note|rank/i.test(copy), copy);

  // Share a tiny progress photo from A through the same browser identity.
  const shared = ab(A, ["eval", `(async () => {
    const today = '${todayLocal()}';
    const device = localStorage.getItem('habitabull.device');
    const res = await fetch('/api/crew/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device,
        day: today,
        caption: 'Shared only because I chose it.',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      })
    });
    return JSON.stringify({ status: res.status, body: await res.text() });
  })()`]);
  assert("A can explicitly share a photo", /"status":200/.test(shared), shared);

  ab(B, ["find", "text", "Back to the crew", "click"]);
  ab(B, ["wait", "500"]);
  ab(B, ["reload"]);
  ab(B, ["wait", "1200"]);
  ab(B, ["find", "text", "Crew", "click"]);
  ab(B, ["wait", "1200"]);
  ab(B, ["screenshot", "body", `${OUT}/b-feed.png`]);

  const feed = text(B);
  assert("B sees A's shared photo feed item", /What they posted|Shared only because I chose it/.test(feed), feed);
  assert("Feed does not leak private performance", !/135|95|Private note|rank/i.test(feed), feed);

  // Cleanup from both browser identities.
  for (const session of [B, A]) {
    ab(session, ["eval", `(async () => {
      const device = localStorage.getItem('habitabull.device');
      if (device) await fetch('/api/crew/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device })
      });
      localStorage.removeItem('habitabull.crew');
      localStorage.removeItem('habitabull.checkins');
      return 'ok';
    })()`]);
  }

  console.log(`Screenshots: ${OUT}`);
}

main().catch((err) => {
  console.error(oneLine(err.stack || String(err)));
  process.exit(1);
});
```

- [ ] **Step 2: Run the script against the dev server**

Run:

```bash
npm run dev
node scripts/ux-crew-two-devices.mjs
```

Expected:
- PASS lines for code creation, A visible as in today, no private numbers, shared lift names, copy screen privacy.
- PASS lines for A photo sharing, B feed rendering, and no private performance strings in the feed.
- Screenshots written under `ux-tests/artifacts/2026-09-20-second-device-crew/`.

- [ ] **Step 3: Fix selector drift if needed**

If `agent-browser find text "Crew" click` hits the wrong text, replace it with a scoped tab click after a fresh snapshot. The exact fallback command inside the script should be:

```js
function clickCrewTab(session) {
  const snap = ab(session, ["snapshot", "-i", "-c"]);
  const match = snap.match(/button "Crew" \\[ref=(e\\d+)\\]/);
  assert("Crew tab ref is present", Boolean(match), snap);
  ab(session, ["click", `@${match[1]}`]);
}
```

Then replace both `find text "Crew" click` calls with `clickCrewTab(A)` and `clickCrewTab(B)`.

- [ ] **Step 4: Commit**

```bash
git add scripts/ux-crew-two-devices.mjs ux-tests/artifacts/2026-09-20-second-device-crew
git commit -m "test: add two-device crew ux check"
```

---

### Task 3: Add NPM Script for the Crew UX Check

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run ux:crew-devices`

- [ ] **Step 1: Add the script**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "ux:crew-devices": "node scripts/ux-crew-two-devices.mjs"
  }
}
```

Keep existing scripts unchanged.

- [ ] **Step 2: Run the command**

Run with dev server already running:

```bash
npm run ux:crew-devices
```

Expected: same PASS output as Task 2.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add crew device ux script"
```

---

### Task 4: Update the Retest Document

**Files:**
- Modify: `/Users/lucyliu/Desktop/Portfolio Documentation/habitabull redesign/ux-tests/2026-09-20-habitabull-ux-retest.md`

**Interfaces:**
- Consumes: output from Tasks 1-3.
- Produces: updated retest note that no longer says these two items were not attempted.

- [ ] **Step 1: Replace the progression bullet**

Replace lines 86-87:

```md
- **Progression rules over time** (clear target reps → weight up; miss three →
  cut 10%). Needs several sessions across dates; not attempted this run.
```

With:

```md
- **Progression rules over time.** Verified with dated sessions in
  `lib/progression-flow.test.ts`: clearing all target reps raises the next
  generated workout by one increment, one/two misses hold the load, three
  consecutive misses cut 10%, and unfinished drafts are ignored.
```

- [ ] **Step 2: Replace the second-device bullet**

Replace lines 89-91:

```md
- **The second device was simulated via the crew API**, not a second browser
  profile. That is stricter for the privacy check, since it inspects the raw
  payload, but it does not exercise B's rendering of A's data.
```

With:

```md
- **Second-device crew rendering.** Verified with two isolated `agent-browser`
  sessions in `scripts/ux-crew-two-devices.mjs`. Device B joined by Device A's
  code, rendered A as trained today, opened A's friend sheet, and reached copy
  workout. B saw days and lift names only; A's private 135/95 lb performance
  numbers and note did not render.
- **Crew photo feed rendering.** In the same two-device browser run, Device A
  explicitly shared a 1x1 test photo with a caption. Device B rendered it in
  the Crew feed. The feed showed the chosen caption and author context, and did
  not render A's private weights, reps, PRs, rankings, or note.
```

- [ ] **Step 3: Add evidence paths**

Under the "Passed" section, add:

```md
- **Second-device crew rendering.** Screenshots:
  `ux-tests/artifacts/2026-09-20-second-device-crew/a-created.png`,
  `b-joined.png`, `b-friend-sheet.png`, `b-copy-workout.png`, and `b-feed.png`.
```

- [ ] **Step 4: Commit**

```bash
git add \
  "/Users/lucyliu/Desktop/Portfolio Documentation/habitabull redesign/ux-tests/2026-09-20-habitabull-ux-retest.md"
git commit -m "docs: close progression and crew device retest gaps"
```

---

## Self-Review

Spec coverage:
- Progression-over-time gap is covered by Task 1.
- Second-browser-profile rendering gap is covered by Tasks 2 and 3.
- Photo/feed rendering gap is covered by Task 2.
- Retest doc update is covered by Task 4.

Placeholder scan:
- No TBD/TODO/fill-in placeholders.

Type consistency:
- Test code uses existing `Routine`, `Session`, `buildSession`, `nextTarget`, and `byId`.
- Browser script uses the same `agent-browser` CLI pattern already used by `scripts/shoot.mjs`.
