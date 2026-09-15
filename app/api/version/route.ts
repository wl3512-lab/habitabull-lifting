/**
 * Which build is live right now.
 *
 * An installed app is resumed, not reloaded. Someone who added HabitaBull to
 * their home screen and never force-quits it can hold the same page in memory
 * for weeks, so shipping a fix does not mean they have it. There is no service
 * worker here to broker that (which is a good thing — the usual PWA failure is
 * a service worker serving a stale shell forever); what is missing is only a
 * way for a page that is already open to notice it has been superseded.
 *
 * One string is enough for that. The client never interprets it, it only
 * compares it against the one it booted with, so any value that changes per
 * deploy will do.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUILD =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export function GET() {
  return Response.json(
    { build: BUILD },
    // Never cached: a cached answer to "what is live" is the one answer that
    // is worthless.
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}
