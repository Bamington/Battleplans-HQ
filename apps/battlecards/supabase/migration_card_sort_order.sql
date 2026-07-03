-- ============================================================
-- BattleCards — card sort_order migration
-- Adds a nullable sort_order integer column to the cards table
-- so that card order within a deck can be persisted.
--
-- Cards with null sort_order will sort after those with a value.
-- Within the same sort_order (or both null), created_at is the
-- tiebreaker.
--
-- Run this in the Supabase SQL editor after the initial schema.
-- ============================================================

alter table public.cards
  add column if not exists sort_order integer default null;
