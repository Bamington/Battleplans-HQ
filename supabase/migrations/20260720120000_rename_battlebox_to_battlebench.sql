-- 20260720120000_rename_battlebox_to_battlebench.sql
--
-- The "BattleBox" name couldn't be licensed, so the app is now "BattleBench".
--
-- Only the *display* name changes. The `battlebox` slug stays as-is: it's the
-- primary key of platform_apps (referenced by platform_app_roles), the value
-- stored in updates.apps, and what the client reports via setCurrentApp(), so
-- renaming it would orphan existing rows for no user-visible gain.

UPDATE public.platform_apps
   SET name = 'BattleBench'
 WHERE slug = 'battlebox';
