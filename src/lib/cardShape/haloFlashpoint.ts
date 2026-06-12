/**
 * haloFlashpoint.ts — DB rows → HaloFlashpointCardProps
 *
 * Pure transformation that takes the join-graph for a single Halo Flashpoint
 * card row (the card + its card_addons → addons → addon_keywords → keywords
 * and its card_keywords → keywords) and returns props ready to spread into
 * <HaloFlashpointCard />.
 *
 * Used today by the pack editor preview. The same transformation lives
 * inline inside CardBuilderHaloFlashpoint at load time (it has additional
 * concerns — editing state, token state, portrait URL resolution — so the
 * builder hasn't been migrated to call this helper yet). When the builder
 * is next touched, the load-time mapping can be redirected through here.
 *
 * The select string this helper assumes:
 *   .select(`
 *     id, name, stats, portrait_style,
 *     card_addons(addon_id, sort_order, addons(name, stats,
 *       addon_keywords(keyword_id, params, sort_order,
 *         keywords(name, description, params_schema)))),
 *     card_keywords(keyword_id, params, sort_order,
 *       keywords(name, description, params_schema))
 *   `)
 *
 * Callers who also want the portrait image rendered should pass in a
 * pre-resolved public URL via `portraitUrl` — this helper doesn't reach
 * out to Supabase Storage itself.
 */

import type { HaloFlashpointCardProps } from '../../components/HaloFlashpointCard';
import type { HaloFlashpointRuleCardProps } from '../../components/HaloFlashpointRuleCard';
import type { HaloFlashpointStats } from '../database.types';
import { formatKeywordLabel } from './util';

// ── Loose row types matching the select string above ────────────────────────
// Supabase TS narrowing of nested selects is brittle; we keep these
// hand-rolled and cast through unknown at call sites.

interface JoinedKeyword {
  name:        string;
  description: string | null;
  params_schema: unknown;
}

interface CardKeywordRow {
  keyword_id: string;
  params:     Record<string, unknown> | null;
  sort_order: number | null;
  keywords:   JoinedKeyword | null;
}

interface CardAddonRow {
  addon_id:   string;
  sort_order: number | null;
  addons: {
    name:  string;
    stats: Record<string, unknown>;
    addon_keywords: CardKeywordRow[];
  } | null;
}

export interface HaloCardDbRow {
  name:           string;
  stats:          HaloFlashpointStats | Record<string, unknown> | null;
  portrait_style?: string | null;
  card_addons?:    CardAddonRow[];
  card_keywords?:  CardKeywordRow[];
}

/** Build the comma-joined keyword label used in the card's "keywords"
 *  field and inside each weapon row. Keywords with a numeric param (X)
 *  render as `Name (X)`; otherwise just `Name`. */
function joinKeywordLabels(rows: CardKeywordRow[]): string {
  return rows
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => formatKeywordLabel(r.keywords!.name, r.params?.X))
    .join(', ');
}

// ── Helper ──────────────────────────────────────────────────────────────────

export function dbRowsToHaloFlashpointProps(
  row: HaloCardDbRow,
  options: { portraitUrl?: string | null } = {},
): HaloFlashpointCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;

  // The "keywords" prop on the card is a flat text string. Prefer the
  // composed list from the card_keywords join; fall back to whatever was
  // hand-typed into stats.keywords (the legacy plain-text field).
  const cardKws = row.card_keywords ?? [];
  const composedKeywords = joinKeywordLabels(cardKws);
  const keywords = composedKeywords || String(s.keywords ?? '');

  // Weapons come from card_addons → addons. Sort by card_addons.sort_order,
  // map each addon's stats into the HaloWeapon shape, and inline its
  // own composed keyword list.
  const sortedAddons = [...(row.card_addons ?? [])]
    .filter(ca => ca.addons != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const weapons = sortedAddons.map(ca => {
    const ws = ca.addons!.stats as Record<string, unknown>;
    const weaponKwText = joinKeywordLabels(ca.addons!.addon_keywords ?? []);
    return {
      type:     String(ws.type     ?? ''),
      name:     ca.addons!.name,
      range:    String(ws.range    ?? ''),
      ap:       String(ws.ap       ?? ''),
      keywords: weaponKwText || String(ws.keywords ?? ''),
    };
  });

  return {
    unitName:     row.name || 'Unit Name',
    keywords,
    ra:           Number(s.ra ?? 0),
    fi:           Number(s.fi ?? 0),
    sv:           Number(s.sv ?? 0),
    advanceValue: Number(s.advanceValue ?? 0),
    sprintValue:  Number(s.sprintValue  ?? 0),
    ar:           Number(s.ar ?? 0),
    hp:           Number(s.hp ?? 0),
    weapons,
    portrait:      options.portraitUrl ?? undefined,
    portraitStyle: row.portrait_style ?? undefined,
  };
}

// ── Rule card shaper ─────────────────────────────────────────────────────────

export function dbRowsToHaloFlashpointRuleProps(row: HaloCardDbRow): HaloFlashpointRuleCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;
  return {
    title:       row.name || undefined,
    description: String(s.description ?? ''),
  };
}
