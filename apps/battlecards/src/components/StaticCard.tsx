/**
 * StaticCard.tsx — Image-only card (List Builder)
 *
 * Renders a static card face (e.g. an official Gundam Assemble unit card) at
 * the card's native pixel size, exactly like the hand-built game cards, so the
 * same scaling wrappers, print grid and TokenOverlay work on top of it.
 *
 * The face is generic card chrome stored in `cards.face_path` (shared pack
 * file). `children` render above the face — the hook for future layers such as
 * an overlaid custom photo, or play-mode tokens.
 *
 * States:
 *   - face loaded        → image fills the card
 *   - no face / broken   → neutral placeholder showing the card name
 *   - dimmed             → greyed out (e.g. not selectable / at max copies)
 *
 * USAGE:
 *   <StaticCard
 *     faceUrl={cardFaceUrl(card.face_path)}
 *     name={card.name}
 *     width={750} height={1050}
 *   >
 *     <TokenOverlay ... />
 *   </StaticCard>
 */

import React, { useState } from 'react';
import { Text } from '@battleplans/ui';
import { supabase } from '@battleplans/ui';

export interface StaticCardProps {
  /** Public URL of the card face. null/undefined shows the placeholder. */
  faceUrl?: string | null;
  /** Card name — used as alt text and on the placeholder. */
  name: string;
  /** Native card width in px (the parent scales it). */
  width: number;
  /** Native card height in px. */
  height: number;
  /** Grey the card out (e.g. unavailable in the picker). */
  dimmed?: boolean;
  /** Corner radius in native px (default 24). */
  radius?: number;
  /** Layers drawn above the face (tokens, photo overlay, selection ring). */
  children?: React.ReactNode;
  className?: string;
}

/** Native card height for a given native width and games.print_size
 *  ([w_mm, h_mm]). Falls back to a standard 63×88 card when print_size is
 *  missing or malformed (the shared games catalog stores [] for unset). */
export const nativeCardHeight = (nativeWidth: number, printSize: unknown): number => {
  const ok = Array.isArray(printSize) && printSize.length === 2
    && printSize.every(n => typeof n === 'number' && n > 0);
  const [w, h] = ok ? (printSize as [number, number]) : [63, 88];
  return Math.round(nativeWidth * (h / w));
};

/** Resolve a cards.face_path to a public URL (card-images bucket is public). */
export const cardFaceUrl = (facePath: string | null | undefined): string | null =>
  facePath ? supabase.storage.from('card-images').getPublicUrl(facePath).data.publicUrl : null;

const StaticCard = ({
  faceUrl,
  name,
  width,
  height,
  dimmed = false,
  radius = 24,
  children,
  className = '',
}: StaticCardProps) => {
  // Remember which URL failed so a new URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(faceUrl) && failedUrl !== faceUrl;

  return (
    // Outer box is NOT clipped, so overlay children (e.g. a token bar placed
    // beneath the card) can extend past the card edge. Only the face is clipped.
    <div className={`relative ${className}`.trim()} style={{ width, height }}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: radius, filter: dimmed ? 'grayscale(1) opacity(0.5)' : undefined }}
      >
      {showImage ? (
        <img
          src={faceUrl!}
          alt={name}
          draggable={false}
          onError={() => setFailedUrl(faceUrl ?? null)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: radius,
            borderStyle: 'dashed',
            borderWidth: Math.max(2, Math.round(width / 150)),
            padding: Math.round(width / 12),
          }}
        >
          {/* Scaled down with the card, so size relative to native width. */}
          <div style={{ fontSize: Math.round(width / 14) }}>
            <Text variant="paragraph" align="center" color="secondary" weight="semibold" className="!text-[1em] !leading-tight">
              {name}
            </Text>
          </div>
        </div>
      )}
      </div>
      {children}
    </div>
  );
};

export default StaticCard;
