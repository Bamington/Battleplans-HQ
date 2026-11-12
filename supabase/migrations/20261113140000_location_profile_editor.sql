-- ============================================================
-- Location profile editor — venue and club admins edit their own profile
-- ============================================================
-- "Edit Store Profile" / "Edit Club Profile" in BattlePlan's user menu.
--
-- Venue admins have never been able to UPDATE their own locations row: the only
-- update policy for non-platform-admins covers spaces. Rather than open the
-- table up — a row policy can't stop an admin rewriting `admins`, `kind` or
-- `is_test` — the editor saves through one definer function that touches only
-- the profile columns.
--
--   update_location_profile(id, name, icon, slug)
--       Caller must administer the location (or be a platform admin). Spaces
--       have no profile. Slug clashes and format errors surface as the usual
--       23505 / 23514 from the unique index, check constraint and the
--       cross-table trigger.
--
--   storage: location-icons/<location id>/…
--       Venue admins may upload logos into their own location's folder. Insert
--       only — each upload is a new object, and nothing is overwritten or
--       deleted (surgical-deletes rule). Platform admins keep their existing
--       policy over the whole bucket.
--
-- Additive: two new functions, one new storage policy.
-- ============================================================

create or replace function public.update_location_profile(
  p_location uuid,
  p_name     text,
  p_icon     text,
  p_slug     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.locations;
begin
  select * into l from public.locations where id = p_location;
  if not found then
    raise exception 'Location not found' using errcode = 'P0002';
  end if;

  if not (public.administers_location(p_location) or public.is_platform_admin()) then
    raise exception 'Only this location''s admins can edit its profile' using errcode = '42501';
  end if;

  if l.kind = 'space' then
    raise exception 'Spaces have no profile' using errcode = '22023';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'A name is required' using errcode = '23514';
  end if;

  if nullif(btrim(p_slug), '') is null then
    raise exception 'A profile name is required' using errcode = '23514';
  end if;

  update public.locations
     set name = btrim(p_name),
         icon = nullif(btrim(p_icon), ''),
         slug = lower(btrim(p_slug))
   where id = p_location;
end;
$$;

revoke all on function public.update_location_profile(uuid, text, text, text) from public;
grant execute on function public.update_location_profile(uuid, text, text, text) to authenticated;

-- First path segment of a storage key, as a location the caller administers.
-- A safe cast: other files in the bucket are bare '<uuid>.<ext>' keys with no
-- folder, and a malformed segment must read as "no", not raise.
create or replace function public.administers_location_folder(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text := split_part(p_name, '/', 1);
begin
  if seg !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or position('/' in p_name) = 0 then
    return false;
  end if;
  return public.administers_location(seg::uuid);
end;
$$;

revoke all on function public.administers_location_folder(text) from public;
grant execute on function public.administers_location_folder(text) to authenticated;

drop policy if exists "Venue admins upload their own location icons" on storage.objects;
create policy "Venue admins upload their own location icons"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'location-icons'
        and public.administers_location_folder(name)
    );
