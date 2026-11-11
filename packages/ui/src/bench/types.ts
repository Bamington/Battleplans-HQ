/**
 * bench/types.ts — BattleBench's display shapes and image helpers, shared so
 * any app can show a model read-only (a profile's Painting Bench and
 * Favourites, a share link). BattleBench's useCollection re-exports these.
 */

import { supabase } from '../lib/supabase';

export type ModelStatus = 'None' | 'Assembled' | 'Primed' | 'Partially Painted' | 'Painted';

/** The progress stages a model passes through on the desk, in order. */
export const DESK_STEPS: ModelStatus[] = ['None', 'Assembled', 'Primed', 'Partially Painted'];

export interface CollectionGame {
  name: string;
  slug: string;
}

export interface CollectionModel {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  /** The model's photos as URLs (primary first) — auto-rotated in a carousel. */
  images: string[];
  game: CollectionGame | null;
  /** Name of the first box/collection this model belongs to, if any. */
  boxName: string | null;
  /** On the Painting Desk right now. */
  onDesk: boolean;
  /** "Started Painting" (YYYY-MM-DD) — set when it went on the desk. */
  startedPaintingDate: string | null;
  /**
   * Set when it's a friend's model credited to the viewer (read-only here):
   * whose it is, and whether the viewer painted it for them or they painted
   * it for the viewer. Absent on your own models.
   */
  shared?: { ownerId: string; direction: 'painted_by_viewer' | 'painted_for_viewer'; ownerName?: string | null } | null;
}

export interface CollectionBox {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  includesString: string | null;
  game: CollectionGame | null;
  /** How many models are linked to this box. */
  modelCount: number;
  /** True when the collection has models and every one of them is painted. */
  allPainted: boolean;
  /** True when the collection has models and every one is unpainted ('None'). */
  allUnpainted: boolean;
  /** True when any member has a status other than unpainted. */
  anyProgress: boolean;
  /**
   * Carousel images: the box's own cover photos, then one photo per member
   * model, de-duplicated. Mirrors the old app's collection carousel.
   */
  images: string[];
}

export interface PaintRef {
  /** The hobby_items id — for unlinking a direct paint from the model. */
  hobbyItemId: number;
  name: string;
  brand: string;
  type: string;            // 'Paint' | 'Spray'
  swatch: string | null;
  /** Where/how it was used (a model_hobby_items.section note). */
  note: string | null;
  /** The hobby_item's owner — the paint is editable only if this is you. */
  ownerId: string | null;
}

/** A recipe applied to a model: a named, ordered group of paints. */
export interface ModelRecipeGroup {
  /** The recipes id — for unlinking the recipe from the model. */
  id: string;
  name: string;
  description: string | null;
  paints: PaintRef[];
  /** The recipe's photos as URLs, cover first. */
  images: string[];
}

// ── Images ────────────────────────────────────────────────────────────────────

/**
 * Build a public URL for a stored model image. Image locations are kept as
 * bucket object paths ('{user_id}/{file}') rather than full URLs, so the host
 * is resolved here at read time and a future project move needs no data change.
 */
export function modelImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
}

export interface ModelImageRow {
  image_path: string | null;
  is_primary: boolean;
  display_order: number;
  /** Painting Desk work-in-progress photo — shown only while the model has no
   *  finished photo. (Recipe photos share this shape and don't have it.) */
  is_progress?: boolean;
  /** Orders progress photos, newest first. */
  created_at?: string | null;
}

/**
 * A model's photos as URLs — what every cover and carousel shows. In order of
 * preference:
 *   1. its finished photos, primary first then by display order;
 *   2. else its legacy image_path (from the old app);
 *   3. else its Painting Desk progress photos, most recent first.
 * So progress photos are shown exactly like any other photo, but only until
 * the model has a finished one — after that they're hidden (still kept, and
 * listed in the Edit form).
 */
export function modelCarouselImages(rows: ModelImageRow[] | null, fallbackPath: string | null): string[] {
  const urls = (list: ModelImageRow[]) => list
    .map(r => modelImageUrl(r.image_path))
    .filter((u): u is string => !!u);

  const finished = urls((rows ?? [])
    .filter(r => !r.is_progress)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order));
  if (finished.length) return finished;

  const legacy = modelImageUrl(fallbackPath);
  if (legacy) return [legacy];

  return urls((rows ?? [])
    .filter(r => r.is_progress)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')));
}
