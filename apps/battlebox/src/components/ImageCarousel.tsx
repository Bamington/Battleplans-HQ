import { useState, useEffect } from 'react';

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
 */

/** How long each image is shown, in ms. Matches the old app. */
const ROTATE_MS = 4000;

export function ImageCarousel({ images, alt, dots = false, className = '' }: {
  images: string[];
  alt: string;
  /** Show non-interactive indicator dots (for larger surfaces like the hero). */
  dots?: boolean;
  className?: string;
}) {
  const n = images.length;
  // index runs 0..n; n lands on the appended clone of frame 0.
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const key = images.join('|');

  // Reset when the image set changes.
  useEffect(() => { setIndex(0); setAnimate(true); }, [key]);

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

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
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
            className="w-full h-full shrink-0 object-cover"
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
