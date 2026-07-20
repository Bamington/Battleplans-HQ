-- 20260720020000_battlecards_admin_only.sql
--
-- Restrict BattleCards to admins for now.
--
-- Removing its only grant is enough: `my_platform_apps` short-circuits on
-- `role = 'admin'` and returns every app, so admins keep access without needing
-- a row here. An app with no grants is therefore admin-only — the same state
-- BattlePack is already in.
--
-- Because the RPC only ever returns apps the caller may open, BattleCards also
-- disappears from the platform switcher for beta testers, rather than showing
-- and then failing.

delete from public.platform_app_roles
where app_slug = 'battlecards';
