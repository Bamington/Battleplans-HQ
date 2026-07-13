-- 20260713010000_opponents.sql
--
-- Opponents as first-class objects (a per-user roster) instead of a comma-joined
-- string. A battle can now have many opponents (multiplayer), and each opponent
-- is a row we can later match to a real user or dedupe/normalise.
--
-- `battles.opp_name` is KEPT as a denormalised display cache, maintained by the
-- app (and resynced here after the backfill).

-- ── opponents ────────────────────────────────────────────────────────────────
create table if not exists public.opponents (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  name           text        not null,
  -- Future hook: link to a real BattlePlan user once matched. Null = unmatched.
  linked_user_id uuid        references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- One opponent per (owner, normalised name) — the dedupe/normalisation anchor,
-- and the ON CONFLICT target for find-or-create.
create unique index if not exists opponents_user_name_key
  on public.opponents (user_id, lower(btrim(name)));
create index if not exists opponents_user_id_idx on public.opponents (user_id);

alter table public.opponents enable row level security;
drop policy if exists "opponents_own" on public.opponents;
create policy "opponents_own" on public.opponents
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── battle_opponents (join) ──────────────────────────────────────────────────
create table if not exists public.battle_opponents (
  battle_id   bigint not null references public.battles (id)   on delete cascade,
  opponent_id uuid   not null references public.opponents (id) on delete cascade,
  primary key (battle_id, opponent_id)
);
create index if not exists battle_opponents_opponent_idx on public.battle_opponents (opponent_id);

alter table public.battle_opponents enable row level security;
drop policy if exists "battle_opponents_own" on public.battle_opponents;
create policy "battle_opponents_own" on public.battle_opponents
  for all to authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id and b.user_id = auth.uid()))
  with check (
        exists (select 1 from public.battles   b where b.id = battle_id   and b.user_id = auth.uid())
    and exists (select 1 from public.opponents o where o.id = opponent_id and o.user_id = auth.uid())
  );

-- ── Backfill from existing opp_name ──────────────────────────────────────────
-- Create an opponent per distinct (owner, trimmed name); skip blanks + "Unknown".
insert into public.opponents (user_id, name)
select distinct b.user_id, btrim(x) as name
from public.battles b
cross join lateral unnest(string_to_array(b.opp_name, ',')) as x
where b.opp_name is not null and btrim(x) <> '' and btrim(x) <> 'Unknown'
on conflict (user_id, lower(btrim(name))) do nothing;

-- Link each battle to its opponents.
insert into public.battle_opponents (battle_id, opponent_id)
select distinct b.id, o.id
from public.battles b
cross join lateral unnest(string_to_array(b.opp_name, ',')) as x
join public.opponents o
  on o.user_id = b.user_id and lower(btrim(o.name)) = lower(btrim(x))
where b.opp_name is not null and btrim(x) <> '' and btrim(x) <> 'Unknown'
on conflict do nothing;

-- Resync the opp_name cache to the canonical opponent names.
update public.battles b
set opp_name = sub.names
from (
  select bo.battle_id, string_agg(o.name, ', ' order by o.name) as names
  from public.battle_opponents bo
  join public.opponents o on o.id = bo.opponent_id
  group by bo.battle_id
) sub
where b.id = sub.battle_id;
