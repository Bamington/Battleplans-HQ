-- 20260818000000_battlecards_beta_testers.sql
--
-- Beta testers get BattleCards back.
--
-- 20260720020000 pulled its only grant to make it admin-only for the first
-- release. Nothing else about the app was locked down, so restoring the row is
-- the whole change: `my_platform_apps` resolves the profile role against this
-- table, and `AppAccessRoute` blocks on the answer.
--
-- Admins are unaffected — they short-circuit ahead of the grant lookup and have
-- had BattleCards throughout.
--
-- Safe on the shared database, and deliberately applied ahead of any deploy:
-- it's a single row against a table the live code already reads, so it widens
-- access the moment it lands and needs no new client. Reverse it by deleting
-- the same row.

insert into public.platform_app_roles (app_slug, role)
values ('battlecards', 'beta_tester')
on conflict do nothing;
