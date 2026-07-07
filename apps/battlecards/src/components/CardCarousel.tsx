/**
 * CardCarousel.tsx — Horizontal card viewer for every card-builder.
 *
 * Renders the WHOLE deck as one horizontal scroll-snap strip: every card is
 * mounted up-front (no windowing), each sits in a fixed fit-to-viewport slot,
 * and snaps to centre as you scroll. The card whose slot is centred is reported
 * via `onActiveChange` so the editor edits it.
 *
 * Zoom scales the card *inside* its fixed slot via a transform, so zooming is
 * smooth (GPU transform, animated) and never shifts the scroll geometry — the
 * centred card stays centred and the snap points don't move. Fit-scale (auto
 * fit to the viewport) resizes the slots and is applied instantly.
 *
 * Shared by every game builder. The prop API is kept stable so callers don't
 * need to change; `role`/`onNavigateStart`/`use3D` are preserved for
 * compatibility (role is 'active' for the centred card, 'prev' otherwise).
 *
 * USAGE:
 *   <CardCarousel
 *     items={cards}
 *     activeId={activeCardId}
 *     onActiveChange={setActiveCardId}
 *     cardWidth={CARD_W}
 *     cardHeight={CARD_H}
 *     renderItem={card => <SomeCard {...card} />}
 *     className="w-full flex-1 min-h-0"
 *   />
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DependencyList,
  type ReactNode,
} from 'react';
import Card3DWrapper from './Card3DWrapper';
import ZoomControls from './ZoomControls';

// ── Constants ────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'drop-shadow(0 5.571px 75.215px rgba(30,31,110,0.75))';
const CARD_GAP    = 20; // px gap between the visible cards, at any zoom level
// The centred card fills at most this fraction of the viewport width, so the
// neighbouring cards always peek in on each side (signalling "more cards").
const FIT_WIDTH_FRACTION = 0.8;
const ZOOM_MS   = 320;                            // zoom animation duration
const ZOOM_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

// ── Types ────────────────────────────────────────────────────────────────────

export type CardCarouselRole = 'prev' | 'active' | 'next';

export interface CardCarouselProps<T extends { id: string }> {
  items:          T[];
  activeId:       string;
  onActiveChange: (id: string) => void;
  /** Bounding-box width. Drives the fit-scale so every card renders at the same
   *  scale. For mixed decks pass the **max** width across all card types. */
  cardWidth:      number;
  /** Bounding-box height. Same role as `cardWidth` on the vertical axis. For
   *  mixed decks pass the **max** height. */
  cardHeight:     number;
  /** Optional per-item dimension override (native size). Useful for mixed
   *  decks (e.g. Kill Team operative cards alongside taller rule cards). */
  getItemDimensions?: (item: T) => { width: number; height: number };
  /** Render the card content for an item, given its role ('active' when centred). */
  renderItem:     (item: T, role: CardCarouselRole) => ReactNode;
  /** Called when the centred (active) card changes (e.g. to fade a popover). */
  onNavigateStart?: () => void;
  /** Wrap each card in Card3DWrapper (hover-tilt effect). Default true. */
  use3D?:         boolean;
  /** Initial zoom level (0.5–1.0). Default 1.0 (max). */
  initialZoom?:   number;
  /** Optional bottom overlay content rendered over the viewport. */
  bottomLeftSlot?:  ReactNode;
  bottomRightSlot?: ReactNode;
  /** Force a re-measure of the viewport when these change (panel toggle, mode
   *  switch, breakpoint flip). */
  layoutDeps?:    DependencyList;
  /** Hide the zoom controls below the viewport. Default false. */
  hideZoomControls?: boolean;
  /** Render zoom buttons centred inside the bottom overlay strip instead of a
   *  row beneath the carousel. Default false. */
  zoomControlsInline?: boolean;
  /** Extra classes for the outer flex column. */
  className?:     string;
}

// ── Component ────────────────────────────────────────────────────────────────

const CardCarousel = <T extends { id: string }>({
  items,
  activeId,
  onActiveChange,
  cardWidth,
  cardHeight,
  getItemDimensions,
  renderItem,
  onNavigateStart,
  use3D            = true,
  initialZoom      = 1.0,
  bottomLeftSlot,
  bottomRightSlot,
  layoutDeps,
  hideZoomControls    = false,
  zoomControlsInline  = false,
  className           = '',
}: CardCarouselProps<T>) => {

  const total = items.length;
  const dimsOf = (item: T): { width: number; height: number } =>
    getItemDimensions ? getItemDimensions(item) : { width: cardWidth, height: cardHeight };

  // ── Zoom & fit-scale ──────────────────────────────────────────────────────
  const [zoomLevel,    setZoomLevel]    = useState(initialZoom);
  const [fitScale,     setFitScale]     = useState(0);   // 0 until first measure
  const [containerW,   setContainerW]   = useState(0);
  const [zoomAnim,     setZoomAnim]     = useState(false); // true during a zoom transition
  const cardScale = fitScale * zoomLevel;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardEls     = useRef(new Map<string, HTMLDivElement>());
  const activeIdRef = useRef(activeId); activeIdRef.current = activeId;
  const lastReportedRef = useRef(activeId);
  const programmaticRef = useRef(false);
  const progTimerRef    = useRef<number>(0);
  const scrollTimerRef   = useRef<number>(0);
  const zoomAnimatingRef = useRef(false);
  const zoomTimerRef     = useRef<number>(0);
  const rafRef           = useRef<number>(0);

  // Fit scale = fit the bounding box into the viewport (so mixed decks don't
  // pop when navigating). Measured off the scroll viewport's BORDER box
  // (getBoundingClientRect), never the content box — the side padding we add to
  // centre the first/last cards would otherwise shrink the content box and feed
  // back into the measurement, leaving the ends off-centre.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerW(r.width);
      setFitScale(Math.min((r.width * FIT_WIDTH_FRACTION) / cardWidth, r.height / cardHeight));
    };
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [cardWidth, cardHeight]);

  // Re-measure on layout-affecting external changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setContainerW(r.width);
    setFitScale(Math.min((r.width * FIT_WIDTH_FRACTION) / cardWidth, r.height / cardHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, layoutDeps ?? []);

  // Snap the active card to the viewport centre using its CURRENT (possibly
  // mid-transition) size. Sets scrollLeft directly — no smooth behaviour.
  const centreActiveNow = () => {
    const scroller = scrollerRef.current;
    const el = cardEls.current.get(activeIdRef.current);
    if (!scroller || !el) return;
    scroller.scrollLeft = Math.max(0, el.offsetLeft + el.offsetWidth / 2 - scroller.clientWidth / 2);
  };

  // Zoom with a smooth transition: the slot size + card transform animate
  // together, and a rAF loop re-centres the active card every frame so it stays
  // put while the cards around it resize (keeping the 20px gap constant).
  const runZoom = (next: (z: number) => number) => {
    setZoomAnim(true);
    zoomAnimatingRef.current = true;
    setZoomLevel(next);
    window.cancelAnimationFrame(rafRef.current);
    window.clearTimeout(zoomTimerRef.current);
    // Re-centre the active card every frame while the sizes animate. (No
    // programmaticRef guard needed — the card stays centred, so if the scroll
    // listener fires it just re-detects the same active card, a no-op.)
    const startedAt = performance.now();
    const step = () => {
      centreActiveNow();
      if (performance.now() - startedAt < ZOOM_MS + 40) {
        rafRef.current = window.requestAnimationFrame(step);
      }
    };
    rafRef.current = window.requestAnimationFrame(step);
    // Settle: drop the transition once the animation is done.
    zoomTimerRef.current = window.setTimeout(() => {
      zoomAnimatingRef.current = false;
      setZoomAnim(false);
      centreActiveNow();
    }, ZOOM_MS + 40);
  };
  const zoomOut = () => runZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))));
  const zoomIn  = () => runZoom(z => Math.min(1.0, parseFloat((z + 0.1).toFixed(1))));

  // ── Centre a card in the viewport ─────────────────────────────────────────
  const centerCard = useCallback((id: string, behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current;
    const el = cardEls.current.get(id);
    if (!scroller || !el) return;
    const target = el.offsetLeft + el.offsetWidth / 2 - scroller.clientWidth / 2;
    programmaticRef.current = true;
    window.clearTimeout(progTimerRef.current);
    scroller.scrollTo({ left: Math.max(0, target), behavior });
    // Release the guard once the (possibly smooth) scroll has settled.
    progTimerRef.current = window.setTimeout(
      () => { programmaticRef.current = false; },
      behavior === 'smooth' ? 450 : 60,
    );
  }, []);

  // Keep the active card centred on zoom / fit-scale / layout changes. The
  // slots resize with cardScale (so the gap between cards stays constant), so
  // zoom must re-centre the active card — done instantly, before paint.
  useLayoutEffect(() => {
    // During a zoom the rAF loop owns centring; skip the instant snap so they
    // don't fight.
    if (fitScale > 0 && !zoomAnimatingRef.current) centerCard(activeIdRef.current, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardScale, containerW, ...(layoutDeps ?? [])]);

  // Centre when the active card is changed from OUTSIDE (list click, new card).
  // Skip when the change came from our own scroll detection.
  useEffect(() => {
    if (activeId === lastReportedRef.current) return;
    lastReportedRef.current = activeId;
    centerCard(activeId, 'smooth');
  }, [activeId, centerCard]);

  // ── Active-card detection on scroll ───────────────────────────────────────
  // Latest detection logic kept in a ref so the once-attached native listener
  // always sees current props without re-binding.
  const detectActiveRef = useRef<() => void>(() => {});
  detectActiveRef.current = () => {
    const scroller = scrollerRef.current;
    // Skip while a zoom is animating (the active card is being held centred) or
    // during a programmatic scroll — either would spuriously change the active.
    if (!scroller || programmaticRef.current || zoomAnimatingRef.current) return;
    const centre = scroller.scrollLeft + scroller.clientWidth / 2;
    let bestId: string | null = null;
    let bestDist = Infinity;
    cardEls.current.forEach((el, id) => {
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(c - centre);
      if (d < bestDist) { bestDist = d; bestId = id; }
    });
    if (bestId && bestId !== activeIdRef.current) {
      lastReportedRef.current = bestId;
      onNavigateStart?.();
      onActiveChange(bestId);
    }
  };

  // Native scroll listener (not React onScroll / rAF): fires reliably for real
  // scrolls and isn't tied to the frame pipeline. Debounced so it resolves the
  // settled/snapped card. Attached once; reads latest logic via the ref.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticRef.current || zoomAnimatingRef.current) return;
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => detectActiveRef.current(), 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(scrollTimerRef.current);
    window.clearTimeout(progTimerRef.current);
    window.clearTimeout(zoomTimerRef.current);
    window.cancelAnimationFrame(rafRef.current);
  }, []);

  // Leading/trailing spacers let the first and last cards scroll to centre.
  // (Real spacer elements — not scroller padding — because a flex scroll
  // container drops its trailing padding, leaving the last card off-centre.)
  // Each spacer is sized from THAT end's actual card width (decks can mix card
  // sizes, e.g. operatives + narrower rule cards), and the flex columnGap
  // already covers part of the centring margin.
  const firstSlotW = (total ? dimsOf(items[0]).width         : cardWidth) * cardScale;
  const lastSlotW  = (total ? dimsOf(items[total - 1]).width : cardWidth) * cardScale;
  const leadSpacerW  = Math.max(0, (containerW - firstSlotW) / 2 - CARD_GAP);
  const trailSpacerW = Math.max(0, (containerW - lastSlotW)  / 2 - CARD_GAP);

  const setCardEl = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardEls.current.set(id, el);
    else    cardEls.current.delete(id);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (total === 0) {
    return <div className={`flex flex-col items-center ${className}`} />;
  }

  const scrollerStyle: CSSProperties = {
    columnGap:  CARD_GAP,
    // Hide until the first measure so cards don't flash at fitScale 0/1.
    visibility: fitScale > 0 ? 'visible' : 'hidden',
  };
  const spacerStyleFor = (w: number): CSSProperties => ({
    width:      w,
    transition: zoomAnim ? `width ${ZOOM_MS}ms ${ZOOM_EASE}` : 'none',
  });

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Viewport — position:relative anchors the bottom overlays. */}
      <div className="relative w-full flex-1 min-h-0">
        <div
          ref={scrollerRef}
          className="absolute inset-0 flex items-center overflow-x-auto overflow-y-hidden
                     snap-x snap-mandatory select-none
                     [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={scrollerStyle}
        >
          {/* Leading spacer — lets the first card scroll to centre. */}
          <div aria-hidden="true" className="shrink-0" style={spacerStyleFor(leadSpacerW)} />
          {items.map(item => {
            const d = dimsOf(item);
            // Slot tracks the card's *visible* size (dims × cardScale) so the
            // gap between cards stays a constant CARD_GAP at every zoom level.
            const slotW = d.width  * cardScale;
            const slotH = d.height * cardScale;
            const isActive = item.id === activeId;
            const card = (
              <div
                style={{
                  width:           d.width,
                  height:          d.height,
                  transform:       `scale(${cardScale})`,
                  transformOrigin: 'center center',
                  transition:      zoomAnim ? `transform ${ZOOM_MS}ms ${ZOOM_EASE}` : 'none',
                  filter:          CARD_SHADOW,
                }}
              >
                {use3D ? (
                  <Card3DWrapper style={{ width: d.width, height: d.height }}>
                    {renderItem(item, isActive ? 'active' : 'prev')}
                  </Card3DWrapper>
                ) : (
                  renderItem(item, isActive ? 'active' : 'prev')
                )}
              </div>
            );
            return (
              <div
                key={item.id}
                ref={setCardEl(item.id)}
                data-card-id={item.id}
                className="shrink-0 snap-center snap-always flex items-center justify-center"
                style={{
                  width:      slotW,
                  height:     slotH,
                  transition: zoomAnim ? `width ${ZOOM_MS}ms ${ZOOM_EASE}, height ${ZOOM_MS}ms ${ZOOM_EASE}` : 'none',
                }}
              >
                {card}
              </div>
            );
          })}
          {/* Trailing spacer — lets the last card scroll to centre. */}
          <div aria-hidden="true" className="shrink-0" style={spacerStyleFor(trailSpacerW)} />
        </div>

        {/* Bottom overlays (game-specific buttons / menus) */}
        {bottomLeftSlot  && <div className="absolute bottom-4 left-4 z-40">{bottomLeftSlot}</div>}
        {bottomRightSlot && <div className="absolute bottom-4 right-4 z-40">{bottomRightSlot}</div>}
        {!hideZoomControls && zoomControlsInline && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
            <ZoomControls zoomLevel={zoomLevel} onZoomOut={zoomOut} onZoomIn={zoomIn} />
          </div>
        )}
      </div>

      {/* Zoom controls — default position: a row below the viewport. */}
      {!hideZoomControls && !zoomControlsInline && (
        <div className="shrink-0 flex items-center justify-center py-3">
          <ZoomControls zoomLevel={zoomLevel} onZoomOut={zoomOut} onZoomIn={zoomIn} />
        </div>
      )}
    </div>
  );
};

export default CardCarousel;
