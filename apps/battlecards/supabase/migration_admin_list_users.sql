-- migration_admin_list_users.sql
--
-- Security-definer RPC that lets admins read user data from auth.users.
-- Only returns rows when the caller has the 'admin' role.
--
-- Run once in the Supabase SQL editor.

create or replace function public.admin_list_users()
returns table (
  id         uuid,
  email      text,
  role       text,
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
    p.created_at
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  )
  order by p.created_at asc;
$$;
