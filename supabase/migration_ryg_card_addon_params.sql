-- migration_ryg_card_addon_params.sql
--
-- Adds a per-attachment params column to card_addons.
-- Mirrors the card_keywords.params pattern, allowing addons like
-- Spellcasting to store a per-warrior selection (e.g. magic type).

alter table public.card_addons
  add column if not exists params jsonb not null default '{}'::jsonb;
