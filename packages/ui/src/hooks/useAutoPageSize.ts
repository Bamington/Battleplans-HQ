import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * How many fixed-height items fit inside `ref`'s current height.
 *
 * Used by the home-screen columns: each column fills the viewport, its list box
 * takes whatever height is left over, and this decides how many rows to show
 * before paginating. Recomputes whenever the box resizes (window resize,
 * breakpoint change, a sibling growing/shrinking).
 *
 * The item height is a caller-supplied constant rather than measured — the rows
 * in each list are a fixed design height. If a row's design changes, update the
 * constant next to it.
 *
 * Safe against feedback loops: the observed box is `flex-1 min-h-0` with hidden
 * overflow, so its height is set by its parent, never by how many items we put
 * in it.
 *
 * @param ref        The list container to measure.
 * @param itemHeight Row height in px.
 * @param gap        Vertical gap between rows in px.
 * @returns Items per page — always at least 1.
 */
export function useAutoPageSize(
  ref: RefObject<HTMLElement | null>,
  itemHeight: number,
  gap = 0,
): number {
  const [pageSize, setPageSize] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // n rows occupy n*itemHeight + (n-1)*gap, so n = (h + gap) / (itemHeight + gap)
      const n = Math.floor((el.clientHeight + gap) / (itemHeight + gap));
      setPageSize(Math.max(1, n));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, itemHeight, gap]);

  return pageSize;
}
