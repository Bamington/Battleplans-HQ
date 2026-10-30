import { useState, useEffect, useRef } from 'react';

/**
 * ImageCarousel.tsx — Auto-rotating image carousel, optionally swipeable.
 *
 * Replicates the old app's collection carousel: a horizontal row of frames that
 * slides sideways on a fixed timer (each image is pushed out as the next pushes
 * in). The dots are indicators only. One image → shown static; zero → the
 * caller falls back to an icon.
 *
 * `swipe` lets the user drag between photos (touch or mouse): the frame follows
 * the finger, and letting go past a threshold — or with a flick — moves to the
 * next/previous photo, wrapping at both ends. Only horizontal drags are taken
 * (touch-action: pan-y), so the page still scrolls vertically and a sheet can
 * still be swiped down. It's off by default because list-card thumbnails sit
 * inside horizontally scrolling column rows on mobile — a swipe there must
 * scroll the row, not change the photo. Turn it on for big hero carousels.
 *
 * To keep the loop a forward push (rather than snapping backward through every
 * frame when it wraps), the first image is cloned onto the end: we slide onto
 * the clone, then — once that slide finishes — jump back to the real first frame
 * with the transition momentarily disabled, so the reset is invisible.
 *
 * `autoHeight` sizes the frame to the *tallest* image in the set: it measures
 * each image's aspect ratio as it loads and sets the frame height to the
 * tallest one at the current width, then shows every image `object-contain` so
 * none are cropped (shorter images letterbox within the frame). Without it the
 * frame takes its height from the caller and images `object-cover` (cropped to
 * fill) — the right default for fixed-size list thumbnails.
 */

/** How long each image is shown, in ms. Matches the old app. */
const ROTATE_MS = 4000;

/** Aspect ratio (h/w) the frame assumes before any image has measured, to
 *  avoid a collapse-then-grow flash on open. Replaced once images load. */
const AUTO_HEIGHT_FALLBACK_RATIO = 0.75;

/** Movement (px) before a press counts as a drag rather than a tap. */
const DRAG_START_PX = 8;
/** Let go past this fraction of the frame width and it changes photo. */
const SWIPE_FRACTION = 0.2;
/** …or flick faster than this (px/ms), however short the drag. */
const FLICK_VELOCITY = 0.4;

export function ImageCarousel({ images, alt, dots = false, className = '', autoHeight = false, onImageClick, swipe = false }: {
  images: string[];
  alt: string;
  /** Show non-interactive indicator dots (for larger surfaces like the hero). */
  dots?: boolean;
  className?: string;
  /** Size the frame to the tallest image (contain, no cropping) instead of
   *  taking a fixed height from the caller (cover). */
  autoHeight?: boolean;
  /** Make the shown image tappable; called with the visible image's index. */
  onImageClick?: (index: number) => void;
  /** Let the user swipe between photos (see the header comment). */
  swipe?: boolean;
}) {
  const n = images.length;
  // index runs 0..n; n lands on the appended clone of frame 0.
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const key = images.join('|');

  // ── Swipe state ──
  /** Live drag offset in px while a finger/mouse is dragging. */
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Bumped on every swipe so the auto-advance timer restarts from zero. */
  const [timerNonce, setTimerNonce] = useState(0);
  /** A backwards swipe from the first photo: jump (unanimated) onto the clone
   *  at the end, then animate one step back to the last photo. */
  const [pendingBack, setPendingBack] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; t: number; decided: boolean; horizontal: boolean } | null>(null);
  /** Set when a drag just ended, so the click that follows isn't a tap. */
  const suppressClick = useRef(false);

  // autoHeight measurement: the frame's current width and the tallest image's
  // aspect ratio (height/width) seen so far.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [maxRatio, setMaxRatio] = useState(0);

  // Reset when the image set changes.
  useEffect(() => { setIndex(0); setAnimate(true); setMaxRatio(0); }, [key]);

  // Track the frame width so the measured height tracks resizes (viewport, the
  // modal going full-width on mobile, etc.).
  useEffect(() => {
    if (!autoHeight) return;
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoHeight]);

  const measureRatio = (img: HTMLImageElement) => {
    if (!img.naturalWidth) return;
    const r = img.naturalHeight / img.naturalWidth;
    setMaxRatio(m => (r > m ? r : m));
  };

  // Cached images are already `complete` on mount and fire no load event, so
  // measure those directly when the set mounts/changes; onLoad covers the rest.
  useEffect(() => {
    if (!autoHeight) return;
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll('img').forEach(img => { if (img.complete) measureRatio(img); });
  }, [autoHeight, key]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (autoHeight) measureRatio(e.currentTarget);
  };

  // Auto-advance; only runs with more than one image. Paused while dragging,
  // and restarted after each swipe (timerNonce) so it doesn't jump straight
  // after the user has just moved it.
  useEffect(() => {
    if (n <= 1 || dragging) return;
    const id = setInterval(() => setIndex(i => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [n, key, dragging, timerNonce]);

  // Re-enable the transition the frame after a no-transition snap, before the
  // next slide — otherwise adding the transition and moving in the same commit
  // wouldn't animate. A pending backwards swipe takes its animated step here.
  useEffect(() => {
    if (animate) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnimate(true);
      if (pendingBack) { setPendingBack(false); setIndex(i => i - 1); }
    }));
    return () => cancelAnimationFrame(r);
  }, [animate, pendingBack]);

  if (n === 0) return null;

  // When the slide onto the clone finishes, snap back to the real first frame
  // with the transition off.
  const handleTransitionEnd = () => {
    if (index === n && !pendingBack) { setAnimate(false); setIndex(0); }
  };

  // ── Swipe handlers ──
  const canSwipe = swipe && n > 1;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canSwipe || (e.pointerType === 'mouse' && e.button !== 0)) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, decided: false, horizontal: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.decided) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return;
      g.decided = true;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!g.horizontal) { gesture.current = null; return; }   // a scroll — let it be
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      setAnimate(false);
      // Sitting on the end clone after a wrap? Treat it as the first photo.
      if (index === n) setIndex(0);
    }
    setDragPx(dx);
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || !g.horizontal) return;
    const dx = e.clientX - g.x;
    const width = containerRef.current?.clientWidth || 1;
    const velocity = dx / Math.max(1, e.timeStamp - g.t);
    const go = Math.abs(dx) > width * SWIPE_FRACTION || Math.abs(velocity) > FLICK_VELOCITY;

    suppressClick.current = true;           // this was a drag, not a tap
    setDragging(false);
    setDragPx(0);
    setTimerNonce(v => v + 1);

    if (!go) { setAnimate(true); return; }   // spring back
    if (dx < 0) {
      setAnimate(true);
      setIndex(i => i + 1);                  // forward; wraps via the end clone
    } else if (index === 0) {
      setAnimate(false);                     // back from the first photo:
      setIndex(n);                           // jump to the clone unanimated,
      setPendingBack(true);                  // then step back to the last photo
    } else {
      setAnimate(true);
      setIndex(i => i - 1);
    }
  };

  const handleImageClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    onImageClick?.(index % n);
  };

  const frames = n > 1 ? [...images, images[0]] : images;
  const active = index % n; // which real image is showing (for dots)

  const heightStyle = autoHeight
    ? { height: Math.round((width || 0) * (maxRatio || AUTO_HEIGHT_FALLBACK_RATIO)) || undefined }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${canSwipe ? 'select-none' : ''} ${className}`.trim()}
      // pan-y: the browser keeps vertical scrolling; horizontal drags come here.
      style={{ ...heightStyle, ...(canSwipe ? { touchAction: 'pan-y' } : {}) }}
      onPointerDown={canSwipe ? onPointerDown : undefined}
      onPointerMove={canSwipe ? onPointerMove : undefined}
      onPointerUp={canSwipe ? endGesture : undefined}
      onPointerCancel={canSwipe ? endGesture : undefined}
    >
      <div
        className={`flex h-full w-full ${animate && !dragging ? 'transition-transform duration-500 ease-out' : ''}`}
        style={{ transform: `translateX(calc(-${index * 100}% + ${dragPx}px))` }}
        onTransitionEnd={handleTransitionEnd}
      >
        {frames.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={i === active ? alt : ''}
            loading="lazy"
            draggable={false}
            onLoad={handleImgLoad}
            onClick={onImageClick || canSwipe ? handleImageClick : undefined}
            className={`w-full h-full shrink-0 ${autoHeight ? 'object-contain' : 'object-cover'}${onImageClick ? ' cursor-zoom-in' : ''}`}
          />
        ))}
      </div>

      {dots && n > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none" aria-hidden="true">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === active ? 'bg-white shadow' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
