import { useEffect, useState } from "react";
import { photoUrl } from "./photos";

/**
 * One stored photo as something an <img> can show, for as long as the caller
 * is mounted.
 *
 * Every photo on screen used to carry its own copy of this: the calendar's
 * thumbnail, its lightbox and the day screen's shot each read the blob, made
 * an object URL and revoked it, the same fifteen lines three times. The
 * progress photos page would have been a fourth.
 *
 * Two things it has to get right, and the copies only got the first:
 *
 * - The read is async, so it can land after the caller has gone. That URL is
 *   revoked on arrival rather than leaked for the life of the tab.
 * - The id can change in place (the day screen swaps its big photo when a
 *   small one is tapped). The old URL is revoked in the cleanup, so handing it
 *   back while the new one loads would point the <img> at a dead blob. The URL
 *   is held together with the id it was made for, and only ever returned for
 *   that id.
 *
 * A null id reads nothing and returns null, which is how a /frames fixture
 * that already has a URL of its own opts out.
 */
export function usePhotoUrl(id: string | null): string | null {
  const [held, setHeld] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    let made: string | null = null;
    photoUrl(id).then((u) => {
      if (!live) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      made = u;
      if (u) setHeld({ id, url: u });
    });
    return () => {
      live = false;
      if (made) {
        URL.revokeObjectURL(made);
        // Forget it too, so going A, B, A quickly cannot return A's dead URL
        // while A is being read again.
        const gone = made;
        setHeld((h) => (h && h.url === gone ? null : h));
      }
    };
  }, [id]);

  return held && held.id === id ? held.url : null;
}
