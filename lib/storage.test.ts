import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY, save, watchSaves } from "./storage";
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
