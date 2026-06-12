/**
 * addonSubtitles.ts — Per-game addon subtitle formatters
 *
 * One-line stat summaries for addon rows in picker lists: Halo weapons
 * read "Ranged, R5, AP 1", Kill Team weapons "Ranged · A4 · Hit 3+ ·
 * Dmg 2/4", and so on. Originally defined inline in each game's card
 * builder for AddAddonModal's picker; extracted so the pack editor can
 * use the same formatting in its panels and its Add-to-Pack picker.
 *
 * Formatters accept a structural AddonLike rather than the full Addon
 * row, because the pack picker works with a loose row shape that only
 * carries name/description/stats.
 *
 * ADDON_SUBTITLE_FORMATTERS maps (game slug → addon-type slug) to a
 * formatter. Combos without an entry (Blood Bowl skills) fall back to
 * the caller's generic formatting.
 */

import { parseHit, parseDamageParts } from './cardShape/killTeam';

// ── Shared shape ─────────────────────────────────────────────────────────────

export type AddonLike = {
  name?:        string;
  description?: string | null;
  stats?:       unknown;
};

// ── Halo: Flashpoint ─────────────────────────────────────────────────────────

/** "Ranged, R5, AP 1, Tracer" — falls back to the addon name when the
 *  stats are empty. */
export function haloWeaponSubtitle(addon: AddonLike): string {
  const s = (addon.stats ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (s.type)     parts.push(String(s.type));
  if (s.range)    parts.push(`R${s.range}`);
  if (s.ap)       parts.push(`AP ${s.ap}`);
  if (s.keywords) parts.push(String(s.keywords));
  return parts.join(', ') || addon.name || '';
}

// ── Kill Team ────────────────────────────────────────────────────────────────

/** "Ranged · A4 · Hit 3+ · Dmg 2/4" */
export function killTeamWeaponSubtitle(addon: AddonLike): string {
  const s = (addon.stats ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (s.meleeOrRanged) parts.push(s.meleeOrRanged === 'melee' ? 'Melee' : 'Ranged');
  if (s.attack)        parts.push(`A${s.attack}`);
  const hit = parseHit(s.hit);
  if (hit > 0)         parts.push(`Hit ${hit}+`);
  const dmg = parseDamageParts(s);
  if (dmg.base > 0 || dmg.crit > 0) parts.push(`Dmg ${dmg.base}/${dmg.crit}`);
  return parts.join(' · ') || addon.name || '';
}

/** "2 AP" / "Free" */
export function killTeamAbilitySubtitle(addon: AddonLike): string {
  const s = (addon.stats ?? {}) as Record<string, unknown>;
  const ap = Number(s.apCost ?? 0);
  return ap > 0 ? `${ap} AP` : 'Free';
}

// ── StarCraft ────────────────────────────────────────────────────────────────

/** Title-cases a StarCraft phase/timing value; `special_abilities`
 *  shortens to "Special". Null/empty in → null out. */
export function formatStarcraftPhase(p: string | null | undefined): string | null {
  if (!p) return null;
  if (p === 'special_abilities') return 'Special';
  return p[0].toUpperCase() + p.slice(1);
}

/** "Combat, Active, R6, 5+ Hit, 2 Dmg" (melee weapons show "Melee"
 *  instead of a range). */
export function starcraftWeaponSubtitle(addon: AddonLike): string {
  const s = (addon.stats ?? {}) as {
    phase?: string | null; timing?: string | null;
    range?: number | null; hit?: number | null; dmg?: number | null;
  };
  const parts: string[] = [];
  const phase  = formatStarcraftPhase(s.phase);
  const timing = formatStarcraftPhase(s.timing);
  if (phase)           parts.push(phase);
  if (timing)          parts.push(timing);
  if (s.range != null) parts.push(s.range === 0 ? 'Melee' : `R${s.range}`);
  if (s.hit   != null) parts.push(`${s.hit}+ Hit`);
  if (s.dmg   != null) parts.push(`${s.dmg} Dmg`);
  return parts.join(', ');
}

/** "Combat, Active, 2 Cost, 3 Min" */
export function starcraftAbilitySubtitle(addon: AddonLike): string {
  const s = (addon.stats ?? {}) as {
    phase?: string | null; timing?: string | null;
    cpCost?: number | null; isUpgrade?: boolean; upgradeCost?: number | null;
  };
  const parts: string[] = [];
  const phase  = formatStarcraftPhase(s.phase);
  const timing = formatStarcraftPhase(s.timing);
  if (phase)                                parts.push(phase);
  if (timing)                               parts.push(timing);
  if (s.cpCost)                             parts.push(`${s.cpCost} Cost`);
  if (s.isUpgrade && s.upgradeCost)         parts.push(`${s.upgradeCost} Min`);
  return parts.join(', ');
}

// ── Registry ─────────────────────────────────────────────────────────────────

/** (game slug → addon-type slug) → formatter. Blood Bowl's skills have
 *  no entry — its builder never formats skill addons (skills are
 *  keywords there), so callers fall back to generic formatting. */
export const ADDON_SUBTITLE_FORMATTERS: Record<
  string,
  Record<string, (addon: AddonLike) => string>
> = {
  'halo-flashpoint': { weapons: haloWeaponSubtitle },
  'kill-team':       { weapons: killTeamWeaponSubtitle, abilities: killTeamAbilitySubtitle },
  'starcraft':       { weapons: starcraftWeaponSubtitle, rules: starcraftAbilitySubtitle },
};
