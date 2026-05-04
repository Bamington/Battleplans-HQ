/**
 * CardCarousel.tsx — Generic horizontal card carousel for any game's card view.
 *
 * Three-slot strip (prev / active / next), with:
 *   • Pointer drag to swipe between items, with live scale+opacity interpolation
 *   • Click on an adjacent slot to navigate to it
 *   • Wrap-around navigation when there are ≥ 2 items
 *   • Container ResizeObserver → auto-fit scale
 *   • Zoom slider (0.5–1.0, in 0.1 steps) below the viewport
 *   • Active card optionally wrapped in `Card3DWrapper` for the hover tilt
 *   • Bottom-left / bottom-right overlay slots (for game-specific UI like
 *     play-mode buttons or token menus)
 *
 * The carousel is item-agnostic — pass any `T extends { id: string }` and a
 * `renderItem(item, role)` function. The role tells the renderer whether
 * the slot is `prev`, `active`, or `next`, so consumers can skip expensive
 * editing UI for the off-screen-ish slots.
 *
 * USAGE:
 *   <CardCarousel
 *     items={[card1, card2, card3]}
 *     activeId={activeCardId}
 *     onActiveChange={setActiveCardId}
 *     cardWidth={1270}
 *     cardHeight={890}
 *     renderItem={(card, role) =>
 *       <MyGameCard {...card} {...(role === 'active' ? editHandlers : {})} />
 *     }
 *   />
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react';
import Card3DWrapper from './Card3DWrapper';
import Button from './Button';
import MinusCircle from '../icons/MinusCircle';
import AddCircle from '../icons/AddCircle';

// ── Constants ────────────────────────────────────────────────────────────────

const ADJACENT_SCALE = 0.7;     // adjacent cards render at 70% of active scale
const CARD_GAP       = 40;      // px gap between cards
const ANIM           = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
const CARD_TRANS     = `${ANIM}, opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)`;
const DRAG_THRESHOLD = 80;      // px past which a release commits the swap
const CLICK_THRESHOLD = 5;      // px below which a release counts as a click

// Drop-shadow used on every slot wrapper. Applying the same shadow to all
// three slots (rather than a smaller one to prev/next and a bigger one to
// the active slot) prevents a one-frame "shadow jump" at the end of a swipe:
// the card growing into the centre would otherwise carry the smaller
// adjacent-shadow up to full size, then snap to the larger active-shadow on
// the swap commit. Filter is rendered before transform, so the shadow scales
// naturally with each slot's transform and reads as smaller on the dimmed,
// 70%-scaled adjacent cards.
const CARD_SHADOW    = 'drop-shadow(0 5.571px 75.215px rgba(30,31,110,0.75))';

// ── Types ────────────────────────────────────────────────────────────────────

export type CardCarouselRole = 'prev' | 'active' | 'next';

export interface CardCarouselProps<T extends { id: string }> {
  items:          T[];
  activeId:       string;
  onActiveChange: (id: string) => void;
  cardWidth:      number;
  cardHeight:     number;
  /** Render the card content for an item, given the slot role. */
  renderItem:     (item: T, role: CardCarouselRole) => ReactNode;
  /** Called BEFORE navigation animation starts (e.g. to fade out a popover). */
  onNavigateStart?: () => void;
  /** Wrap the active card in Card3DWrapper (hover-tilt effect). Default true. */
  use3D?:         boolean;
  /** Initial zoom level (0.5–1.0). Default 0.7. */
  initialZoom?:   number;
  /** Optional bottom overlay content rendered inside the viewport. */
  bottomLeftSlot?:  ReactNode;
  bottomRightSlot?: ReactNode;
  /**
   * Force a re-measure of the container size when these change. Useful for
   * panel-toggle, mode-switch, or breakpoint changes.
   */
  layoutDeps?:    DependencyList;
  /** Hide the zoom controls below the viewport. Default false. */
  hideZoomControls?: boolean;
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
  renderItem,
  onNavigateStart,
  use3D            = true,
  initialZoom      = 0.7,
  bottomLeftSlot,
  bottomRightSlot,
  layoutDeps,
  hideZoomControls = false,
  className        = '',
}: CardCarouselProps<T>) => {

  // ── Active item resolution ────────────────────────────────────────────────
  const idx       = items.findIndex(i => i.id === activeId);
  const safeIdx   = idx === -1 ? 0 : idx;
  const total     = items.length;
  const activeItem = items[safeIdx] ?? null;
  const prevItem   = total >= 2 ? items[(safeIdx - 1 + total) % total] : null;
  const nextItem   = total >= 2 ? items[(safeIdx + 1) % total]         : null;

  // ── Zoom & fit-scale ──────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [fitScale,  setFitScale]  = useState(1);
  const cardScale = fitScale * zoomLevel;

  const containerRef     = useRef<HTMLDivElement>(null);
  const containerWidthRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerWidthRef.current = width;
      setFitScale(Math.min(width / cardWidth, height / cardHeight));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cardWidth, cardHeight]);

  // Re-measure on layout-affecting external changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    containerWidthRef.current = width;
    setFitScale(Math.min(width / cardWidth, height / cardHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, layoutDeps ?? []);

  const zoomOut = () => setZoomLevel(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))));
  const zoomIn  = () => setZoomLevel(z => Math.min(1.0, parseFloat((z + 0.1).toFixed(1))));

  // ── Carousel slot refs ────────────────────────────────────────────────────
  const stripRef       = useRef<HTMLDivElement>(null);
  const prevCardRef    = useRef<HTMLDivElement>(null);
  const activeCardRef  = useRef<HTMLDivElement>(null);
  const nextCardRef    = useRef<HTMLDivElement>(null);

  const cardScaleRef = useRef(cardScale); cardScaleRef.current = cardScale;
  const totalRef     = useRef(total);     totalRef.current     = total;

  const phaseRef     = useRef<'idle' | 'transitioning'>('idle');
  const pendingIdRef = useRef<string | null>(null);
  const draggingRef  = useRef(false);
  const dragStartRef = useRef(0);

  // ── Geometry helpers ──────────────────────────────────────────────────────
  // Strip's resting translateX positions the active card in the centre of
  // the viewport. The adjacent cards sit `CARD_GAP` away from each side.
  const getBaseTranslateX = useCallback(() => {
    const cs   = cardScaleRef.current;
    const adjW = cardWidth * cs * ADJACENT_SCALE;
    return containerWidthRef.current / 2 - adjW - CARD_GAP - cardWidth * cs / 2;
  }, [cardWidth]);

  /** How far the strip slides during a single navigation step. */
  const getSlideDistance = useCallback(() => {
    const cs = cardScaleRef.current;
    return cardWidth * cs / 2 + CARD_GAP + cardWidth * cs * ADJACENT_SCALE / 2;
  }, [cardWidth]);

  const applyStripTransform = useCallback((extra: number, animate: boolean) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transition = animate ? ANIM : 'none';
    strip.style.transform  = `translateX(${getBaseTranslateX() + extra}px)`;
  }, [getBaseTranslateX]);

  /** Set transform + opacity on all three slots imperatively, no React re-render. */
  const applyCardStyles = useCallback((
    prevS: number, activeS: number, nextS: number,
    prevO: number, activeO: number, nextO: number,
    animate: boolean,
  ) => {
    const t = animate ? CARD_TRANS : 'none';
    if (prevCardRef.current)   { prevCardRef.current.style.transition   = t; prevCardRef.current.style.transform   = `scale(${prevS})`;   prevCardRef.current.style.opacity   = String(prevO);   }
    if (activeCardRef.current) { activeCardRef.current.style.transition = t; activeCardRef.current.style.transform = `scale(${activeS})`; activeCardRef.current.style.opacity = String(activeO); }
    if (nextCardRef.current)   { nextCardRef.current.style.transition   = t; nextCardRef.current.style.transform   = `scale(${nextS})`;   nextCardRef.current.style.opacity   = String(nextO);   }
  }, []);

  const resetCardStyles = useCallback((animate: boolean) => {
    const cs   = cardScaleRef.current;
    const as   = cs * ADJACENT_SCALE;
    const adjO = totalRef.current >= 2 ? 0.5 : 0;
    applyCardStyles(as, cs, as, adjO, 1, adjO, animate);
  }, [applyCardStyles]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = useCallback((targetId: string, direction: 'prev' | 'next') => {
    if (phaseRef.current !== 'idle') return;
    onNavigateStart?.();

    const cs     = cardScaleRef.current;
    const as     = cs * ADJACENT_SCALE;
    const offset = direction === 'next' ? -getSlideDistance() : getSlideDistance();
    phaseRef.current     = 'transitioning';
    pendingIdRef.current = targetId;
    applyStripTransform(offset, true);
    if (direction === 'next') {
      // active dims + shrinks; next brightens + grows
      applyCardStyles(as, as, cs, 0.5, 0.5, 1, true);
    } else {
      // prev brightens + grows; active dims + shrinks
      applyCardStyles(cs, as, as, 1, 0.5, 0.5, true);
    }
  }, [applyStripTransform, applyCardStyles, getSlideDistance, onNavigateStart]);

  /**
   * After a transition finishes, hide the strip → swap state → layout-effect
   * snaps everything back to resting before the browser paints again, which
   * eliminates the old-card flash that would otherwise appear in the strip.
   */
  const needsSnapRef = useRef(false);

  const handleStripTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== stripRef.current) return;
    if (phaseRef.current !== 'transitioning' || !pendingIdRef.current) return;
    const targetId = pendingIdRef.current;
    pendingIdRef.current = null;
    const strip = stripRef.current;
    if (strip) strip.style.visibility = 'hidden';
    needsSnapRef.current = true;
    onActiveChange(targetId);
  };

  useLayoutEffect(() => {
    if (needsSnapRef.current) {
      needsSnapRef.current = false;
      phaseRef.current     = 'idle';
      applyStripTransform(0, false);
      resetCardStyles(false);
      const strip = stripRef.current;
      if (strip) strip.style.visibility = 'visible';
    }
  });

  // Re-centre + reset whenever fit scale, zoom, or layout deps change.
  useLayoutEffect(() => {
    if (phaseRef.current !== 'transitioning' && !needsSnapRef.current) {
      applyStripTransform(0, false);
      resetCardStyles(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardScale, ...(layoutDeps ?? [])]);

  // Initial reset before first paint.
  useLayoutEffect(() => { resetCardStyles(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layout positions for the three slots ──────────────────────────────────
  const adjW       = cardWidth * cardScale * ADJACENT_SCALE;
  const activeW    = cardWidth * cardScale;
  const prevLeft   = adjW / 2                                       - cardWidth / 2;
  const activeLeft = adjW + CARD_GAP + activeW / 2                  - cardWidth / 2;
  const nextLeft   = adjW + CARD_GAP + activeW + CARD_GAP + adjW / 2 - cardWidth / 2;

  // ── Render ────────────────────────────────────────────────────────────────
  if (total === 0) {
    return <div className={`flex flex-col items-center ${className}`} />;
  }

  return (
    <div className={`flex flex-col items-center overflow-hidden ${className}`}>
      {/* ── Viewport ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="w-full overflow-hidden relative select-none touch-pan-y flex-1 min-h-0"
        onPointerDown={e => {
          if (phaseRef.current !== 'idle') return;
          draggingRef.current  = true;
          dragStartRef.current = e.clientX;
        }}
        onPointerMove={e => {
          if (!draggingRef.current) return;
          const delta = e.clientX - dragStartRef.current;
          if (Math.abs(delta) > 5 && !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          applyStripTransform(delta, false);
          // Live scale + opacity interpolated by drag progress
          const cs   = cardScaleRef.current;
          const as   = cs * ADJACENT_SCALE;
          const adjO = totalRef.current >= 2 ? 0.5 : 0;
          const t    = Math.min(1, Math.max(-1, delta / getSlideDistance()));
          applyCardStyles(
            as   + (cs - as) * Math.max(0,  t),    // prev grows when dragging right
            cs   - (cs - as) * Math.abs(t),          // active shrinks
            as   + (cs - as) * Math.max(0, -t),    // next grows when dragging left
            adjO + (1  - adjO) * Math.max(0,  t),
            1    - (1  - adjO) * Math.abs(t),
            adjO + (1  - adjO) * Math.max(0, -t),
            false,
          );
        }}
        onPointerUp={e => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          const delta = e.clientX - dragStartRef.current;
          if (Math.abs(delta) < CLICK_THRESHOLD) {
            applyStripTransform(0, true);
            resetCardStyles(true);
          } else if (delta < -DRAG_THRESHOLD && total >= 2 && nextItem) {
            navigate(nextItem.id, 'next');
          } else if (delta > DRAG_THRESHOLD && total >= 2 && prevItem) {
            navigate(prevItem.id, 'prev');
          } else {
            applyStripTransform(0, true);
            resetCardStyles(true);
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          applyStripTransform(0, true);
          resetCardStyles(true);
        }}
      >
        {/* Strip */}
        <div
          ref={stripRef}
          style={{
            position:   'absolute',
            top:        '50%',
            left:       0,
            height:     cardHeight,
            marginTop:  -(cardHeight / 2),
            willChange: 'transform',
          }}
          onTransitionEnd={handleStripTransitionEnd}
        >
          {/* Prev slot */}
          <div
            ref={prevCardRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            prevLeft,
              width:           cardWidth,
              height:          cardHeight,
              transformOrigin: 'center center',
              cursor:          prevItem ? 'pointer' : 'default',
              pointerEvents:   prevItem ? 'auto' : 'none',
              filter:          CARD_SHADOW,
            }}
            onClick={() => prevItem && navigate(prevItem.id, 'prev')}
          >
            {prevItem && renderItem(prevItem, 'prev')}
          </div>

          {/* Active slot — wrapper carries the shadow (same as adjacent slots)
              so it reads consistently across navigation; Card3DWrapper just
              handles the hover tilt. */}
          <div
            ref={activeCardRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            activeLeft,
              width:           cardWidth,
              height:          cardHeight,
              transformOrigin: 'center center',
              filter:          CARD_SHADOW,
            }}
          >
            {activeItem && (
              use3D ? (
                <Card3DWrapper style={{ width: cardWidth, height: cardHeight }}>
                  {renderItem(activeItem, 'active')}
                </Card3DWrapper>
              ) : (
                <div style={{ width: cardWidth, height: cardHeight }}>
                  {renderItem(activeItem, 'active')}
                </div>
              )
            )}
          </div>

          {/* Next slot */}
          <div
            ref={nextCardRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            nextLeft,
              width:           cardWidth,
              height:          cardHeight,
              transformOrigin: 'center center',
              cursor:          nextItem ? 'pointer' : 'default',
              pointerEvents:   nextItem ? 'auto' : 'none',
              filter:          CARD_SHADOW,
            }}
            onClick={() => nextItem && navigate(nextItem.id, 'next')}
          >
            {nextItem && renderItem(nextItem, 'next')}
          </div>
        </div>

        {/* Bottom overlays (game-specific buttons / menus) */}
        {bottomLeftSlot  && <div className="absolute bottom-4 left-4 z-40">{bottomLeftSlot}</div>}
        {bottomRightSlot && <div className="absolute bottom-4 right-4 z-40">{bottomRightSlot}</div>}
      </div>

      {/* ── Zoom controls ────────────────────────────────────────────────── */}
      {!hideZoomControls && (
        <div className="shrink-0 flex items-center gap-2 py-3">
          <Button
            leftIcon={<MinusCircle className="w-4 h-4" />}
            variant="outline"
            size="sm"
            disabled={zoomLevel <= 0.5}
            onClick={zoomOut}
          >
            Zoom Out
          </Button>
          <Button
            rightIcon={<AddCircle className="w-4 h-4" />}
            variant="outline"
            size="sm"
            disabled={zoomLevel >= 1.0}
            onClick={zoomIn}
          >
            Zoom In
          </Button>
        </div>
      )}
    </div>
  );
};

export default CardCarousel;
