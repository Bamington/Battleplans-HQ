-- 20260731000000_battlepack_banner_aspect.sql
--
-- Remember the shape of each pack's banner.
--
-- Banners were forced to 3:1: everything got cropped to the hero's fixed band
-- whether it suited the artwork or not. They can now be any shape from very
-- wide down to 3:2, and only images TALLER than 3:2 are cropped — so the hero
-- has to render each banner at its own ratio rather than one shared one.
--
-- That ratio has to be stored rather than measured on load. Reading it from the
-- decoded image means the hero has no height until the file arrives, and the
-- whole document below it jumps down the moment it does. A number in the row is
-- known before the first byte of the image is requested.
--
-- Width ÷ height, so 3:1 is 3.0 and 3:2 is 1.5. Null means a banner uploaded
-- before this existed, which was cropped to 3:1 — the client falls back to 3.
--
-- Backward-compatible on the shared database: nullable column, nothing reads it
-- until BattlePack deploys.
--
-- Idempotent: safe to re-run.

alter table public.battlepacks
  add column if not exists banner_aspect real;

comment on column public.battlepacks.banner_aspect is
  'Width ÷ height of banner_path''s image, e.g. 3.0 for 3:1 and 1.5 for 3:2. Lets the hero reserve the right height before the image loads. Null means a pre-existing 3:1 crop.';

-- A sanity check, not a restatement of the rule. The crop step already enforces
-- 3:2 as the tallest; this only catches a zero, a negative or a transposed
-- height÷width. The floor is 1.4 rather than 1.5 so that a client computing
-- 3/2 and storing it as `real` cannot fail the check on rounding alone, and the
-- ceiling is loose because a very wide strip is a design choice, not an error.
alter table public.battlepacks
  drop constraint if exists battlepacks_banner_aspect_sane;

alter table public.battlepacks
  add constraint battlepacks_banner_aspect_sane
  check (banner_aspect is null or (banner_aspect >= 1.4 and banner_aspect <= 20));
