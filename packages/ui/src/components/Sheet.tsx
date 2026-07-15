/**
 * Sheet.tsx — Responsive dialog: a bottom action-sheet on mobile, a centred
 * dialog on desktop.
 *
 * Below lg: slides up from the bottom, leaves a peek gap at the top with
 * rounded corners + a grab handle, and everything the caller passes scrolls as
 * one. Dragging the handle down past a threshold dismisses it (with a
 * slide-down); a short drag snaps back. Tapping the backdrop also closes.
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
  /** Called on backdrop tap, or when the handle is dragged past the threshold. */
  onClose: () => void;
  /** Sheet content (see SCROLL CONVENTION). */
  children: React.ReactNode;
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
/** How far (px) the handle must be dragged before release dismisses. */
const DRAG_CLOSE_THRESHOLD = 100;
/** Slide duration; the exit unmount waits this long. Keep in sync with the CSS. */
const SLIDE_MS = 300;

const Sheet = ({ open, onClose, children, className = '' }: SheetProps) => {
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
  // slide itself; `dragY` is the live handle-drag offset.
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

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

  const onHandleStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; setDragging(true); };
  const onHandleMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onHandleEnd = () => {
    setDragging(false);
    dragStart.current = null;
    if (dragY > DRAG_CLOSE_THRESHOLD) onClose();
    else setDragY(0);
  };

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
        className={[
          'relative z-10 w-full flex flex-col overflow-hidden bg-neutral-900 shadow-xl will-change-transform',
          'h-[calc(100dvh-2.75rem)] rounded-t-2xl border-t border-neutral-800',
          'lg:h-auto lg:max-h-[85vh] lg:rounded-lg lg:border lg:border-gray-700',
          lgMaxW,
          restClass,
        ].filter(Boolean).join(' ')}
        style={sheetStyle}
      >
        {/* Drag handle — mobile only; drag it down to dismiss. */}
        <div
          className="lg:hidden shrink-0 flex items-center justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={onHandleStart}
          onTouchMove={onHandleMove}
          onTouchEnd={onHandleEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-neutral-600" aria-hidden="true" />
        </div>

        {/* Scroll area — one continuous scroll on mobile; overflow-hidden on
            desktop so children manage their own scroll (see SCROLL CONVENTION). */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Sheet;
