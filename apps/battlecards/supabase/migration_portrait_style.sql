-- ============================================================
-- BattleCards — portrait style migration
-- Adds a nullable portrait_style column to the cards table.
--
-- When null  → default card layout (no frame overlay)
-- 'portraitFramed' → show the portrait frame overlay on the image
--
-- Run this in the Supabase SQL editor after the initial schema.
-- ============================================================

alter table public.cards
  add column portrait_style text default null;
