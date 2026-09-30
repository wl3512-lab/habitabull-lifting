import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY, load, save, watchSaves } from "./storage";
import { makeWorkout, saveWorkout, placeOn } from "./workouts";
import { buildSession } from "./engine";
import type { AppState } from "./types";

/**
 * The write path, and specifically what it does when the device says no.
 *
 * There is no jsdom here, so `window` is stood up by hand. That is a fair
 * model of what is being tested: `save` only ever touches
 * `window.localStorage.setItem`, and the cases that matter are the ones where
 * that throws — Safari in private browsing, a full disk, a site with storage
 * switched off.
 */

type Win = { localStorage: { setItem: (k: string, v: string) => void } };

function withWindow(setItem: (k: string, v: string) => void) {
  vi.stubGlobal("window", { localStorage: { setItem } } satisfies Win);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const state: AppState = { ...EMPTY };

describe("save", () => {
  it("reports a write that landed", () => {
    withWindow(() => {});
    expect(save(state)).toBe(true);
  });

  it("reports a write that did not, without throwing", () => {
    withWindow(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => save(state)).not.toThrow();
    expect(save(state)).toBe(false);
  });

  it("still refuses to throw when storage is switched off entirely", () => {
    // Safari in private browsing: the getter itself is the thing that throws.
    withWindow(() => {
      throw new Error("The operation is insecure.");
    });
    expect(save(state)).toBe(false);
  });
});

describe("watchSaves", () => {
  it("tells a watcher about a failure", () => {
    const seen: boolean[] = [];
    const stop = watchSaves((ok) => seen.push(ok));
    withWindow(() => {
      throw new Error("full");
    });
    save(state);
    stop();
    expect(seen).toEqual([false]);
  });

  it("tells a watcher about recovery, so the warning can come back down", () => {
    const seen: boolean[] = [];
    const stop = watchSaves((ok) => seen.push(ok));
    withWindow(() => {
      throw new Error("full");
    });
    save(state);
    withWindow(() => {});
    save(state);
    stop();
    expect(seen).toEqual([false, true]);
  });

  it("stops telling an unsubscribed watcher", () => {
    const seen: boolean[] = [];
    watchSaves((ok) => seen.push(ok))();
    withWindow(() => {});
    save(state);
    expect(seen).toEqual([]);
  });
});

/**
 * The read path for anything added to the store after it shipped.
 *
 * `load` names every field it returns, so a new one that nobody wired in comes
 * back undefined on the next launch and the feature quietly loses whatever the
 * user put in it — with no error anywhere, because the write side worked
 * perfectly. Her saved workouts are the current instance of that risk.
 */
describe("a reload", () => {
  function withStore() {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        setItem: (k: string, v: string) => void store.set(k, v),
        getItem: (k: string) => store.get(k) ?? null,
        removeItem: (k: string) => void store.delete(k),
      },
    });
  }

  it("gives her back the workouts she saved", () => {
    withStore();
    const mine: AppState = {
      ...EMPTY,
      workouts: [
        {
          id: "own-leg-day-1",
          name: "Leg day",
          template: "legs",
          createdAt: "2026-09-26T18:00:00.000Z",
          exercises: [{ exerciseId: "back-squat", sets: 4, reps: 6, weight: 145 }],
        },
      ],
    };
    expect(save(mine)).toBe(true);
    const back = load();
    expect(back.workouts?.map((w) => [w.name, w.exercises.length])).toEqual([["Leg day", 1]]);
    expect(back.workouts?.[0].template).toBe("legs");
  });

  it("keeps named updates, the chosen day and history across repeated reloads", () => {
    withStore();
    const first = makeWorkout("Push", [{ exerciseId: "bench-press", sets: 3, reps: 8, weight: 95 }]);
    const second = makeWorkout("Pull", [{ exerciseId: "barbell-row", sets: 3, reps: 10, weight: 65 }]);
    save({ ...EMPTY, workouts: saveWorkout([first], second),
      routines: [{ day: 1, label: "Original", exercises: first.exercises }],
      sessions: [{ date: "2026-08-01", label: "Push", completedAt: "2026-08-01T12:00:00Z",
        exercises: [{ exerciseId: "bench-press", sets: [{ weight: 115, reps: 7, done: true }] }] }] });
    const loaded = load();
    const updated = makeWorkout("Push", [{ exerciseId: "bench-press", sets: 4, reps: 9, weight: 100 }]);
    const workouts = saveWorkout(loaded.workouts, updated);
    expect(save({ ...loaded, workouts, routines: placeOn(loaded.routines, 1, workouts.find(w => w.name === "Push")!) })).toBe(true);
    const restored = load();
    expect(restored.workouts).toHaveLength(2);
    expect(restored.workouts?.find(w => w.name === "Push")?.id).toBe(first.id);
    expect(restored.workouts?.find(w => w.name === "Pull")?.exercises).toEqual(second.exercises);
    expect(restored.routines[0].exercises[0].sets).toBe(4);
    expect(restored.sessions).toEqual(loaded.sessions);
    expect(buildSession(restored.routines[0], restored.sessions, "new", "2026-09-28").exercises[0].sets)
      .toEqual(Array.from({ length: 4 }, () => ({ weight: 115, reps: 7, done: false })));
  });

  it("is not broken by a store that has never heard of them", () => {
    withStore();
    save(EMPTY);
    expect(load().workouts).toBeUndefined();
  });
});
