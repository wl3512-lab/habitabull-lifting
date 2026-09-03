import { NextResponse } from "next/server";
import { isValidCode, makeCode, normaliseCode } from "@/lib/joincode";
import {
  configured,
  deleteObject,
  insert,
  putObject,
  remove,
  select,
  signObject,
  update,
  upsert,
} from "@/lib/server/db";
import {
  cleanName,
  cleanText,
  decodeImage,
  isDay,
  isDeviceId,
  isUuid,
} from "@/lib/server/validate";

/**
 * The crew API.
 *
 * One handler, one action per path segment. Every route starts the same way:
 * find the member row this device owns, and refuse if there isn't one. A device
 * can only ever read its own crew, because the crew id comes from that lookup
 * and never from the request body.
 *
 * Nothing here stores or returns a weight, a rep or a set. A crew learns that
 * you trained on a day and sees a photo you chose to share; that is the whole
 * surface, and it is small on purpose.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Member {
  id: string;
  crew_id: string;
  name: string;
}

const bad = (status: number, why: string) => NextResponse.json({ error: why }, { status });

/** The member row for this device, or null. The basis of every permission here. */
async function whoami(device: string): Promise<Member | null> {
  const rows = await select<Member>(
    "members",
    `device_id=eq.${device}&select=id,crew_id,name&limit=1`
  );
  return rows[0] ?? null;
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!configured()) return bad(503, "No crew backend configured.");

  const { action } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad(400, "Malformed request.");
  }

  const device = body.device;
  if (!isDeviceId(device)) return bad(400, "Bad device.");

  try {
    switch (action) {
      case "create":
        return await create(device, body);
      case "join":
        return await join(device, body);
      case "leave":
        return await leave(device);
      case "members":
        return await members(device);
      case "checkin":
        return await checkin(device, body);
      case "day":
        return await day(device, body);
      case "feed":
        return await feed(device);
      case "publish":
        return await publish(device, body);
      case "share":
        return await share(device, body);
      case "unshare":
        return await unshare(device, body);
      case "like":
        return await like(device, body);
      case "reply":
        return await reply(device, body);
      default:
        return bad(404, "No such action.");
    }
  } catch (err) {
    // The database's own words are for the log, never for the phone.
    console.error(`[crew:${action}]`, err);
    return bad(500, "Something went wrong.");
  }
}

// ── membership ───────────────────────────────────────────────────────────────

async function create(device: string, body: Record<string, unknown>) {
  await leaveQuietly(device);

  // Collisions are vanishingly rare at 29^6, but "vanishing" is not "never",
  // and a duplicate code would silently merge two groups of strangers.
  let crew: { id: string; code: string } | undefined;
  for (let attempt = 0; attempt < 5 && !crew; attempt++) {
    const code = makeCode();
    const existing = await select<{ id: string }>("crews", `code=eq.${code}&select=id&limit=1`);
    if (existing.length) continue;
    crew = (await insert<{ id: string; code: string }>("crews", { code }))[0];
  }
  if (!crew) return bad(503, "Could not make a code. Try again.");

  await insert("members", { crew_id: crew.id, device_id: device, name: cleanName(body.name) }, false);
  return NextResponse.json({ code: crew.code });
}

async function join(device: string, body: Record<string, unknown>) {
  const code = normaliseCode(String(body.code ?? ""));
  if (!isValidCode(code)) return bad(400, "That code isn't right.");

  const crews = await select<{ id: string }>("crews", `code=eq.${code}&select=id&limit=1`);
  if (!crews.length) return bad(404, "No crew with that code.");

  // One crew at a time. Two would mean a check-in belonging to two places, and
  // nobody asked for a second crew.
  await leaveQuietly(device);
  await upsert(
    "members",
    { crew_id: crews[0].id, device_id: device, name: cleanName(body.name) },
    "crew_id,device_id"
  );
  return NextResponse.json({ ok: true, code });
}

async function leave(device: string) {
  await leaveQuietly(device);
  return NextResponse.json({ ok: true });
}

/**
 * Leaving takes the check-ins and the photos with it — the cascade in the
 * schema does that. Nobody should have to trust a promise that their pictures
 * are gone when the foreign key can make it true.
 *
 * The last person out takes the crew with them. A crew with no members is not
 * a crew, and leaving it behind holds its join code hostage forever: 29^6 is a
 * large number but an empty row still owns a code nobody can ever use again.
 */
async function leaveQuietly(device: string) {
  const me = await whoami(device);
  if (!me) return;
  const mine = await select<{ path: string }>("photos", `member_id=eq.${me.id}&select=path`);
  await Promise.all(mine.map((p) => deleteObject(p.path)));
  await remove("members", `id=eq.${me.id}`);

  const left = await select<{ id: string }>("members", `crew_id=eq.${me.crew_id}&select=id&limit=1`);
  if (left.length === 0) await remove("crews", `id=eq.${me.crew_id}`);
}

/** A day of somebody's shared plan. Names and shape, never numbers. */
interface SharedDay {
  day: number;
  label: string;
  exercises: string[];
}

/**
 * Validate a plan before it is stored or handed to anyone.
 *
 * The exercise ids are checked against the library rather than trusted, so a
 * copied plan cannot introduce a lift the copier's app has never heard of —
 * and a plan is capped so one member cannot make everyone else's crew screen
 * enormous.
 */
function cleanPlan(raw: unknown): SharedDay[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SharedDay[] = [];
  for (const d of raw.slice(0, 7)) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    if (typeof o.day !== "number" || o.day < 0 || o.day > 6) continue;
    const exercises = Array.isArray(o.exercises)
      ? o.exercises.filter((e): e is string => typeof e === "string" && e.length <= 60).slice(0, 12)
      : [];
    if (!exercises.length) continue;
    out.push({
      day: Math.round(o.day),
      label: typeof o.label === "string" ? o.label.slice(0, 40) : "Training",
      exercises,
    });
  }
  return out.length ? out : null;
}

/** Publish, or withdraw, my plan for the crew to copy. */
async function publish(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");
  const plan = body.plan === null ? null : cleanPlan(body.plan);
  await update("members", `id=eq.${me.id}`, { plan });
  return NextResponse.json({ ok: true, shared: plan !== null });
}

async function members(device: string) {
  const me = await whoami(device);
  if (!me) return NextResponse.json({ code: null, members: [] });

  const crews = await select<{ code: string }>("crews", `id=eq.${me.crew_id}&select=code`);
  const rows = await select<{
    id: string;
    name: string;
    plan: SharedDay[] | null;
    checkins: { day: string }[];
  }>(
    "members",
    `crew_id=eq.${me.crew_id}&select=id,name,plan,checkins(day)&order=joined_at.asc`
  );

  return NextResponse.json({
    code: crews[0]?.code ?? null,
    members: rows.map((m) => ({
      id: m.id,
      name: m.name,
      plan: cleanPlan(m.plan) ?? null,
      // Which row is the person asking. The roster reads "you" from this
      // rather than trying to match on a display name two people can share.
      mine: m.id === me.id,
      days: (m.checkins ?? []).map((c) => c.day).sort(),
    })),
  });
}

// ── presence ─────────────────────────────────────────────────────────────────

async function checkin(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");

  const days = Array.isArray(body.days) ? body.days.filter(isDay).slice(0, 400) : [];
  if (!days.length) return NextResponse.json({ ok: true });

  await upsert(
    "checkins",
    days.map((d) => ({ member_id: me.id, day: d })),
    "member_id,day"
  );
  return NextResponse.json({ ok: true });
}

// ── the day ──────────────────────────────────────────────────────────────────

interface PhotoRow {
  id: string;
  member_id: string;
  path: string;
  caption: string | null;
  members: { name: string } | null;
  reactions: {
    id: string;
    kind: string;
    body: string | null;
    member_id: string;
    members: { name: string } | null;
  }[];
}

/** One row, shaped for the client. Shared by the day view and the feed. */
async function shapePhoto(p: PhotoRow, day: string, meId: string) {
  const reactions = p.reactions ?? [];
  return {
    id: p.id,
    memberId: p.member_id,
    memberName: p.members?.name ?? "Someone",
    mine: p.member_id === meId,
    day,
    url: await signObject(p.path),
    caption: p.caption ?? undefined,
    likes: reactions.filter((r) => r.kind === "like").length,
    likedByMe: reactions.some((r) => r.kind === "like" && r.member_id === meId),
    replies: reactions
      .filter((r) => r.kind === "reply" && r.body)
      .map((r) => ({
        id: r.id,
        memberName: r.members?.name ?? "Someone",
        mine: r.member_id === meId,
        body: r.body as string,
      })),
  };
}

/**
 * Everyone's shared photos for one day, with their reactions already counted.
 *
 * One query and one signing pass rather than a request per photo — a calendar
 * day in a crew of six should not be six round trips.
 */
async function day(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return NextResponse.json({ photos: [], trained: [] });
  if (!isDay(body.day)) return bad(400, "Bad day.");

  const crew = await select<{ id: string; name: string; checkins: { day: string }[] }>(
    "members",
    `crew_id=eq.${me.crew_id}&select=id,name,checkins(day)&order=joined_at.asc`
  );
  const ids = crew.map((m) => m.id).filter(isUuid);
  if (!ids.length) return NextResponse.json({ photos: [], trained: [] });

  // Who else was in the gym that day. A name and nothing else — the whole
  // reason there is no weight column to leak.
  const trained = crew
    .filter((m) => (m.checkins ?? []).some((c) => c.day === body.day))
    .map((m) => ({ id: m.id, name: m.name, mine: m.id === me.id }));

  const rows = await select<PhotoRow>(
    "photos",
    `day=eq.${body.day}&member_id=in.(${ids.join(",")})` +
      `&select=id,member_id,path,caption,members(name),reactions(id,kind,body,member_id,members(name))` +
      `&order=created_at.asc`
  );

  const photos = await Promise.all(rows.map((p) => shapePhoto(p, body.day as string, me.id)));

  // A photo whose object has gone is not a broken image on someone's calendar.
  return NextResponse.json({ photos: photos.filter((p) => p.url), trained });
}

/**
 * What the crew has posted lately, newest first.
 *
 * Without this a photo is only reachable by opening the exact calendar day it
 * was taken on — you would have to guess when somebody trained in order to see
 * that they did. The same rows the day view returns, not filtered by date.
 */
async function feed(device: string) {
  const me = await whoami(device);
  if (!me) return NextResponse.json({ photos: [] });

  const crew = await select<{ id: string }>("members", `crew_id=eq.${me.crew_id}&select=id`);
  const ids = crew.map((m) => m.id).filter(isUuid);
  if (!ids.length) return NextResponse.json({ photos: [] });

  const rows = await select<PhotoRow & { day: string }>(
    "photos",
    `member_id=in.(${ids.join(",")})` +
      `&select=id,member_id,day,path,caption,members(name),reactions(id,kind,body,member_id,members(name))` +
      `&order=created_at.desc&limit=24`
  );

  const photos = await Promise.all(rows.map((p) => shapePhoto(p, p.day, me.id)));
  return NextResponse.json({ photos: photos.filter((p) => p.url) });
}

async function share(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");
  if (!isDay(body.day)) return bad(400, "Bad day.");

  const image = decodeImage(body.dataUrl);
  if (!image) return bad(400, "That file isn't a photo we can take.");

  const path = `${me.crew_id}/${me.id}/${body.day}-${Date.now().toString(36)}.${image.ext}`;
  await putObject(path, image.bytes, image.type);

  const rows = await insert<{ id: string }>("photos", {
    member_id: me.id,
    day: body.day,
    path,
    // A caption is the workout note she already wrote; same length.
    caption: cleanText(body.caption, 500) ?? null,
  });
  return NextResponse.json({ id: rows[0]?.id ?? null });
}

async function unshare(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");
  if (!isUuid(body.photoId)) return bad(400, "Bad photo.");

  // Scoped to this member: unsharing is only ever your own photo.
  const rows = await select<{ path: string }>(
    "photos",
    `id=eq.${body.photoId}&member_id=eq.${me.id}&select=path`
  );
  if (!rows.length) return bad(404, "Not yours.");

  await remove("photos", `id=eq.${body.photoId}&member_id=eq.${me.id}`);
  await deleteObject(rows[0].path);
  return NextResponse.json({ ok: true });
}

// ── reactions ────────────────────────────────────────────────────────────────

/** A photo id, but only if it belongs to somebody in this device's crew. */
async function visiblePhoto(me: Member, photoId: unknown): Promise<string | null> {
  if (!isUuid(photoId)) return null;
  const rows = await select<{ id: string; members: { crew_id: string } | null }>(
    "photos",
    `id=eq.${photoId}&select=id,members(crew_id)&limit=1`
  );
  return rows[0]?.members?.crew_id === me.crew_id ? rows[0].id : null;
}

async function like(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");

  const photo = await visiblePhoto(me, body.photoId);
  if (!photo) return bad(404, "No such photo.");

  // Clear then set, so the same tap twice lands in the same place. A partial
  // unique index backs this up if two taps race each other.
  await remove("reactions", `photo_id=eq.${photo}&member_id=eq.${me.id}&kind=eq.like`);
  if (body.on !== false) {
    await insert("reactions", { photo_id: photo, member_id: me.id, kind: "like" }, false);
  }
  return NextResponse.json({ ok: true });
}

async function reply(device: string, body: Record<string, unknown>) {
  const me = await whoami(device);
  if (!me) return bad(403, "Not in a crew.");

  const photo = await visiblePhoto(me, body.photoId);
  if (!photo) return bad(404, "No such photo.");

  const text = cleanText(body.body);
  if (!text) return bad(400, "Nothing to say.");

  await insert("reactions", { photo_id: photo, member_id: me.id, kind: "reply", body: text }, false);
  return NextResponse.json({ ok: true });
}
