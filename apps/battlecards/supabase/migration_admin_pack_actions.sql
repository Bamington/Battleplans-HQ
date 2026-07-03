-- migration_admin_pack_actions.sql
--
-- Expands packs_update and packs_delete to also allow admin users,
-- so admins can manage any pack regardless of ownership.
--
-- Run once in the Supabase SQL editor.

drop policy if exists "packs_update" on public.packs;
drop policy if exists "packs_delete" on public.packs;

create policy "packs_update" on public.packs
  for update to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "packs_delete" on public.packs
  for delete to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );
