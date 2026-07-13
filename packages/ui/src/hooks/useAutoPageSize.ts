import { useEffect, useRef, useState } from 'react';
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
 * The observed box may mount AFTER this hook first runs — e.g. a list that only
 * renders once its data has loaded, sitting behind a spinner until then. So the
 * effect runs on every render and (re)attaches the observer the moment the
 * element appears or is swapped, rather than giving up if `ref.current` was null
 * on mount.
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

  // The element currently under observation, and its observer. Tracked so the
  // no-deps effect below only re-attaches when the element actually changes.
  const observed = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  // Intentionally no dependency array: this runs after every render so it can
  // catch the observed element mounting later (null -> element). It early-exits
  // when nothing changed, so it never triggers a re-render loop.
  useEffect(() => {
    const el = ref.current;
    if (el === observed.current) return;

    observer.current?.disconnect();
    observed.current = el;
    if (!el) return;

    const measure = () => {
      // n rows occupy n*itemHeight + (n-1)*gap, so n = (h + gap) / (itemHeight + gap)
      const n = Math.floor((el.clientHeight + gap) / (itemHeight + gap));
      setPageSize(Math.max(1, n));
    };

    const obs = new ResizeObserver(measure);
    obs.observe(el);
    observer.current = obs;
    measure();
  });

  useEffect(() => () => observer.current?.disconnect(), []);

  return pageSize;
}
