/**
 * Lightbox.tsx — Full-screen image viewer with pinch/double-tap zoom.
 *
 * Opens above everything (portalled to <body>, so it escapes any transformed
 * modal ancestor) and shows one image at a time from `images`, starting at
 * `startIndex`. Gestures (pointer events, touch + mouse):
 *   - pinch / double-tap / wheel  → zoom the active image (pan when zoomed)
 *   - horizontal swipe (unzoomed)  → page between images
 *   - vertical swipe (unzoomed)    → drag down to dismiss
 *   - tap the backdrop, the ✕, or Esc → close; ← / → page (desktop)
 *
 * Transforms are applied imperatively (refs) during gestures so dragging tracks
 * the finger at 60fps without a React re-render per move; state is committed on
 * release.
 */

import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxProps {
  /** Whether the viewer is open. */
  open: boolean;
  /** Called on ✕, backdrop tap, Esc, or a completed swipe-down. */
  onClose: () => void;
  /** The images to page through. */
  images: string[];
  /** Which image to open on. */
  startIndex?: number;
  /** Accessible label for the active image. */
  alt?: string;
}

const MAX_SCALE = 4;
const DBL_TAP_SCALE = 2.5;
/** Fraction of the width a horizontal swipe must cross to flip the page. */
const PAGE_THRESHOLD = 0.18;
/** Pixels a vertical swipe must cross to dismiss. */
const DISMISS_THRESHOLD = 110;
const EASE = 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Mode = 'idle' | 'pending' | 'pan' | 'pinch' | 'page' | 'dismiss';

const Lightbox = ({ open, onClose, images, startIndex = 0, alt = '' }: LightboxProps) => {
  const n = images.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);            // mirrors view.scale for UI/logic

  // Imperative gesture state (avoids a re-render per pointermove).
  const view = useRef({ scale: 1, tx: 0, ty: 0 });  // active image transform
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const mode = useRef<Mode>('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const start = useRef<any>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const animateNext = useRef(false);

  const center = () => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const applyView = (animate = false) => {
    const el = imgRef.current;
    if (!el) return;
    el.style.transition = animate ? EASE : 'none';
    const { scale: s, tx, ty } = view.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };

  const applyStrip = (dragX = 0, animate = false) => {
    const el = stripRef.current;
    if (!el) return;
    el.style.transition = animate ? EASE : 'none';
    el.style.transform = `translateX(calc(${-indexRef.current * 100}% + ${dragX}px))`;
  };

  const clampPan = () => {
    const el = imgRef.current, cont = containerRef.current;
    if (!el || !cont) return;
    const s = view.current.scale;
    const maxX = Math.max(0, (el.offsetWidth * s - cont.clientWidth) / 2);
    const maxY = Math.max(0, (el.offsetHeight * s - cont.clientHeight) / 2);
    view.current.tx = clamp(view.current.tx, -maxX, maxX);
    view.current.ty = clamp(view.current.ty, -maxY, maxY);
  };

  const resetView = () => { view.current = { scale: 1, tx: 0, ty: 0 }; setScale(1); };

  const page = (dir: number) => {
    const next = indexRef.current + dir;
    if (next < 0 || next >= n) { applyStrip(0, true); return; }
    resetView();
    applyView(false);              // clear zoom on the outgoing image
    animateNext.current = true;
    setIndex(next);
  };

  const doubleTap = (px: number, py: number) => {
    const c = center();
    if (view.current.scale > 1.02) {
      view.current = { scale: 1, tx: 0, ty: 0 };
      setScale(1);
    } else {
      const s = DBL_TAP_SCALE;
      view.current = { scale: s, tx: (px - c.x) * (1 - s), ty: (py - c.y) * (1 - s) };
      setScale(s);
      clampPan();
    }
    applyView(true);
  };

  // Reset to the requested image whenever opened.
  useEffect(() => {
    if (!open) return;
    animateNext.current = false;
    resetView();
    setIndex(startIndex);
  }, [open, startIndex]);

  // Apply the strip/image transforms after each index change (and on open).
  useLayoutEffect(() => {
    if (!open) return;
    applyStrip(0, animateNext.current);
    applyView(false);
    animateNext.current = true;
  }, [index, open]);

  // Lock body scroll + handle the keyboard while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') page(1);
      else if (e.key === 'ArrowLeft') page(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, n]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-lb-control]')) return;  // let buttons handle themselves
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      start.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        scale: view.current.scale, tx: view.current.tx, ty: view.current.ty,
      };
      mode.current = 'pinch';
      return;
    }

    const now = e.timeStamp;
    const lt = lastTap.current;
    if (lt && now - lt.t < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
      doubleTap(e.clientX, e.clientY);
      lastTap.current = null;
      mode.current = 'idle';
      return;
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    start.current = {
      x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty,
      onImage: (e.target as Element).tagName === 'IMG',
    };
    mode.current = view.current.scale > 1 ? 'pan' : 'pending';
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (mode.current === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clamp(start.current.scale * (dist / start.current.dist), 1, MAX_SCALE);
      const c = center();
      const qx = start.current.mid.x - c.x, qy = start.current.mid.y - c.y;
      const f = s / start.current.scale;
      view.current = {
        scale: s,
        tx: qx - (qx - start.current.tx) * f + (mid.x - start.current.mid.x),
        ty: qy - (qy - start.current.ty) * f + (mid.y - start.current.mid.y),
      };
      applyView(false);
      return;
    }

    if (mode.current === 'pan') {
      view.current.tx = start.current.tx + (e.clientX - start.current.x);
      view.current.ty = start.current.ty + (e.clientY - start.current.y);
      clampPan();
      applyView(false);
      return;
    }

    if (mode.current === 'pending' || mode.current === 'page' || mode.current === 'dismiss') {
      const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
      if (mode.current === 'pending') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        lastTap.current = null;               // a drag, not a double-tap
        mode.current = Math.abs(dx) > Math.abs(dy) ? 'page' : 'dismiss';
      }
      if (mode.current === 'page') {
        // Resist paging past the ends.
        const atEnd = (dx < 0 && indexRef.current === n - 1) || (dx > 0 && indexRef.current === 0);
        applyStrip(atEnd ? dx * 0.35 : dx, false);
      } else {
        view.current.ty = dy;
        view.current.tx = dx * 0.4;
        applyView(false);
        if (containerRef.current) {
          containerRef.current.style.background = `rgba(0,0,0,${clamp(1 - Math.abs(dy) / 600, 0.4, 1)})`;
        }
      }
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const remaining = ptrs.current.size;

    if (mode.current === 'pinch') {
      if (remaining >= 1) {
        const p = [...ptrs.current.values()][0];
        start.current = { x: p.x, y: p.y, tx: view.current.tx, ty: view.current.ty, onImage: true };
        mode.current = view.current.scale > 1 ? 'pan' : 'pending';
      } else {
        if (view.current.scale <= 1.02) resetView();
        else setScale(view.current.scale);
        clampPan();
        applyView(true);
        mode.current = 'idle';
      }
      return;
    }

    if (remaining > 0) return;

    if (mode.current === 'pan') {
      clampPan(); applyView(true);
    } else if (mode.current === 'page') {
      const dx = e.clientX - start.current.x;
      const w = containerRef.current?.clientWidth ?? 1;
      if (dx <= -w * PAGE_THRESHOLD && indexRef.current < n - 1) page(1);
      else if (dx >= w * PAGE_THRESHOLD && indexRef.current > 0) page(-1);
      else applyStrip(0, true);
    } else if (mode.current === 'dismiss') {
      if (containerRef.current) containerRef.current.style.background = '';
      if (Math.abs(e.clientY - start.current.y) > DISMISS_THRESHOLD) { onClose(); return; }
      resetView(); applyView(true);
    } else if (mode.current === 'pending' && !start.current?.onImage) {
      onClose();                              // clean tap on the backdrop
    }
    mode.current = 'idle';
  };

  const overlay = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center touch-none select-none overscroll-none"
      role="dialog"
      aria-modal="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {/* Image strip — one full-screen page per image. */}
      <div ref={stripRef} className="absolute inset-0 flex">
        {images.map((src, i) => (
          <div key={i} className="w-full h-full shrink-0 flex items-center justify-center overflow-hidden">
            <img
              ref={i === index ? imgRef : undefined}
              src={src}
              alt={i === index ? alt : ''}
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
              style={{ willChange: 'transform', cursor: scale > 1 ? 'grab' : 'zoom-in' }}
            />
          </div>
        ))}
      </div>

      {/* Top bar: counter + close. */}
      <div data-lb-control className="absolute top-0 inset-x-0 flex items-center justify-between p-3 z-10">
        <span className="font-body text-sm text-white/80 tabular-nums px-1">
          {n > 1 ? `${index + 1} / ${n}` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* Desktop paging arrows. */}
      {n > 1 && (
        <>
          <button
            data-lb-control type="button" aria-label="Previous" onClick={() => page(-1)}
            className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center disabled:opacity-30"
            disabled={index === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            data-lb-control type="button" aria-label="Next" onClick={() => page(1)}
            className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center disabled:opacity-30"
            disabled={index === n - 1}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
};

export default Lightbox;
