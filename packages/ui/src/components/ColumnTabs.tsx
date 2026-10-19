/**
 * ColumnTabs.tsx — the navbar's quick-jump row of column icons (Figma
 * "Tab Menu - Icon", 1153:2927).
 *
 *   [▢] [▢] [▢] [▢] [▢]
 *       LABEL LABEL         ← shown on hover, and on every column in view
 *
 * One icon per column, borrowed from that column's ColumnHeader. Default shows
 * the icon alone; Selected (the column is fully on screen) and Hover add the
 * short label beneath. Showing a label widens a tab, so the row shifts a little
 * as columns scroll in and out — that's intended.
 *
 * Presentational: the Navbar feeds it from useColumnTabs() and decides whether
 * there's room to show it at all.
 */

import { forwardRef } from 'react';
import type { ReactNode } from 'react';

export interface ColumnTabItem {
  id: string;
  label: string;
  /** Any icon node; it's resized to 24px and recoloured to the tab's state. */
  icon: ReactNode;
  /** The column is fully in view → Selected. */
  active?: boolean;
}

export interface ColumnTabsProps {
  tabs: ColumnTabItem[];
  onSelect: (id: string) => void;
  /** Extra classes on the root. */
  className?: string;
}

const ColumnTabs = forwardRef<HTMLDivElement, ColumnTabsProps>(function ColumnTabs(
  { tabs, onSelect, className = '' },
  ref,
) {
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Jump to column"
      className={`flex gap-2.5 items-center justify-center px-[30px] ${className}`.trim()}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-label={tab.label}
          aria-current={tab.active ? 'true' : undefined}
          onClick={() => onSelect(tab.id)}
          className={[
            'group flex flex-col items-center justify-center h-10 shrink-0 cursor-pointer transition-colors',
            // The icon carries its own size and colour for the header; take both
            // over so it reads as a tab.
            '[&_svg]:size-6! [&_svg]:text-current!',
            tab.active ? 'text-primary-200' : 'text-neutral-600',
            'hover:text-primary-400 focus-visible:text-primary-400 focus-visible:outline-none',
          ].join(' ')}
        >
          <span className="flex size-6 items-center justify-center" aria-hidden="true">
            {tab.icon}
          </span>
          <span
            aria-hidden="true"
            className={[
              'font-body font-bold text-[10px] leading-4 uppercase whitespace-nowrap',
              tab.active ? 'block text-neutral-300' : 'hidden',
              'group-hover:block group-hover:text-primary-400',
              'group-focus-visible:block group-focus-visible:text-primary-400',
            ].join(' ')}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
});

export default ColumnTabs;
