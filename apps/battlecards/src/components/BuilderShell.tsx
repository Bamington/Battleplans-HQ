/**
 * BuilderShell.tsx — Outer 3-column layout for every card-builder page.
 *
 * Owns the chrome shared by Halo / Starcraft / Blood Bowl (and future games):
 *   - Full-height column wrapper with the gray-950 page background.
 *   - Slot for the Navbar (always rendered).
 *   - Slot for an optional sub-bar directly below the navbar (EditSubnav,
 *     PlaySubnav, etc.).
 *   - A flex-row body containing optional left/right `<aside>` panels and a
 *     centre `<main>`-like region. The asides apply the responsive
 *     show/hide + ordering classes that all three current builders use.
 *   - Slot at the end for modal portals.
 *
 * The shell is intentionally a slot-based component — game-specific concerns
 * (Navbar children, which subnav to render, what's in each panel, which
 * modals are mounted) stay with the page. The shell only owns the layout.
 *
 * USAGE (composed with the other shells + useCardBuilder):
 *   const builder = useCardBuilder({ deckId });
 *   return (
 *     <BuilderShell
 *       navbar={<AppNavbar>{...}</AppNavbar>}
 *       topBar={<EditSubnav className="lg:hidden" {...} />}
 *       leftPanel={<CardListPanel {...}>{cardListBody}</CardListPanel>}
 *       leftPanelOpen={builder.cardListOpen}
 *       center={<CenterViewport logo={<img .../>} {...}>{carousel}</CenterViewport>}
 *       rightPanel={<EditorPanel title="Edit Card">{editorBody}</EditorPanel>}
 *       rightPanelOpen={builder.editorOpen}
 *       modals={<>{photoModal}{deleteConfirmModal}{...}</>}
 *     />
 *   );
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export interface BuilderShellProps {
  /** Top navbar — always rendered. Pass an already-configured <AppNavbar> element. */
  navbar: ReactNode;
  /** Optional sub-bar below the navbar (EditSubnav, PlaySubnav, etc.). */
  topBar?: ReactNode;

  /** Content of the left aside (typically a <CardListPanel>). Omit to hide. */
  leftPanel?: ReactNode;
  /** Mobile slide-in state for the left aside. Ignored at lg+ where the aside is always visible. */
  leftPanelOpen?: boolean;

  /** Centre region content (typically a <CenterViewport>). */
  center: ReactNode;

  /** Content of the right aside (typically an <EditorPanel>). Omit to hide. */
  rightPanel?: ReactNode;
  /** Mobile slide-in state for the right aside. Ignored at lg+ where the aside is always visible. */
  rightPanelOpen?: boolean;

  /** Fires when the responsive drawer backdrop is tapped. Should close both
   *  panels. Ignored at lg+ where the panels are always-visible columns. */
  onClosePanels?: () => void;

  /** Modal portals — rendered as the last child of the page wrapper. */
  modals?: ReactNode;
}

// Below lg the aside is a bottom drawer: fixed to the viewport bottom, sliding
// up over the content and scrolling internally. Its height snaps between "half"
// (50dvh, the default) and "full" (up to the header) and it can be dragged
// closed — see DrawerAside. At lg+ it reverts to the always-visible in-flow
// side column (`lg:static` makes the drawer offsets / max-height inert, and the
// inline drag styles are only applied below lg).
// The drawer's height (`--drawer-h`) and vertical offset (`--drawer-y`) are fed
// in as CSS custom properties from the drag/snap state. They're consumed via
// arbitrary `[max-height:…]` / `[transform:…]` utilities below lg only — at lg+
// the `lg:` utilities set `max-height`/`transform` to their column values
// directly, so the inline custom properties are simply never read. This keeps
// the desktop layout immune to the inline drag styles (which would otherwise
// win over `lg:` classes by specificity).
const DRAWER_BASE =
  'fixed inset-x-0 bottom-0 z-50 flex flex-col ' +
  'bg-gray-900 rounded-t-2xl shadow-2xl overflow-hidden ' +
  '[max-height:var(--drawer-h)] [transform:translateY(var(--drawer-y))] ' +
  'lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:max-h-none lg:[transform:none] ' +
  'lg:rounded-none lg:shadow-none lg:transition-none';

const LEFT_DRAWER  = `${DRAWER_BASE} lg:order-1 lg:border-r lg:border-gray-700`;
const RIGHT_DRAWER = `${DRAWER_BASE} lg:order-3 lg:border-l lg:border-gray-700`;

type DrawerSnap = 'half' | 'full';
interface DragState { maxH: number; translate: number }

/**
 * DrawerAside — one builder side panel. Below lg it's a draggable bottom sheet
 * with three rest positions — full (up to the header), half (the default), and
 * closed. On release it snaps to whichever the handle was let go nearest to, so
 * e.g. from full a downward drag lands on half or dismisses depending on how
 * far it was pulled. At lg+ it's the plain in-flow side column (drag
 * styles/handlers are inert).
 */
const DrawerAside = ({
  className,
  open,
  onClose,
  children,
}: {
  className: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  const asideRef = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<DrawerSnap>('half');
  const [drag, setDrag] = useState<DragState | null>(null);
  const metrics   = useRef({ avail: 0, half: 0 });
  const dragStart = useRef<{ y: number; base: number } | null>(null);

  // Every fresh open (or close) resets the sheet back to the half snap.
  useEffect(() => { setSnap('half'); setDrag(null); }, [open]);

  // Measure the space between the header (this aside's in-flow parent, which
  // starts below the navbar/subnav) and the viewport bottom → the "full" height.
  const measure = () => {
    const parentTop = asideRef.current?.parentElement?.getBoundingClientRect().top ?? 0;
    const avail = Math.max(0, window.innerHeight - parentTop);
    const half  = Math.min(avail, Math.round(window.innerHeight * 0.5));
    metrics.current = { avail, half };
    return metrics.current;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // The handle is `lg:hidden`, so this can only fire below lg (drawer mode).
    if (!open) return;
    const { avail, half } = measure();
    const base = snap === 'full' ? avail : half;
    dragStart.current = { y: e.clientY, base };
    setDrag({ maxH: base, translate: 0 });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const { avail } = metrics.current;
    const base = dragStart.current.base;
    // Drag up grows the sheet toward the header; drag down slides it toward close.
    if (dy <= 0) setDrag({ maxH: Math.min(avail, base - dy), translate: 0 });
    else         setDrag({ maxH: base, translate: Math.min(dy, base) });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const { avail, half } = metrics.current;
    const base = dragStart.current.base;
    dragStart.current = null;
    setDrag(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // Snap to whichever rest height the handle was released nearest to. The
    // released height is the same whether the drag grew the sheet (up) or slid
    // it down: base − dy, clamped to [0, full].
    const releasedH = Math.max(0, Math.min(avail, base - dy));
    if (releasedH >= (half + avail) / 2) {
      setSnap('full');                     // nearest to full → expand to header
    } else if (releasedH >= half / 2) {
      setSnap('half');                     // nearest to half → original size
    } else {
      onClose();                           // nearest to closed → dismiss
      setSnap('half');                     // reset so the next open starts at half
    }
  };

  // Feed the drawer geometry in as CSS custom properties (see DRAWER_BASE).
  // These are always safe to set: at lg+ the `lg:` utilities override
  // max-height/transform directly, so the vars are never read there.
  const drawerY = drag ? `${drag.translate}px` : open ? '0px' : '100%';
  const drawerH = drag
    ? `${drag.maxH}px`
    : open && snap === 'full' && metrics.current.avail
      ? `${metrics.current.avail}px`
      : '50dvh';
  const style = { '--drawer-y': drawerY, '--drawer-h': drawerH } as CSSProperties;

  // Follow the finger instantly while dragging; animate the snap on release.
  const transition = drag
    ? 'transition-none'
    : 'transition-[transform,max-height] duration-300 ease-out lg:transition-none';

  return (
    <aside ref={asideRef} className={`${className} ${transition}`} style={style}>
      {/* Grab handle — drag up to expand, down to dismiss (< lg only). */}
      <div
        className="lg:hidden shrink-0 flex justify-center pt-4 pb-2 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="separator"
        aria-label="Drag to resize or dismiss panel"
      >
        <div className="h-1 w-10 rounded-full bg-gray-600" />
      </div>
      {children}
    </aside>
  );
};

const BuilderShell = ({
  navbar,
  topBar,
  leftPanel,
  leftPanelOpen = false,
  center,
  rightPanel,
  rightPanelOpen = false,
  onClosePanels,
  modals,
}: BuilderShellProps) => {
  const anyPanelOpen = leftPanelOpen || rightPanelOpen;
  const closePanels = onClosePanels ?? (() => {});

  return (
    <div className="flex flex-col h-dvh bg-gray-950 overflow-hidden">
      {navbar}
      {topBar}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {leftPanel != null && (
          <DrawerAside className={LEFT_DRAWER} open={leftPanelOpen} onClose={closePanels}>
            {leftPanel}
          </DrawerAside>
        )}

        {center}

        {rightPanel != null && (
          <DrawerAside className={RIGHT_DRAWER} open={rightPanelOpen} onClose={closePanels}>
            {rightPanel}
          </DrawerAside>
        )}
      </div>

      {/* Tap-outside-to-close backdrop — drawer overlay only exists below lg. */}
      {anyPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClosePanels}
          aria-hidden="true"
        />
      )}

      {modals}
    </div>
  );
};

export default BuilderShell;
