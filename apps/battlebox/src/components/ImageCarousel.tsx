import { useState, useEffect } from 'react';

/**
 * ImageCarousel.tsx — Auto-rotating, non-interactive image carousel.
 *
 * Replicates the old app's collection carousel: it cycles through a set of
 * images on a fixed timer with a crossfade, with no user controls (the dots are
 * indicators only). One image → shown static. Zero images → the caller falls
 * back to an icon, so this expects at least one.
 *
 * All frames are stacked and cross-faded via opacity (rather than a horizontal
 * slider) so only the active image needs to paint.
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
  const [index, setIndex] = useState(0);
  const key = images.join('|');

  // Reset to the first frame whenever the image set changes.
  useEffect(() => { setIndex(0); }, [key]);

  // Auto-advance. Only runs when there's more than one image.
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [images.length, key]);

  if (images.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={i === index ? alt : ''}
          loading="lazy"
          aria-hidden={i === index ? undefined : true}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      {dots && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none" aria-hidden="true">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === index ? 'bg-white shadow' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
