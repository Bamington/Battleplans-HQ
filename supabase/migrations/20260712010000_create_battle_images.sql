-- 20260712010000_create_battle_images.sql
--
-- Photos attached to a battle. A battle can have several; exactly one is the
-- `is_primary` shot shown as the My Battles card background.
--
-- Supersedes the single `battles.image_path` column added in
-- 20260712000000 — photos are now their own FK-related rows, so that column is
-- dropped here.

-- ── Drop the superseded column ───────────────────────────────────────────────
alter table public.battles
  drop column if exists image_path;

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.battle_images (
  id          uuid        primary key default gen_random_uuid(),

  -- The battle this photo belongs to. bigint to match battles.id.
  battle_id   bigint      not null references public.battles (id) on delete cascade,

  -- Denormalised owner, so RLS and the storage folder ({user_id}/…) line up
  -- without a join back to battles.
  user_id     uuid        not null references auth.users (id)   on delete cascade,

  -- Storage object path in the `battle-images` bucket ('{user_id}/{file}').
  -- Kept as a path, not a URL, and resolved client-side (like model images).
  -- Unique: a stored object maps to exactly one row (also makes import re-runs
  -- idempotent).
  image_path  text        not null unique,

  -- The one photo used as the card background. At most one per battle.
  is_primary  boolean     not null default false,

  created_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists battle_images_battle_id_idx on public.battle_images (battle_id);
create index if not exists battle_images_user_id_idx    on public.battle_images (user_id);

-- At most one primary photo per battle.
create unique index if not exists battle_images_one_primary_per_battle
  on public.battle_images (battle_id) where is_primary;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- A photo is personal: only its owner may read or write it.
alter table public.battle_images enable row level security;

drop policy if exists "battle_images_select_own" on public.battle_images;
create policy "battle_images_select_own" on public.battle_images
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "battle_images_insert_own" on public.battle_images;
create policy "battle_images_insert_own" on public.battle_images
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "battle_images_update_own" on public.battle_images;
create policy "battle_images_update_own" on public.battle_images
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "battle_images_delete_own" on public.battle_images;
create policy "battle_images_delete_own" on public.battle_images
  for delete to authenticated using (user_id = auth.uid());

-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'battle-images', 'battle-images', true,
  52428800, -- 50 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/jfif', 'application/octet-stream']
)
on conflict (id) do nothing;

-- Anyone can read (bucket is public; belt-and-braces for the API).
drop policy if exists "Anyone can read battle images" on storage.objects;
create policy "Anyone can read battle images"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'battle-images');

-- Owners manage only their own '{uid}/…' folder.
drop policy if exists "Users manage own battle images" on storage.objects;
create policy "Users manage own battle images"
  on storage.objects for all
  to authenticated
  using      (bucket_id = 'battle-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'battle-images' and (storage.foldername(name))[1] = auth.uid()::text);
