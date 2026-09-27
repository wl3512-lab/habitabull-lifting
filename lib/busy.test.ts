import { beforeEach, describe, expect, it } from "vitest";
import { isBusy, setBusy } from "./busy";

/**
 * Small, but it gates a page reload on somebody's phone mid-set, so the
 * default matters as much as the flag: a fresh module must read "not busy",
 * or an app that never opened a workout would refuse updates forever.
 */
describe("busy", () => {
  beforeEach(() => setBusy(false));

  it("starts clear", () => {
    expect(isBusy()).toBe(false);
  });

  it("holds while a workout is open", () => {
    setBusy(true);
    expect(isBusy()).toBe(true);
  });

  it("clears again when it ends", () => {
    setBusy(true);
    setBusy(false);
    expect(isBusy()).toBe(false);
  });
});
