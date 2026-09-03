/**
 * Capture the canonical stills in redesign-screens/.
 *
 * Every frame is rendered by `/frames?shot=<n>` — the same components the
 * gallery shows, alone and filling a 390 × 844 viewport at 2× — so a still is
 * the app rather than a photograph of the app that quietly ages. Re-run it
 * after any visual change and the folder is current again.
 *
 *   npx next build && npx next start -p 3111
 *   node scripts/shoot.mjs [--only 01,10b] [--port 3111]
 *
 * Needs agent-browser (npm i -g agent-browser).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(
  process.env.HOME,
  "Desktop/Portfolio Documentation/habitabull redesign/redesign-screens"
);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const PORT = flag("port") ?? "3111";
const ONLY = flag("only")?.split(",").map((s) => s.trim());

/**
 * Frame id -> filename. The id is the `n` on the Frame in app/frames/page.tsx;
 * the name is what the folder has always called it, so numbering stays stable
 * for anything already linked in the docs.
 */
const SHOTS = [
  // [frame id, filename, scroll px]. A screen taller than 844 gets a second
  // still rather than going undocumented below the fold.
  ["00", "00-welcome"],
  ["02", "02-onboarding-why"],
  ["03", "03-week-setup"],
  ["01", "01-today"],
  ["01c", "01c-today-habit-learned"],
  ["01d", "01d-today-comeback"],
  ["01e", "01e-today-crew"],
  ["01f", "01f-today-reason-skipped"],
  ["01g", "01g-today-first-run"],
  ["04", "04-logging"],
  ["05", "05-rest-timer"],
  ["06", "06-pr-celebration"],
  ["09", "09-bull-coach"],
  ["16", "16-after-workout"],
  ["08", "08-progress"],
  ["11", "11-calendar"],
  ["17", "17-day-detail"],
  ["17b", "17b-day-detail-crew"],
  ["—", "07-goal"],
  ["18", "18-your-data"],
  ["14", "14-routine-editor"],
  ["14b", "14b-add-a-lift-ask", 1120],
  ["14c", "14c-build-the-week", 480],
  ["10", "10-crew"],
  ["10b", "10b-crew-joined"],
  ["10c", "10c-crew-join"],
  ["10d", "10d-crew-feed", 620],
  ["10e", "10e-post-opened"],
  ["11", "11a-calendar-photos", 620],
  ["08", "08a-progress-consistency", 560],
  ["14", "14a-routine-add-a-lift", 900],
  ["17b", "17b2-day-detail-crew-photos", 700],
];

/**
 * The two stills that are not phone screens: the app inside its drawn device
 * on a desktop, and the gallery itself. Both are shot from `next start` — the
 * old 19 was taken off a dev server and has the Next badge sitting in the
 * corner, which is exactly what HANDOFF warns about.
 */
const DESKTOP = [
  ["19-desktop-device-frame", "/", 1440, 900],
  ["20-frames-gallery", "/frames", 1600, 1100],
];

const sh = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const ab = (...a) => sh("agent-browser", a);

function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  try {
    sh("curl", ["-sf", "-o", "/dev/null", `http://localhost:${PORT}/frames`]);
  } catch {
    console.error(
      `Nothing serving on :${PORT}. Run \`npx next build && npx next start -p ${PORT}\` first.\n`
    );
    process.exit(2);
  }

  // 390 × 844 is the artboard; the 2 is the retina factor the existing stills
  // were shot at, so new files sit beside old ones at the same resolution.
  ab("set", "viewport", "390", "844", "2");

  const wanted = SHOTS.filter(([id]) => !ONLY || ONLY.includes(id));
  let ok = 0;
  const failed = [];

  for (const [id, name, scroll] of wanted) {
    const file = `${OUT}/${name}.png`;
    const q = `shot=${encodeURIComponent(id)}${scroll ? `&scroll=${scroll}` : ""}`;
    ab("open", `http://localhost:${PORT}/frames?${q}`);

    // The frame is client-rendered from the query string, so wait for it
    // rather than for a fixed delay that is either flaky or wasteful.
    let present = false;
    for (let i = 0; i < 40 && !present; i++) {
      present = ab("eval", `document.querySelector('[data-shot]')?.dataset.ready === 'yes'`)
        .includes("true");
      if (!present) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    if (!present) {
      failed.push(`${id} (never rendered — is there a Frame with n="${id}"?)`);
      continue;
    }

    ab("screenshot", file);
    const size = sh("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file])
      .match(/pixelWidth: (\d+)[\s\S]*pixelHeight: (\d+)/);
    const dims = size ? `${size[1]}×${size[2]}` : "?";
    if (dims !== "780×1688") failed.push(`${name} came out ${dims}, expected 780×1688`);
    console.log(`  ${dims === "780×1688" ? "✓" : "!"} ${name}.png  ${dims}`);
    ok++;
  }

  if (!ONLY) {
    for (const [name, path, w, h] of DESKTOP) {
      ab("set", "viewport", String(w), String(h), "2");
      ab("open", `http://localhost:${PORT}${path}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
      const file = `${OUT}/${name}.png`;
      ab("screenshot", file);
      const m = sh("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]).match(
        /pixelWidth: (\d+)[\s\S]*pixelHeight: (\d+)/
      );
      console.log(`  ✓ ${name}.png  ${m ? `${m[1]}×${m[2]}` : "?"}`);
      ok++;
    }
  }

  const total = wanted.length + (ONLY ? 0 : DESKTOP.length);
  console.log(`\n${ok}/${total} captured into redesign-screens/`);
  if (failed.length) {
    console.log("\nProblems:");
    failed.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }

  const stale = readdirSync(OUT)
    .filter((n) => n.endsWith(".png"))
    .filter((n) => !SHOTS.some(([, name]) => `${name}.png` === n))
    .filter((n) => !DESKTOP.some(([name]) => `${name}.png` === n));
  if (stale.length) {
    console.log(
      "\nNot captured by this script, so possibly stale:\n" +
        stale.map((n) => "  - " + n).join("\n")
    );
  }
}

main();
