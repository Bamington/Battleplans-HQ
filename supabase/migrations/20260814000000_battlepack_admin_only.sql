-- 20260814000000_battlepack_admin_only.sql
--
-- BattlePack becomes usable — for platform admins, and nobody else yet.
--
-- Two separate levers decide who gets an app, and this pulls both. Getting one
-- without the other is the mistake this file exists to prevent:
--
--   platform_apps.is_launched  — whether the tile is a LINK or a placeholder.
--                                usePlatformApps sets href to '#' unless it is
--                                true, so an admin's tile is dead today even
--                                though they can already see it.
--   platform_app_roles         — whether the tile APPEARS at all.
--
-- ── The URL ──────────────────────────────────────────────────────────────────
--
-- Held at '#' since 20260727000000 on purpose: one Supabase project sits behind
-- production AND every preview, so a real URL written before the app was
-- deployed would have repointed the switcher for every production user at
-- whatever branch happened to be open. It is deployed now.
--
-- `/app` matches the other three — the switcher sends a user to the signed-in
-- application, not to the marketing root. That root is BattlePack's public
-- namespace, where battlepack.app/<slug> is an event's public page, so pointing
-- the switcher there would land an admin in a slug lookup.

update public.platform_apps
   set url         = 'https://battlepack.app/app',
       is_launched = true
 where slug = 'battlepack';

-- ── Store admins go back to not having it ────────────────────────────────────
--
-- 20260728000000 granted BattlePack to the 'store_admin' pseudo-role, in
-- anticipation of it being a store admin's tool. It is not ready to be one, and
-- is_launched going true would have turned that anticipation into real access
-- for every venue admin at once. Revoking the grant is what keeps the launch to
-- platform admins: my_platform_apps() lets `up.role = 'admin'` see every app
-- regardless of grants or launch state, so admins need no grant of their own.
--
-- REVERSIBLE BY ONE INSERT. When BattlePack is ready for venues, put the row
-- back — the pseudo-role machinery and every RLS policy behind it are untouched:
--
--   INSERT INTO public.platform_app_roles (app_slug, role)
--   VALUES ('battlepack', 'store_admin') ON CONFLICT DO NOTHING;
--
-- THE ROW-LEVEL RULES ARE DELIBERATELY LEFT ALONE. `battlepacks` stays readable
-- by a venue's admins and staff (20260728000000, widened by 20260803000000),
-- because BattlePlan's Upcoming Events column reads it — a venue's staff are
-- shown the events booked into their shop whether or not they can open
-- BattlePack. Tightening those policies to match this grant would break that
-- column. The app gate and the data rules answer different questions here, and
-- that is intended rather than an oversight.

delete from public.platform_app_roles
 where app_slug = 'battlepack'
   and role     = 'store_admin';
