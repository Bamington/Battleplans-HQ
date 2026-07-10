-- migration_location_icons_bucket.sql
--
-- Creates the `location-icons` storage bucket used by BattlePlan's Manage
-- Locations screen. Without it, uploading a venue icon fails with a
-- "Bucket not found" error.
--
-- Run once in the Supabase SQL editor for the shared project.

-- ── Bucket ───────────────────────────────────────────────────────────────────
-- Public: venue icons are shown to every user (booking cards, venue picker),
-- and the app stores the result of getPublicUrl() straight onto locations.icon.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'location-icons',
  'location-icons',
  true,
  5242880,  -- 5 MB; icons render at 24-64px
  array['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

-- ── Storage RLS policies ─────────────────────────────────────────────────────
-- Objects are stored flat as {uuid}.{ext} — there's no per-user folder prefix to
-- key on (unlike card-images), so writes are restricted to admins instead. Only
-- Manage Locations (an AdminRoute) uploads here.

drop policy if exists "location_icons_select" on storage.objects;
create policy "location_icons_select"
  on storage.objects for select to public
  using (bucket_id = 'location-icons');

drop policy if exists "location_icons_insert" on storage.objects;
create policy "location_icons_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'location-icons'
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "location_icons_update" on storage.objects;
create policy "location_icons_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'location-icons'
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "location_icons_delete" on storage.objects;
create policy "location_icons_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'location-icons'
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
