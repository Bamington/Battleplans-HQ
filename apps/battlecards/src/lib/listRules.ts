/**
 * listRules.ts — List-level building rules (points, unit caps, uniqueness)
 *
 * A game's rules live in games.list_rules; the values a player picks per
 * list (scenario size, points limit) live in decks.list_settings.
 *
 *   settings   numbers the player chooses per list, with a default
 *   resources  things that get totalled: a card count, or a stat summed
 *              over cards (+ their upgrades, so upgrades can change cost)
 *   rules      checks against those totals: track / max / min / exact,
 *              plus unique (one copy per card unless exempt)
 *
 * evaluateListRules is pure: given cards and rules it returns the tallies
 * and any problems. It never blocks anything — the UI decides how to show it.
 */

import type { Json } from './database.types';

// ── Schema ───────────────────────────────────────────────────────────────────

export interface ListSettingDef {
  key:      string;
  label:    string;
  default:  number;
  /** Fixed choices (e.g. scenario sizes). Omit for a free number. */
  options?: number[];
  /** Shown after the value, e.g. "units" or "pts". */
  suffix?:  string;
  /** Bounds for a free-number setting. */
  min?:     number;
  max?:     number;
  /** Which resource's tally opens this setting when tapped. */
  resource?: string;
}

export interface ListResource {
  key:    string;
  label:  string;
  /** 'count' = number of cards; { stat } = sum of that stat on cards. */
  source: 'count' | { stat: string; /** Also add this stat from upgrades. */ addonStat?: string };
  /** Only count these card types. Omit for all. */
  cardTypes?: string[];
  /** Only count cards carrying this keyword (case-insensitive). */
  hasKeyword?: string;
  /** Used by rules but not shown as a tally badge. */
  hidden?: boolean;
  /** Show the total with thousands separators (e.g. 1,150,000). */
  grouping?: boolean;
}

/** A limit is a fixed number or a reference to a list setting. */
export type ListLimit = number | { setting: string };

export type ListSeverity = 'error' | 'warning';

export type ListRule =
  | { type: 'track'; resource: string }
  | { type: 'max' | 'min' | 'exact'; resource: string; limit: ListLimit; severity?: ListSeverity; message?: string }
  | {
      type: 'unique';
      cardTypes?: string[];
      /** Copies allowed per card (default 1). */
      maxCopies?: number;
      /** Cards with this stat set (truthy) are exempt, e.g. mass_produced. */
      exemptStat?: string;
      severity?: ListSeverity;
      message?: string;
    };

export interface ListRules {
  settings?:  ListSettingDef[];
  resources?: ListResource[];
  rules?:     ListRule[];
}

export type ListSettings = Record<string, number>;

// ── Inputs / outputs ─────────────────────────────────────────────────────────

export interface RuleCard {
  id:        string;
  name:      string;
  card_type: string;
  stats:     Record<string, Json>;
  /** Official card identity; copies of the same pack card share it. */
  pack_source_id?: string | null;
  /** Keyword names on the card, for resources with hasKeyword. */
  keywords?: string[];
  /** Stats of attached upgrades, for resources with addonStat. */
  addons?:   { stats: Record<string, Json> }[];
}

export interface ResourceTally {
  key:    string;
  label:  string;
  total:  number;
  /** Upper bound shown as "total / limit", when a max or exact rule exists. */
  limit:  number | null;
  /** True when a rule about this resource failed. */
  failed: ListSeverity | null;
  /** Display with thousands separators. */
  grouping?: boolean;
}

export interface ListProblem {
  severity: ListSeverity;
  message:  string;
  /** Cards involved, so the list can highlight them. */
  cardIds:  string[];
}

export interface ListEvaluation {
  tallies:  ResourceTally[];
  problems: ListProblem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Numbers from stats, tolerating free text like "$55,000" or "50k". */
export const toNumber = (v: Json | undefined): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v !== 'string') return 0;
  const s = v.trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k)?/);
  if (!m) return 0;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) ? n : 0;
};

/** Badge text for a tally, e.g. "Points 191/200" or "GP 1,150,000". */
export const tallyText = (t: ResourceTally): string => {
  const fmt = (n: number) => (t.grouping ? n.toLocaleString('en-US') : String(n));
  return `${t.label} ${fmt(t.total)}${t.limit != null ? `/${fmt(t.limit)}` : ''}`;
};

const truthy = (v: Json | undefined): boolean =>
  v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v !== '' && v !== '0' && v.toLowerCase() !== 'false');

const ofTypes = (types: string[] | undefined) => (c: RuleCard) => !types || types.includes(c.card_type);

const inResource = (res: ListResource) => (c: RuleCard) =>
  ofTypes(res.cardTypes)(c) &&
  (!res.hasKeyword || (c.keywords ?? []).some(k => k.trim().toLowerCase() === res.hasKeyword!.trim().toLowerCase()));

/** Identity for uniqueness: printed card number, then pack source, then name. */
export const cardIdentity = (c: RuleCard): string => {
  const num = c.stats?.card_number;
  if (typeof num === 'string' && num.trim()) return `num:${num.trim().toUpperCase()}`;
  if (c.pack_source_id) return `src:${c.pack_source_id}`;
  return `name:${c.name.trim().toLowerCase()}`;
};

/** Settings with defaults filled in. */
export const resolveSettings = (rules: ListRules | null | undefined, values: ListSettings | null | undefined): ListSettings => {
  const out: ListSettings = {};
  for (const s of rules?.settings ?? []) {
    const v = values?.[s.key];
    out[s.key] = typeof v === 'number' && Number.isFinite(v) ? v : s.default;
  }
  return out;
};

const resolveLimit = (limit: ListLimit, settings: ListSettings): number | null =>
  typeof limit === 'number' ? limit : settings[limit.setting] ?? null;

const resourceTotal = (res: ListResource, cards: RuleCard[]): number => {
  const pool = cards.filter(inResource(res));
  if (res.source === 'count') return pool.length;
  const { stat, addonStat } = res.source;
  return pool.reduce((sum, c) => {
    let s = sum + toNumber(c.stats?.[stat]);
    if (addonStat) for (const a of c.addons ?? []) s += toNumber(a.stats?.[addonStat]);
    return s;
  }, 0);
};

const worse = (a: ListSeverity | null, b: ListSeverity): ListSeverity => (a === 'error' || b === 'error' ? 'error' : 'warning');

// ── Evaluate ─────────────────────────────────────────────────────────────────

export function evaluateListRules(
  rules: ListRules | null | undefined,
  cards: RuleCard[],
  settingValues?: ListSettings | null,
): ListEvaluation {
  if (!rules) return { tallies: [], problems: [] };
  const settings = resolveSettings(rules, settingValues);

  const tallies = new Map<string, ResourceTally>();
  const resources = new Map<string, ListResource>();
  for (const res of rules.resources ?? []) {
    resources.set(res.key, res);
    tallies.set(res.key, { key: res.key, label: res.label, total: resourceTotal(res, cards), limit: null, failed: null, grouping: res.grouping });
  }

  const problems: ListProblem[] = [];

  for (const rule of rules.rules ?? []) {
    if (rule.type === 'track') continue;

    if (rule.type === 'unique') {
      const severity = rule.severity ?? 'error';
      const max = rule.maxCopies ?? 1;
      const groups = new Map<string, RuleCard[]>();
      for (const c of cards.filter(ofTypes(rule.cardTypes))) {
        if (rule.exemptStat && truthy(c.stats?.[rule.exemptStat])) continue;
        const k = cardIdentity(c);
        groups.set(k, [...(groups.get(k) ?? []), c]);
      }
      for (const group of groups.values()) {
        if (group.length <= max) continue;
        problems.push({
          severity,
          message: `${group[0].name} ×${group.length}${rule.message ? ` — ${rule.message}` : ''}`,
          cardIds: group.map(c => c.id),
        });
      }
      continue;
    }

    const tally = tallies.get(rule.resource);
    const res = resources.get(rule.resource);
    if (!tally || !res) continue;
    const limit = resolveLimit(rule.limit, settings);
    if (limit == null) continue;
    if (rule.type !== 'min') tally.limit = limit;

    const t = tally.total;
    const failed = rule.type === 'max' ? t > limit : rule.type === 'min' ? t < limit : t !== limit;
    if (!failed) continue;

    const severity = rule.severity ?? 'error';
    tally.failed = worse(tally.failed, severity);
    const label = res.label;
    const auto =
      rule.type === 'max' ? `${label}: ${t} of ${limit} — ${t - limit} over the limit`
      : rule.type === 'min' ? `${label}: ${t} — at least ${limit} needed`
      : t < limit ? `${label}: ${t} of ${limit} — ${limit - t} more needed`
      : `${label}: ${t} of ${limit} — ${t - limit} too many`;
    problems.push({
      severity,
      message: rule.message ?? auto,
      cardIds: cards.filter(inResource(res)).map(c => c.id),
    });
  }

  // Errors before warnings.
  problems.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const hidden = new Set((rules.resources ?? []).filter(r => r.hidden).map(r => r.key));
  return { tallies: [...tallies.values()].filter(t => !hidden.has(t.key)), problems };
}
