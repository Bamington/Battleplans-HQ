/**
 * useScrollFocusIntoView — keep the focused field visible in a scrolling box.
 *
 * A long form inside a modal scrolls within the modal, not the page. Browsers
 * only scroll a focused element into view for their OWN focus moves — tabbing,
 * or the keyboard's next/previous buttons — so tapping a field low in the form,
 * or a field that only appears once an earlier answer is given, leaves the
 * caret somewhere the user cannot see. They then scroll by hand, which on a
 * phone means scrolling with the keyboard already covering half the screen.
 *
 * ── Two passes, on purpose ───────────────────────────────────────────────
 *
 * On a phone the on-screen keyboard opens AFTER focus lands and shrinks the
 * visual viewport, which can push the field straight back out of sight. So the
 * element is brought into view immediately — right for a desktop tab — and
 * again once the keyboard has settled. The second pass is usually a no-op,
 * because of the next point.
 *
 * `block: 'nearest'` does the least that works: it scrolls only when the
 * element is actually out of view, and only far enough. Anything else yanks a
 * perfectly visible field to the middle of the screen every time it is
 * touched, which feels broken in a different way.
 */

import { useEffect, type RefObject } from 'react';

/** How long to wait for the on-screen keyboard to finish opening. */
const KEYBOARD_SETTLE_MS = 300;

export function useScrollFocusIntoView(
  container: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const el = container.current;
    if (!el) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const bring = (target: HTMLElement) => {
      // Guard: jsdom and some older browsers have no scrollIntoView options.
      try {
        target.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      } catch {
        target.scrollIntoView();
      }
    };

    let timer: number | undefined;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.scrollIntoView !== 'function') return;
      bring(target);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Only if it still has focus — the user may have moved on already.
        if (document.activeElement === target) bring(target);
      }, KEYBOARD_SETTLE_MS);
    };

    // `focusin` rather than `focus`: it bubbles, so one listener on the
    // container covers every field inside it, including ones added later.
    el.addEventListener('focusin', onFocusIn);
    return () => {
      el.removeEventListener('focusin', onFocusIn);
      window.clearTimeout(timer);
    };
  }, [container, active]);
}
