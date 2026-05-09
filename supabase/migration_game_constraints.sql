-- ============================================================
-- BattleCards — game constraints migration
-- Adds a game_constraints table for DB-driven field validation
-- and entity limits, plus triggers to enforce them.
-- ============================================================


-- ── Table ───────────────────────────────────────────────────────────────────

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


-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.game_constraints enable row level security;

create policy "game_constraints_select" on public.game_constraints
  for select to authenticated using (true);


-- ── Trigger: validate card field constraints ────────────────────────────────

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


-- ── Trigger: validate addon field constraints ───────────────────────────────

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


-- ── Trigger: validate keyword field constraints ─────────────────────────────

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


-- ── Trigger: validate card_addons limit ─────────────────────────────────────

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


-- ── Trigger: validate card_keywords limit ───────────────────────────────────

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


-- ── Trigger: validate addon_keywords limit ──────────────────────────────────

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


-- ── Seed: game_constraints ──────────────────────────────────────────────────

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
