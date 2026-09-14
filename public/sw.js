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

const VERSION = "v2";

/*
  Two caches, because they have opposite needs.

  SHELL is what the app cannot open without: the document and the scripts it
  names. It is written once at install and never evicted.

  RUNTIME is everything picked up along the way, and it is capped, because each
  deploy leaves behind a set of hashed chunks that will never be asked for
  again and a cache with no ceiling is a slow leak on somebody's phone.

  They were one cache to begin with, and that was a bug that ate its own
  feature: eviction is oldest-first, the document is cached first, so the
  single most important entry was the first one thrown away. Eighty requests
  later there was no shell to fall back to and no way to notice until a
  basement.
*/
const SHELL = `habitabull-shell-${VERSION}`;
const RUNTIME = `habitabull-runtime-${VERSION}`;
const KEEP = [SHELL, RUNTIME];

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

/**
 * Every asset the document names, so the shell can be stored whole.
 *
 * The scripts and stylesheets are what make this a working app rather than a
 * page of markup, and `next/font` preloads its faces in the head, so matching
 * everything under /_next/static picks up the type as well.
 */
function assetsIn(html) {
  const found = html.match(/\/_next\/static\/[A-Za-z0-9._\-/]+/g) || [];
  return [...new Set(found)];
}

/** Look in the pinned shell first, then in what was picked up along the way. */
async function cached(request) {
  const shell = await caches.open(SHELL);
  const pinned = await shell.match(request);
  if (pinned) return pinned;
  const runtime = await caches.open(RUNTIME);
  return runtime.match(request);
}

/** Drop the oldest entries once the runtime cache is over its ceiling. */
async function trim() {
  const cache = await caches.open(RUNTIME);
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  for (const request of keys.slice(0, keys.length - MAX_ENTRIES)) {
    await cache.delete(request);
  }
}

async function immutable(request) {
  const hit = await cached(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, res.clone());
    await trim();
  }
  return res;
}

async function shellFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME);
      await cache.put(request, res.clone());
      await trim();
    }
    return res;
  } catch {
    const hit = await cached(request);
    if (hit) return hit;
    /*
      One route, one document. A navigation to anything we have not got
      verbatim still resolves to the app, because the app is a single page and
      it rebuilds every screen out of local storage anyway.
    */
    if (request.mode === "navigate") {
      const root = await caches.open(SHELL).then((c) => c.match("/"));
      if (root) return root;
    }
    throw new Error("offline and not cached");
  }
}

/**
 * Store the whole shell while the worker installs.
 *
 * Without this the first visit is the one visit that does not get cached: the
 * worker registers as the page is loading, so the page's own requests have
 * already gone out uncontrolled. Somebody who opens the app once at home and
 * then goes to a basement had nothing. Now the install goes and fetches it.
 *
 * Each asset is stored on its own rather than through `addAll`, which rejects
 * the whole set if any single request fails and would trade a mostly-cached
 * app for an uncached one.
 */
async function precache() {
  const cache = await caches.open(SHELL);
  const res = await fetch("/", { cache: "reload" });
  if (!res || !res.ok) return;
  const html = await res.clone().text();
  await cache.put("/", res);
  await Promise.all(
    assetsIn(html).map(async (url) => {
      try {
        const asset = await fetch(url, { cache: "reload" });
        if (asset && asset.ok) await cache.put(url, asset);
      } catch {
        // One missing chunk should not cost the shell the rest of itself.
      }
    })
  );
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      precache()
        .catch(() => {
          // Installing without a network. The app works exactly as it did
          // before this file existed, and the next visit fills the cache.
        })
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        // A bumped VERSION means the old caches are dead weight.
        const names = await caches.keys();
        await Promise.all(
          names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))
        );
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
    event.respondWith(how === "immutable" ? immutable(request) : shellFirst(request));
  });
}

// So the routing table above can be tested in node, where there is no `self`.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { strategyFor, assetsIn, VERSION, SHELL, RUNTIME, MAX_ENTRIES };
}
