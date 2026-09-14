import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

/**
 * The worker's routing table.
 *
 * `public/sw.js` is a plain script rather than part of the bundle, so it
 * cannot be imported the usual way; it guards its listeners on `self` existing
 * and exports the decision function, which is the only part with judgement in
 * it. Everything else in that file is Cache API plumbing that only a browser
 * can exercise, and the offline run does that.
 */
const require = createRequire(import.meta.url);
const { strategyFor } = require("../public/sw.js") as {
  strategyFor: (url: string, sameOrigin: boolean) => string;
};

const origin = "https://habitabull.vercel.app";
const call = (path: string, same = true) => strategyFor(origin + path, same);

describe("what the worker keeps", () => {
  it("never keeps anything that belongs to a person", () => {
    expect(call("/api/crew/members")).toBe("network");
    expect(call("/api/crew/feed")).toBe("network");
    expect(call("/api/generate")).toBe("network");
  });

  it("never keeps the answer to which build is live", () => {
    // A cached answer to that question is the one answer worth nothing.
    expect(call("/api/version")).toBe("network");
  });

  it("trusts content-hashed assets forever", () => {
    expect(call("/_next/static/immutable/chunks/2corl6wyj4669.js")).toBe("immutable");
    expect(call("/_next/static/immutable/chunks/2cvdlr4fghv2a.css")).toBe("immutable");
    expect(call("/_next/static/immutable/media/0595f7052377a1a2-s.p.woff2")).toBe("immutable");
  });

  it("keeps the optimised images too", () => {
    // Not under /_next/static. A rule written only for that prefix misses the
    // mascot, and he is the one thing on the screen nobody would miss quietly.
    expect(call("/_next/image?url=%2Fmascot.png&w=256&q=75")).toBe("immutable");
  });

  it("takes the page from the network first, and the cache only if that fails", () => {
    expect(call("/")).toBe("shell");
    expect(call("/frames")).toBe("shell");
    expect(call("/manifest.webmanifest")).toBe("shell");
    expect(call("/icon-192.png?v=3")).toBe("shell");
  });

  it("leaves other origins alone entirely", () => {
    expect(strategyFor("https://fonts.googleapis.com/css2?family=Barlow", false)).toBe("network");
    expect(strategyFor("https://example.com/anything.js", false)).toBe("network");
  });

  it("is not fooled by a query string that mentions the api", () => {
    expect(call("/?next=/api/crew")).toBe("shell");
  });
});
