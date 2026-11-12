/**
 * bench/StatCards.tsx — the cards of BattleBench's collection stats: totals,
 * painting progress, and ranked lists. Shared so a profile's Painting Stats
 * (in any app) looks exactly like the stats page.
 */

import { useState, type ReactNode } from 'react';
import Pagination from '../components/Pagination';
import Widget2 from '../icons/Widget2';
import { GAME_ICONS } from '../lib/gameArt';
import { STATUS_ORDER, STATUS_LABEL, STATUS_COLOR, type Progress, type Group } from './collectionStats';

const RANK_PAGE = 10;

export const pct = (r: number) => Math.round(r * 100);

// ── Card building blocks ──────────────────────────────────────────────────────

export function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] shadow-md flex flex-col gap-2">
      <h3 className="font-heading text-base text-white leading-6">{title}</h3>
      {children}
    </div>
  );
}

/** The painted → unpainted split as a stacked bar. */
function ProgressBar({ progress }: { progress: Progress }) {
  const { total, byStatus } = progress;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-700">
      {STATUS_ORDER.map(s => {
        const w = total ? (byStatus[s] / total) * 100 : 0;
        return w > 0 ? <div key={s} className={STATUS_COLOR[s]} style={{ width: `${w}%` }} /> : null;
      })}
    </div>
  );
}

export function PaintingProgressCard({ title, progress }: { title: string; progress: Progress }) {
  return (
    <StatCard title={title}>
      {progress.total === 0 ? (
        <p className="font-body text-sm text-neutral-500">No models here yet.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-heading text-2xl text-white leading-none">{pct(progress.paintedRate)}%</span>
            <span className="font-body text-sm text-neutral-400">
              {progress.byStatus.Painted} / {progress.total} painted
            </span>
          </div>
          <ProgressBar progress={progress} />
          <ul className="flex flex-col gap-1 mt-1">
            {STATUS_ORDER.filter(s => progress.byStatus[s] > 0).map(s => (
              <li key={s} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${STATUS_COLOR[s]}`} aria-hidden="true" />
                <span className="flex-1 font-body text-sm text-neutral-200">{STATUS_LABEL[s]}</span>
                <span className="font-body text-sm text-neutral-400 tabular-nums">{progress.byStatus[s]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </StatCard>
  );
}

export function TotalsCard({ models, collections, games }: { models: number; collections: number; games: number }) {
  const Item = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col">
      <span className="font-heading text-2xl text-white leading-none tabular-nums">{value}</span>
      <span className="font-body text-xs text-neutral-400 mt-1">{label}</span>
    </div>
  );
  return (
    <StatCard title="Collection">
      <div className="flex gap-8">
        <Item value={models} label={models === 1 ? 'Model' : 'Models'} />
        <Item value={collections} label={collections === 1 ? 'Collection' : 'Collections'} />
        <Item value={games} label={games === 1 ? 'Game' : 'Games'} />
      </div>
    </StatCard>
  );
}

/**
 * One ranked row: rank, optional game icon, name, total, and a rate.
 * `rateLabel` names that rate — "painted" for collections (the default), or
 * e.g. "won" when a Group carries battles (total = played, painted = won).
 */
export function RankRow({ index, group, icon, rateLabel = 'painted' }: { index: number; group: Group; icon?: boolean; rateLabel?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-4 shrink-0 text-right font-body text-sm text-neutral-500">{index + 1}</span>
      {icon && (
        <span className="size-6 shrink-0 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
          {group.slug && GAME_ICONS[group.slug]
            ? <img src={GAME_ICONS[group.slug]} alt="" className="w-full h-full object-cover" />
            : <Widget2 className="w-3.5 h-3.5 text-neutral-400" />}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate font-body text-sm text-neutral-50">{group.name}</span>
      <span className="font-heading text-sm text-white tabular-nums">{group.total}</span>
      <span className="w-16 shrink-0 text-right font-body text-xs text-neutral-400">{pct(group.paintedRate)}% {rateLabel}</span>
    </li>
  );
}

/**
 * A numbered ranking: top 3 collapsed, "Show all" expands (paginated past 10).
 * `expandable={false}` lists every group given, with no toggle or pages — for
 * a list the caller has already capped (e.g. a profile's top 10).
 */
export function RankedListCard({ title, groups, icon, emptyLabel, rateLabel, expandable = true }: {
  title: string; groups: Group[]; icon?: boolean; emptyLabel: string; rateLabel?: string; expandable?: boolean;
}) {
  const [toggled, setExpanded] = useState(false);
  const expanded = !expandable || toggled;
  const [page, setPage] = useState(0);

  const paginated  = expandable && expanded && groups.length > RANK_PAGE;
  const totalPages = Math.max(1, Math.ceil(groups.length / RANK_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = paginated ? safePage * RANK_PAGE : 0;
  const visible    = !expanded ? groups.slice(0, 3) : paginated ? groups.slice(start, start + RANK_PAGE) : groups;

  return (
    <StatCard title={title}>
      {groups.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {visible.map((g, i) => <RankRow key={g.key} index={start + i} group={g} icon={icon} rateLabel={rateLabel} />)}
          </ol>
          {paginated && <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />}
          {expandable && groups.length > 3 && (
            <button
              type="button"
              onClick={() => (expanded ? (setExpanded(false), setPage(0)) : setExpanded(true))}
              className="self-start font-body text-sm font-medium text-primary-500 hover:text-primary-400 transition-colors"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
        </>
      )}
    </StatCard>
  );
}

