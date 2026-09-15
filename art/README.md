# Source art

Provenance, not assets. Nothing here is fetched by the app.

These lived in `public/` until they didn't need to: `public/` is the deployed
web root, so every one of them was publicly downloadable and shipped on every
deploy while no screen ever asked for it. Roughly a megabyte of it. Kept in
git because where the drawing came from is worth keeping; kept out of `public/`
because a source file is not an asset.

- `mascot-source-2026.jpeg` — the untouched 2026 bull, as delivered. The
  transparency checkerboard is painted into the pixels, which is why the
  background had to be cut with a flood fill from the canvas edges rather than
  a brightness threshold: the horns sit at lightness 0.75 and the checkerboard
  at 0.79, so any threshold that caught the background also ate the horns.
- `mascot-source.png` — the 2023 source it replaced.
- `mascot-2023.png` — the previous bull as shipped, the open grin rather than
  the closed smile.

The cut-out the app actually uses is `public/mascot.png`.
