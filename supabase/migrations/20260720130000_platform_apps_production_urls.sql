-- 20260720130000_platform_apps_production_urls.sql
--
-- Point the platform switcher at the production domains instead of the Vercel
-- deployment URLs it was seeded with, so switching apps lands the user on the
-- canonical site (and keeps the cross-app session hand-off on a stable origin).
--
--   battleplan  → https://battleplan.app/app
--   battlecards → https://battlecards.app/app
--   battlebox   → https://battlebench.app/app   (slug stays 'battlebox')
--
-- Only the URL changes; slugs, names and roles are untouched.

UPDATE public.platform_apps SET url = 'https://battleplan.app/app'  WHERE slug = 'battleplan';
UPDATE public.platform_apps SET url = 'https://battlecards.app/app' WHERE slug = 'battlecards';
UPDATE public.platform_apps SET url = 'https://battlebench.app/app' WHERE slug = 'battlebox';
