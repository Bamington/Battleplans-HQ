-- ============================================================
-- BattleCards — keywords migration
-- Adds structured keyword definitions and per-card/addon keyword assignments.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

-- Keyword definitions — user-owned, scoped to a game.
create table public.keywords (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  game_id       uuid        not null references public.games (id) on delete cascade,
  name          text        not null,
  description   text,
  -- Array of { key, label, type } objects describing the parameters this keyword
  -- accepts (e.g. X in "Weight of Fire (X)").  Empty array = no params.
  params_schema jsonb       not null default '[]'::jsonb,
  -- Arbitrary game-specific metadata that lives on the keyword itself.
  extra         jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, game_id, name)
);

-- Assigns keywords to cards with per-instance parameter values.
create table public.card_keywords (
  id          uuid        primary key default gen_random_uuid(),
  card_id     uuid        not null references public.cards (id) on delete cascade,
  keyword_id  uuid        not null references public.keywords (id) on delete cascade,
  -- Actual parameter values for this instance, e.g. {"X": 3}.
  params      jsonb       not null default '{}'::jsonb,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  unique (card_id, keyword_id)
);

-- Assigns keywords to addons with per-instance parameter values.
create table public.addon_keywords (
  id          uuid        primary key default gen_random_uuid(),
  addon_id    uuid        not null references public.addons (id) on delete cascade,
  keyword_id  uuid        not null references public.keywords (id) on delete cascade,
  -- Actual parameter values for this instance, e.g. {"X": 2}.
  params      jsonb       not null default '{}'::jsonb,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  unique (addon_id, keyword_id)
);


-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.keywords      enable row level security;
alter table public.card_keywords enable row level security;
alter table public.addon_keywords enable row level security;

-- keywords: users manage only their own rows
create policy "keywords_select" on public.keywords
  for select to authenticated
  using (auth.uid() = user_id);

create policy "keywords_insert" on public.keywords
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "keywords_update" on public.keywords
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "keywords_delete" on public.keywords
  for delete to authenticated
  using (auth.uid() = user_id);

-- card_keywords: users manage rows for cards in their own decks
create policy "card_keywords_select" on public.card_keywords
  for select to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_insert" on public.card_keywords
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_update" on public.card_keywords
  for update to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_delete" on public.card_keywords
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

-- addon_keywords: users manage rows for their own addons
create policy "addon_keywords_select" on public.addon_keywords
  for select to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_insert" on public.addon_keywords
  for insert to authenticated
  with check (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_update" on public.addon_keywords
  for update to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_delete" on public.addon_keywords
  for delete to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );
