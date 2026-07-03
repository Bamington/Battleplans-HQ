-- migration_admin_user_actions.sql
--
-- RPCs for admin-only user management: update role and delete user.
-- Both check the caller is an admin and refuse self-targeting.
--
-- Run once in the Supabase SQL editor.

-- ── Update a user's role ─────────────────────────────────────────────────────

create or replace function public.admin_update_user_role(
  target_user_id uuid,
  new_role       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Unauthorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot change your own role';
  end if;

  if new_role not in ('user', 'beta_tester', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.user_profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

-- ── Delete a user ────────────────────────────────────────────────────────────
-- Deletes the auth.users row; user_profiles cascades automatically.

create or replace function public.admin_delete_user(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Unauthorized';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;
