/**
 * End-to-end check against a real Supabase project.
 *
 * The route tests prove the handler's logic with a fake database. They cannot
 * prove the half that only Postgres can answer: whether the embedded selects
 * resolve, whether the storage bucket exists, whether a signed URL actually
 * serves bytes. That is what this does, by driving two pretend phones through
 * the whole feature and then putting everything back.
 *
 *   npm run dev                 # in one terminal
 *   node scripts/smoke-crew.mjs # in another
 *
 * It creates a throwaway crew, uses it, and deletes it. Nothing it makes
 * survives a successful run.
 */

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

// Two devices, shaped exactly as deviceId() writes them.
const A = "a".repeat(31) + "1";
const B = "b".repeat(31) + "2";

const today = new Date().toISOString().slice(0, 10);

// A 1x1 PNG. Small enough to be honest about what is being tested.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`${mark} ${name}${detail && !ok ? `\n    ${detail}` : ""}`);
}

async function call(device, action, body = {}) {
  const res = await fetch(`${BASE}/api/crew/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, device }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nHabitaBull crew · smoke test against ${BASE}\n`);

  // ── reachable and configured ───────────────────────────────────────────────
  const ping = await call(A, "members");
  if (ping.status === 503) {
    console.error(
      "The server says no crew backend is configured.\n" +
        "Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local, then restart `npm run dev`.\n"
    );
    process.exit(2);
  }
  if (ping.status !== 200) {
    console.error(`Unexpected ${ping.status} from /api/crew/members:`, ping.json, "\n");
    process.exit(2);
  }
  check("the server answers and is configured", true);

  // ── membership ─────────────────────────────────────────────────────────────
  const made = await call(A, "create", { name: "Smoke A" });
  const code = made.json?.code;
  check("A can create a crew and gets a code back", Boolean(code), JSON.stringify(made.json));
  if (!code) return;

  const joined = await call(B, "join", { code, name: "Smoke B" });
  check("B can join with that code", joined.status === 200, JSON.stringify(joined.json));

  const roster = await call(A, "members");
  const names = (roster.json?.members ?? []).map((m) => m.name).sort();
  check(
    "the roster embeds both members (members → checkins)",
    names.join(",") === "Smoke A,Smoke B",
    `got ${JSON.stringify(names)}`
  );

  // ── presence ───────────────────────────────────────────────────────────────
  await call(A, "checkin", { days: [today] });
  await call(B, "checkin", { days: [today] });
  const afterCheckin = await call(A, "members");
  const aDays = afterCheckin.json?.members?.find((m) => m.name === "Smoke A")?.days ?? [];
  check("a check-in is stored and read back", aDays.includes(today), JSON.stringify(aDays));

  // Twice, to prove the upsert really is idempotent rather than erroring.
  const again = await call(A, "checkin", { days: [today] });
  check("checking in twice on one day is not an error", again.status === 200, JSON.stringify(again.json));

  // ── sharing ────────────────────────────────────────────────────────────────
  const shared = await call(A, "share", {
    day: today,
    dataUrl: PNG,
    caption: "Smoke test. Delete me.",
  });
  check("A can upload a photo to the bucket", shared.status === 200, JSON.stringify(shared.json));
  const photoId = shared.json?.id;

  const bDay = await call(B, "day", { day: today });
  const seen = bDay.json?.photos?.[0];
  check(
    "B sees A's photo on that day (photos → members, photos → reactions)",
    Boolean(seen),
    JSON.stringify(bDay.json)
  );
  check("the caption survives the round trip", seen?.caption === "Smoke test. Delete me.");
  check("B is told whose photo it is", seen?.memberName === "Smoke A", seen?.memberName);
  check("B is correctly told it is not theirs", seen?.mine === false);
  check(
    "B sees who trained that day, and no numbers",
    (bDay.json?.trained ?? []).length === 2 && !/weight|reps/i.test(JSON.stringify(bDay.json.trained))
  );

  // The part no unit test can fake: a signed URL that actually serves bytes.
  if (seen?.url) {
    const img = await fetch(seen.url);
    const type = img.headers.get("content-type") ?? "";
    check(
      "the signed URL really serves the image",
      img.ok && type.startsWith("image/"),
      `${img.status} ${type}`
    );
  } else {
    check("the signed URL really serves the image", false, "no url on the photo");
  }

  // ── reactions ──────────────────────────────────────────────────────────────
  await call(B, "like", { photoId, on: true });
  await call(B, "reply", { photoId, body: "Smoke reply" });

  const aDay = await call(A, "day", { day: today });
  const mine = aDay.json?.photos?.[0];
  check("A sees the like", mine?.likes === 1, `likes=${mine?.likes}`);
  check("A knows they did not like it themselves", mine?.likedByMe === false);
  check(
    "A sees the reply, attributed (reactions → members)",
    mine?.replies?.[0]?.body === "Smoke reply" && mine?.replies?.[0]?.memberName === "Smoke B",
    JSON.stringify(mine?.replies)
  );
  check("A is correctly told the photo is theirs", mine?.mine === true);

  // Liking twice must not double-count — the partial unique index and the
  // clear-then-set in the handler have to agree.
  await call(B, "like", { photoId, on: true });
  const twice = await call(A, "day", { day: today });
  check("liking twice still counts once", twice.json?.photos?.[0]?.likes === 1);

  await call(B, "like", { photoId, on: false });
  const unliked = await call(A, "day", { day: today });
  check("taking the like back works", unliked.json?.photos?.[0]?.likes === 0);

  // ── the refusals ───────────────────────────────────────────────────────────
  const stranger = "c".repeat(31) + "3";
  const outsider = await call(stranger, "day", { day: today });
  check(
    "someone in no crew sees nothing",
    outsider.status === 200 && outsider.json?.photos?.length === 0,
    JSON.stringify(outsider.json)
  );

  const theft = await call(B, "unshare", { photoId });
  check("B cannot unshare A's photo", theft.status === 404, `${theft.status}`);

  const stillThere = await call(A, "day", { day: today });
  check("and A's photo is still there afterwards", stillThere.json?.photos?.length === 1);

  const badImage = await call(A, "share", { day: today, dataUrl: "javascript:alert(1)" });
  check("a non-image is refused", badImage.status === 400);

  // ── cleanup ────────────────────────────────────────────────────────────────
  const gone = await call(A, "unshare", { photoId });
  check("A can unshare their own photo", gone.status === 200);

  await call(B, "leave");
  await call(A, "leave");
  const after = await call(A, "members");
  check("leaving empties the crew", (after.json?.members ?? []).length === 0);

  console.log(
    `\n${failures === 0 ? "\x1b[32mAll good.\x1b[0m" : `\x1b[31m${failures} failed.\x1b[0m`} ` +
      `${results.length - failures}/${results.length} checks passed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nThe smoke test itself fell over:\n", err, "\n");
  process.exit(2);
});
