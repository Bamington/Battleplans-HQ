/**
 * ryg.ts — DB rows → RygCardProps
 *
 * Addons split into four groups via addon_type.slug:
 *   'special-ability' → single ability block
 *   'weapons'         → weapons list (name, damage, range, keywords)
 *   'armor'           → armor list   (name, description)
 *   'items'           → items list   (name, description)
 *
 * Assumed select shape:
 *   .select(`
 *     id, name, stats, portrait_style,
 *     card_addons(addon_id, sort_order, addons(name, description, stats,
 *       addon_type:addon_types(slug),
 *       addon_keywords(keyword_id, params, sort_order,
 *         keywords(name, description, params_schema)))),
 *     card_keywords(keyword_id, params, sort_order,
 *       keywords(name, description, params_schema))
 *   `)
 */

import type { RygCardProps, RygWeapon, RygArmor, RygItem } from '../../components/RygCard';
import type { RygStats } from '../database.types';
import { addonSlug, formatKeywordLabel } from './util';

// ── Loose row types ──────────────────────────────────────────────────────────

interface JoinedKeyword {
  name:          string;
  description:   string | null;
  params_schema: unknown;
}

interface AddonKeywordRow {
  keyword_id: string;
  params:     Record<string, unknown> | null;
  sort_order: number | null;
  keywords:   JoinedKeyword | null;
}

interface CardAddonRow {
  addon_id:   string;
  sort_order: number | null;
  addons: {
    name:           string;
    description:    string | null;
    stats:          Record<string, unknown>;
    addon_type:     { slug: string } | { slug: string }[] | null;
    addon_keywords: AddonKeywordRow[];
  } | null;
}

interface CardKeywordRow {
  keyword_id: string;
  params:     Record<string, unknown> | null;
  sort_order: number | null;
  keywords:   JoinedKeyword | null;
}

export interface RygCardDbRow {
  name:            string;
  stats:           RygStats | Record<string, unknown> | null;
  portrait_style?: string | null;
  card_addons?:    CardAddonRow[];
  card_keywords?:  CardKeywordRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function joinKeywordLabels(rows: AddonKeywordRow[]): string {
  return rows
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => formatKeywordLabel(r.keywords!.name, r.params?.X))
    .join(', ');
}

const numStat = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// ── Main transformer ─────────────────────────────────────────────────────────

export function dbRowsToRygProps(
  row: RygCardDbRow,
  options: { portraitUrl?: string | null } = {},
): RygCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;

  const sortedAddons = [...(row.card_addons ?? [])]
    .filter(ca => ca.addons != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  let specialAbilityName: string | undefined;
  let specialAbilityDesc: string | undefined;
  const weapons: RygWeapon[] = [];
  const armor:   RygArmor[]  = [];
  const items:   RygItem[]   = [];

  for (const ca of sortedAddons) {
    const addon = ca.addons!;
    const slug  = addonSlug(addon);
    const ws    = addon.stats;

    if (slug === 'special-ability') {
      specialAbilityName = addon.name;
      specialAbilityDesc = addon.description ?? undefined;
    } else if (slug === 'weapons') {
      const rangeVal = typeof ws.range === 'number' ? ws.range : parseInt(String(ws.range ?? ''), 10);
      weapons.push({
        id:       ca.addon_id,
        name:     addon.name,
        damage:   typeof ws.damage === 'string' ? ws.damage : '',
        range:    Number.isFinite(rangeVal) ? rangeVal : 0,
        keywords: joinKeywordLabels(addon.addon_keywords ?? []),
      });
    } else if (slug === 'armor') {
      armor.push({
        id:          ca.addon_id,
        name:        addon.name,
        description: addon.description ?? '',
      });
    } else if (slug === 'items') {
      items.push({
        id:          ca.addon_id,
        name:        addon.name,
        description: addon.description ?? '',
      });
    }
  }

  const talents = [...(row.card_keywords ?? [])]
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => formatKeywordLabel(r.keywords!.name, r.params?.X))
    .join(', ');

  return {
    warriorName:        row.name || 'Warrior Name',
    type:               typeof s.type    === 'string' ? s.type    : '',
    sept:               typeof s.sept    === 'string' ? s.sept    : '',
    offense:            numStat(s.offense),
    defense:            numStat(s.defense),
    life:               numStat(s.life),
    tactics:            numStat(s.tactics),
    fate:               numStat(s.fate),
    talents,
    specialAbilityName,
    specialAbilityDesc,
    weapons,
    armor,
    items,
    portrait:           options.portraitUrl ?? undefined,
  };
}
