-- migration_updates.sql
--
-- News & Updates: release notes shown in each app's "News & Updates" panel.
-- Seeded with the 16 notes that had real content in the previous BattlePlan
-- project's `version` table (26 bare version bumps and 3 title-only rows were skipped).
--
-- `apps` is the set of apps an update is relevant to. An EMPTY array means the
-- update appears in no app — each app queries `apps @> '{<its own name>}'`.
-- Run once in the Supabase SQL editor for the shared project.

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table if not exists public.updates (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text,                          -- markdown
  version      text,                          -- not unique: the old data has a duplicate
  apps         text[]      not null default '{}',
  published    boolean     not null default false,
  published_by uuid        references auth.users (id) on delete set null,
  -- Author's name snapshotted at publish time. Denormalised because RLS on
  -- user_profiles is select-own, so the client can't resolve another user's name.
  published_by_name text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint updates_apps_valid check (
    apps <@ array['battlecards', 'battleplan', 'battlepack', 'battlebox']::text[]
  )
);

-- Each app filters with `apps @> '{...}'` — GIN makes that an index scan.
create index if not exists updates_apps_idx         on public.updates using gin (apps);
create index if not exists updates_published_at_idx on public.updates (published_at desc);

-- ── 2. Row Level Security ────────────────────────────────────────────────────

alter table public.updates enable row level security;

-- Any signed-in user can read published updates.
drop policy if exists "updates_select_published" on public.updates;
create policy "updates_select_published" on public.updates
  for select to authenticated
  using (published = true);

-- Admins can read drafts and write everything. (SELECT policies OR together.)
drop policy if exists "updates_admin_all" on public.updates;
create policy "updates_admin_all" on public.updates
  for all to authenticated
  using      (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── 3. Seed: 16 historical release notes ──────────────────────────────────
-- published_by is attributed to the original author. Idempotent on (title, version).

insert into public.updates (title, body, version, apps, published, published_by, published_by_name, published_at, created_at)
select
  v.title, v.body, v.version, v.apps, v.published, v.published_by,
  -- Resolve the author's display name once, at migration time.
  (select coalesce(p.username, u.raw_user_meta_data ->> 'full_name', u.email)
     from auth.users u
     left join public.user_profiles p on p.id = u.id
    where u.id = v.published_by),
  v.published_at, v.created_at
from (values
  ('Battle Tracking V0', 'The basics for tracking battles has now been implemented! ', '0.28.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-28 04:59:36.526+00'::timestamptz, '2025-08-28 04:59:36.526+00'::timestamptz),
  ('First Public Release', '- Updated configuration to support live authentication and hosting on battleplan.app.
- Updated public pages to display logos correctly, and allowed users who are not logged in to change theme.
- Updated all rich text editors to use markdown format, display correctly on mobile.', '0.29.0', array['battleplan', 'battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-28 11:33:37.773+00'::timestamptz, '2025-08-28 11:33:37.773+00'::timestamptz),
  ('New Cropping Tools', '**Features**
- Replaced the custom cropping tool with a new react library. Hopefully mobile cropping works a bit better now.

**Bug Fixes**
- Fixed a bug where the home link didn''t close all overlays.
- Fixed a bug in version management.
- Fixed a bug where login fields weren''t identified correctly for browsers to recognise.', '0.3.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-28 11:58:19.748+00'::timestamptz, '2025-08-28 11:58:19.748+00'::timestamptz),
  ('iOS Fixes', '**Bug Fixes**
- Adjusted modal views to accomodate iOS better.
- Added Privacy Policy and Terms of Service to the app.', '0.31.0', array['battleplan', 'battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-28 23:03:59.894+00'::timestamptz, '2025-08-28 23:03:59.894+00'::timestamptz),
  ('New Tab Bar', '**Features**
- Added a new Tab Bar and action button. Hopefully more usable on mobile devices.

**Bug Fixes**
- Refactored modal displays to behave better on small iOS devices. iOS is the gift that keeps on giving.
- Added an empty state to a user with past bookings but no upcoming bookings.', '0.32.0', array['battleplan', 'battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-29 00:57:00.682+00'::timestamptz, '2025-08-29 00:57:00.682+00'::timestamptz),
  ('v1.0.0', '**Features**
- Beta Users can now add a wishlist of items, and the app will find stores with the item in stock (still testing this - there are many bugs!)
- Locations can now store the result of the battle, and the location. Locations are remembered for future battle entries.', '1.0.0', array['battleplan', 'battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-08-31 22:24:06.108+00'::timestamptz, '2025-08-31 22:24:06.108+00'::timestamptz),
  ('Partial Date Blocking', '- Added the ability for location admins to only partially block a date.
- Fixes to modal functionality for battles and wishlists.', '1.01.0', array['battleplan', 'battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-02 02:53:14.932+00'::timestamptz, '2025-09-02 02:53:14.932+00'::timestamptz),
  ('Battle Stats', '**Features**
- Added a statistics page to the battles section!
- Added the ability to customise the Recent Models section. 
- Updated the battle cards to show the result of the game.

**Bug Fixes**
- Solved issues around adding battles and refreshing the battle list.
- Solved a number of mobile issues when viewing models and collections.
- Game icons are now cached locally on launch, so performance should be much better.
- Beta Testers: Solved some issues with the Wishlist feature not having it''s modal dismissed (product search is still broken though)', '1.02.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-03 07:26:49.451+00'::timestamptz, '2025-09-03 07:26:49.451+00'::timestamptz),
  ('Sharing Screenshot', '**Features**
- Added a new ''Share Screenshot'' feature that generates a cool social-media ready image for you to share. Much more to come on this later!
- The image suggestion when creating a new collection will now provide more results, and those results should be a little more useful.

**Bug Fixes**
- Fixes some odd layout issues with the image suggestion modal.', '1.03.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-08 11:47:37.961+00'::timestamptz, '2025-09-08 11:47:37.961+00'::timestamptz),
  ('Collection Statistics', '**Features**
- View your collection statistics! See how many models you own, what percentage are painted, etc. 
- Themes for the Share Screenshot feature are in! These are pretty barebones for now, but more will be coming soon.', '1.04.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-10 01:38:18.616+00'::timestamptz, '2025-09-10 01:38:18.616+00'::timestamptz),
  ('Multiple Collections', '**Features**
- Models can now be attached to more than one collection.
- Refined the image search for new collections.', '1.05.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-11 02:34:57.676+00'::timestamptz, '2025-09-11 02:34:57.676+00'::timestamptz),
  ('Multi-Image Support', '**Features**
- You can upload multiple images to a model.
- Added Mordheim, Battlefleet Gothic, and Inquisitor.

**Bug Fixes**
- Fixed an issue where only 10 collections would show.
- Fixed an issue where uploaded images weren''t populating correctly.', '1.06.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-13 12:39:26.187+00'::timestamptz, '2025-09-13 12:39:26.187+00'::timestamptz),
  ('Theme Updates', '**Features**
- Kill Team theme has been updated to look like the KT Datacards. Great for Kill Team or 40k models!
- Marathon theme has been updated, now looking pretty fresh! If you''ve got Halo: Flashpoint in your collection, give it a go.
- You can now save the updated model and artist information when creating a share image.

**Bug Fixes**
- Fixed an issue where adding opponents in battles wasn''t working.
- Fixed an issue where locations weren''t appearing properly when adding a battle.
- Fixed an issue where the app was showing no opponent, even when you''ve added one to a battle.', '1.07.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-16 00:13:32.671+00'::timestamptz, '2025-09-16 00:13:32.671+00'::timestamptz),
  ('Campaigns!', '**Features**
- NEW! You can now create ''Campaigns'' - think of these as collections for your battles. Great for if you''re playing in a long-form campaign or crusade, or just want to group up your games from a one-day event.
- The new Warcrow theme is complete, perfect for your adventures in Lindworm.', '1.08.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-16 22:56:59.078+00'::timestamptz, '2025-09-16 22:56:59.078+00'::timestamptz),
  ('Collection Covers', '**Features**
- You can now display the model images in a collection as their cover. It''ll rotate through them all, and show the collection image if you have one, too. Pretty cool!
- You can sort the models in your collection alphabetically, by painted status, or by date added (thanks for the suggestion Jack!)
- A new Shatterpoint theme has been added, and you can even select the color you want to match the unit''s affiliation.', '1.09.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-09-22 12:56:41.455+00'::timestamptz, '2025-09-22 12:56:41.455+00'::timestamptz),
  ('v1.1.0', 'Features
- You can now create ''Lists''! Lots of functionality coming for these down the line, but for now you can create a list of units, attach them to battles, and then see stats on that list (Battles won, etc). 
- Battles can now have multiple images, and you can generate share screenshots for them. We''ve also refactored the battle information and campaign information modals to give you better information.', '1.1.0', array['battlebox']::text[], true, 'c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid, '2025-10-04 23:51:17.325+00'::timestamptz, '2025-10-04 23:51:17.325+00'::timestamptz)
) as v(title, body, version, apps, published, published_by, published_at, created_at)
where not exists (
  select 1 from public.updates u where u.title = v.title and u.version is not distinct from v.version
);
