import { NextResponse } from "next/server";
import { EQUIPMENT, MUSCLES, parseLocally, sanitize } from "@/lib/constraints";
import { alternativesFor } from "@/lib/engine";
import { byId } from "@/lib/exercises";
import { parseAvailability } from "@/lib/schedule";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import type { Equipment, Muscle } from "@/lib/types";

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

/**
 * "I don't know what I want to do for biceps."
 *
 * The model picks from a shortlist we build; it does not know any exercise we
 * have not just handed it, and the id it returns is checked against that same
 * shortlist before it leaves this file. A hallucinated "cable crossover" is
 * dropped and the picker's own first choice is returned instead, which is
 * exactly what the screen would have shown anyway.
 *
 * It never returns a weight, a set count or a rep count. Adding the lift runs
 * the same rules engine as adding it by hand.
 */
function pickSystem(muscle: string, options: { id: string; name: string }[]) {
  return `A gym-goer is choosing a ${muscle} exercise and has asked for help.

Choose ONE from this list. These are the only exercises that exist:
${options.map((o) => `${o.id} = ${o.name}`).join("\n")}

Return ONLY JSON, no prose, no markdown fence:
{"id": "<one id from the list>", "why": "<one short sentence, under 15 words>"}

Write "why" in second person, plainly, about what the movement is like. Never
mention sets, reps, weights or numbers. Never invent an exercise.`;
}

/**
 * "Build me a week."
 *
 * The model picks day *types* and nothing else — full body, push, legs — from
 * the same seven the picker shows. It never returns an exercise, a weight, a
 * set count or a rep count, because `generateRoutine` builds all of that from
 * the templates afterwards. That is the whole trick: the model is choosing
 * words, and the words happen to be an enum the rules engine already accepts.
 */
function weekSystem(count: number) {
  return `A gym-goer described the week they want. Choose the shape of each session.

Day types, and the only values allowed:
${TEMPLATES.map((t) => `${t.id} = ${t.label}, ${t.hint}`).join("\n")}

Return ONLY JSON, no prose, no markdown fence:
{"templates": [${Array(count).fill('"..."').join(", ")}], "why": "<one short sentence, under 15 words>"}

Give exactly ${count} values, in the order the sessions fall across the week.
Prefer full-body when they are new or unsure — training everything twice a week
matters more than the split. Never mention sets, reps, weights or numbers.`;
}

/**
 * "Cable crossover." What is that?
 *
 * The model reads a lift's name and says which muscle it trains and what it is
 * done with — two enums the app already understands. It writes no coaching:
 * every built-in entry's cue and steps were written by a person, and having a
 * language model improvise form advice for an arbitrary barbell movement is
 * the one place in this product where being wrong could injure somebody.
 */
const CLASSIFY_SYSTEM = `You identify a strength exercise from its name.

Return ONLY JSON, no prose, no markdown fence:
{"muscle": "...", "equipment": "...", "compound": true|false}

"muscle" is the main one it trains. Allowed values only: ${MUSCLES.join(", ")}.
"equipment" is what it is done with. Allowed values only: ${EQUIPMENT.join(", ")}.
"compound" is true when several joints move together, false for an isolation.

Never invent form advice, sets, reps or weights. If the name is not an exercise
you recognise, still answer with your best guess from the allowed values.`;

export async function POST(request: Request) {
  let text = "";
  let intent = "constraints";
  let muscle: Muscle | null = null;
  let equipment: Equipment[] = [];
  let exclude: string[] = [];
  let bodyCount: unknown = 3;
  try {
    const body = await request.json();
    if (body?.intent === "week") {
      intent = "week";
      bodyCount = body?.count;
    }
    if (body?.intent === "classify") intent = "classify";
    text = typeof body?.text === "string" ? body.text.slice(0, 500) : "";
    if (body?.intent === "availability") intent = "availability";
    if (body?.intent === "pick") {
      intent = "pick";
      const muscles: readonly string[] = MUSCLES;
      const kit: readonly string[] = EQUIPMENT;
      muscle = muscles.includes(body?.muscle) ? (body.muscle as Muscle) : null;
      equipment = Array.isArray(body?.equipment)
        ? (body.equipment.filter((e: unknown) => typeof e === "string" && kit.includes(e)) as Equipment[])
        : [];
      exclude = Array.isArray(body?.exclude)
        ? body.exclude.filter((x: unknown) => typeof x === "string").slice(0, 30)
        : [];
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (intent === "classify") {
    const name = text.trim().slice(0, 40);
    // Unknown things are arms and dumbbells: the most common answer, and the
    // safest place to land something the app could not identify.
    const local = () =>
      NextResponse.json({ muscle: "arms", equipment: "dumbbell", compound: false, source: "local" });
    if (!name) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    try {
      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          input: { prompt: name, system_prompt: CLASSIFY_SYSTEM, max_completion_tokens: 80 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return local();

      const raw = extractJson(readOutput(await res.json())) as Record<string, unknown> | null;
      const muscles: readonly string[] = MUSCLES;
      const kit: readonly string[] = EQUIPMENT;
      const muscle = typeof raw?.muscle === "string" && muscles.includes(raw.muscle) ? raw.muscle : null;
      const equipment = typeof raw?.equipment === "string" && kit.includes(raw.equipment) ? raw.equipment : null;

      if (!muscle || !equipment) {
        console.warn(`[generate:classify] discarded ${JSON.stringify(raw)} for ${JSON.stringify(name)}`);
        return local();
      }
      return NextResponse.json({
        muscle,
        equipment,
        compound: raw?.compound === true,
        source: "ai",
      });
    } catch {
      return local();
    }
  }

  if (intent === "week") {
    const count = Math.min(7, Math.max(1, Math.round(Number(bodyCount) || 3)));
    const ids = new Set(TEMPLATES.map((t) => t.id));
    // What the app would have built on its own, and the floor we never fall
    // below: full body is the shape the guidance actually recommends.
    const local = () =>
      NextResponse.json({
        templates: Array(count).fill("full-body") as TemplateId[],
        why: null,
        source: "local",
      });
    if (!text.trim()) return local();

    try {
      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          input: { prompt: text, system_prompt: weekSystem(count), max_completion_tokens: 160 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return local();

      const raw = extractJson(readOutput(await res.json())) as Record<string, unknown> | null;
      const got = Array.isArray(raw?.templates) ? raw.templates : [];

      // Every value checked against the enum. One bad entry does not cost the
      // whole answer — that slot falls back to full body, which is the default
      // it would have had anyway.
      const templates = Array.from({ length: count }, (_, i) => {
        const v = got[i];
        if (typeof v === "string" && ids.has(v as TemplateId)) return v as TemplateId;
        console.warn(`[generate:week] discarded template ${JSON.stringify(v)}`);
        return "full-body" as TemplateId;
      });

      const why = typeof raw?.why === "string" ? raw.why.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      return NextResponse.json({ templates, why: /\d/.test(why) ? null : why || null, source: "ai" });
    } catch {
      return local();
    }
  }

  if (intent === "pick") {
    if (!muscle) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const options = alternativesFor(muscle, equipment, exclude);
    if (options.length === 0) return NextResponse.json({ id: null, why: null, source: "local" });

    // What the screen would have suggested on its own, and what we fall back to.
    const local = () =>
      NextResponse.json({ id: options[0].id, why: options[0].cue, source: "local" });
    if (!text.trim()) return local();

    try {
      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          input: {
            prompt: text,
            system_prompt: pickSystem(muscle, options.map((o) => ({ id: o.id, name: o.name }))),
            max_completion_tokens: 120,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return local();

      const raw = extractJson(readOutput(await res.json())) as Record<string, unknown> | null;
      const id = typeof raw?.id === "string" ? raw.id : "";

      // The rail. An id we did not offer is not an exercise, whatever it sounds
      // like, and a lift the app cannot load or explain is worse than no answer.
      if (!options.some((o) => o.id === id)) {
        console.warn(`[generate:pick] discarded id ${JSON.stringify(id)} for ${muscle}`);
        return local();
      }

      const why = typeof raw?.why === "string" ? raw.why.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      // No numbers in the sentence either: the engine owns every one of those.
      const clean = /\d/.test(why) ? "" : why;
      return NextResponse.json({ id, why: clean || byId(id)?.cue || null, source: "ai" });
    } catch {
      return local();
    }
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
