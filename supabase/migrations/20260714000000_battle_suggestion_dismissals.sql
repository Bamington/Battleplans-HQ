-- 20260714000000_battle_suggestion_dismissals.sql
--
-- "Suggested Battles": we surface past bookings the user hasn't logged a battle
-- for yet. This table records suggestions the user has explicitly dismissed, so a
-- session they'll never log (a demo, a no-show, a game they'd rather not record)
-- doesn't keep coming back. Keyed by the booking the suggestion came from.

create table if not exists public.battle_suggestion_dismissals (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  booking_id uuid        not null references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, booking_id)
);

create index if not exists battle_suggestion_dismissals_user_idx
  on public.battle_suggestion_dismissals (user_id);

alter table public.battle_suggestion_dismissals enable row level security;
drop policy if exists "battle_suggestion_dismissals_own" on public.battle_suggestion_dismissals;
create policy "battle_suggestion_dismissals_own" on public.battle_suggestion_dismissals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
