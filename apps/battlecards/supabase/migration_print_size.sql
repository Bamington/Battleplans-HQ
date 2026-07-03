-- Add print_size and bleed_size columns to games table.
-- Each stores [width_mm, height_mm] as a two-element JSON array.

alter table public.games
  add column print_size jsonb not null default '[]'::jsonb,
  add column bleed_size jsonb not null default '[]'::jsonb;

-- Backfill existing games

-- Halo Flashpoint: 127×89 mm print, 133×95 mm bleed
update public.games
  set print_size = '[127, 89]'::jsonb,
      bleed_size = '[133, 95]'::jsonb
  where slug = 'halo-flashpoint';

-- Blood Bowl: 75×110 mm print, 81×116 mm bleed
update public.games
  set print_size = '[75, 110]'::jsonb,
      bleed_size = '[81, 116]'::jsonb
  where slug = 'blood-bowl';
