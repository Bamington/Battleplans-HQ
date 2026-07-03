-- ============================================================
-- BattleCards — card images migration
-- Creates a storage bucket for card portrait images and a
-- card_images table to track which images belong to which card.
--
-- Run this in the Supabase SQL editor after the initial schema.
-- ============================================================


-- ── Storage bucket ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  true,
  31457280,  -- 30 MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;


-- ── Storage RLS policies ────────────────────────────────────────────────────
-- Files are stored under {user_id}/{card_id}/{filename}.
-- Users can only manage files in their own user_id prefix.

create policy "card_images_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card_images_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card_images_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card_images_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── Table ───────────────────────────────────────────────────────────────────

create table public.card_images (
  id          uuid        primary key default gen_random_uuid(),
  card_id     uuid        not null references public.cards (id) on delete cascade,
  file_path   text        not null,   -- storage object path: {user_id}/{card_id}/{filename}
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);


-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.card_images enable row level security;

-- Users can manage images for cards in their own decks
create policy "card_images_select" on public.card_images
  for select to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_images.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_images_insert" on public.card_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_images.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_images_update" on public.card_images
  for update to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_images.card_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_images.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_images_delete" on public.card_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_images.card_id
        and decks.user_id = auth.uid()
    )
  );
