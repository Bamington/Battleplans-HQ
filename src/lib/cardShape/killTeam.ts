/**
 * killTeam.ts — DB rows → KillTeamCardProps / KillTeamRuleCardProps
 *
 * Kill Team's wrinkle is that addons split into TWO lists on the card
 * (weapons + abilities), via addon_type.slug, and the cards table holds
 * both operative AND rule cards (rules surface as a different visual
 * component entirely). The helpers handle that split.
 *
 * Assumed select shape (the unified PackEditor select):
 *   .select(`
 *     id, name, card_type, stats, portrait_style,
 *     card_addons(addon_id, sort_order, addons(name, description, stats,
 *       addon_type:addon_types(slug),
 *       addon_keywords(keyword_id, params, sort_order,
 *         keywords(name, description, params_schema)))),
 *     card_keywords(keyword_id, params, sort_order,
 *       keywords(name, description, params_schema))
 *   `)
 *
 * Hit / damage parsing mirrors CardBuilderKillTeam.tsx's parseHit +
 * parseDamageParts so legacy string-shaped stats still render.
 */

import type {
  KillTeamCardProps,
  KillTeamWeapon,
  KillTeamAbility,
  CardKeywordInfo,
} from '../../components/KillTeamCard';
import type { KillTeamRuleCardProps } from '../../components/KillTeamRuleCard';
import type { KillTeamStats } from '../database.types';
import { addonSlug, formatKeywordLabel } from './util';

// ── Loose row types matching the select string above ────────────────────────

interface JoinedKeyword {
  name:        string;
  description: string | null;
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
    name:        string;
    description: string | null;
    stats:       Record<string, unknown>;
    addon_type:  { slug: string } | { slug: string }[] | null;
    addon_keywords: AddonKeywordRow[];
  } | null;
}

interface CardKeywordRow {
  keyword_id: string;
  params:     Record<string, unknown> | null;
  sort_order: number | null;
  keywords:   JoinedKeyword | null;
}

export interface KillTeamCardDbRow {
  name:            string;
  card_type?:      string;
  stats:           KillTeamStats | Record<string, unknown> | null;
  portrait_style?: string | null;
  card_addons?:    CardAddonRow[];
  card_keywords?:  CardKeywordRow[];
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Comma-joined display string for a list of attached keywords. */
function joinKeywordLabels(rows: AddonKeywordRow[]): string {
  return rows
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => formatKeywordLabel(r.keywords!.name, r.params?.X))
    .join(', ');
}

/** Build the per-row `keywordData` array so weapon keywords render as
 *  clickable chips on the card. */
function keywordInfos(rows: AddonKeywordRow[]): CardKeywordInfo[] {
  return rows
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => ({
      label:       formatKeywordLabel(r.keywords!.name, r.params?.X),
      name:        r.keywords!.name,
      description: r.keywords!.description ?? '',
    }));
}

/** parseHit / parseDamageParts handle Kill Team's mix of legacy
 *  string-shaped stats (hit `"3+"`, damage `"3/4"`) and the newer
 *  numeric shape (`baseDamage`, `critDamage`). Exported so the
 *  CardBuilderKillTeam can use the same logic at load time. */
export function parseHit(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseDamageParts(s: Record<string, unknown>): { base: number; crit: number } {
  if (s.baseDamage != null || s.critDamage != null) {
    return { base: Number(s.baseDamage) || 0, crit: Number(s.critDamage) || 0 };
  }
  const raw = String(s.damage ?? '');
  const [b, c] = raw.split('/');
  return { base: parseInt(b ?? '', 10) || 0, crit: parseInt(c ?? '', 10) || 0 };
}

export const formatHit    = (hit: number) => hit > 0 ? `${hit}+` : '—';
export const formatDamage = (base: number, crit: number) =>
  base > 0 || crit > 0 ? `${base}/${crit}` : '—';

const numStat = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// ── Operative helper ────────────────────────────────────────────────────────

export function dbRowsToKillTeamProps(
  row: KillTeamCardDbRow,
  options: { portraitUrl?: string | null } = {},
): KillTeamCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;

  const sortedAddons = [...(row.card_addons ?? [])]
    .filter(ca => ca.addons != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const weapons: KillTeamWeapon[] = [];
  const abilities: KillTeamAbility[] = [];

  for (const ca of sortedAddons) {
    const addon = ca.addons!;
    const slug  = addonSlug(addon);
    const ws    = addon.stats;
    const kwLabels = joinKeywordLabels(addon.addon_keywords ?? []);

    if (slug === 'weapons') {
      const mr = ws.meleeOrRanged === 'melee' || ws.meleeOrRanged === 'ranged'
        ? (ws.meleeOrRanged as 'melee' | 'ranged')
        : '';
      const dmg = parseDamageParts(ws);
      weapons.push({
        name:          addon.name,
        meleeOrRanged: mr,
        attack:        Number(ws.attack) || 0,
        hit:           formatHit(parseHit(ws.hit)),
        damage:        formatDamage(dmg.base, dmg.crit),
        keywords:      kwLabels,
        keywordData:   keywordInfos(addon.addon_keywords ?? []),
      });
    } else if (slug === 'abilities') {
      abilities.push({
        name:        addon.name,
        description: addon.description ?? '',
        apCost:      Number(ws.apCost) || 0,
        keywords:    kwLabels,
      });
    }
  }

  return {
    operativeName: row.name || 'Operative Name',
    role:          typeof s.role     === 'string' ? s.role     : '',
    teamName:      typeof s.teamName === 'string' ? s.teamName : '',
    tags:          typeof s.tags     === 'string' ? s.tags     : '',
    actions:       numStat(s.actions),
    movement:      numStat(s.movement),
    save:          numStat(s.save),
    wounds:        numStat(s.wounds),
    baseSize:      numStat(s.baseSize),
    portrait:      options.portraitUrl ?? undefined,
    weapons,
    abilities,
  };
}

// ── Rule card helper ────────────────────────────────────────────────────────
// Rule cards have title = card name and description in stats.description.
// The card also surfaces the FIRST attached "abilities"-type addon as a
// single ability slot (KillTeamRuleCard only renders one).

export function dbRowsToKillTeamRuleProps(
  row: KillTeamCardDbRow,
): KillTeamRuleCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;

  const sortedAddons = [...(row.card_addons ?? [])]
    .filter(ca => ca.addons != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Find the first attached abilities addon; render it as the rule card's
  // single ability slot.
  let ability: KillTeamRuleCardProps['ability'] = null;
  for (const ca of sortedAddons) {
    const addon = ca.addons!;
    if (addonSlug(addon) !== 'abilities') continue;
    const ws = addon.stats;
    ability = {
      name:        addon.name,
      description: addon.description ?? '',
      apCost:      Number(ws.apCost) || 0,
      keywords:    joinKeywordLabels(addon.addon_keywords ?? []),
    };
    break;
  }

  return {
    title:       row.name || 'Rule Title',
    description: typeof s.description === 'string' ? s.description : '',
    ability,
  };
}
