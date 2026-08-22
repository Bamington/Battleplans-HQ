-- ============================================================
-- BattleCards — play sessions
--
-- Play mode has always been in-memory only: token values lived on
-- the React card objects and were lost the moment the builder
-- unmounted. Coming back to a deck re-seeded every token from its
-- definition's starting_value, so a wounded unit came back at full
-- health.
--
-- This gives a game in progress a row of its own. A session belongs
-- to one player and one deck, holds the token values for every card
-- plus the turn number, and ends when the player says so.
--
-- WHY A SESSION AND NOT A COLUMN ON cards
-- Token values are not a property of a deck — they are a property of
-- a game being played with it. Hanging them off `cards` would mean
-- one game per deck forever, with no way to tell "I finished that
-- battle" from "I haven't started one", and no room for a second
-- player running the same list. A session row has a beginning and an
-- end, which is what the concept actually is.
--
-- Run in the Supabase SQL editor after migration_tokens.sql.
-- ============================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
--
-- `state` maps a card's DATABASE id to its token values:
--   { "<cards.id>": { "<token_definitions.id>": 3 } }
--
-- Keyed on the database id deliberately. The builders assign each card a fresh
-- crypto.randomUUID() for React on every load and keep the row id separately as
-- dbId, so anything keyed on the client-side id would restore into nothing.

create table if not exists public.deck_play_sessions (
  id         uuid        primary key default gen_random_uuid(),
  deck_id    uuid        not null references public.decks (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  -- Turn counter, driven by the existing New Turn control.
  turn       integer     not null default 1 check (turn >= 1),
  -- card_id → { token_def_id → value }
  state      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Null while the game is in progress. Set when the player ends it, which
  -- keeps the row as history rather than deleting it.
  ended_at   timestamptz
);

comment on table public.deck_play_sessions is
  'One game in progress (or finished) for a deck. Holds Play-mode token values keyed by cards.id, plus the turn number.';

-- One live game per player per deck. Ended sessions are exempt, so the history
-- can hold as many as it likes.
create unique index if not exists deck_play_sessions_one_active_idx
  on public.deck_play_sessions (deck_id, user_id)
  where ended_at is null;

-- "Resume my game on this deck" — the hot path on entering Play mode.
create index if not exists deck_play_sessions_lookup_idx
  on public.deck_play_sessions (user_id, deck_id)
  where ended_at is null;


-- ── 2. Keep updated_at honest ───────────────────────────────────────────────
-- Token changes save often; the client shouldn't have to remember to stamp it.

create or replace function public.deck_play_sessions_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists deck_play_sessions_touch on public.deck_play_sessions;
create trigger deck_play_sessions_touch
  before update on public.deck_play_sessions
  for each row execute procedure public.deck_play_sessions_touch();


-- ── 3. Row Level Security ───────────────────────────────────────────────────
-- A session is private to the player it belongs to. Inserting one also
-- requires owning the deck, so a session can't be attached to someone else's
-- list — including a deck seen through a share link, which is read-only.

alter table public.deck_play_sessions enable row level security;

drop policy if exists "deck_play_sessions_select" on public.deck_play_sessions;
create policy "deck_play_sessions_select" on public.deck_play_sessions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "deck_play_sessions_insert" on public.deck_play_sessions;
create policy "deck_play_sessions_insert" on public.deck_play_sessions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.decks d
      where d.id = deck_play_sessions.deck_id
        and d.user_id = auth.uid()
    )
  );

drop policy if exists "deck_play_sessions_update" on public.deck_play_sessions;
create policy "deck_play_sessions_update" on public.deck_play_sessions
  for update to authenticated
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "deck_play_sessions_delete" on public.deck_play_sessions;
create policy "deck_play_sessions_delete" on public.deck_play_sessions
  for delete to authenticated
  using (user_id = auth.uid());
