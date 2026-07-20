-- 20260720000000_updates_visible.sql
--
-- Lets an admin hide an update from the in-app News & Updates column without
-- deleting it, and without demoting it to a draft.
--
-- This is deliberately separate from `published`: that flag is the editorial
-- draft/published state, and the byline (published_by / published_at) is
-- stamped on the transition into it. Toggling `published` off to hide an
-- article would relabel a real, authored post as "Draft". `visible` is the
-- lighter switch — still published, just not currently shown.
--
-- Defaults to true so every existing update keeps showing.

alter table public.updates
  add column if not exists visible boolean not null default true;
