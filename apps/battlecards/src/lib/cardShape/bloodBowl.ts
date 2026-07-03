/**
 * bloodBowl.ts — DB rows → BloodBowlCardProps
 *
 * Same shape as the Halo helper. Blood Bowl is the simplest of the
 * games: no card_addons (skills live on the card via card_keywords),
 * so the helper just walks card_keywords and produces the comma-joined
 * `skills` display string plus the per-skill `skillData` array.
 *
 * Assumed select shape (matches the unified PackEditor select):
 *   .select(`
 *     id, name, stats, portrait_style,
 *     card_keywords(keyword_id, params, sort_order,
 *       keywords(name, description, params_schema))
 *   `)
 *
 * Mirrors the load-time mapping at CardBuilderBloodBowl.tsx ~619-666.
 * The builder can be migrated to call this helper in a separate pass.
 */

import type { BloodBowlCardProps } from '../../components/BloodBowlCard';
import type { BloodBowlStats } from '../database.types';
import { formatKeywordLabel } from './util';

// ── Loose row types matching the select string above ────────────────────────

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

export interface BloodBowlCardDbRow {
  name:           string;
  stats:          BloodBowlStats | Record<string, unknown> | null;
  portrait_style?: string | null;
  card_keywords?:  CardKeywordRow[];
}

// ── Helper ──────────────────────────────────────────────────────────────────

export function dbRowsToBloodBowlProps(
  row: BloodBowlCardDbRow,
  options: { portraitUrl?: string | null } = {},
): BloodBowlCardProps {
  const s = (row.stats ?? {}) as Record<string, unknown>;

  // Sort + filter keyword rows (defensive — keywords may be null from a
  // dangling join row).
  const sortedKws = [...(row.card_keywords ?? [])]
    .filter(ck => ck.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Skill labels: "Name" or "Name (X)" if the keyword has a numeric param.
  const skillLabels = sortedKws.map(ck =>
    formatKeywordLabel(ck.keywords!.name, ck.params?.X),
  );

  const skillData = sortedKws.map((ck, i) => ({
    label:       skillLabels[i],
    name:        ck.keywords!.name,
    description: ck.keywords!.description ?? '',
  }));

  // Attribute fields are stored comma-separated. Fall back to em-dash when
  // empty — matches the builder's render-time default.
  const primaryAttribute =
    typeof s.primaryAttribute === 'string' && s.primaryAttribute.length > 0
      ? s.primaryAttribute
      : '—';
  const secondaryAttribute =
    typeof s.secondaryAttribute === 'string' && s.secondaryAttribute.length > 0
      ? s.secondaryAttribute
      : '—';

  return {
    teamName:           typeof s.teamName   === 'string' ? s.teamName   : '',
    unitName:           row.name || 'Unit Name',
    playerRole:         typeof s.playerRole === 'string' ? s.playerRole : '',
    cost:               typeof s.cost       === 'string' || typeof s.cost === 'number'
                          ? s.cost
                          : '',
    skills:             skillLabels.join(', '),
    skillData:          skillData.length > 0 ? skillData : undefined,
    primaryAttribute,
    secondaryAttribute,
    portrait:           options.portraitUrl ?? undefined,
    ma:                 Number(s.ma ?? 0),
    st:                 Number(s.st ?? 0),
    ag:                 Number(s.ag ?? 0),
    pa:                 Number(s.pa ?? 0),
    av:                 Number(s.av ?? 0),
  };
}
