import { describe, parseLocally, type Constraints } from "./constraints";

/**
 * Turning "only dumbbells today, my shoulder is tweaked" into constraints.
 *
 * This lived inside Today. The list now asks the same question from the plan
 * card ("Adjust it for today"), so the call, the local fallback and the
 * honesty about which one answered live here, once. `post` is a parameter so
 * the tests can stand in for the network.
 */
export async function readConstraints(
  text: string,
  post: typeof fetch = fetch
): Promise<{ constraints: Constraints; offline: boolean }> {
  try {
    const res = await post("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const constraints = (await res.json()) as Constraints;
    return { constraints, offline: constraints.source === "local" };
  } catch {
    // Hard requirement: the app works with the AI layer completely dead.
    return { constraints: parseLocally(text), offline: true };
  }
}

/** What Today says back after a rebuild, the same words wherever it was asked. */
export function adjustedLine(c: Constraints, offline: boolean): string {
  return offline
    ? `${describe(c)} Worked that out offline — the smart parser was unreachable.`
    : describe(c);
}
