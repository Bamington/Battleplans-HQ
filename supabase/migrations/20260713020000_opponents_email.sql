-- 20260713020000_opponents_email.sql
--
-- Optional email for an opponent — captured when creating a new one, later used
-- to find a matching BattlePlan user and share the game with them.

alter table public.opponents
  add column if not exists email text;
