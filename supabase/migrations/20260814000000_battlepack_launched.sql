-- 20260814000000_battlepack_launched.sql
--
-- BattlePack goes live in the app switcher.
--
-- The row has existed since 20260727000000 with `url = '#'` and
-- `is_launched = false`, deliberately: one Supabase project sits behind
-- production AND every preview, so a real URL written before the app was
-- deployed would have repointed the switcher for every user in production at
-- whatever branch happened to be open. It is deployed now, so the placeholder
-- can go.
--
-- BOTH COLUMNS OR NEITHER. `is_launched` is the gate — usePlatformApps sets a
-- tile's href to '#' unless it is true, which the Navbar renders as a greyed
-- "coming soon" entry. Flipping the flag alone would give a live-looking tile
-- pointing at nothing; setting the URL alone would change nothing at all.
--
-- `/app` matches the other three: the switcher sends a user to the signed-in
-- application, not to the marketing root. That root is BattlePack's public
-- namespace — battlepack.app/<slug> is an event's public page — so pointing
-- the switcher there would land an admin on a slug lookup.
--
-- WHO SEES IT is not decided here. Visibility comes from the
-- `platform_app_roles` grants set up in 20260728000000 (admins, plus the
-- `store_admin` pseudo-role resolved against locations.admins). This only
-- decides whether the tile is a link or a placeholder.
--
-- Idempotent: safe to re-run.

update public.platform_apps
   set url          = 'https://battlepack.app/app',
       is_launched  = true
 where slug = 'battlepack';
