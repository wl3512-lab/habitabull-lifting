import { describe, parseLocally, type Constraints } from "./constraints";

/**
 * Turning "only dumbbells today, my shoulder is tweaked" into constraints.
 *
 * This lived inside Today. The list now asks the same question from the plan
 * card ("Adjust it for today"), so the call, the local fallback and the
 * honesty about which one answered live here, once. `post` is a parameter so
 * the tests can stand in for the network.
 */
/**
 * How long to wait for the model before parsing locally. Nothing else bounds
 * the request on the client, so without this a stalled connection leaves her
 * on "Rebuilding..." until the browser gives up on its own, which can be minutes.
 */
export const READ_TIMEOUT_MS = 10_000;

export async function readConstraints(
  text: string,
  post: typeof fetch = fetch
): Promise<{ constraints: Constraints; offline: boolean }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);
  try {
    const res = await post("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const constraints = (await res.json()) as Constraints;
    return { constraints, offline: constraints.source === "local" };
  } catch {
    // Hard requirement: the app works with the AI layer completely dead.
    return { constraints: parseLocally(text), offline: true };
  } finally {
    clearTimeout(timer);
  }
}

/** What Today says back after a rebuild, the same words wherever it was asked. */
export function adjustedLine(c: Constraints, offline: boolean): string {
  return offline
    ? `${describe(c)} Worked that out offline. The smart parser was unreachable.`
    : describe(c);
}
