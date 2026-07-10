/**
 * Pagination.tsx — Pager for the home-screen column cards.
 *
 * Pages are 0-based. Renders nothing when there's only one page, so callers can
 * drop it in unconditionally at the bottom of a column.
 *
 * Page counts are derived from the available height (see useAutoPageSize), so a
 * short viewport can produce a lot of pages. Rather than render one button per
 * page (which would overflow the column), we show at most MAX_PAGE_BUTTONS
 * numbers in a window that slides around the current page. Every column then
 * looks the same whether it has 3 pages or 30.
 *
 * USAGE:
 *   <Pagination page={page} totalPages={totalPages} onPage={setPage} />
 */

import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';

export interface PaginationProps {
  /** Current page, 0-based. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called with the new 0-based page. */
  onPage: (page: number) => void;
  /** Extra classes on the wrapper. */
  className?: string;
}

/** Most page buttons ever rendered; beyond this the window slides. */
const MAX_PAGE_BUTTONS = 5;

/**
 * The window of page indices to render, clamped to the ends so we always show
 * MAX_PAGE_BUTTONS (or every page, when there are fewer).
 */
function pageWindow(page: number, totalPages: number): number[] {
  const size  = Math.min(MAX_PAGE_BUTTONS, totalPages);
  const half  = Math.floor(size / 2);
  const start = Math.max(0, Math.min(page - half, totalPages - size));
  return Array.from({ length: size }, (_, i) => start + i);
}

const ARROW =
  'size-9 flex items-center justify-center bg-gray-900 text-gray-400 ' +
  'hover:text-white hover:bg-gray-800 transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export default function Pagination({ page, totalPages, onPage, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);

  return (
    <div className={['flex items-center justify-center shrink-0', className].filter(Boolean).join(' ')}>

      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className={`${ARROW} border border-gray-700 rounded-l-lg`}
        aria-label="Previous page"
      >
        <AltArrowLeft className="size-4" />
      </button>

      {pages.map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onPage(i)}
          aria-current={i === page ? 'page' : undefined}
          aria-label={`Page ${i + 1} of ${totalPages}`}
          className={[
            'size-9 flex items-center justify-center font-body text-sm',
            'border-y border-r border-gray-700 transition-colors',
            i === page
              ? 'bg-gray-800 text-white'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white',
          ].join(' ')}
        >
          {i + 1}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
        className={`${ARROW} border-y border-r border-gray-700 rounded-r-lg`}
        aria-label="Next page"
      >
        <AltArrowRight className="size-4" />
      </button>

    </div>
  );
}
