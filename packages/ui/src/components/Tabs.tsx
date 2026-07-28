/**
 * Tabs.tsx — Tabbed content panel component
 *
 * USAGE EXAMPLES:
 *   <Tabs
 *     tabs={[
 *       { id: 'stats',    label: 'Stats',    content: <p>Stats content</p> },
 *       { id: 'abilities', label: 'Abilities', content: <p>Abilities content</p> },
 *       { id: 'lore',     label: 'Lore',     content: <p>Lore content</p>, disabled: true },
 *     ]}
 *   />
 *
 *   <Tabs variant="underline" defaultTab="abilities" tabs={[...]} />
 *
 *   <Tabs
 *     variant="pills"
 *     tabs={[
 *       { id: 'a', label: 'Overview', icon: <Star className="w-4 h-4" />, content: <p>...</p> },
 *     ]}
 *   />
 */

import React, { useState } from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

/**
 * Visual style of the tab bar.
 *
 * `segmented` is the joined, full-width button group from the design system —
 * the selected tab is a solid primary button and the rest are outlined, sharing
 * edges with no gap. Unlike the other variants it is themed from `primary-*`
 * rather than blue/grey, so it takes on each app's accent.
 */
export type TabsVariant = 'default' | 'underline' | 'pills' | 'fullWidth' | 'segmented';

export interface TabItem {
  /** Unique identifier for this tab */
  id: string;
  /** Text label shown on the tab */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Prevents selection of this tab */
  disabled?: boolean;
  /** Content rendered when this tab is active */
  content: React.ReactNode;
}

export interface TabsProps {
  /** Tab definitions including their content */
  tabs: TabItem[];
  /** Visual style of the tab bar */
  variant?: TabsVariant;
  /** ID of the tab that is active on first render. Ignored when `activeTab` is set. */
  defaultTab?: string;
  /**
   * Controlled mode: the id of the active tab. Pass this together with
   * `onTabChange` when something outside the tab bar also selects tabs — in
   * BattlePack the left-hand category nav is the sole source of truth for
   * which section is showing, and clicking a category has to switch the centre
   * tab. Uncontrolled tabs cannot be driven from outside, so they would end up
   * disagreeing with the nav.
   *
   * Omit both and the component keeps its own state, as before.
   */
  activeTab?: string;
  /** Fires with the tab id when a tab is clicked. Required for controlled mode. */
  onTabChange?: (tabId: string) => void;
  /**
   * Extra Tailwind classes on the tab panel.
   * Use to suppress the panel border when Tabs is placed inside a Card:
   *   panelClassName="border-0 rounded-none p-5"
   */
  panelClassName?: string;
  /** Extra Tailwind classes on the root container */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

/** Container classes for each tab list style */
const listClasses: Record<TabsVariant, string> = {
  default:   'flex flex-wrap text-sm font-medium text-center',
  underline: 'flex flex-wrap -mb-px text-sm font-medium text-center border-b border-gray-200 dark:border-gray-700',
  pills:     'flex flex-wrap gap-2 text-sm font-medium text-center',
  fullWidth: 'flex w-full divide-x divide-gray-200 dark:divide-gray-700 rounded-lg shadow-xs text-sm font-medium text-center overflow-hidden',
  // No rounding or clipping here — see the note on the button classes below.
  segmented: 'flex w-full h-10 text-sm font-medium text-center',
};

/** Active tab button classes per variant */
const activeTabClasses: Record<TabsVariant, string> = {
  default:   'inline-flex items-center gap-2 p-4 rounded-t-lg text-blue-600 bg-gray-100 dark:bg-gray-800 dark:text-blue-500',
  underline: 'inline-flex items-center gap-2 p-4 border-b-2 border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500',
  pills:     'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white bg-blue-600',
  fullWidth: 'inline-flex flex-1 items-center justify-center gap-2 p-4 text-blue-600 bg-gray-100 dark:bg-gray-800 dark:text-blue-500',
  segmented: 'inline-flex flex-1 items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white',
};

/** Inactive tab button classes per variant */
const inactiveTabClasses: Record<TabsVariant, string> = {
  default:
    'inline-flex items-center gap-2 p-4 rounded-t-lg text-gray-500 ' +
    'hover:text-gray-600 hover:bg-gray-50 ' +
    'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300',
  underline:
    'inline-flex items-center gap-2 p-4 border-b-2 border-transparent text-gray-500 ' +
    'hover:text-gray-600 hover:border-gray-300 ' +
    'dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600',
  pills:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-gray-500 ' +
    'hover:text-gray-600 hover:bg-gray-100 ' +
    'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300',
  fullWidth:
    'inline-flex flex-1 items-center justify-center gap-2 p-4 text-gray-500 ' +
    'hover:text-gray-600 hover:bg-gray-50 ' +
    'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300',
  segmented:
    'inline-flex flex-1 items-center justify-center gap-2 px-3 py-2 ' +
    'border border-primary-500 text-primary-500 hover:bg-primary-950 transition-colors',
};

/** Disabled tab button classes (same for all variants) */
const DISABLED_TAB_CLASSES =
  'inline-flex items-center gap-2 p-4 text-gray-400 dark:text-gray-500 cursor-not-allowed';

/**
 * Rounding for the two ends of a segmented row.
 *
 * This lives on the buttons rather than on the container because the container
 * would have to clip to round them, and clipping shaves the outlined buttons'
 * 1px border off at the corners — the stroke stops short of where the curve is.
 * Rounding the element the border is drawn on keeps the two in step.
 */
function segmentedEdge(index: number, count: number): string {
  if (count === 1) return 'rounded-lg';
  if (index === 0) return 'rounded-l-lg';
  if (index === count - 1) return 'rounded-r-lg';
  // Middle buttons overlap their neighbour's border so the shared edge stays 1px.
  return '-ml-px';
}

// ── Component ─────────────────────────────────────────────────────────────────

const Tabs = ({
  tabs,
  variant        = 'default',
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  panelClassName = '',
  className      = '',
}: TabsProps) => {

  // Default to first non-disabled tab if no defaultTab is specified
  const firstEnabled = tabs.find((t) => !t.disabled)?.id ?? tabs[0]?.id;
  const [uncontrolledTab, setUncontrolledTab] = useState<string>(defaultTab ?? firstEnabled);

  // Controlled when a tab id is supplied, uncontrolled otherwise. The internal
  // state is still updated in controlled mode so that dropping the prop later
  // does not snap the panel back to whatever was active before.
  const isControlled = controlledTab !== undefined;
  const activeTab    = isControlled ? controlledTab : uncontrolledTab;

  const selectTab = (tabId: string) => {
    if (!isControlled) setUncontrolledTab(tabId);
    onTabChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={`w-full ${className}`}>

      {/* Tab list */}
      <div role="tablist" className={listClasses[variant]}>
        {tabs.map((tab, index) => {
          const isActive   = tab.id === activeTab;
          const isDisabled = tab.disabled ?? false;

          const baseClasses = isDisabled
            ? DISABLED_TAB_CLASSES
            : isActive
              ? activeTabClasses[variant]
              : inactiveTabClasses[variant];

          const buttonClasses = variant === 'segmented'
            ? `${baseClasses} ${segmentedEdge(index, tabs.length)}`
            : baseClasses;

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              disabled={isDisabled}
              onClick={() => !isDisabled && selectTab(tab.id)}
              className={`font-body ${buttonClasses}`}
            >
              {tab.icon && (
                <span className="shrink-0" aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className={[
          'p-4 rounded-b-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none',
          panelClassName,
        ].filter(Boolean).join(' ')}
      >
        {activeContent}
      </div>

    </div>
  );
};

export default Tabs;
