import type { MetadataRoute } from "next";

/**
 * This app is installed, not visited.
 *
 * Two reasons, and the second is the one that matters. In a browser tab the
 * chrome eats the bottom of the screen, which is exactly where every primary
 * action in the app sits — the whole "the thumb finds it in the same place on
 * every screen" rule is fighting the address bar.
 *
 * More seriously: iOS caps script-writable storage at seven days of no
 * interaction for sites that have not been added to the home screen, and
 * localStorage is the app's only persistence. The user who vanishes for three
 * weeks is the user this entire product was designed for, and unless the app is
 * installed the platform will have erased their streak, their history and the
 * grid before they come back. Installing exempts it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HabitaBull Lifting",
    short_name: "HabitaBull",
    description: "A gym companion for when you keep losing the habit by week three.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16181d",
    theme_color: "#16181d",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops to whatever shape the launcher wants, so this one keeps
      // the bull inside the 40% safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
