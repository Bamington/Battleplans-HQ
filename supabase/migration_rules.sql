-- ============================================================
-- BattleCards — rules migration
-- Adds rule definitions (title + markdown description) and
-- per-deck rule assignments.  Rules are reusable across decks
-- of the same game.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

-- Rule definitions — user-owned, scoped to a game.
create table public.rules (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  game_id       uuid        not null references public.games (id) on delete cascade,
  title         text        not null,
  description   text,
  created_at    timestamptz not null default now(),
  unique (user_id, game_id, title)
);

-- Assigns rules to decks.
create table public.deck_rules (
  id          uuid        primary key default gen_random_uuid(),
  deck_id     uuid        not null references public.decks (id) on delete cascade,
  rule_id     uuid        not null references public.rules (id) on delete cascade,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  unique (deck_id, rule_id)
);


-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.rules      enable row level security;
alter table public.deck_rules enable row level security;

-- rules: users manage only their own rows
create policy "rules_select" on public.rules
  for select to authenticated
  using (auth.uid() = user_id);

create policy "rules_insert" on public.rules
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "rules_update" on public.rules
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "rules_delete" on public.rules
  for delete to authenticated
  using (auth.uid() = user_id);

-- deck_rules: users manage rows for decks they own
create policy "deck_rules_select" on public.deck_rules
  for select to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_rules.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_rules_insert" on public.deck_rules
  for insert to authenticated
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_rules.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_rules_update" on public.deck_rules
  for update to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_rules.deck_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_rules.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_rules_delete" on public.deck_rules
  for delete to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_rules.deck_id
        and decks.user_id = auth.uid()
    )
  );


-- ── Extend game_constraints entity_type check ───────────────────────────────

alter table public.game_constraints
  drop constraint if exists game_constraints_entity_type_check;

alter table public.game_constraints
  add constraint game_constraints_entity_type_check
  check (entity_type in ('card', 'addon', 'keyword', 'rule'));


-- ── Halo: Flashpoint — rule constraints ─────────────────────────────────────

insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'rule', null, '{
  "fields": {
    "title":       { "required": true, "maxLength": 60 },
    "description": { "maxLength": 2000 }
  }
}'::jsonb
from public.games g where g.slug = 'halo-flashpoint';
