/**
 * cardSizes.ts — print size of a card, per card type
 *
 * A game's print_size / bleed_size are the defaults; games.card_type_sizes
 * overrides them per card_type (e.g. Gundam Assemble tactics cards — card_type
 * 'rule' — are 63×88 mm portrait while its units are 150×105 mm landscape).
 */

import type { CardTypeSizes } from './database.types';

export interface GameSizeInfo {
  print_size?:      unknown;
  bleed_size?:      unknown;
  card_type_sizes?: CardTypeSizes | null;
}

/** [w, h] mm print size for a card type (unvalidated; pass to nativeCardHeight etc.). */
export const printSizeFor = (game: GameSizeInfo | null | undefined, cardType: string): unknown =>
  game?.card_type_sizes?.[cardType]?.print ?? game?.print_size;

/** Native render scale for static cards: 5 px per mm (150 mm → 750 px). A
 *  constant scale keeps different card types at their true relative sizes. */
export const PX_PER_MM = 5;

/** Valid [w, h] mm pair, or a standard 63×88 card when missing/malformed. */
export const validMm = (size: unknown): [number, number] =>
  Array.isArray(size) && size.length === 2 && size.every(n => typeof n === 'number' && n > 0)
    ? (size as [number, number])
    : [63, 88];

/** Native pixel size of a static card of the given type. */
export const nativeDimsFor = (game: GameSizeInfo | null | undefined, cardType: string): { w: number; h: number } => {
  const [w, h] = validMm(printSizeFor(game, cardType));
  return { w: Math.round(w * PX_PER_MM), h: Math.round(h * PX_PER_MM) };
};

/** [w, h] mm bleed size for a card type (unvalidated). */
export const bleedSizeFor = (game: GameSizeInfo | null | undefined, cardType: string): unknown =>
  game?.card_type_sizes?.[cardType]?.bleed ?? game?.bleed_size;
