/**
 * ColumnTabBar.tsx — the phone version of the navbar's column tabs (Figma
 * 1154:24454): the same <ColumnTabs>, in a bar along the bottom of the screen.
 *
 * Below `md` the navbar has no room for the tabs, so they move down here.
 * Mount it as the last thing in a home page's viewport-height layout, so it
 * sits at the bottom of the screen:
 *
 *   <AppNavbar … />
 *   <main>…column row…</main>
 *   <AppFooter … />
 *   <ColumnTabBar />
 *
 * Reads the same column registry as the navbar (see lib/columnTabs), so it
 * shows only when the row has columns off screen, and only on phones. It hides
 * while a text field has focus, because otherwise it rides up above the
 * keyboard and takes room from the column you're typing in.
 */

import { useEffect, useState } from 'react';
import ColumnTabs from './ColumnTabs';
import type { ColumnTabItem } from './ColumnTabs';
import { useColumnTabs } from '../lib/columnTabs';

/** Input types that don't bring up a keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/** True while a field that opens the on-screen keyboard has focus. */
function useTyping(): boolean {
  const [typing, setTyping] = useState(() => opensKeyboard(document.activeElement));
  useEffect(() => {
    // focusout fires before focus lands on the next field, so read
    // activeElement a tick later rather than trusting either event alone.
    const update = () => setTimeout(() => setTyping(opensKeyboard(document.activeElement)));
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return typing;
}

export interface ColumnTabBarProps {
  /** Extra classes on the bar. */
  className?: string;
  /**
   * Overrides the column registry with a fixed set of tabs, shown at every
   * width. Normally omitted — pass it only to render a demo (e.g. the
   * component gallery), like Navbar's `apps`.
   */
  tabs?: ColumnTabItem[];
  /** Called with a tab's id when `tabs` is given. */
  onSelect?: (id: string) => void;
}

export default function ColumnTabBar({ className = '', tabs: fixedTabs, onSelect }: ColumnTabBarProps) {
  const { tabs, overflowing, reveal } = useColumnTabs();
  const typing = useTyping();

  const live = !fixedTabs;
  if (live && (!overflowing || tabs.length < 2)) return null;

  return (
    <div
      className={[
        'shrink-0 bg-gray-900 border-t border-gray-800 pb-safe pl-safe pr-safe',
        live ? 'md:hidden' : '',
        live && typing ? 'hidden' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <ColumnTabs
        className="py-2.5"
        tabs={fixedTabs ?? tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon, active: t.visible }))}
        onSelect={fixedTabs ? (id) => onSelect?.(id) : reveal}
      />
    </div>
  );
}
