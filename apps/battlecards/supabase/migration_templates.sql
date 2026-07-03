-- ============================================================
-- BattleCards — templates migration
--
-- Lets the cards table hold BOTH deck cards (scoped to a deck)
-- and user templates (scoped to user + game, no deck). Extends
-- the existing schema so addons/keywords join tables work for
-- templates without any duplication.
--
-- Shape changes on public.cards:
--   - deck_id   becomes nullable (templates have no deck).
--   - user_id   added, NOT NULL. Populated for every card
--               (backfilled from the parent deck for existing rows;
--               required up front for new rows).
--   - game_id   added, nullable. Required only for templates;
--               deck cards derive game via deck.
--   - is_template added, NOT NULL DEFAULT false.
--
--   A CHECK constraint enforces the row-shape invariant:
--     * is_template = false  → deck_id required
--     * is_template = true   → game_id required, deck_id null
--
-- RLS is extended so users can access their template rows
-- directly via user_id, in addition to the existing
-- "access via parent deck" policies.
--
-- Run this in the Supabase SQL editor after the previous
-- migrations.
-- ============================================================

-- ── Column changes ────────────────────────────────────────────

alter table public.cards
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.cards
  add column if not exists game_id uuid references public.games (id) on delete restrict;

alter table public.cards
  add column if not exists is_template boolean not null default false;

-- Backfill user_id from the parent deck for existing rows.
update public.cards c
   set user_id = d.user_id
  from public.decks d
 where c.deck_id  = d.id
   and c.user_id is null;

alter table public.cards
  alter column user_id set not null;

alter table public.cards
  alter column deck_id drop not null;

-- Row-shape invariant.
alter table public.cards
  drop constraint if exists cards_template_or_deck;
alter table public.cards
  add constraint cards_template_or_deck check (
    (is_template = false and deck_id is not null) or
    (is_template = true  and deck_id is null and game_id is not null)
  );

-- ── Indexes ───────────────────────────────────────────────────

-- Fast lookup of a user's templates for a given game.
create index if not exists cards_templates_user_game_idx
  on public.cards (user_id, game_id)
  where is_template = true;

-- ── Trigger: auto-populate user_id for deck cards ─────────────
-- Existing INSERTs in the app don't pass user_id; derive it from
-- the parent deck so callers don't need to change. Templates
-- (is_template = true) must pass user_id explicitly.

create or replace function public.cards_fill_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null and new.deck_id is not null then
    select d.user_id into new.user_id
      from public.decks d
     where d.id = new.deck_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cards_fill_user_id on public.cards;
create trigger cards_fill_user_id
  before insert on public.cards
  for each row execute procedure public.cards_fill_user_id();

-- ── RLS policies ──────────────────────────────────────────────

-- Add a parallel "access via user_id" arm to each card policy,
-- so template rows (which have no deck) are reachable. The
-- existing "access via deck" arm keeps working for deck cards.

drop policy if exists "cards_select" on public.cards;
create policy "cards_select" on public.cards
  for select to authenticated
  using (
    (deck_id is not null and exists (
      select 1 from public.decks
       where decks.id = cards.deck_id
         and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and user_id = auth.uid())
  );

drop policy if exists "cards_insert" on public.cards;
create policy "cards_insert" on public.cards
  for insert to authenticated
  with check (
    (deck_id is not null and exists (
      select 1 from public.decks
       where decks.id = cards.deck_id
         and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and user_id = auth.uid())
  );

drop policy if exists "cards_update" on public.cards;
create policy "cards_update" on public.cards
  for update to authenticated
  using (
    (deck_id is not null and exists (
      select 1 from public.decks
       where decks.id = cards.deck_id
         and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and user_id = auth.uid())
  )
  with check (
    (deck_id is not null and exists (
      select 1 from public.decks
       where decks.id = cards.deck_id
         and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and user_id = auth.uid())
  );

drop policy if exists "cards_delete" on public.cards;
create policy "cards_delete" on public.cards
  for delete to authenticated
  using (
    (deck_id is not null and exists (
      select 1 from public.decks
       where decks.id = cards.deck_id
         and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and user_id = auth.uid())
  );
