-- 20260817010000_table_labels_and_notes.sql
--
-- Call a table whatever it actually is, and write down what's odd about it.
--
-- `store_tables.size` has been one of exactly two values, 'wargaming' or 'tcg',
-- enforced by a check. That covers a shop with two kinds of table and nothing
-- else: no terrain table, no painting bench, no board-game corner, no "the big
-- one by the window".
--
-- ── Why a new column instead of loosening the old one ────────────────────────
--
-- Renaming `size` to `label` would be the honest fix — the values are not sizes
-- any more — but one Supabase project sits behind production AND every preview.
-- Production is running code that selects `size`, so renaming it breaks the live
-- app the moment this applies, before anything is deployed. Additive only.
--
-- So `label` is the new truth and `size` becomes a legacy mirror: still there,
-- still constrained, still readable by the deployed app, and now defaulted so
-- new code can stop thinking about it. It should be dropped in a follow-up once
-- this has shipped and nothing reads it — see the note at the bottom.
--
-- Backfilled from `size` so no table loses the description it already had, and
-- so the column is useful the moment it exists rather than blank for everyone.
--
-- Idempotent: safe to re-run.

alter table public.store_tables
  add column if not exists label text;

alter table public.store_tables
  add column if not exists notes text;

comment on column public.store_tables.label is
  'What this table is, in the venue''s own words — "Wargaming", "Terrain table", "Painting bench". Free text: the two-value check on `size` is what this replaces.';

comment on column public.store_tables.notes is
  'Anything a venue wants remembered about this table — "no power socket", "wobbly leg", "reserved for demos on Saturdays". Shown to the venue, never to a customer.';

-- Only where it has not been set, so re-running cannot overwrite a label a
-- venue has since typed by hand.
update public.store_tables
   set label = case size when 'tcg' then 'TCG' else 'Wargaming' end
 where label is null;

-- ── The legacy mirror ────────────────────────────────────────────────────────
--
-- `size` stays NOT NULL and still refuses anything but the two original values,
-- because the deployed app both reads and writes it. Giving it a default is what
-- lets new code stop supplying it: an insert that names only `label` still
-- satisfies the old column, and the old app keeps rendering "Wargaming" for
-- anything it does not recognise rather than falling over.
--
-- FOLLOW-UP, once this is in production and nothing selects `size`:
--   alter table public.store_tables drop column size;
-- Until then, leaving it is the difference between a safe migration and an
-- outage.

alter table public.store_tables
  alter column size set default 'wargaming';

comment on column public.store_tables.size is
  'LEGACY. Superseded by `label`; kept only because deployed code still selects it. Defaulted so new writes can ignore it. Drop once production no longer reads it.';
