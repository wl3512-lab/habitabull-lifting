# Offline: the basement gym

**Status:** built and verified, 2026-09-14.

## The problem

Everything this app knows already lives on the phone: the plan, the history,
the photos, the weights. The one thing it could not do without a signal was
*open*, because the document itself had to come off the network first.

Two floors underground that is the entire app gone, at exactly the moment
somebody is standing at a rack wanting to log a set. The manifest already
argued for installing the app so iOS would not evict her history; it just never
finished the job of making the thing openable when the network is not there.

## Scope

**Open and train.** The app opens, the plan is there, sets log, the rest timer
runs, the session finishes. Crew stays unavailable, and says so.

Explicitly not in scope: caching other people's rosters or photos so the Crew
tab has something to show underground. That means storing other people's
pictures on her device, which cuts against the line the schema is built around.

## Approach

A hand-written service worker, `public/sw.js`, about a hundred lines.

Rejected: `next-pwa` / Serwist. The repo has two runtime dependencies and this
would add a toolchain for one cache strategy. Worse, Workbox's precache
manifest is the specific mechanism behind "installed web app serves a build
from three weeks ago", which is the failure `StayFresh` exists to prevent.

Rejected: HTTP caching alone. No new code, and it does not work — browsers will
not reliably serve a stale HTML document offline, iOS least of all. It would
look finished and fail in the basement.

## How it avoids the stale-shell trap

**The document is fetched network-first.** Online the network answers and the
cache is only updated behind it; the cache is a fallback, never a preference.
So the version check and the resume-time reload keep working exactly as they
did.

The hashed assets are cache-first, and that is safe by construction rather than
by care: Next puts a content hash in the filename, so a changed chunk is a
different URL and a cached one cannot be stale.

## The routing table

| Path | Strategy | Why |
|---|---|---|
| `/api/*` | never cached | Her crew, her generated week, and which build is live. A stale answer to any of them is worse than none. |
| `/_next/static/*` | cache-first | Content-hashed. A hit is always correct. |
| `/_next/image*` | cache-first | The image optimiser. Not under `/_next/static`, so a rule written only for that prefix misses it and the mascot disappears underground. |
| everything else same-origin | network-first | The page, the icons, the manifest. |
| cross-origin | untouched | None of it is ours. Fonts are self-hosted by `next/font`, so there is no third-party round trip to lose. |

A navigation with no verbatim cache entry falls back to the cached `/`, because
this is a single page and every screen rebuilds from local storage anyway.

## Two caches, not one

This started as a single cache with a ceiling, and that was a bug that ate its
own feature. Eviction is oldest-first and the document is cached first, so the
one entry the whole thing depends on was the first one dropped. Eighty requests
later there was no shell to fall back to, and nothing to notice it by until a
basement.

So the shell is its own cache, written at install and never evicted, and
everything picked up along the way goes in a capped one. Measured: 120
cacheable requests leave the runtime cache at exactly 80 and the shell
untouched at 17, document included.

## The first visit

The worker registers while the page is loading, so the page's own requests have
already gone out uncontrolled and the first visit cached nothing. Somebody who
opened the app once at home and then went to a basement had nothing there.

Install now fetches the document itself, reads the assets it names, and stores
them. `next/font` preloads its faces in the head and those sit under the same
prefix, so the type comes too: a first-ever visit followed immediately by no
signal opens the app in real Barlow, interactive. Each asset is stored on its
own rather than through `addAll`, which rejects the whole set if any single
request fails and would trade a mostly-cached app for an uncached one.

## What speaks up, and what stays quiet

Two places need a signal, so two places say so. Everything else stays silent,
because everything else genuinely works.

**Crew** said "Just you, for now." to somebody with five people in her crew —
the app inventing a fact about her life out of a dropped connection. The cached
join code tells the two apart: it is written when she joins and cleared when
she leaves, so a code with no reachable crew behind it means the network
failed, not that everyone left. It now says it cannot reach them, and that her
own training is still being kept.

**The AI week builder** caught its own failure and went quiet, which from the
other side of the screen is a button that does nothing. It now explains itself
and points at the day-type buttons, which produce the same week without it.

That failure state is its own variable rather than a message pushed through the
"why the model chose this shape" slot. Reading both out of one variable is how
a failure ends up phrased as a reason.

## Testing

The routing table is a pure function of the URL, so it is unit-tested in node:
`lib/sw.test.ts` imports `public/sw.js`, which guards its listeners on `self`
existing precisely so it can be imported outside a browser.

The rest is Cache API plumbing only a browser can exercise, so it was verified
by killing the server and reloading: the app opened, the plan was there, a set
logged and persisted, the mascot rendered, and both offline messages appeared.
