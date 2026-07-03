-- ============================================================
-- BattleCards — addons migration
-- Paste this into the Supabase SQL editor and run it.
-- ============================================================


-- ── Tables ───────────────────────────────────────────────────────────────────

-- Defines a category of addon for a specific game (e.g. "Skills" for Blood Bowl).
-- Admin-managed — same access pattern as public.games.
create table public.addon_types (
  id          uuid        primary key default gen_random_uuid(),
  game_id     uuid        not null references public.games (id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  -- Array of { key, label, type } objects describing each stat field for this addon type.
  stat_schema jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (game_id, slug)
);

-- A user-created addon instance (e.g. a specific skill or weapon).
create table public.addons (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  addon_type_id uuid        not null references public.addon_types (id) on delete restrict,
  -- Denormalised from addon_types.game_id for fast per-game queries.
  -- Auto-populated by trigger — do not set manually.
  game_id       uuid        not null references public.games (id) on delete restrict,
  name          text        not null,
  description   text,
  -- Game-specific stats stored as a flexible JSON object.
  -- Shape is defined by the parent addon_type's stat_schema.
  stats         jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Join table — links cards to addons (many-to-many).
create table public.card_addons (
  id         uuid        primary key default gen_random_uuid(),
  card_id    uuid        not null references public.cards (id) on delete cascade,
  addon_id   uuid        not null references public.addons (id) on delete cascade,
  -- Nullable for now; populated when display order matters.
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (card_id, addon_id)
);


-- ── Trigger: auto-populate addons.game_id ────────────────────────────────────

create or replace function public.set_addon_game_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select game_id into new.game_id
  from public.addon_types
  where id = new.addon_type_id;
  return new;
end;
$$;

create trigger addon_set_game_id
  before insert or update of addon_type_id on public.addons
  for each row execute procedure public.set_addon_game_id();


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.addon_types enable row level security;
alter table public.addons      enable row level security;
alter table public.card_addons enable row level security;

-- addon_types: any authenticated user can read; writes require the service role
create policy "addon_types_select" on public.addon_types
  for select to authenticated using (true);

-- addons: users manage only their own rows
create policy "addons_select" on public.addons
  for select to authenticated
  using (auth.uid() = user_id);

create policy "addons_insert" on public.addons
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "addons_update" on public.addons
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "addons_delete" on public.addons
  for delete to authenticated
  using (auth.uid() = user_id);

-- card_addons: users manage join rows for cards in their own decks
create policy "card_addons_select" on public.card_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_insert" on public.card_addons
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_update" on public.card_addons
  for update to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_delete" on public.card_addons
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );


-- ── Seed: addon_types ────────────────────────────────────────────────────────

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Skills', 'skills',
  '[
    {"key": "description", "label": "Description", "type": "text"}
  ]'::jsonb
from public.games where slug = 'blood-bowl';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "type",     "label": "Type",     "type": "text"},
    {"key": "range",    "label": "Range",    "type": "text"},
    {"key": "ap",       "label": "AP",       "type": "text"},
    {"key": "keywords", "label": "Keywords", "type": "text"}
  ]'::jsonb
from public.games where slug = 'halo-flashpoint';


-- ── Update games: remove now-relational fields from stat_schema ──────────────

-- Remove the 'skills' text field from Blood Bowl — now handled by addons.
update public.games
set stat_schema = (
  select jsonb_agg(field order by ordinality)
  from jsonb_array_elements(stat_schema) with ordinality as t(field, ordinality)
  where field->>'key' != 'skills'
)
where slug = 'blood-bowl';

-- Remove the 'weapons' field from Halo: Flashpoint — now handled by addons.
update public.games
set stat_schema = (
  select jsonb_agg(field order by ordinality)
  from jsonb_array_elements(stat_schema) with ordinality as t(field, ordinality)
  where field->>'key' != 'weapons'
)
where slug = 'halo-flashpoint';
