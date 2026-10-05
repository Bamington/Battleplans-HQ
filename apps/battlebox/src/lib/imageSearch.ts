/**
 * imageSearch.ts — Finding a photo for a new model or collection.
 *
 * Talks to the `image-search` Edge Function (Brave Image Search behind it), and
 * stages photos picked in the Add forms until the new row exists to attach
 * them to. Raw fetch rather than functions.invoke so error bodies and the
 * X-Image-Type header are readable.
 */

import { supabase } from '@battleplans/ui';

export interface WebImage {
  /** Brave's proxied thumbnail — safe to show directly. */
  thumbnail: string;
  /** The original image on its site. */
  image: string;
  title: string;
  /** The site it came from, e.g. "warhammer.com". */
  source: string;
  width: number | null;
  height: number | null;
}

/** A photo chosen in an Add form, waiting for the row to be created. */
export interface PendingPhoto {
  id: string;
  /** What to show in the tile: an object URL or the web thumbnail. */
  preview: string;
  source: { kind: 'file'; file: File } | { kind: 'web'; image: WebImage };
}

async function callFunction(body: unknown): Promise<Response> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${url}/functions/v1/image-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? anon}`,
      'apikey': anon,
    },
    body: JSON.stringify(body),
  });
}

/** Search the web for photos. `error` is a sentence fit to show the user. */
export async function searchWebImages(query: string): Promise<{ results: WebImage[]; error: string | null }> {
  try {
    const res = await callFunction({ action: 'search', query });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { results: [], error: res.status === 503 ? 'Photo search isn’t switched on yet.' : (body.error ?? 'Photo search failed. Please try again.') };
    }
    return { results: (body.results as WebImage[]) ?? [], error: null };
  } catch {
    return { results: [], error: 'Photo search failed. Check your connection and try again.' };
  }
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif',
};

/** Download a web image (through the function — CORS blocks doing it here). */
async function downloadWebImage(url: string): Promise<File | null> {
  try {
    const res = await callFunction({ action: 'fetch', url });
    if (!res.ok) return null;
    const type = res.headers.get('X-Image-Type') ?? 'image/jpeg';
    const blob = await res.blob();
    return new File([blob], `web-photo.${EXT[type] ?? 'jpg'}`, { type });
  } catch {
    return null;
  }
}

/**
 * Turn a staged photo into a File ready for the normal upload path. A web pick
 * tries the full-size original first; plenty of shops refuse hotlinked
 * downloads, so Brave's thumbnail is the fallback — smaller, but it always
 * answers.
 */
export async function pendingPhotoFile(photo: PendingPhoto): Promise<File | null> {
  if (photo.source.kind === 'file') return photo.source.file;
  return (await downloadWebImage(photo.source.image.image))
      ?? (await downloadWebImage(photo.source.image.thumbnail));
}

/**
 * Upload every staged photo against a just-created row, first one as the
 * cover. Returns how many could not be saved.
 */
export async function uploadPendingPhotos(
  photos: PendingPhoto[],
  upload: (file: File, isPrimary: boolean) => Promise<{ error: string | null }>,
): Promise<number> {
  let failed = 0;
  let cover = true;
  for (const photo of photos) {
    const file = await pendingPhotoFile(photo);
    const err = file ? (await upload(file, cover)).error : 'download failed';
    if (err) failed++; else cover = false;
  }
  return failed;
}

/** Free the object URLs behind uploaded-file previews. */
export function releasePendingPhotos(photos: PendingPhoto[]) {
  for (const p of photos) if (p.source.kind === 'file') URL.revokeObjectURL(p.preview);
}
