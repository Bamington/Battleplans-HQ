-- ============================================================
-- BattleCards — make keywords user-owned
-- Run AFTER migration_keywords.sql has been applied.
-- ============================================================

-- ── Add user_id column ──────────────────────────────────────────────────────

alter table public.keywords
  add column user_id uuid references auth.users (id) on delete cascade;

-- If any rows already exist, assign them to a default user or delete them.
-- (Uncomment and set a real user UUID if you have existing data to keep.)
-- update public.keywords set user_id = 'YOUR-USER-UUID-HERE';

alter table public.keywords
  alter column user_id set not null;

-- ── Update unique constraint ────────────────────────────────────────────────

alter table public.keywords
  drop constraint keywords_game_id_name_key;

alter table public.keywords
  add constraint keywords_user_id_game_id_name_key unique (user_id, game_id, name);

-- ── Replace RLS policies ────────────────────────────────────────────────────

drop policy if exists "keywords_select" on public.keywords;

create policy "keywords_select" on public.keywords
  for select to authenticated
  using (auth.uid() = user_id);

create policy "keywords_insert" on public.keywords
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "keywords_update" on public.keywords
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "keywords_delete" on public.keywords
  for delete to authenticated
  using (auth.uid() = user_id);
