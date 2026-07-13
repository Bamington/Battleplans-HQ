/**
 * Column.tsx — Reusable dashboard columns with a built-in navigation behaviour.
 *
 * Home screens are built from columns that all share the same frame (a bordered,
 * rounded, snap-scrolling panel with a ColumnHeader on top and an optional footer
 * pinned to the bottom) but differ in how the list navigates:
 *
 *   • <PaginatedColumn> — a fixed-height list that fills the visible space and
 *     pages with a <Pagination> control. Best for uniform rows (bookings, news).
 *
 *   • <ScrollColumn> — a scrolling list, optionally with infinite scroll
 *     (`hasMore` + `onLoadMore`, fired by an IntersectionObserver near the end).
 *     Best for long or variable-height content (battles).
 *
 * Both take the same header/footer/item props, so a new column just picks the
 * navigation that fits. `ColumnShell` is exported for the rare column that needs
 * a bespoke body but the standard frame.
 */

import { useEffect, useRef, useState, Fragment } from 'react';
import type { ReactNode, Key } from 'react';
import ColumnHeader from './ColumnHeader';
import type { ColumnHeaderToggle } from './ColumnHeader';
import Pagination from './Pagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';

// ── Shell ─────────────────────────────────────────────────────────────────────

export interface ColumnShellProps {
  /** Double the desktop width (e.g. a two-up gallery). */
  wide?: boolean;
  /** Extra classes on the outer panel. */
  className?: string;
  children: ReactNode;
}

/** The panel frame + padded inner container shared by every column. */
export function ColumnShell({ wide = false, className = '', children }: ColumnShellProps) {
  return (
    <div
      className={[
        'bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always',
        'w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto',
        'flex flex-col min-h-0 shadow-md overflow-hidden transition-[max-width]',
        wide ? 'lg:flex-[2] lg:max-w-3xl' : 'lg:flex-1 lg:max-w-sm',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

/** The centred muted line used for loading / empty states inside a column. */
function ColumnMessage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-body text-sm text-neutral-500 text-center py-4 ${className}`.trim()}>
      {children}
    </p>
  );
}

// ── Shared column props ───────────────────────────────────────────────────────

interface ColumnBaseProps<T> {
  /** 48px header icon (carries its own colour). */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional view toggle in the header (see ColumnHeader). */
  toggle?: ColumnHeaderToggle;
  /** Items to render. */
  items: T[];
  /** Render one item. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable React key for an item. */
  getKey: (item: T, index: number) => Key;
  /** Still loading the first batch — shows a loading line instead of the list. */
  loading?: boolean;
  /** Copy shown while loading. */
  loadingLabel?: ReactNode;
  /** Content shown when there are no items. */
  empty?: ReactNode;
  /** Classes on the list element (e.g. a grid). Defaults to a vertical stack. */
  listClassName?: string;
  /** Content between the header and the list (e.g. a segmented toggle). */
  beforeList?: ReactNode;
  /** Content pinned below the list (e.g. action buttons). */
  footer?: ReactNode;
  /** Double the desktop width. */
  wide?: boolean;
  /** Extra classes on the outer panel. */
  className?: string;
}

const DEFAULT_LIST = 'flex flex-col gap-1.5';

// ── Paginated column ──────────────────────────────────────────────────────────

export interface PaginatedColumnProps<T> extends ColumnBaseProps<T> {
  /** Rendered row height in px — how many fit decides the page size. */
  itemHeight: number;
  /** Vertical gap between rows in px (match `listClassName`'s gap). */
  gap?: number;
  /** When this value changes, jump back to the first page (e.g. a filter change). */
  resetPageKey?: unknown;
}

export function PaginatedColumn<T>({
  icon, title, description, toggle,
  items, renderItem, getKey,
  loading = false, loadingLabel = 'Loading…', empty = 'Nothing here yet.',
  listClassName = DEFAULT_LIST, beforeList, footer, wide, className,
  itemHeight, gap = 6, resetPageKey,
}: PaginatedColumnProps<T>) {
  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, itemHeight, gap);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = items.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Snap back into range when the list shrinks or the viewport resizes.
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);
  // Jump to the first page when the caller's reset key changes.
  useEffect(() => { setPage(0); }, [resetPageKey]);

  return (
    <ColumnShell wide={wide} className={className}>
      <ColumnHeader icon={icon} title={title} description={description} toggle={toggle} />
      {beforeList}
      <div ref={listRef} className={`w-full flex-1 min-h-0 overflow-hidden ${listClassName}`}>
        {loading
          ? <ColumnMessage>{loadingLabel}</ColumnMessage>
          : items.length === 0
            ? <ColumnMessage>{empty}</ColumnMessage>
            : paginated.map((item, i) => <Fragment key={getKey(item, i)}>{renderItem(item, i)}</Fragment>)}
      </div>
      <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
      {footer}
    </ColumnShell>
  );
}

// ── Scrolling column ──────────────────────────────────────────────────────────

export interface ScrollColumnProps<T> extends ColumnBaseProps<T> {
  /** More pages remain — shows the infinite-scroll sentinel. */
  hasMore?: boolean;
  /** A page is currently being fetched — shows a "loading more" line. */
  loadingMore?: boolean;
  /** Called when the sentinel scrolls near the end. Omit for plain scrolling. */
  onLoadMore?: () => void;
  /** Copy shown while fetching the next page. */
  loadingMoreLabel?: ReactNode;
}

export function ScrollColumn<T>({
  icon, title, description, toggle,
  items, renderItem, getKey,
  loading = false, loadingLabel = 'Loading…', empty = 'Nothing here yet.',
  listClassName = DEFAULT_LIST, beforeList, footer, wide, className,
  hasMore = false, loadingMore = false, onLoadMore, loadingMoreLabel = 'Loading more…',
}: ScrollColumnProps<T>) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root   = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore || !onLoadMore) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore(); },
      { root, rootMargin: '0px 0px 300px 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
    // Re-observe after each append so it keeps loading if the sentinel is still
    // in view (e.g. a very tall column).
  }, [hasMore, onLoadMore, items.length]);

  return (
    <ColumnShell wide={wide} className={className}>
      <ColumnHeader icon={icon} title={title} description={description} toggle={toggle} />
      {beforeList}
      {/* Outer box scrolls; the inner flex/grid stays content-sized so items keep
          their full height (a height-constrained flex/grid parent would shrink
          items that clip their own overflow). */}
      <div ref={scrollRef} className="w-full flex-1 min-h-0 overflow-y-auto">
        <div className={listClassName}>
          {loading
            ? <ColumnMessage>{loadingLabel}</ColumnMessage>
            : items.length === 0
              ? <ColumnMessage>{empty}</ColumnMessage>
              : items.map((item, i) => <Fragment key={getKey(item, i)}>{renderItem(item, i)}</Fragment>)}
        </div>
        {hasMore && onLoadMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
        {loadingMore && <ColumnMessage className="py-3">{loadingMoreLabel}</ColumnMessage>}
      </div>
      {footer}
    </ColumnShell>
  );
}
