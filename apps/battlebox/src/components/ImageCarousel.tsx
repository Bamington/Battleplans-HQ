import { useState, useEffect, useRef } from 'react';

/**
 * ImageCarousel.tsx — Auto-rotating, non-interactive image carousel.
 *
 * Replicates the old app's collection carousel: a horizontal row of frames that
 * slides sideways on a fixed timer (each image is pushed out as the next pushes
 * in), with no user controls — the dots are indicators only. One image → shown
 * static; zero → the caller falls back to an icon.
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

export function ImageCarousel({ images, alt, dots = false, className = '', autoHeight = false }: {
  images: string[];
  alt: string;
  /** Show non-interactive indicator dots (for larger surfaces like the hero). */
  dots?: boolean;
  className?: string;
  /** Size the frame to the tallest image (contain, no cropping) instead of
   *  taking a fixed height from the caller (cover). */
  autoHeight?: boolean;
}) {
  const n = images.length;
  // index runs 0..n; n lands on the appended clone of frame 0.
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const key = images.join('|');

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

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!autoHeight) return;
    const img = e.currentTarget;
    if (img.naturalWidth) {
      const r = img.naturalHeight / img.naturalWidth;
      setMaxRatio(m => (r > m ? r : m));
    }
  };

  // Auto-advance; only runs with more than one image.
  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => setIndex(i => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [n, key]);

  // Re-enable the transition the frame after a no-transition snap, before the
  // next slide — otherwise adding the transition and moving in the same commit
  // wouldn't animate.
  useEffect(() => {
    if (animate) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(r);
  }, [animate]);

  if (n === 0) return null;

  // When the slide onto the clone finishes, snap back to the real first frame
  // with the transition off.
  const handleTransitionEnd = () => {
    if (index === n) { setAnimate(false); setIndex(0); }
  };

  const frames = n > 1 ? [...images, images[0]] : images;
  const active = index % n; // which real image is showing (for dots)

  const heightStyle = autoHeight
    ? { height: Math.round((width || 0) * (maxRatio || AUTO_HEIGHT_FALLBACK_RATIO)) || undefined }
    : undefined;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`.trim()} style={heightStyle}>
      <div
        className={`flex h-full w-full ${animate ? 'transition-transform duration-700 ease-in-out' : ''}`}
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTransitionEnd={handleTransitionEnd}
      >
        {frames.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={i === active ? alt : ''}
            loading="lazy"
            onLoad={handleImgLoad}
            className={`w-full h-full shrink-0 ${autoHeight ? 'object-contain' : 'object-cover'}`}
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
