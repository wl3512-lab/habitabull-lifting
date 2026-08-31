"use client";

import { useRef, useState } from "react";
import { Pill } from "./ui";
import { backupFilename, buildBackup, parseBackup } from "@/lib/backup";
import { exportPhotos, importPhotos } from "@/lib/photos";
import type { AppState } from "@/lib/types";

/**
 * Getting your training out of the browser, and back into one.
 *
 * Everything the app knows sits in a single browser: localStorage for the log,
 * IndexedDB for the photos. Clearing site data, changing phone, or letting iOS
 * evict an uninstalled site takes months of history with it and there is nobody
 * to ask for it back. For a product whose whole argument is "come back in week
 * three", losing weeks one and two is the worst thing it can do.
 *
 * Import replaces rather than merges, and says so before it runs. Merging two
 * training histories sounds helpful and produces a log neither of them agrees
 * with — better to be blunt about what the button does.
 */
export default function YourData({
  state,
  onImport,
}: {
  state: AppState;
  onImport: (next: AppState) => void;
}) {
  const [busy, setBusy] = useState<"idle" | "exporting" | "importing">("idle");
  const [said, setSaid] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sessions = state.sessions.filter((s) => s.completedAt).length;

  async function save() {
    setBusy("exporting");
    setSaid(null);
    try {
      const photos = await exportPhotos();
      const blob = new Blob([JSON.stringify(buildBackup(state, photos))], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFilename();
      a.click();
      URL.revokeObjectURL(url);
      const mb = (blob.size / 1_048_576).toFixed(1);
      setSaid(`Saved ${sessions} ${sessions === 1 ? "session" : "sessions"} and ${photos.length} ${photos.length === 1 ? "photo" : "photos"} · ${mb} MB`);
    } catch {
      setSaid("Could not build the file.");
    } finally {
      setBusy("idle");
    }
  }

  async function load(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("importing");
    setSaid(null);
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!parsed) {
        setSaid("That is not a HabitaBull backup.");
        return;
      }
      const n = await importPhotos(parsed.photos);
      onImport(parsed.state);
      const done = parsed.state.sessions.filter((s) => s.completedAt).length;
      setSaid(`Restored ${done} ${done === 1 ? "session" : "sessions"} and ${n} ${n === 1 ? "photo" : "photos"}.`);
    } catch {
      setSaid("That file could not be read.");
    } finally {
      setBusy("idle");
      setConfirming(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-[18px]">
      <p className="label text-dim">Your data</p>
      <p className="mt-2 text-[15px] text-dim">
        All of this lives in this browser and nowhere else. One file holds every session,
        note and photo.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={load}
        aria-hidden
        tabIndex={-1}
      />

      <div className="mt-3 flex flex-col gap-2.5">
        <Pill variant="ghost" onClick={save} disabled={busy !== "idle"}>
          {busy === "exporting" ? "Packing it up…" : "Save a copy"}
        </Pill>

        {confirming ? (
          <div className="rounded-xl border border-line-strong p-3.5">
            <p className="text-[15px] text-fg">
              Restoring replaces everything here with the file&apos;s contents. Your
              current {sessions} {sessions === 1 ? "session" : "sessions"} would be gone.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Pill
                size="sm"
                className="h-12 flex-1"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== "idle"}
              >
                {busy === "importing" ? "Restoring…" : "Choose a file"}
              </Pill>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="head h-12 shrink-0 px-4 text-[15px] text-dim transition-colors hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <Pill variant="ghost" onClick={() => setConfirming(true)} disabled={busy !== "idle"}>
            Restore from a file
          </Pill>
        )}
      </div>

      {said && <p className="mt-2.5 text-[15px] text-dim">{said}</p>}
    </section>
  );
}
