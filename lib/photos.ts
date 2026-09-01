/**
 * Progress photos.
 *
 * Cathy, the Organizer archetype (deck p21), names taking progress pictures as
 * the thing she wants and the thing her apps don't do well. The 2023 flow put
 * them on the calendar (p27, p36) and the Miro stickies went further: "compare
 * pictures after each month" — comparison, not a gallery, was the part that
 * never got built.
 *
 * These live in IndexedDB, not localStorage. localStorage is a ~5MB string
 * store and a single phone photo blows it; putting images there would take the
 * whole app's history down with it. Each photo is downscaled before it is
 * stored, because a 12MP original is four megabytes of detail nobody will ever
 * look at at 96px wide.
 *
 * Everything degrades to "no photos" rather than throwing: private-mode Safari
 * and blocked site data both make IndexedDB unavailable, and losing photos is
 * bad while blocking a workout log is worse.
 */

const DB = "habitabull.photos";
const STORE = "photos";
const VERSION = 1;

/** Longest edge, in px. Enough to look at full-screen, small enough to keep. */
const MAX_EDGE = 1400;
const QUALITY = 0.82;

export interface PhotoMeta {
  id: string;
  /** ISO date the photo belongs to, YYYY-MM-DD. */
  date: string;
  addedAt: string;
  bytes: number;
}

interface PhotoRecord extends PhotoMeta {
  blob: Blob;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("date", "date");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T | null>(async (resolve) => {
    const db = await open();
    if (!db) return resolve(null);
    try {
      const store = db.transaction(STORE, mode).objectStore(STORE);
      const req = run(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Downscale to something worth keeping. Returns the original untouched if the
 * browser can't decode it — an unshrunk photo beats a lost one.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) {
      bitmap.close();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", QUALITY)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function addPhoto(date: string, file: File): Promise<PhotoMeta | null> {
  const blob = await shrink(file);
  const record: PhotoRecord = {
    id: `${date}-${Date.now().toString(36)}`,
    date,
    addedAt: new Date().toISOString(),
    bytes: blob.size,
    blob,
  };
  const ok = await tx("readwrite", (s) => s.put(record) as IDBRequest<IDBValidKey>);
  if (ok === null) return null;
  const { blob: _blob, ...meta } = record;
  void _blob;
  return meta;
}

export async function listPhotos(): Promise<PhotoMeta[]> {
  const all = await tx<PhotoRecord[]>("readonly", (s) => s.getAll() as IDBRequest<PhotoRecord[]>);
  if (!all) return [];
  return all
    .map(({ blob: _b, ...meta }) => {
      void _b;
      return meta;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.addedAt.localeCompare(a.addedAt));
}

/** An object URL for one photo. Callers must revokeObjectURL when done. */
export async function photoUrl(id: string): Promise<string | null> {
  const rec = await tx<PhotoRecord>("readonly", (s) => s.get(id) as IDBRequest<PhotoRecord>);
  return rec?.blob ? URL.createObjectURL(rec.blob) : null;
}

export async function deletePhoto(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
}

/** Blob → data URL, so a backup is one self-contained file. */
function toDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

/** One photo as a data URL, for sharing it with a crew. */
export async function photoData(id: string): Promise<string | null> {
  const rec = await tx<PhotoRecord>("readonly", (s) => s.get(id) as IDBRequest<PhotoRecord>);
  return rec?.blob ? toDataUrl(rec.blob) : null;
}

/** Every photo, inlined. Anything unreadable is skipped rather than failing the export. */
export async function exportPhotos(): Promise<
  { id: string; date: string; addedAt: string; data: string }[]
> {
  const all = await tx<PhotoRecord[]>("readonly", (s) => s.getAll() as IDBRequest<PhotoRecord[]>);
  if (!all) return [];
  const out = [];
  for (const rec of all) {
    const data = rec.blob ? await toDataUrl(rec.blob) : null;
    if (data) out.push({ id: rec.id, date: rec.date, addedAt: rec.addedAt, data });
  }
  return out;
}

/**
 * Restore photos from a backup. Existing ids are overwritten, which makes an
 * import idempotent — running the same file twice leaves one copy, not two.
 */
export async function importPhotos(
  photos: { id: string; date: string; addedAt: string; data: string }[]
): Promise<number> {
  let n = 0;
  for (const p of photos) {
    try {
      const blob = await (await fetch(p.data)).blob();
      const ok = await tx("readwrite", (s) =>
        s.put({ id: p.id, date: p.date, addedAt: p.addedAt, bytes: blob.size, blob }) as IDBRequest<IDBValidKey>
      );
      if (ok !== null) n++;
    } catch {
      // One bad photo should not cost someone the rest of their history.
    }
  }
  return n;
}
