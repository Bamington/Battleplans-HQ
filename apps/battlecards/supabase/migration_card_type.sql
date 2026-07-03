-- ============================================================
-- BattleCards — add card_type discriminator to cards
-- Paste this into the Supabase SQL editor and run it.
--
-- Adds a `card_type` column to public.cards distinguishing operative cards
-- (the default game-piece layout) from rule cards (e.g. Kill Team faction
-- rules / ploys). Existing rows backfill to 'operative'.
--
-- Idempotent — re-running is a no-op once the column exists.
-- ============================================================

alter table public.cards
  add column if not exists card_type text not null default 'operative';

-- Add the check constraint only if it doesn't exist yet.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cards'::regclass
      and conname  = 'cards_card_type_check'
  ) then
    alter table public.cards
      add constraint cards_card_type_check
      check (card_type in ('operative', 'rule'));
  end if;
end $$;
