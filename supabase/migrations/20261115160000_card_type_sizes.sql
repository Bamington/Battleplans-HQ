-- Already applied to the live database on 2026-11 from the standalone BattleCards repo
-- (supabase/migration_card_type_sizes.sql); recorded here with 'supabase migration repair'.

-- ============================================================
-- BattleCards — per-card-type print sizes
--
-- games.print_size / bleed_size stay the default size for a game's cards.
-- games.card_type_sizes overrides them for specific card types, e.g.
-- Gundam Assemble unit cards are 150×105 mm landscape while its tactics
-- cards (card_type 'rule') are 63×88 mm portrait:
--
--   { "rule": { "print": [63, 88], "bleed": [69, 94] } }
--
-- Used by the List Builder (card display), the Pack Editor previews and the
-- print layout for static card faces.
-- ============================================================

alter table public.games
  add column if not exists card_type_sizes jsonb not null default '{}'::jsonb;

update public.games
set card_type_sizes = '{"rule": {"print": [63, 88], "bleed": [69, 94]}}'::jsonb
where slug = 'gundam-assemble'
  and card_type_sizes = '{}'::jsonb;
