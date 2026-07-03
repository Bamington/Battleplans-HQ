-- ============================================================
-- BattleCards — rule templates migration
--
-- Mirrors the card-template model for rules. Adds an
-- `is_template` flag on public.rules so a rule row can be either
-- a "live" rule (attached to decks via deck_rules) or a template
-- (reusable blueprint for creating new rules).
--
-- The existing unique constraint `(user_id, game_id, title)`
-- is replaced by two partial indexes so a template and a
-- non-template can share the same title without conflicting.
--
-- Run in the Supabase SQL editor after `migration_rules.sql`.
-- ============================================================

-- ── Column ────────────────────────────────────────────────────

alter table public.rules
  add column if not exists is_template boolean not null default false;

-- ── Unique title — split by is_template ───────────────────────

alter table public.rules
  drop constraint if exists rules_user_id_game_id_title_key;

create unique index if not exists rules_title_non_template_uniq
  on public.rules (user_id, game_id, title)
  where is_template = false;

create unique index if not exists rules_title_template_uniq
  on public.rules (user_id, game_id, title)
  where is_template = true;

-- ── Index for fast template lookup ────────────────────────────

create index if not exists rules_templates_user_game_idx
  on public.rules (user_id, game_id)
  where is_template = true;
