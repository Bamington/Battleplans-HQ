/**
 * cardBuilder.ts — Shared contracts for the card-builder shell + hook.
 *
 * Game-agnostic types that let `useCardBuilder` and the BuilderShell /
 * CardListPanel / EditorPanel / CenterViewport components stay decoupled
 * from any specific game's card data shape.
 */

export interface CardBuilderConfig {
  /** Supabase deck row id, or null while the deck is loading / unsaved. */
  deckId: string | null;
  /** Supabase table holding the deck row. Default: 'decks'. */
  decksTable?: string;
}
