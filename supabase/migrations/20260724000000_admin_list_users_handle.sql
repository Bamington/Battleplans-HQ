-- 20260724000000_admin_list_users_handle.sql
--
-- Manage Users now shows each user's @handle and real name, not just email.
-- user_profiles is select-own, so admins read other users only through this
-- SECURITY DEFINER function — extend it to return handle + username.
--
-- Adding columns is backward-compatible: the deployed page selects the fields it
-- knows and ignores the rest, so this is safe on the shared DB ahead of deploy.
-- Changing the return signature needs drop+create (can't CREATE OR REPLACE a new
-- shape); atomic inside the migration, so no gap for callers.
--
-- Idempotent.

drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id         uuid,
  email      text,
  role       text,
  handle     text,
  username   text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    p.role,
    p.handle,
    p.username,
    p.created_at
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  )
  order by p.created_at asc;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
