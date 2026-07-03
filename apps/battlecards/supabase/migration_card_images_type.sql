-- ============================================================
-- BattleCards — card images type migration
-- Adds an image_type column to distinguish portrait vs avatar.
--
-- 'portrait' = unit card portrait image (default)
-- 'avatar'   = cropped square thumbnail for lists/UI
--
-- Run this in the Supabase SQL editor.
-- ============================================================

alter table public.card_images
  add column image_type text not null default 'portrait';
