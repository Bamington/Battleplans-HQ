/**
 * util.ts — Cross-game primitives shared by per-game card shapers
 *
 * These helpers do small mechanical bits that come up in every game's
 * shaper AND every game's card builder load mapping. Keeping them in
 * one place lets both contexts use the same convention without each
 * file having its own copy.
 */

/** Filter null `keywords` rows and sort by `sort_order` (nulls treated
 *  as 0). Used everywhere we walk a *_keywords join with optional
 *  per-instance ordering. The generic constraint is intentionally loose
 *  so the caller can pass either card_keywords or addon_keywords rows. */
export function sortJoinRows<
  T extends { sort_order: number | null; keywords?: unknown }
>(rows: T[] | null | undefined): T[] {
  return (rows ?? [])
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** Render a keyword for display as either `"Name"` or `"Name (X)"`.
 *  `paramX` is the per-instance value (typically `params.X` from a
 *  card_keywords / addon_keywords row); pass `null` / `undefined`
 *  when the keyword has no value. */
export function formatKeywordLabel(name: string, paramX: unknown): string {
  return paramX != null ? `${name} (${paramX})` : name;
}

/** Pull the slug string out of a Supabase nested addon_type join. The
 *  join arrives as either a single object or a one-element array
 *  depending on schema introspection; normalise to a string. Returns
 *  `""` when the addon or its addon_type is absent. */
export function addonSlug(
  addon: { addon_type?: { slug: string } | { slug: string }[] | null } | null | undefined,
): string {
  if (!addon?.addon_type) return '';
  const at = addon.addon_type;
  return Array.isArray(at) ? (at[0]?.slug ?? '') : at.slug;
}
