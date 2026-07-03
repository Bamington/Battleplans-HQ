-- ============================================================
-- BattleCards — templates join-table RLS fix
--
-- The initial templates migration (`migration_templates.sql`)
-- extended RLS on `public.cards` so users can access their own
-- template rows via `user_id` even though templates have no
-- `deck_id`. However it did NOT extend RLS on the join tables
-- (`card_addons`, `card_keywords`), whose policies still only
-- grant access via the parent card's `deck_id → decks.user_id`.
--
-- As a result, reading a template's nested `card_addons` /
-- `card_keywords` rows returns nothing (silent RLS filter), so
-- `createFromTemplate` sees an empty list and the new card ends
-- up with no weapons or keyword relationships.
--
-- This migration adds a parallel "access via template owner"
-- arm to each policy, so templates' join rows are readable,
-- writable, and deletable by their owner. Deck-card behaviour
-- is unchanged.
--
-- Run in the Supabase SQL editor after `migration_templates.sql`.
-- ============================================================

-- ── card_addons ──────────────────────────────────────────────

drop policy if exists "card_addons_select" on public.card_addons;
create policy "card_addons_select" on public.card_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_addons.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_addons_insert" on public.card_addons;
create policy "card_addons_insert" on public.card_addons
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_addons.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_addons_update" on public.card_addons;
create policy "card_addons_update" on public.card_addons
  for update to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_addons.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_addons.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_addons_delete" on public.card_addons;
create policy "card_addons_delete" on public.card_addons
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_addons.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

-- ── card_keywords ────────────────────────────────────────────

drop policy if exists "card_keywords_select" on public.card_keywords;
create policy "card_keywords_select" on public.card_keywords
  for select to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_keywords.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_keywords_insert" on public.card_keywords;
create policy "card_keywords_insert" on public.card_keywords
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_keywords.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_keywords_update" on public.card_keywords;
create policy "card_keywords_update" on public.card_keywords
  for update to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_keywords.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_keywords.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );

drop policy if exists "card_keywords_delete" on public.card_keywords;
create policy "card_keywords_delete" on public.card_keywords
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks d on d.id = c.deck_id
      where c.id = card_keywords.card_id
        and (
          d.user_id = auth.uid()
          or (c.is_template = true and c.user_id = auth.uid())
        )
    )
  );
