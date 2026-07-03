-- migration_ryg_keyword_category.sql
--
-- Adds a 'category' column to keywords.
-- Null = general keyword (weapons, warriors, etc.).
-- 'spell' = spell-specific keyword, shown only in the spell form picker.

alter table public.keywords
  add column if not exists category text;
