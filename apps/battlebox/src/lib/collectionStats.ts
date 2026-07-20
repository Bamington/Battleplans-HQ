/**
 * collectionStats.ts — Pure aggregation for the collection stats page. No React,
 * no Supabase; the page is presentation only.
 *
 * Everything is weighted by a model row's `count` (how many of that miniature
 * the user owns), so a "5 models · Painted" row contributes 5 painted minis.
 */

export type ModelStatus = 'None' | 'Assembled' | 'Primed' | 'Partially Painted' | 'Painted';

export interface StatModel {
  id: string;
  count: number;
  status: ModelStatus;
  purchaseDate: string | null;
  paintedDate: string | null;
  game: { id: string; name: string; slug: string } | null;
  boxes: { id: string; name: string; type: 'Box' | 'Collection' }[];
}

/** Painted → Unpainted, the order used for the progress bar and breakdown list. */
export const STATUS_ORDER: ModelStatus[] = ['Painted', 'Partially Painted', 'Primed', 'Assembled', 'None'];

export const STATUS_LABEL: Record<ModelStatus, string> = {
  Painted: 'Painted',
  'Partially Painted': 'Partially Painted',
  Primed: 'Primed',
  Assembled: 'Assembled',
  None: 'Unpainted',
};

/** Bar colours per status (Tailwind bg-*), Painted → Unpainted. */
export const STATUS_COLOR: Record<ModelStatus, string> = {
  Painted: 'bg-green-500',
  'Partially Painted': 'bg-lime-500',
  Primed: 'bg-amber-500',
  Assembled: 'bg-sky-500',
  None: 'bg-neutral-600',
};

export interface Progress {
  /** Total miniatures (sum of count). */
  total: number;
  /** Miniatures in each status. */
  byStatus: Record<ModelStatus, number>;
  /** Painted ÷ total, 0–1. */
  paintedRate: number;
}

const emptyByStatus = (): Record<ModelStatus, number> =>
  ({ None: 0, Assembled: 0, Primed: 0, 'Partially Painted': 0, Painted: 0 });

export function progressOf(models: StatModel[]): Progress {
  const byStatus = emptyByStatus();
  let total = 0;
  for (const m of models) {
    const n = m.count > 0 ? m.count : 1;
    byStatus[m.status] += n;
    total += n;
  }
  return { total, byStatus, paintedRate: total ? byStatus.Painted / total : 0 };
}

// ── Groups (per game / per collection) ────────────────────────────────────────

export interface Group {
  key: string;
  name: string;
  slug?: string;
  /** Total miniatures in the group. */
  total: number;
  /** Painted miniatures in the group. */
  painted: number;
  /** painted ÷ total, 0–1. */
  paintedRate: number;
}

function groupsFrom(entries: { key: string; name: string; slug?: string; model: StatModel }[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const n = e.model.count > 0 ? e.model.count : 1;
    const g = map.get(e.key) ?? { key: e.key, name: e.name, slug: e.slug, total: 0, painted: 0, paintedRate: 0 };
    g.total += n;
    if (e.model.status === 'Painted') g.painted += n;
    map.set(e.key, g);
  }
  const groups = [...map.values()];
  for (const g of groups) g.paintedRate = g.total ? g.painted / g.total : 0;
  return groups;
}

/** One group per game (models with no game fall under "No game"). */
export function gameGroups(models: StatModel[]): Group[] {
  return groupsFrom(models.map(m => ({
    key: m.game?.id ?? 'none',
    name: m.game?.name ?? 'No game',
    slug: m.game?.slug,
    model: m,
  })));
}

/** One group per collection a model belongs to (a model in two boxes counts in
 *  both). Models in no collection are omitted. */
export function collectionGroups(models: StatModel[]): Group[] {
  const entries: { key: string; name: string; model: StatModel }[] = [];
  for (const m of models) {
    for (const b of m.boxes) entries.push({ key: b.id, name: b.name, model: m });
  }
  return groupsFrom(entries);
}

// ── Ranking ───────────────────────────────────────────────────────────────────

/** Most miniatures first; ties broken by name for stable order. */
export function rankByTotal(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Highest painted-rate first, among groups of at least `minTotal` minis. */
export function rankByPainted(groups: Group[], minTotal = 1): Group[] {
  return groups
    .filter(g => g.total >= minTotal)
    .sort((a, b) => b.paintedRate - a.paintedRate || b.total - a.total || a.name.localeCompare(b.name));
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface YearRow {
  year: number;
  /** Miniatures whose purchase_date falls in this year. */
  added: number;
  /** Miniatures whose painted_date falls in this year. */
  painted: number;
}

/** Miniatures added and painted per year, most recent first. Rows with neither
 *  are dropped. */
export function purchaseByYear(models: StatModel[]): YearRow[] {
  const map = new Map<number, YearRow>();
  const bump = (iso: string | null, field: 'added' | 'painted', n: number) => {
    if (!iso) return;
    const year = Number(iso.slice(0, 4));
    if (!year) return;
    const row = map.get(year) ?? { year, added: 0, painted: 0 };
    row[field] += n;
    map.set(year, row);
  };
  for (const m of models) {
    const n = m.count > 0 ? m.count : 1;
    bump(m.purchaseDate, 'added', n);
    bump(m.paintedDate, 'painted', n);
  }
  return [...map.values()].sort((a, b) => b.year - a.year);
}

/** Distinct games represented in the collection. */
export function gameCount(models: StatModel[]): number {
  return new Set(models.map(m => m.game?.id).filter(Boolean)).size;
}
