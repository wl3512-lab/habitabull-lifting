/*
  The basement gym worker.

  Everything this app knows already lives on the phone: the plan, the history,
  the photos. The one thing it could not do without a signal was open, because
  the page itself had to come off the network first. Two floors underground
  that is the whole app gone, at exactly the moment somebody is standing at a
  rack wanting to log a set.

  So this caches the shell, and nothing else changes.

  The rule that keeps it from becoming the usual PWA disaster: **the document
  is fetched network-first.** A service worker that serves a cached page first
  is the reason installed web apps get stuck on a build from three weeks ago,
  and this app has a version check that exists precisely to stop that. Online,
  the network answers and the cache is only updated. The cache is a fallback,
  never a preference.

  The hashed assets are the exception, and they are safe by construction:
  Next puts a content hash in the filename, so a changed chunk is a different
  URL and a cached one can never be stale.
*/

const VERSION = "v1";
const CACHE = `habitabull-${VERSION}`;

/*
  Each deploy adds a fresh set of hashed chunks, and the old ones are never
  requested again. Without a ceiling that is a slow leak on somebody's phone
  forever. `caches.keys()` returns insertion order, so the oldest go first.
*/
const MAX_ENTRIES = 80;

/**
 * What to do with a request. A pure function of the URL, so the interesting
 * decision in this file can be tested without a browser.
 *
 * - `network`    never cached. Live data, and answers whose whole value is
 *                being current.
 * - `immutable`  cache first. Content-hashed, so a hit is always correct.
 * - `shell`      network first, cache as fallback. The page and its furniture.
 */
function strategyFor(rawUrl, sameOrigin) {
  if (!sameOrigin) return "network";

  const { pathname } = new URL(rawUrl, "https://habitabull.invalid");

  // Her crew, her generated week, and what build is live. None of it is ours
  // to keep, and a stale answer to any of them is worse than no answer.
  if (pathname.startsWith("/api/")) return "network";

  // Hashed by content, so these can be trusted forever.
  if (pathname.startsWith("/_next/static/")) return "immutable";

  // The image optimiser. Not under /_next/static, so a rule written only for
  // that prefix misses it and the bull disappears underground.
  if (pathname.startsWith("/_next/image")) return "immutable";

  return "shell";
}

/** Drop the oldest entries once the cache is over its ceiling. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  for (const request of keys.slice(0, keys.length - MAX_ENTRIES)) {
    await cache.delete(request);
  }
}

async function immutable(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) {
    await cache.put(request, res.clone());
    await trim(cache);
  }
  return res;
}

async function shell(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      await cache.put(request, res.clone());
      await trim(cache);
    }
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    /*
      One route, one document. A navigation to anything we have not got
      verbatim still resolves to the app, because the app is a single page and
      it rebuilds every screen out of local storage anyway.
    */
    if (request.mode === "navigate") {
      const root = await cache.match("/");
      if (root) return root;
    }
    throw new Error("offline and not cached");
  }
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", () => self.skipWaiting());

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        // A bumped VERSION means the old cache is dead weight.
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    if (!request.url.startsWith("http")) return;

    const sameOrigin = new URL(request.url).origin === self.location.origin;
    const how = strategyFor(request.url, sameOrigin);
    if (how === "network") return;
    event.respondWith(how === "immutable" ? immutable(request) : shell(request));
  });
}

// So the routing table above can be tested in node, where there is no `self`.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { strategyFor, VERSION, CACHE, MAX_ENTRIES };
}
