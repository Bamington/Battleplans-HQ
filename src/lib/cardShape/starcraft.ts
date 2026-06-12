/**
 * starcraft.ts — DB rows → StarcraftCardProps
 *
 * StarCraft has two addon types (slug 'weapons' and slug 'rules' — yes,
 * the rules slug here means abilities, not the rule_types feature). It
 * supports parent_addon_id on addons so children render under their
 * parent. Keyword params are free-text strings (the param key is
 * `value`, not `X`).
 *
 * Assumed select shape (the unified PackEditor select):
 *   .select(`
 *     id, name, stats, portrait_style,
 *     card_addons(addon_id, sort_order, addons(name, description, stats,
 *       parent_addon_id, addon_type:addon_types(slug),
 *       addon_keywords(keyword_id, params, sort_order,
 *         keywords(name, description, params_schema)))),
 *     card_keywords(keyword_id, params, sort_order,
 *       keywords(name, description, params_schema))
 *   `)
 *
 * Mirrors the rowsToWeapons / rowsToAbilities / rowToKeywords trio
 * at CardBuilderStarcraft.tsx ~219-273.
 */

import type {
  StarcraftCardProps,
  StarcraftWeapon,
  StarcraftAbility,
  StarcraftKeywordAttachment,
  StarcraftPhase,
  StarcraftTiming,
} from '../../components/StarcraftCard';
import type {
  StarcraftStats,
  StarcraftWeaponStats,
  StarcraftRuleStats,
  StarcraftSupplyTier,
} from '../database.types';
import { addonSlug } from './util';

// ── Loose row types ─────────────────────────────────────────────────────────

interface JoinedKeyword {
  id:          string;
  name:        string;
  description: string | null;
  params_schema: unknown;
}

interface AddonKeywordRow {
  params:     Record<string, unknown> | null;
  sort_order: number | null;
  keywords:   JoinedKeyword | null;
}

interface CardAddonRow {
  addon_id?:  string;
  sort_order: number | null;
  addons: {
    id:               string;
    name:             string;
    description:      string | null;
    stats:            Record<string, unknown>;
    parent_addon_id?: string | null;
    addon_type:       { slug: string } | { slug: string }[] | null;
    addon_keywords:   AddonKeywordRow[];
  } | null;
}

export interface StarcraftCardDbRow {
  name:           string;
  stats:          StarcraftStats | Record<string, unknown> | null;
  portrait_style?: string | null;
  card_addons?:    CardAddonRow[];
  /** Not currently used by StarcraftCard but present in the unified select. */
  card_keywords?:  unknown[];
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Convert an addon's addon_keywords join into StarCraft's
 *  keyword-attachment shape. Exported for reuse from
 *  CardBuilderStarcraft, which builds the same array at load time.
 *
 *  Signature only requires `addon_keywords` — the function doesn't
 *  read any other field of the addon, so callers can pass their own
 *  stricter row shapes without coupling to CardAddonRow. */
export function rowToKeywords(
  addon: { addon_keywords?: AddonKeywordRow[] | null } | null | undefined,
): StarcraftKeywordAttachment[] {
  return (addon?.addon_keywords ?? [])
    .filter(ak => ak.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(ak => ({
      keywordId:   ak.keywords!.id,
      name:        ak.keywords!.name,
      description: ak.keywords!.description ?? '',
      hasValue:    Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
      value:       typeof ak.params?.value === 'string' ? (ak.params!.value as string) : null,
    }));
}

function rowsToWeapons(rows: CardAddonRow[]): StarcraftWeapon[] {
  return rows
    .filter(r => r.addons != null && addonSlug(r.addons) === 'weapons')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => {
      const a = r.addons!;
      const ws = (a.stats ?? {}) as StarcraftWeaponStats;
      return {
        id:        a.id,
        name:      a.name,
        phase:     (ws.phase  ?? null) as StarcraftPhase  | null,
        timing:    (ws.timing ?? null) as StarcraftTiming | null,
        range:     ws.range,
        roa:       ws.roa,
        hit:       ws.hit,
        dmg:       ws.dmg,
        surgeType: ws.surgeType,
        sDice:     ws.sDice,
        keywords:  rowToKeywords(a),
        parentId:  a.parent_addon_id ?? null,
      };
    });
}

function rowsToAbilities(rows: CardAddonRow[]): StarcraftAbility[] {
  return rows
    .filter(r => r.addons != null && addonSlug(r.addons) === 'rules')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => {
      const a = r.addons!;
      const ws = (a.stats ?? {}) as StarcraftRuleStats;
      return {
        id:          a.id,
        name:        a.name,
        phase:       (ws.phase  ?? null) as StarcraftPhase  | null,
        timing:      (ws.timing ?? null) as StarcraftTiming | null,
        cpCost:      ws.cpCost ?? null,
        description: typeof ws.description === 'string' ? ws.description : '',
        keywords:    rowToKeywords(a),
        isUpgrade:   ws.isUpgrade ?? false,
        upgradeCost: ws.upgradeCost ?? null,
      };
    });
}

// ── Helper ──────────────────────────────────────────────────────────────────

export function dbRowsToStarcraftProps(
  row: StarcraftCardDbRow,
): StarcraftCardProps {
  const s = (row.stats ?? {}) as StarcraftStats;
  const addons = row.card_addons ?? [];

  return {
    // cards.name (the required column) holds the Unit Type. The optional
    // hero-style Unit Name lives in stats.unitName.
    unitType:    row.name,
    unitName:    typeof s.unitName === 'string' ? s.unitName : '',
    speed:       typeof s.speed      === 'number' ? s.speed      : 0,
    evade:       typeof s.evade      === 'number' ? s.evade      : 0,
    armour:      typeof s.armour     === 'number' ? s.armour     : 0,
    hitPoints:   typeof s.hitPoints  === 'number' ? s.hitPoints  : 0,
    size:        typeof s.size       === 'number' ? s.size       : 0,
    pointsCost:  typeof s.pointsCost === 'number' ? s.pointsCost : 0,
    supplyTiers: Array.isArray(s.supplyTiers) ? (s.supplyTiers as StarcraftSupplyTier[]) : [],
    tags:        typeof s.tags === 'string' ? s.tags : '',
    weapons:     rowsToWeapons(addons),
    abilities:   rowsToAbilities(addons),
  };
}
