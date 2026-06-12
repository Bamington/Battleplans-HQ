/**
 * duplicateDeck.ts — client-side deep-clone of a deck
 *
 * Produces an independent copy of a deck the user owns: a new deck row plus
 * clones of every piece of deck-scoped content, so the duplicate is fully
 * functional and edits to it never touch the original.
 *
 * What gets cloned:
 *   - decks            → new row, name suffixed " (Copy)"
 *   - cards            → one clone per source card (deck_id remapped)
 *   - card_addons      → join rows remapped to the cloned cards
 *                        (addons themselves are user-library items, shared)
 *   - card_keywords    → join rows remapped to the cloned cards
 *   - card_images      → storage object copied to a fresh path + new row
 *                        (mirrors duplicateCard in the card builders)
 *   - deck_rules       → join rows remapped to the new deck
 *   - token_definitions→ deck-scoped custom tokens remapped to the new deck
 *
 * This is not transactional (Supabase has no client-side transaction). On a
 * critical failure (deck or card insert) we best-effort delete the partial
 * deck — its ON DELETE CASCADE children clean up with it — and rethrow.
 * Non-critical per-image failures are logged and skipped, matching the
 * existing single-card duplicate behaviour.
 *
 * Returns the new deck's id.
 */

import { supabase } from './supabase';

/** Drop server-managed / remapped keys from a fetched row before re-insert. */
function stripRowKeys<T extends Record<string, unknown>>(row: T, keys: string[]): Partial<T> {
  const copy: Record<string, unknown> = { ...row };
  for (const k of keys) delete copy[k];
  return copy as Partial<T>;
}

export async function duplicateDeck(sourceDeckId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // ── 1. Source deck → new deck row ─────────────────────────────────────────
  const { data: srcDeck, error: srcDeckErr } = await supabase
    .from('decks')
    .select('game_id, name')
    .eq('id', sourceDeckId)
    .single();
  if (srcDeckErr || !srcDeck) throw srcDeckErr ?? new Error('Source deck not found');

  const { data: newDeck, error: newDeckErr } = await supabase
    .from('decks')
    .insert({ user_id: user.id, game_id: srcDeck.game_id, name: `${srcDeck.name} (Copy)` })
    .select('id')
    .single();
  if (newDeckErr || !newDeck) throw newDeckErr ?? new Error('Failed to create deck');
  const newDeckId = newDeck.id as string;

  try {
    // ── 2. Cards ────────────────────────────────────────────────────────────
    // select('*') keeps us robust to column drift; we only override deck_id and
    // drop the server-managed id / created_at. Insert one at a time so we get a
    // reliable source→clone id map for the join tables below (decks are small).
    const { data: srcCards, error: cardsErr } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', sourceDeckId)
      .order('sort_order', { ascending: true, nullsFirst: false });
    if (cardsErr) throw cardsErr;

    const cardIdMap = new Map<string, string>(); // old card id → new card id
    for (const card of srcCards ?? []) {
      const payload = stripRowKeys(card as Record<string, unknown>, ['id', 'created_at']);
      payload.deck_id = newDeckId;
      const { data: newCard, error: insErr } = await supabase
        .from('cards')
        .insert(payload)
        .select('id')
        .single();
      if (insErr || !newCard) throw insErr ?? new Error('Failed to clone card');
      cardIdMap.set(card.id as string, newCard.id as string);
    }

    const oldCardIds = [...cardIdMap.keys()];

    if (oldCardIds.length > 0) {
      // ── 3. card_addons + card_keywords (join rows remapped) ───────────────
      const [addonsRes, keywordsRes, imagesRes] = await Promise.all([
        supabase.from('card_addons').select('card_id, addon_id, sort_order').in('card_id', oldCardIds),
        supabase.from('card_keywords').select('card_id, keyword_id, params, sort_order').in('card_id', oldCardIds),
        supabase.from('card_images').select('card_id, file_path, image_type, sort_order').in('card_id', oldCardIds),
      ]);
      if (addonsRes.error) throw addonsRes.error;
      if (keywordsRes.error) throw keywordsRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const addonRows = (addonsRes.data ?? []).map(a => ({
        card_id: cardIdMap.get(a.card_id),
        addon_id: a.addon_id,
        sort_order: a.sort_order,
      }));
      if (addonRows.length > 0) {
        const { error } = await supabase.from('card_addons').insert(addonRows);
        if (error) throw error;
      }

      const keywordRows = (keywordsRes.data ?? []).map(k => ({
        card_id: cardIdMap.get(k.card_id),
        keyword_id: k.keyword_id,
        params: k.params,
        sort_order: k.sort_order,
      }));
      if (keywordRows.length > 0) {
        const { error } = await supabase.from('card_keywords').insert(keywordRows);
        if (error) throw error;
      }

      // ── 4. card_images — copy storage object then insert row ──────────────
      // Per-image failures are logged and skipped rather than aborting the
      // whole duplicate (matches the single-card duplicate behaviour).
      for (const img of imagesRes.data ?? []) {
        try {
          const newCardId = cardIdMap.get(img.card_id)!;
          const ext = img.file_path.split('.').pop() ?? 'jpg';
          const prefix = img.image_type === 'avatar' ? 'avatar-' : '';
          const newPath = `${user.id}/${newCardId}/${prefix}${crypto.randomUUID()}.${ext}`;

          await supabase.storage.from('card-images').copy(img.file_path, newPath);
          await supabase.from('card_images').insert({
            card_id: newCardId,
            file_path: newPath,
            image_type: img.image_type,
            sort_order: img.sort_order,
          });
        } catch (err) {
          console.error('[BattleCards] Failed to duplicate card image:', err);
        }
      }
    }

    // ── 5. deck_rules (rule assignments) ──────────────────────────────────────
    const { data: srcRules, error: rulesErr } = await supabase
      .from('deck_rules')
      .select('rule_id, sort_order')
      .eq('deck_id', sourceDeckId);
    if (rulesErr) throw rulesErr;
    if (srcRules && srcRules.length > 0) {
      const { error } = await supabase.from('deck_rules').insert(
        srcRules.map(r => ({ deck_id: newDeckId, rule_id: r.rule_id, sort_order: r.sort_order })),
      );
      if (error) throw error;
    }

    // ── 6. token_definitions (deck-scoped custom tokens) ──────────────────────
    const { data: srcTokens, error: tokensErr } = await supabase
      .from('token_definitions')
      .select('*')
      .eq('deck_id', sourceDeckId);
    if (tokensErr) throw tokensErr;
    if (srcTokens && srcTokens.length > 0) {
      const tokenRows = srcTokens.map(t => {
        const payload = stripRowKeys(t as Record<string, unknown>, ['id', 'created_at']);
        payload.deck_id = newDeckId;
        return payload;
      });
      const { error } = await supabase.from('token_definitions').insert(tokenRows);
      if (error) throw error;
    }

    return newDeckId;
  } catch (err) {
    // Best-effort cleanup of the partial deck (cascades to its children).
    await supabase.from('decks').delete().eq('id', newDeckId);
    throw err;
  }
}
