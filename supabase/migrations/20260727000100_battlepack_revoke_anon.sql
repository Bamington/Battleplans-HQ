-- 20260727000100_battlepack_revoke_anon.sql
--
-- Take the anon role's table privileges away from BattlePack's tables.
--
-- Supabase grants anon the usual seven privileges on every new table in public
-- by default, and every table in this project has them. They are inert here —
-- row level security is enabled on all four tables and not one policy names
-- anon, so an anonymous caller already reads nothing. This removes the grants
-- anyway.
--
-- The reason is the order of operations, not the current risk. BattlePack's
-- public read view is a V2 conversation: a published pack will eventually be
-- readable by anyone at battlepack.app/<slug>. When that lands, someone will be
-- writing a policy for anon, and the safe version of that mistake is a policy
-- that grants too much on a table anon cannot touch. Loosening should take two
-- deliberate steps, not one.
--
-- Idempotent, and purely a privilege change — no schema, no data.

REVOKE ALL ON public.battlepacks              FROM anon;
REVOKE ALL ON public.battlepack_slugs         FROM anon;
REVOKE ALL ON public.battlepack_categories    FROM anon;
REVOKE ALL ON public.battlepack_schedule_items FROM anon;
