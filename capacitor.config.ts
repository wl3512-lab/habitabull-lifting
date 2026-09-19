import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell.
 *
 * This app cannot be a static bundle. `app/api/generate`, `app/api/crew` and
 * `app/api/version` run on the server, and there is no `output: "export"` in
 * next.config.ts, so there is nothing to copy into the app. The shell loads
 * production instead, which also means a web deploy reaches the native app
 * without going near App Store Connect.
 *
 * The cost of that choice is Guideline 4.2: a WKWebView pointed at a website
 * is the thing review rejects as "not an app". It does not bite on internal
 * TestFlight, which has no review at all, so this config is enough to get a
 * build onto a phone. It has to be answered before external TestFlight or
 * public release, and the answer is native capability the web cannot have —
 * push notifications for the person who vanishes for three weeks is the one
 * this product actually needs.
 *
 * `webDir` is required by the CLI even when `server.url` makes it unused.
 */
const config: CapacitorConfig = {
  appId: "xyz.lucyliu.habitabull",
  appName: "HabitaBull",
  webDir: "public",
  server: {
    url: "https://habitabull.vercel.app",
    cleartext: false,
  },
  ios: {
    // The app is portrait-only and dark. Matching the manifest's ground colour
    // stops a white flash between the launch screen and the first paint.
    backgroundColor: "#16181d",
    contentInset: "always",
  },
};

export default config;
