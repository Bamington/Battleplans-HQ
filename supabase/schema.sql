-- ============================================================
-- BattleCards — initial schema
-- Paste this into the Supabase SQL editor and run it.
-- ============================================================


-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.games (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  -- Array of { key, label, type } objects describing each stat field for this game.
  -- type is one of: "text" | "number"
  stat_schema jsonb       not null default '[]'::jsonb,
  -- [width_mm, height_mm] — card dimensions for printing (no bleed)
  print_size  jsonb       not null default '[]'::jsonb,
  -- [width_mm, height_mm] — card dimensions for printing (with bleed)
  bleed_size  jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

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

create table public.decks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  game_id    uuid        not null references public.games (id) on delete restrict,
  name       text        not null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id          uuid        primary key default gen_random_uuid(),
  -- Nullable: templates (is_template = true) have no deck.
  deck_id     uuid        references public.decks (id) on delete cascade,
  -- Always populated. Owner of the card or template.
  -- Auto-filled by trigger from decks.user_id for deck cards.
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- Nullable for deck cards (derive via deck); required for templates.
  game_id     uuid        references public.games (id) on delete restrict,
  name        text        not null,
  -- Discriminator for the card layout. 'operative' is the default game-piece
  -- card; 'rule' is a faction-rule / ploy / mission style card.
  card_type   text        not null default 'operative'
                              check (card_type in ('operative', 'rule')),
  -- Game-specific stats stored as a flexible JSON object.
  -- Shape is defined by the parent game's stat_schema.
  stats       jsonb       not null default '{}'::jsonb,
  is_template boolean     not null default false,
  created_at  timestamptz not null default now(),
  constraint cards_template_or_deck check (
    (is_template = false and deck_id is not null) or
    (is_template = true  and deck_id is null and game_id is not null)
  )
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

-- Auto-populate cards.user_id from the parent deck for deck cards. Templates
-- must pass user_id explicitly (they have no parent deck).
create or replace function public.cards_fill_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and new.deck_id is not null then
    select d.user_id into new.user_id
      from public.decks d
     where d.id = new.deck_id;
  end if;
  return new;
end;
$$;

create trigger cards_fill_user_id
  before insert on public.cards
  for each row execute procedure public.cards_fill_user_id();

-- Fast lookup of a user's templates for a given game.
create index if not exists cards_templates_user_game_idx
  on public.cards (user_id, game_id)
  where is_template = true;

create trigger addon_set_game_id
  before insert or update of addon_type_id on public.addons
  for each row execute procedure public.set_addon_game_id();


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.games       enable row level security;
alter table public.addon_types enable row level security;
alter table public.decks       enable row level security;
alter table public.cards       enable row level security;
alter table public.addons      enable row level security;
alter table public.card_addons enable row level security;

-- games: any authenticated user can read; writes require the service role (admin only)
create policy "games_select" on public.games
  for select to authenticated using (true);

-- addon_types: any authenticated user can read; writes require the service role
create policy "addon_types_select" on public.addon_types
  for select to authenticated using (true);

-- decks: users manage only their own rows
create policy "decks_select" on public.decks
  for select to authenticated
  using (auth.uid() = user_id);

create policy "decks_insert" on public.decks
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "decks_update" on public.decks
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decks_delete" on public.decks
  for delete to authenticated
  using (auth.uid() = user_id);

-- cards: users manage cards that belong to their own decks (deck cards)
-- or templates they own directly (templates have no deck).
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


-- ── Keywords ─────────────────────────────────────────────────────────────────

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

alter table public.keywords       enable row level security;
alter table public.card_keywords  enable row level security;
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


-- ── Game constraints ─────────────────────────────────────────────────────────
-- Stores per-game, per-entity-type validation rules in a JSONB column.
-- Shape of constraints:
--   { "fields": { "<fieldKey>": { required, min, max, minLength, maxLength, pattern } },
--     "limits": { "maxAddons": N, "maxKeywords": N } }
-- For stat fields, use "stats.<key>" as the field key.

create table public.game_constraints (
  id            uuid        primary key default gen_random_uuid(),
  game_id       uuid        not null references public.games (id) on delete cascade,
  entity_type   text        not null check (entity_type in ('card', 'addon', 'keyword')),
  addon_type_id uuid        references public.addon_types (id) on delete cascade,
  constraints   jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- One constraint row per (game, entity_type) when addon_type_id IS NULL
create unique index game_constraints_without_addon
  on public.game_constraints (game_id, entity_type)
  where addon_type_id is null;

-- One constraint row per (game, entity_type, addon_type_id) when NOT NULL
create unique index game_constraints_with_addon
  on public.game_constraints (game_id, entity_type, addon_type_id)
  where addon_type_id is not null;

alter table public.game_constraints enable row level security;

-- Anyone can read constraints (they're game-level config, not user data).
-- Writes require the service role (admin only).
create policy "game_constraints_select" on public.game_constraints
  for select to authenticated using (true);


-- ── Trigger: validate entity field constraints ──────────────────────────────

create or replace function public.validate_card_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id  uuid;
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  -- Resolve game_id through the card's deck
  select d.game_id into _game_id
  from public.decks d where d.id = new.deck_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    -- Resolve value: "stats.X" reads from new.stats->'X', else reads column
    if _key like 'stats.%' then
      _val := new.stats -> substring(_key from 7);
    elsif _key = 'name' then
      _val := to_jsonb(new.name);
    else
      continue;
    end if;

    -- required
    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    -- skip further checks if value is null
    if _val is null or _val = 'null'::jsonb then continue; end if;

    -- min / max (numeric)
    if _fc ? 'min' and (_val)::text::numeric < (_fc ->> 'min')::numeric then
      raise exception 'Field "%" must be >= %', _key, _fc ->> 'min';
    end if;
    if _fc ? 'max' and (_val)::text::numeric > (_fc ->> 'max')::numeric then
      raise exception 'Field "%" must be <= %', _key, _fc ->> 'max';
    end if;

    -- minLength / maxLength (text)
    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    -- pattern (text)
    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger cards_validate_constraints
  before insert or update on public.cards
  for each row execute procedure public.validate_card_constraints();


create or replace function public.validate_addon_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  -- Look for addon-type-specific constraints first, fall back to generic
  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = new.game_id
    and gc.entity_type = 'addon'
    and gc.addon_type_id = new.addon_type_id;

  if _gc is null then
    select gc.constraints into _gc
    from public.game_constraints gc
    where gc.game_id = new.game_id
      and gc.entity_type = 'addon'
      and gc.addon_type_id is null;
  end if;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    if _key like 'stats.%' then
      _val := new.stats -> substring(_key from 7);
    elsif _key = 'name' then
      _val := to_jsonb(new.name);
    elsif _key = 'description' then
      _val := to_jsonb(new.description);
    else
      continue;
    end if;

    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    if _val is null or _val = 'null'::jsonb then continue; end if;

    if _fc ? 'min' and (_val)::text::numeric < (_fc ->> 'min')::numeric then
      raise exception 'Field "%" must be >= %', _key, _fc ->> 'min';
    end if;
    if _fc ? 'max' and (_val)::text::numeric > (_fc ->> 'max')::numeric then
      raise exception 'Field "%" must be <= %', _key, _fc ->> 'max';
    end if;

    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger addons_validate_constraints
  before insert or update on public.addons
  for each row execute procedure public.validate_addon_constraints();


create or replace function public.validate_keyword_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = new.game_id
    and gc.entity_type = 'keyword'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    if _key = 'name' then
      _val := to_jsonb(new.name);
    elsif _key = 'description' then
      _val := to_jsonb(new.description);
    else
      continue;
    end if;

    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    if _val is null or _val = 'null'::jsonb then continue; end if;

    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger keywords_validate_constraints
  before insert or update on public.keywords
  for each row execute procedure public.validate_keyword_constraints();


-- ── Trigger: validate entity limits (maxAddons, maxKeywords) ────────────────

create or replace function public.validate_card_addon_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id     uuid;
  _gc          jsonb;
  _max_addons  int;
  _current     int;
begin
  select d.game_id into _game_id
  from public.cards c
  join public.decks d on d.id = c.deck_id
  where c.id = new.card_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _max_addons := (_gc -> 'limits' ->> 'maxAddons')::int;
  if _max_addons is null then return new; end if;

  select count(*) into _current
  from public.card_addons ca
  where ca.card_id = new.card_id;

  if _current >= _max_addons then
    raise exception 'Card already has the maximum number of addons (%)', _max_addons;
  end if;

  return new;
end;
$$;

create trigger card_addons_validate_limit
  before insert on public.card_addons
  for each row execute procedure public.validate_card_addon_limit();


create or replace function public.validate_card_keyword_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id       uuid;
  _gc            jsonb;
  _max_keywords  int;
  _current       int;
begin
  select d.game_id into _game_id
  from public.cards c
  join public.decks d on d.id = c.deck_id
  where c.id = new.card_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _max_keywords := (_gc -> 'limits' ->> 'maxKeywords')::int;
  if _max_keywords is null then return new; end if;

  select count(*) into _current
  from public.card_keywords ck
  where ck.card_id = new.card_id;

  if _current >= _max_keywords then
    raise exception 'Card already has the maximum number of keywords (%)', _max_keywords;
  end if;

  return new;
end;
$$;

create trigger card_keywords_validate_limit
  before insert on public.card_keywords
  for each row execute procedure public.validate_card_keyword_limit();


create or replace function public.validate_addon_keyword_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id       uuid;
  _gc            jsonb;
  _max_keywords  int;
  _current       int;
begin
  select a.game_id into _game_id
  from public.addons a
  where a.id = new.addon_id;

  -- Check addon-type-specific constraints first, then fall back
  select gc.constraints into _gc
  from public.game_constraints gc
  join public.addons a on a.game_id = gc.game_id
  where a.id = new.addon_id
    and gc.entity_type = 'addon'
    and gc.addon_type_id = a.addon_type_id;

  if _gc is null then
    select gc.constraints into _gc
    from public.game_constraints gc
    where gc.game_id = _game_id
      and gc.entity_type = 'addon'
      and gc.addon_type_id is null;
  end if;

  if _gc is null then return new; end if;

  _max_keywords := (_gc -> 'limits' ->> 'maxKeywords')::int;
  if _max_keywords is null then return new; end if;

  select count(*) into _current
  from public.addon_keywords ak
  where ak.addon_id = new.addon_id;

  if _current >= _max_keywords then
    raise exception 'Addon already has the maximum number of keywords (%)', _max_keywords;
  end if;

  return new;
end;
$$;

create trigger addon_keywords_validate_limit
  before insert on public.addon_keywords
  for each row execute procedure public.validate_addon_keyword_limit();


-- ── Seed: games ───────────────────────────────────────────────────────────────

insert into public.games (name, slug, stat_schema) values (
  'Blood Bowl',
  'blood-bowl',
  '[
    {"key": "teamName",           "label": "Team Name",           "type": "text"},
    {"key": "playerRole",         "label": "Player Role",         "type": "text"},
    {"key": "cost",               "label": "Cost (GP)",           "type": "text"},
    {"key": "primaryAttribute",   "label": "Primary Attribute",   "type": "text"},
    {"key": "secondaryAttribute", "label": "Secondary Attribute", "type": "text"},
    {"key": "ma",                 "label": "MA",                  "type": "number"},
    {"key": "st",                 "label": "ST",                  "type": "number"},
    {"key": "ag",                 "label": "AG",                  "type": "number"},
    {"key": "pa",                 "label": "PA",                  "type": "number"},
    {"key": "av",                 "label": "AV",                  "type": "number"}
  ]'::jsonb
);

insert into public.games (name, slug, stat_schema) values (
  'Halo: Flashpoint',
  'halo-flashpoint',
  '[
    {"key": "keywords",     "label": "Keywords",      "type": "text"},
    {"key": "ra",           "label": "RA",            "type": "number"},
    {"key": "fi",           "label": "FI",            "type": "number"},
    {"key": "sv",           "label": "SV",            "type": "number"},
    {"key": "advanceValue", "label": "Speed Advance", "type": "number"},
    {"key": "sprintValue",  "label": "Speed Sprint",  "type": "number"},
    {"key": "ar",           "label": "AR",            "type": "number"},
    {"key": "hp",           "label": "HP",            "type": "number"},
    {"key": "pointsCost",   "label": "Points Cost",   "type": "number"}
  ]'::jsonb
);

insert into public.games (name, slug, stat_schema, print_size, bleed_size) values (
  'Kill Team',
  'kill-team',
  '[
    {"key": "role",     "label": "Role",     "type": "text"},
    {"key": "teamName", "label": "Team Name","type": "text"},
    {"key": "tags",     "label": "Tags",     "type": "text"},
    {"key": "actions",  "label": "A",        "type": "number"},
    {"key": "movement", "label": "M",        "type": "number"},
    {"key": "save",     "label": "S",        "type": "number"},
    {"key": "wounds",   "label": "W",        "type": "number"},
    {"key": "baseSize", "label": "Base Size","type": "number"}
  ]'::jsonb,
  '[127, 89]'::jsonb,
  '[133, 95]'::jsonb
);


-- ── Seed: addon_types ─────────────────────────────────────────────────────────

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
    {"key": "keywords",   "label": "Keywords",    "type": "text"},
    {"key": "pointsCost", "label": "Points Cost", "type": "text"}
  ]'::jsonb
from public.games where slug = 'halo-flashpoint';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "meleeOrRanged", "label": "Melee or Ranged", "type": "text"},
    {"key": "attack",        "label": "Attack",          "type": "number"},
    {"key": "hit",           "label": "Hit",             "type": "number"},
    {"key": "baseDamage",    "label": "Base Damage",     "type": "number"},
    {"key": "critDamage",    "label": "Crit Damage",     "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Abilities', 'abilities',
  '[
    {"key": "apCost", "label": "AP Cost", "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';


-- ── Seed: game_constraints ───────────────────────────────────────────────────

-- Blood Bowl — card constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":                      { "required": true, "maxLength": 40 },
    "stats.teamName":            { "maxLength": 40 },
    "stats.playerRole":          { "maxLength": 30 },
    "stats.cost":                { "maxLength": 20 },
    "stats.primaryAttribute":    { "maxLength": 30 },
    "stats.secondaryAttribute":  { "maxLength": 30 },
    "stats.ma":                  { "min": 0, "max": 9 },
    "stats.st":                  { "min": 0, "max": 9 },
    "stats.ag":                  { "min": 0, "max": 9 },
    "stats.pa":                  { "min": 0, "max": 9 },
    "stats.av":                  { "min": 0, "max": 9 }
  },
  "limits": {
    "maxKeywords": 10
  }
}'::jsonb
from public.games g where g.slug = 'blood-bowl';

-- Blood Bowl — keyword constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'blood-bowl';

-- Blood Bowl — skill addon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 40 },
    "stats.description": { "maxLength": 500 }
  },
  "limits": {
    "maxKeywords": 5
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'skills'
where g.slug = 'blood-bowl';

-- Halo: Flashpoint — card constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":               { "required": true, "maxLength": 40 },
    "stats.keywords":     { "maxLength": 100 },
    "stats.ra":           { "min": 0, "max": 9 },
    "stats.fi":           { "min": 0, "max": 9 },
    "stats.sv":           { "min": 0, "max": 9 },
    "stats.advanceValue": { "min": 0, "max": 9 },
    "stats.sprintValue":  { "min": 0, "max": 9 },
    "stats.ar":           { "min": 0, "max": 9 },
    "stats.hp":           { "min": 0, "max": 9 },
    "stats.pointsCost":   { "min": 0, "max": 999 }
  },
  "limits": {
    "maxAddons":   3,
    "maxKeywords": 10
  }
}'::jsonb
from public.games g where g.slug = 'halo-flashpoint';

-- Halo: Flashpoint — keyword constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'halo-flashpoint';

-- Halo: Flashpoint — weapon addon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 40 },
    "stats.type":        { "maxLength": 30 },
    "stats.range":       { "maxLength": 20 },
    "stats.ap":          { "maxLength": 10 },
    "stats.keywords":    { "maxLength": 100 },
    "stats.pointsCost":  { "maxLength": 10 }
  },
  "limits": {
    "maxKeywords": 5
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'weapons'
where g.slug = 'halo-flashpoint';
