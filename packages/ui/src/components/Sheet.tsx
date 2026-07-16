/**
 * Sheet.tsx — Responsive dialog: a bottom action-sheet on mobile, a centred
 * dialog on desktop.
 *
 * Below lg: slides up from the bottom, leaves a peek gap at the top with
 * rounded corners + a grab handle, and everything the caller passes scrolls as
 * one. A downward swipe anywhere on the sheet dismisses it (past a threshold,
 * or a quick flick), but only when the content is scrolled to the top —
 * otherwise the swipe just scrolls. Tapping the backdrop also closes.
 *
 * At lg+: a centred dialog capped at 85vh, its width taken from the caller's
 * `max-w-*` in `className` (full-width below lg). No handle, no slide.
 *
 * SCROLL CONVENTION — children sit in a flex column that scrolls as one on
 * mobile and is overflow-hidden on desktop. For the common "pinned header,
 * scrolling body" desktop layout, mark the header sections `shrink-0` and give
 * the scrolling region `lg:flex-1 lg:min-h-0 lg:overflow-y-auto`. For a plain
 * "scroll everything on desktop too" modal, wrap all content in a single
 * `lg:flex-1 lg:min-h-0 lg:overflow-y-auto` element.
 *
 * USAGE:
 *   <Sheet open={open} onClose={close} className="max-w-2xl">
 *     <Hero className="shrink-0" />
 *     <Body className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto" />
 *   </Sheet>
 *
 * NOTE: closing always animates (gesture, backdrop, or the parent flipping
 * `open` to false), then the sheet unmounts after the slide-out completes.
 */

import React, { useEffect, useRef, useState } from 'react';

export interface SheetProps {
  /** Whether the sheet is visible. */
  open: boolean;
  /** Called on backdrop tap, or a swipe-down dismiss. */
  onClose: () => void;
  /** Sheet content (see SCROLL CONVENTION). */
  children: React.ReactNode;
  /** Optional action bar pinned below the scroll area (e.g. Apply / Reset). */
  footer?: React.ReactNode;
  /** Desktop max-width (e.g. "max-w-2xl") plus any extra panel classes. Below
   *  lg the sheet is always full-width. */
  className?: string;
}

// Desktop max-width lookup — Tailwind's JIT only emits classes it sees verbatim
// in source, so the lg: variants must be written out as literals here.
const LG_MAX_W: Record<string, string> = {
  'max-w-xs':    'lg:max-w-xs',
  'max-w-sm':    'lg:max-w-sm',
  'max-w-md':    'lg:max-w-md',
  'max-w-lg':    'lg:max-w-lg',
  'max-w-xl':    'lg:max-w-xl',
  'max-w-2xl':   'lg:max-w-2xl',
  'max-w-3xl':   'lg:max-w-3xl',
  'max-w-[80%]': 'lg:max-w-[80%]',
};
const DEFAULT_LG_MAX_W = 'lg:max-w-lg';

/** Below lg, the media query that marks "this is a sheet, not a dialog". */
const MOBILE_MQ = '(max-width: 1023px)';
/** How far (px) the sheet must be swiped down before release dismisses. */
const DRAG_CLOSE_THRESHOLD = 120;
/** A downward flick this fast (px/ms) dismisses even under the distance threshold. */
const FLICK_VELOCITY = 0.55;
/** Slide duration; the exit unmount waits this long. Keep in sync with the CSS. */
const SLIDE_MS = 300;

const Sheet = ({ open, onClose, children, footer, className = '' }: SheetProps) => {
  // Below lg every sheet is full-width; the caller's max-w only applies at lg+.
  const callerMaxW = className.match(/max-w-\S+/)?.[0];
  const lgMaxW     = (callerMaxW && LG_MAX_W[callerMaxW]) || DEFAULT_LG_MAX_W;
  const restClass  = callerMaxW ? className.replace(callerMaxW, '').trim() : className;

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // `render` keeps the sheet mounted through the slide-out; `shown` drives the
  // slide itself; `dragY` is the live swipe-down offset.
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount on open; on close slide down first (mobile) then unmount.
  useEffect(() => {
    if (open) { setRender(true); return; }
    setShown(false);
    if (!isMobile) { setRender(false); return; }
    const t = window.setTimeout(() => setRender(false), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [open, isMobile]);

  // Slide up once mounted — start at 100% and transition to 0 after a paint
  // (double rAF guarantees the 100% frame is committed first).
  useEffect(() => {
    if (!render || !open) return;
    setDragY(0);
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, [render, open]);

  // Lock body scroll while mounted.
  useEffect(() => {
    if (!render) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [render]);

  // Swipe-down-to-dismiss (mobile). Attached natively so the dismiss drag can
  // preventDefault the browser's scroll/rubber-band; it only engages when the
  // content is scrolled to the top and the gesture is a downward drag.
  useEffect(() => {
    if (!isMobile || !render) return;
    const panel = panelRef.current;
    const scroller = scrollRef.current;
    if (!panel || !scroller) return;

    let startX = 0, startY = 0, dx = 0, dy = 0, vy = 0, lastY = 0, lastT = 0;
    let decided = false, active = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { decided = true; active = false; return; }
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; lastY = t.clientY; lastT = e.timeStamp;
      dx = dy = vy = 0; decided = false; active = false;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (decided && !active) return;                     // committed to scrolling
      const t = e.touches[0];
      dx = t.clientX - startX;
      dy = t.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        decided = true;
        // Dismiss only on a downward, mostly-vertical drag from the very top.
        active = dy > 0 && Math.abs(dy) > Math.abs(dx) && scroller.scrollTop <= 0;
        if (!active) return;
        setDragging(true);
      }
      const now = e.timeStamp;
      if (now > lastT) { vy = (t.clientY - lastY) / (now - lastT); lastY = t.clientY; lastT = now; }
      e.preventDefault();                                 // suppress native scroll/bounce
      setDragY(dy > 0 ? dy : 0);
    };
    const onEnd = () => {
      if (active) {
        setDragging(false);
        if (dy > DRAG_CLOSE_THRESHOLD || (vy > FLICK_VELOCITY && dy > 40)) onCloseRef.current();
        else setDragY(0);
      }
      decided = false; active = false; dx = dy = vy = 0;
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd, { passive: true });
    panel.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [isMobile, render]);

  if (!render) return null;

  const sheetStyle = isMobile
    ? {
        transform: `translateY(${shown ? `${dragY}px` : '100%'})`,
        transition: dragging ? 'none' : `transform ${SLIDE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end lg:items-center lg:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className={[
          'relative z-10 w-full flex flex-col overflow-hidden bg-neutral-900 shadow-xl will-change-transform',
          'h-[calc(100dvh-2.75rem)] rounded-t-2xl border-t border-neutral-800',
          'lg:h-auto lg:max-h-[85vh] lg:rounded-lg lg:border lg:border-gray-700',
          lgMaxW,
          restClass,
        ].filter(Boolean).join(' ')}
        style={sheetStyle}
      >
        {/* Grab handle — mobile only; a visual cue that the sheet swipes down. */}
        <div className="lg:hidden shrink-0 flex items-center justify-center pt-3 pb-2" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-neutral-600" />
        </div>

        {/* Scroll area — one continuous scroll on mobile; overflow-hidden on
            desktop so children manage their own scroll (see SCROLL CONVENTION). */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col">
          {children}
        </div>

        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export default Sheet;
