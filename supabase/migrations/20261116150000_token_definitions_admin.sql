-- Let platform admins manage a game's built-in tokens (deck_id is null) from
-- Manage Games › Tracking. Existing policies only cover deck-scoped UCTs.
-- Additive: new policies only.

create policy token_definitions_admin_insert on public.token_definitions
  for insert to authenticated
  with check (deck_id is null and public.is_platform_admin());

create policy token_definitions_admin_update on public.token_definitions
  for update to authenticated
  using (deck_id is null and public.is_platform_admin())
  with check (deck_id is null and public.is_platform_admin());

create policy token_definitions_admin_delete on public.token_definitions
  for delete to authenticated
  using (deck_id is null and public.is_platform_admin());
