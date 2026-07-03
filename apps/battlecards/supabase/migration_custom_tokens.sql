-- ============================================================
-- BattleCards — User-Created Tokens (UCTs)
-- Paste this into the Supabase SQL editor and run it.
--
-- Extends the existing `token_definitions` table so it can hold both:
--   • GAME tokens (deck_id = null)  — built-in, seeded per game (Halo's
--     Damage/Shield/Activated, KT's Wound/Order/etc). Visible to everyone.
--   • USER tokens (deck_id NOT null) — created from the play-mode TokenMenu
--     by the user, scoped to a single deck. CRUD limited to the deck owner.
--
-- Three new columns:
--   • deck_id        — FK to decks; cascade-deletes UCTs when the deck is
--                      removed. NULL for game tokens.
--   • display_color  — hex string (e.g. "#f85908"). When non-null, the
--                      renderer paints a badge (colored circle + glyph)
--                      instead of resolving `icon` to an asset path.
--   • display_glyph  — up to 2 characters shown on the badge. UCTs always
--                      set this; game tokens leave it null.
--
-- RLS gets a new "own-deck" arm on SELECT plus dedicated INSERT/UPDATE/
-- DELETE policies for deck-scoped rows. Game tokens stay read-only via
-- the existing public SELECT.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Columns ──────────────────────────────────────────────────────────────────

alter table public.token_definitions
  add column if not exists deck_id       uuid references public.decks (id) on delete cascade,
  add column if not exists display_color text,
  add column if not exists display_glyph text;

-- Glyph length cap (2 chars). Use a CHECK rather than a domain so it's easy
-- to drop/relax later without touching the column type.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.token_definitions'::regclass
      and conname  = 'token_definitions_display_glyph_len'
  ) then
    alter table public.token_definitions
      add constraint token_definitions_display_glyph_len
      check (display_glyph is null or char_length(display_glyph) <= 2);
  end if;
end $$;

-- Fast deck-scoped lookups.
create index if not exists token_definitions_deck_id_idx
  on public.token_definitions (deck_id)
  where deck_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Replace the broad "everyone can read everything" SELECT with one that
-- still lets every authenticated user read GAME tokens but limits UCT
-- visibility to the deck owner. Add per-action policies for UCT CRUD.

drop policy if exists "token_definitions_select"        on public.token_definitions;
drop policy if exists "token_definitions_select_game"   on public.token_definitions;
drop policy if exists "token_definitions_select_uct"    on public.token_definitions;
drop policy if exists "token_definitions_insert_uct"    on public.token_definitions;
drop policy if exists "token_definitions_update_uct"    on public.token_definitions;
drop policy if exists "token_definitions_delete_uct"    on public.token_definitions;

-- SELECT: game tokens (deck_id null) are visible to all authenticated users;
-- UCTs only to the owning deck's user.
create policy "token_definitions_select" on public.token_definitions
  for select to authenticated
  using (
    deck_id is null
    or deck_id in (select id from public.decks where user_id = auth.uid())
  );

-- INSERT: only deck-scoped rows on a deck the user owns. Game-token inserts
-- continue to require the service role (no policy = denied for authenticated).
create policy "token_definitions_insert_uct" on public.token_definitions
  for insert to authenticated
  with check (
    deck_id is not null
    and deck_id in (select id from public.decks where user_id = auth.uid())
  );

-- UPDATE: same scoping. Old + new row must both belong to a user-owned deck.
create policy "token_definitions_update_uct" on public.token_definitions
  for update to authenticated
  using (
    deck_id is not null
    and deck_id in (select id from public.decks where user_id = auth.uid())
  )
  with check (
    deck_id is not null
    and deck_id in (select id from public.decks where user_id = auth.uid())
  );

-- DELETE: same scoping.
create policy "token_definitions_delete_uct" on public.token_definitions
  for delete to authenticated
  using (
    deck_id is not null
    and deck_id in (select id from public.decks where user_id = auth.uid())
  );
