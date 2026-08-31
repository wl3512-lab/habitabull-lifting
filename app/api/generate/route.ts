import { NextResponse } from "next/server";
import { EQUIPMENT, MUSCLES, parseLocally, sanitize } from "@/lib/constraints";
import { parseAvailability } from "@/lib/schedule";

/**
 * Free text in, structured constraints out.
 *
 * The model's entire job is language: turning "my shoulder is tweaked and I only
 * have dumbbells" into two enum arrays. It never sees or returns a weight, a set
 * count, or a rep count — the rules engine owns all of that.
 *
 * Every failure path falls back to the local keyword parser. The app must work
 * with this endpoint completely dead.
 *
 * Provider: the NYU ITP/IMA Replicate proxy, decided 2026-08-31. This
 * supersedes CLAUDE-PROMPT.md, which specifies the Anthropic SDK with
 * claude-sonnet-5 — that brief was written before this route existed. The proxy
 * needs no key, costs nothing, and leaks no secret, and the rails that actually
 * matter here are provider-independent: the model proposes constraints, the
 * rules engine decides, and anything outside the allowed enum is discarded and
 * logged. Swapping providers means changing PROXY, MODEL, and the fetch body;
 * nothing else in the app knows or cares which model answered.
 */

const PROXY = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const MODEL = "openai/gpt-4o-mini";
const TIMEOUT_MS = 8000;

const SYSTEM = `You convert a gym-goer's note into JSON constraints.

Return ONLY a JSON object, no prose, no markdown fence:
{"equipment": [...], "avoid": [...]}

"equipment" = what they say they HAVE. Allowed values only: ${EQUIPMENT.join(", ")}.
"avoid" = muscle groups to work around because of pain, injury or soreness.
Allowed values only: ${MUSCLES.join(", ")}.

Use empty arrays when unsure. Never invent sets, reps, weights or exercise names.`;

function readOutput(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join("");
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if ("output" in o) return readOutput(o.output);
  }
  return "";
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const AVAILABILITY_SYSTEM = `You convert a gym-goer's note about their week into JSON.

Return ONLY a JSON object, no prose, no markdown fence:
{"days": [...], "avoid": [...], "anchor": "wake"|"lunch"|"afterwork"|"evening"|null, "count": 1-7|null}

"days" and "avoid" are weekday numbers, 0 = Sunday.
"anchor" is when in the day, not a clock time.
Use null and empty arrays when unsure. Never invent a schedule they did not describe.`;

/**
 * Availability is validated the same way constraints are: the model may only
 * return weekday numbers, one of four anchors, and a session count inside the
 * range the guidance allows. Anything else is dropped and the local parser wins.
 */
function sanitizeAvailability(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nums = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6))] as number[] : [];
  const anchors = ["wake", "lunch", "afterwork", "evening"];
  const count = typeof o.count === "number" && o.count >= 1 && o.count <= 7 ? Math.round(o.count) : undefined;
  const avoid = nums(o.avoid);
  return {
    days: nums(o.days).filter((d) => !avoid.includes(d)),
    avoid,
    anchor: typeof o.anchor === "string" && anchors.includes(o.anchor) ? o.anchor : undefined,
    count,
  };
}

export async function POST(request: Request) {
  let text = "";
  let intent = "constraints";
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text.slice(0, 500) : "";
    if (body?.intent === "availability") intent = "availability";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (intent === "availability") {
    const local = () => NextResponse.json({ ...parseAvailability(text), source: "local" });
    if (!text.trim()) return local();
    try {
      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          input: { prompt: text, system_prompt: AVAILABILITY_SYSTEM, max_completion_tokens: 120 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return local();
      const clean = sanitizeAvailability(extractJson(readOutput(await res.json())));
      if (!clean) return local();
      /*
        The model reliably invents a session count nobody asked for — "free most
        evenings" comes back as five days a week, which is how beginners quit.
        A frequency is a number, and numbers are the rules engine's job, so the
        model's count is only honoured when the local parser can find a
        frequency in the text too. Days and anchors are language; counts are not.
      */
      if (parseAvailability(text).count === undefined) delete clean.count;
      return NextResponse.json({ ...clean, source: "ai" });
    } catch {
      return local();
    }
  }

  if (!text.trim()) {
    return NextResponse.json({ equipment: [], avoid: [], source: "local" });
  }

  const fallback = () => NextResponse.json(parseLocally(text));

  try {
    const res = await fetch(PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        input: {
          prompt: text,
          system_prompt: SYSTEM,
          max_completion_tokens: 120,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[generate] proxy returned ${res.status}, falling back to local parser`);
      return fallback();
    }

    const clean = sanitize(extractJson(readOutput(await res.json())));
    if (!clean) {
      console.warn("[generate] model output failed enum validation, discarded");
      return fallback();
    }

    return NextResponse.json({ ...clean, source: "ai" });
  } catch (err) {
    console.warn("[generate] proxy unreachable, falling back to local parser", err);
    return fallback();
  }
}
