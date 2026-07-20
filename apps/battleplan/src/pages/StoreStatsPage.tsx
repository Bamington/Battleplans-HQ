/**
 * StoreStatsPage.tsx — What's happening at a venue (/app/store-stats).
 *
 * Three columns, reusing the same ColumnShell frame as the player stats page:
 *   1. Overview  — time range, headline totals, bookings per month.
 *   2. What & Who — most booked games, most frequent bookers.
 *   3. When      — busiest weekdays, busiest timeslots.
 *
 * Everything here is derived from the venue's own BOOKINGS (see lib/storeStats
 * for why), so the language is deliberately "booked", not "played".
 *
 * Scope is one venue at a time, chosen from the venues this user administers —
 * the picker only ever offers their own, and RLS enforces it for real.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, AppFooter, Select, Pagination, ColumnShell, ColumnHeader } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { StoreSelector } from '../components/StoreSelector';
import { GAME_ICONS } from '../components/gameIcons';
import { useAdminLocations } from '../hooks/useBookingData';
import { useStoreStats } from '../hooks/useStoreStats';
import {
  storeTotals, gameCounts, weekdayCounts, timeslotCounts, customerCounts,
  monthlyTrend, filterBookingsByRange, bookingYears, NO_GAME_KEY,
  type StoreBooking, type CountStat,
} from '../lib/storeStats';
import type { TimeRange } from '../lib/battleStats';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

// ── Column icons ──────────────────────────────────────────────────────────────

const StoreIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 18h32v22a2 2 0 01-2 2H10a2 2 0 01-2-2V18Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M6 18l3-10h30l3 10" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M19 42V29h10v13" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);

const DiceIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="7" width="34" height="34" rx="5" stroke="currentColor" strokeWidth="2.5"/>
    <circle cx="17" cy="17" r="2.5" fill="currentColor"/>
    <circle cx="31" cy="31" r="2.5" fill="currentColor"/>
    <circle cx="24" cy="24" r="2.5" fill="currentColor"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M24 13v11l7 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Building blocks ───────────────────────────────────────────────────────────

function StatCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] shadow-md flex flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="font-heading text-base text-white leading-6">{title}</h3>
        {subtitle && <span className="font-body text-xs text-neutral-500">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function ColumnBody({ loading, empty, children }: { loading: boolean; empty: boolean; children: ReactNode }) {
  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
      {loading
        ? <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
        : empty
          ? <p className="font-body text-sm text-neutral-500 text-center py-4">No bookings in this period.</p>
          : children}
    </div>
  );
}

const RANK_PAGE = 10;

function RankRow({ index, row, total, showIcon }: {
  index: number; row: CountStat; total: number; showIcon?: boolean;
}) {
  const icon  = showIcon && row.slug ? GAME_ICONS[row.slug] : undefined;
  const share = total > 0 ? Math.round((row.count / total) * 100) : 0;
  const muted = row.key === NO_GAME_KEY;

  return (
    <li className="flex items-center gap-2">
      <span className="w-4 shrink-0 font-body text-xs text-neutral-500">{index + 1}</span>
      {showIcon && (
        <span className="w-6 h-6 shrink-0 rounded bg-neutral-700 overflow-hidden flex items-center justify-center">
          {icon && <img src={icon} alt="" className="w-full h-full object-cover" />}
        </span>
      )}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={`truncate font-body text-sm ${muted ? 'text-neutral-400 italic' : 'text-neutral-50'}`}>
          {row.label}
        </span>
        {row.sublabel && (
          <span className="truncate font-body text-xs text-neutral-500">{row.sublabel}</span>
        )}
      </span>
      <span className="w-10 shrink-0 text-right font-body text-xs text-neutral-400">{share}%</span>
      <span className="w-8 shrink-0 text-right font-heading text-sm text-white">{row.count}</span>
    </li>
  );
}

/** Numbered ranking: top 3 collapsed, "Show all" expands and paginates. */
function CountListCard({ title, subtitle, rows, total, showIcon, emptyLabel = 'Nothing recorded yet.' }: {
  title: string; subtitle?: string; rows: CountStat[]; total: number;
  showIcon?: boolean; emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const paginated  = expanded && rows.length > RANK_PAGE;
  const totalPages = Math.max(1, Math.ceil(rows.length / RANK_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = paginated ? safePage * RANK_PAGE : 0;
  const visible    = !expanded ? rows.slice(0, 3)
    : paginated ? rows.slice(start, start + RANK_PAGE)
    : rows;

  return (
    <StatCard title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {visible.map((r, i) => (
              <RankRow key={r.key} index={start + i} row={r} total={total} showIcon={showIcon} />
            ))}
          </ol>
          {paginated && <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />}
          {rows.length > 3 && (
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

// ── Columns ───────────────────────────────────────────────────────────────────

function OverviewColumn({ bookings, loading, range, year, years, onRange, onYear }: {
  bookings: StoreBooking[]; loading: boolean;
  range: TimeRange; year: number | null; years: number[];
  onRange: (r: TimeRange) => void; onYear: (y: number | null) => void;
}) {
  const totals = useMemo(() => storeTotals(bookings), [bookings]);
  const trend  = useMemo(() => monthlyTrend(bookings), [bookings]);
  const peak   = Math.max(1, ...trend.map(t => t.count));

  return (
    <ColumnShell>
      <ColumnHeader icon={<StoreIcon />} title="Overview" description="Tables booked at your venue." />

      <div className="w-full flex flex-col gap-2 mb-2.5">
        <Select
          label="Time range"
          value={range}
          onChange={e => onRange(e.target.value as TimeRange)}
          options={[
            { value: 'all',  label: 'All Time' },
            { value: '3m',   label: 'Last 3 Months' },
            { value: '6m',   label: 'Last 6 Months' },
            { value: 'year', label: 'By Year' },
          ]}
        />
        {range === 'year' && years.length > 0 && (
          <Select
            label="Year"
            value={year != null ? String(year) : ''}
            onChange={e => onYear(Number(e.target.value))}
            options={years.map(y => ({ value: String(y), label: String(y) }))}
          />
        )}
      </div>

      <ColumnBody loading={loading} empty={bookings.length === 0}>
        <StatCard title="Bookings">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="font-heading text-2xl text-white leading-none">{totals.bookings}</span>
              <span className="font-body text-xs text-neutral-400 mt-1">Bookings</span>
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-2xl text-white leading-none">{totals.customers}</span>
              <span className="font-body text-xs text-neutral-400 mt-1">Booking accounts</span>
            </div>
          </div>
          {totals.missingGame > 0 && (
            <p className="font-body text-xs text-neutral-500">
              {totals.missingGame} of {totals.bookings} have no game recorded.
            </p>
          )}
        </StatCard>

        <StatCard title="Bookings by month">
          <div className="flex flex-col gap-1">
            {trend.map(t => (
              <div key={t.month} className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-body text-xs text-neutral-400">{t.label}</span>
                <div className="flex-1 h-2 rounded-full bg-neutral-700 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${(t.count / peak) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right font-body text-xs text-neutral-300">{t.count}</span>
              </div>
            ))}
          </div>
        </StatCard>
      </ColumnBody>
    </ColumnShell>
  );
}

function WhatWhoColumn({ bookings, loading }: { bookings: StoreBooking[]; loading: boolean }) {
  const games     = useMemo(() => gameCounts(bookings), [bookings]);
  const customers = useMemo(() => customerCounts(bookings), [bookings]);

  return (
    <ColumnShell>
      <ColumnHeader icon={<DiceIcon />} title="What & Who" description="The games and the regulars." />
      <ColumnBody loading={loading} empty={bookings.length === 0}>
        <CountListCard
          title="Most Booked Games"
          rows={games}
          total={bookings.length}
          showIcon
        />
        <CountListCard
          title="Most Frequent Bookers"
          subtitle="By booking account — staff booking for walk-ins counts as one."
          rows={customers}
          total={bookings.length}
        />
      </ColumnBody>
    </ColumnShell>
  );
}

function WhenColumn({ bookings, loading }: { bookings: StoreBooking[]; loading: boolean }) {
  const days  = useMemo(() => weekdayCounts(bookings), [bookings]);
  const slots = useMemo(() => timeslotCounts(bookings), [bookings]);

  return (
    <ColumnShell>
      <ColumnHeader icon={<ClockIcon />} title="When" description="Your busiest days and timeslots." />
      <ColumnBody loading={loading} empty={bookings.length === 0}>
        <CountListCard title="Busiest Days" rows={days} total={bookings.length} />
        <CountListCard title="Busiest Timeslots" rows={slots} total={bookings.length} />
      </ColumnBody>
    </ColumnShell>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StoreStatsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const { adminLocations } = useAdminLocations(userId);

  // Only ever a venue this user administers; defaults to their first.
  const [venueId, setVenueId] = useState('');
  useEffect(() => {
    if (!venueId && adminLocations.length > 0) setVenueId(adminLocations[0].id);
  }, [adminLocations, venueId]);

  const { bookings, loading } = useStoreStats(venueId || null);

  const [range, setRange] = useState<TimeRange>('all');
  const [year,  setYear]  = useState<number | null>(null);
  const years = useMemo(() => bookingYears(bookings), [bookings]);

  useEffect(() => {
    if (range === 'year' && year == null && years.length > 0) setYear(years[0]);
  }, [range, years, year]);

  const filtered = useMemo(
    () => filterBookingsByRange(bookings, range, year ?? undefined),
    [bookings, range, year],
  );

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />}>
        {adminLocations.length > 0 && (
          <StoreSelector
            locations={adminLocations}
            selectedId={venueId}
            onSelect={setVenueId}
            headerLabel="Stats for"
          />
        )}
      </AppNavbar>

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          <OverviewColumn
            bookings={filtered} loading={loading}
            range={range} year={year} years={years}
            onRange={setRange} onYear={setYear}
          />
          <WhatWhoColumn bookings={filtered} loading={loading} />
          <WhenColumn    bookings={filtered} loading={loading} />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
