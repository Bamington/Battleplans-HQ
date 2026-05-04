-- ============================================================
-- BattleCards — token definitions migration
-- Adds a game-level reference table for play-mode tokens.
-- ============================================================

-- ── Table ────────────────────────────────────────────────────────────────────

create table public.token_definitions (
  id                  uuid        primary key default gen_random_uuid(),
  game_id             uuid        not null references public.games (id) on delete cascade,
  name                text        not null,
  description         text,
  icon                text,       -- asset path for the default / "on" state SVG
  -- For tokens with two states (on/off), the icon for the "off" state.
  icon_off            text,
  -- True if this token toggles between on/off rather than stacking a count.
  is_toggle           boolean     not null default false,

  -- Optional link to a keyword by name (matched per-game at runtime).
  keyword_name        text,
  -- When a linked keyword has a param value, how that value is applied to
  -- this token: 'max', 'min', or 'starting'.
  keyword_value_role  text        check (keyword_value_role in ('max', 'min', 'starting')),

  -- Optional link to a stat from the game's stat_schema (e.g. "hp").
  stat_key            text,
  -- How the linked stat value affects this token: 'max', 'min', or 'starting'.
  stat_role           text        check (stat_role in ('max', 'min', 'starting')),

  -- Hard limits and defaults (nullable — only set when the token has them).
  starting_value      integer,
  min_value           integer,
  max_value           integer,

  sort_order          integer,
  created_at          timestamptz not null default now(),

  unique (game_id, name)
);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.token_definitions enable row level security;

-- Admin-managed: any authenticated user can read, writes require service role.
create policy "token_definitions_select" on public.token_definitions
  for select to authenticated using (true);


-- ── Seed: Halo Flashpoint tokens ─────────────────────────────────────────────

insert into public.token_definitions
  (game_id, name, description, icon, icon_off, is_toggle, keyword_name, keyword_value_role, stat_key, stat_role, starting_value, min_value, max_value, sort_order)
select
  g.id,
  v.name,
  v.description,
  v.icon,
  v.icon_off,
  v.is_toggle,
  v.keyword_name,
  v.keyword_value_role,
  v.stat_key,
  v.stat_role,
  v.starting_value,
  v.min_value,
  v.max_value,
  v.sort_order
from public.games g,
(values
  ('Damage',    'Tracks damage taken by the unit.',
   'src/assets/games/card assets/halo/tokens/Token Type=Damage, State=Default.svg',
   null::text, false,
   null::text, null::text,
   'hp', 'max',
   0, 0, null::int, 1),

  ('Shield',    'Energy shield tokens absorb damage before health.',
   'src/assets/games/card assets/halo/tokens/Token Type=Shield, State=Default.svg',
   'src/assets/games/card assets/halo/tokens/Token Type=Shield, State=Off.svg', true,
   'Energy Shield', 'max',
   null::text, null::text,
   null::int, 0, null::int, 2),

  ('Crouch',    'Indicates the unit is crouching.',
   'src/assets/games/card assets/halo/tokens/Token Type=Crouch, State=Default.svg',
   null::text, false,
   null::text, null::text,
   null::text, null::text,
   null::int, 0, 1, 3),

  ('Pinned',    'Indicates the unit is pinned down.',
   'src/assets/games/card assets/halo/tokens/Token Type=Pinned, State=Default.svg',
   null::text, false,
   null::text, null::text,
   null::text, null::text,
   null::int, 0, 1, 4),

  ('Activated', 'Indicates the unit has been activated this round.',
   'src/assets/games/card assets/halo/tokens/Token Type=Activated, State=Default.svg',
   'src/assets/games/card assets/halo/tokens/Token Type=Activated, State=Off.svg', true,
   null::text, null::text,
   null::text, null::text,
   1, 0, 1, 5)
) as v(name, description, icon, icon_off, is_toggle, keyword_name, keyword_value_role, stat_key, stat_role, starting_value, min_value, max_value, sort_order)
where g.slug = 'halo-flashpoint';
