-- 20260801000000_link_preview_favicon.sql
--
-- The site's icon, for the footer line of a link card.
--
-- The card shows where a link goes as well as what is on it, and a domain on
-- its own is a weak signal — "ko-fi.com" is a string, the Ko-fi mark is
-- recognised at a glance. This is the same reasoning as the game icons on a
-- pack row.
--
-- Nullable, and the card falls back to the domain alone. Plenty of sites have
-- no declared icon, and a missing favicon is not worth an empty box.
--
-- Backward-compatible: nothing reads it until the function is redeployed.
--
-- Idempotent: safe to re-run.

alter table public.link_previews
  add column if not exists favicon_url text;

comment on column public.link_previews.favicon_url is
  'Absolute URL of the site''s icon, resolved against the final URL after redirects. Null when the page declares none — the card then shows the domain alone.';
