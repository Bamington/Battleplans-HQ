-- ============================================================
-- Location profiles — phase 1: an @handle and a public page
--
-- Venues and clubs get a profile page at /@<slug>, the same address space as
-- players (/@bamington). So a slug and a user handle must never collide: one
-- @name means one thing, everywhere.
--
--   locations.slug        — same format as user_profiles.handle; NULL for
--                           spaces, which never get a page.
--   Shared namespace      — two triggers, one per table, each refusing a name
--                           the other table already holds. They raise 23505
--                           (unique_violation) so the existing "That username
--                           was just taken" handling applies unchanged.
--                           handle_new_user() also learns to step around slugs,
--                           otherwise a signup whose email starts "guf-ballarat@"
--                           would fail outright.
--   handle_in_use(text)   — availability check across both tables, for the
--                           Edit Profile form and Manage Locations. Private
--                           clubs aren't readable, hence a definer function.
--   get_location_profile  — the page's one read, callable signed out. Returns
--                           NULL for spaces, and for anything the viewer may
--                           not see (test venues, and for now every club)
--                           unless they are one of its people.
--
-- Clubs are not public in this phase: the opt-in arrives with the profile
-- editor. A club's own admins, staff, organisers and members can already open
-- its page, so it can be built and checked before anyone else sees it.
--
-- Additive: new column, new functions, replaced handle_new_user().
-- ============================================================

-- ── Column ───────────────────────────────────────────────────────────────────
alter table public.locations
  add column if not exists slug text;

comment on column public.locations.slug is
  'The @name of this venue or club''s profile page (/@slug). Same format as user_profiles.handle and shares its namespace. NULL for spaces.';

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- From the name: lowercase, runs of anything else to one hyphen, trimmed, cut
-- to 20 so a numeric suffix still fits inside 24. Suffixed when it would clash
-- with another location or with any user's handle.
with base as (
  select id,
         left(btrim(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '-'), 20) as b
    from public.locations
   where slug is null and kind in ('venue', 'club')
),
padded as (
  select id,
         case when b = '' then 'venue'
              when length(rtrim(b, '-_')) < 3 then rpad(rtrim(b, '-_'), 3, '0')
              else rtrim(b, '-_') end as b
    from base
),
numbered as (
  select id, b, row_number() over (partition by b order by id) as rn
    from padded
)
update public.locations l
   set slug = case
                when n.rn = 1 and not exists (select 1 from public.user_profiles u where lower(u.handle) = n.b)
                  then n.b
                else n.b || '-' || n.rn
              end
  from numbered n
 where l.id = n.id;

-- ── Constraints ──────────────────────────────────────────────────────────────
alter table public.locations
  drop constraint if exists locations_slug_format;
alter table public.locations
  add constraint locations_slug_format
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9_-]{2,23}$');

drop index if exists locations_slug_key;
create unique index locations_slug_key
  on public.locations (lower(slug));

-- ── New locations get one ────────────────────────────────────────────────────
-- A venue or club created without a slug gets one from its name, suffixed with
-- a slice of its uuid when the plain form is taken (race-free, like
-- handle_new_user). Spaces never do.
create or replace function public.locations_default_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b text;
begin
  if new.slug is not null or new.kind not in ('venue', 'club') then
    return new;
  end if;
  b := left(btrim(regexp_replace(lower(coalesce(new.name, '')), '[^a-z0-9]+', '-', 'g'), '-'), 20);
  b := rtrim(b, '-_');
  if b = '' then b := 'venue'; end if;
  if length(b) < 3 then b := rpad(b, 3, '0'); end if;
  if exists (select 1 from public.locations where lower(slug) = b)
     or exists (select 1 from public.user_profiles where lower(handle) = b) then
    b := left(b, 17) || '-' || substr(md5(new.id::text), 1, 6);
  end if;
  new.slug := b;
  return new;
end;
$$;

drop trigger if exists locations_default_slug on public.locations;
create trigger locations_default_slug
  before insert on public.locations
  for each row execute function public.locations_default_slug();

-- ── One namespace across two tables ──────────────────────────────────────────
create or replace function public.locations_slug_not_a_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is not null
     and exists (select 1 from public.user_profiles where lower(handle) = lower(new.slug)) then
    raise exception 'The name @% is already taken', new.slug using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists locations_slug_not_a_handle on public.locations;
create trigger locations_slug_not_a_handle
  before insert or update of slug on public.locations
  for each row execute function public.locations_slug_not_a_handle();

create or replace function public.user_handle_not_a_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.handle is not null
     and exists (select 1 from public.locations where lower(slug) = lower(new.handle)) then
    raise exception 'The name @% is already taken', new.handle using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists user_handle_not_a_slug on public.user_profiles;
create trigger user_handle_not_a_slug
  before insert or update of handle on public.user_profiles
  for each row execute function public.user_handle_not_a_slug();

-- As in 20260722000000, but a candidate held by a location counts as taken.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text;
  candidate text;
begin
  base := coalesce(
    nullif(left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_-]', '', 'g'), 20), ''),
    'user'
  );
  if base !~ '^[a-z0-9]' then base := left('u' || base, 20); end if;
  if length(base) < 3   then base := rpad(base, 3, '0');     end if;

  candidate := base;
  if exists (select 1 from public.user_profiles where lower(handle) = candidate)
     or exists (select 1 from public.locations where lower(slug) = candidate) then
    candidate := left(base, 17) || '-' || substr(md5(new.id::text), 1, 6);
  end if;

  insert into public.user_profiles (id, handle)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ── Availability ─────────────────────────────────────────────────────────────
-- Is this @name held by anyone or anything other than p_self (a user id or a
-- location id — whichever is asking to keep its own)? Advisory: the triggers
-- and unique indexes are the guarantee.
create or replace function public.handle_in_use(p_handle text, p_self uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.user_profiles
                    where lower(handle) = lower(btrim(p_handle))
                      and id is distinct from p_self)
        or exists (select 1 from public.locations
                    where lower(slug) = lower(btrim(p_handle))
                      and id is distinct from p_self);
$$;

revoke all on function public.handle_in_use(text, uuid) from public;
grant execute on function public.handle_in_use(text, uuid) to anon, authenticated;

-- ── The page ─────────────────────────────────────────────────────────────────
-- Everything a profile page shows, in one call. Nothing from the row that a
-- page has no business publishing: no admins array, no store email.
--
--   location — id, slug, name, kind, icon, address, country, is_test
--   viewer   — can_manage (admin or staff), is_member
--   tables   — enabled tables grouped by label: [{label, count}]
--   events   — upcoming published BattlePacks held there or hosted by it
create or replace function public.get_location_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l          public.locations;
  uid        uuid := auth.uid();
  can_manage boolean := false;
  is_member  boolean := false;
  is_people  boolean := false;
  -- A day of slack: venues span time zones, and an event finishing "today"
  -- somewhere must not drop off while it is still on.
  today      date := current_date - 1;
begin
  select * into l
    from public.locations
   where lower(slug) = lower(btrim(ltrim(p_handle, '@')))
   limit 1;

  if not found or l.kind = 'space' then
    return null;
  end if;

  if uid is not null then
    can_manage := uid = any (l.admins)
               or public.is_location_staff(l.id)
               or public.is_platform_admin();
    is_member  := public.is_location_member(l.id);
    is_people  := can_manage or is_member
               or public.is_location_organiser(l.id)
               or public.administers_location_owner(l.id);
  end if;

  -- Public: real venues. Everything else only to its own people.
  if not (l.kind = 'venue' and not l.is_test) and not is_people then
    return null;
  end if;

  return jsonb_build_object(
    'location', jsonb_build_object(
        'id', l.id, 'slug', l.slug, 'name', l.name, 'kind', l.kind,
        'icon', l.icon, 'address', l.address, 'country', l.country,
        'is_test', l.is_test),
    'viewer', jsonb_build_object('can_manage', can_manage, 'is_member', is_member),
    'tables', coalesce((
        select jsonb_agg(jsonb_build_object('label', t.label, 'count', t.n) order by t.n desc, t.label nulls last)
          from (select nullif(btrim(label), '') as label, count(*)::int as n
                  from public.store_tables
                 where location_id = l.id and enabled
                 group by 1) t), '[]'::jsonb),
    'events', coalesce((
        select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'name', p.name, 'slug', p.slug,
                   'starts_on', p.starts_on, 'ends_on', p.ends_on,
                   'hosted', p.host_location_id = l.id and p.location_id is distinct from l.id,
                   'game', (select jsonb_build_object('name', g.name, 'slug', g.slug)
                              from public.games g where g.id = p.game_id))
                 order by p.starts_on nulls last, p.name)
          from public.battlepacks p
         where p.status = 'published'
           and (p.location_id = l.id or p.host_location_id = l.id)
           and coalesce(p.ends_on, p.starts_on, today) >= today), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_location_profile(text) from public;
grant execute on function public.get_location_profile(text) to anon, authenticated;
