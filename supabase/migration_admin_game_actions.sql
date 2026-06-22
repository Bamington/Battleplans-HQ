-- migration_admin_game_actions.sql
--
-- Allows admin users to update and delete games directly via the client.
-- The existing games_select policy (any authenticated user) is unchanged.
--
-- Run once in the Supabase SQL editor.

create policy "games_update" on public.games
  for update to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "games_delete" on public.games
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );
