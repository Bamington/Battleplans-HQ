-- 20260722000000_user_handles.sql
--
-- @handles — the stable, unique identifier used to find a user.
--
-- `username` stays a free-text DISPLAY name (two people may both be "Chris").
-- `handle` is the unique one you search for and share. Splitting them means
-- friend search can be exact and unambiguous without forcing display names to
-- be unique.
--
-- Every user gets one, derived from their email, because a null handle means
-- unfindable — and 57 of the 66 existing users have never onboarded, so
-- relying on them to choose one would leave most of the platform invisible.
--
-- Idempotent: safe to re-run.

-- ── Column ───────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists handle text;

comment on column public.user_profiles.handle is
  'Unique lowercase identifier used to find this user, e.g. ''chris-h''. Distinct from username, which is a non-unique display name.';

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Make sure every auth user actually has a profile row first. Users imported
-- from the old BattlePlan predate the handle_new_user() trigger, so some may
-- have none — without a row they would silently miss the backfill below.
insert into public.user_profiles (id)
select u.id
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Derive from the email local-part, stripped to the allowed alphabet, then
-- de-duplicated with a numeric suffix. Truncated to 20 so the suffix still
-- fits inside the 24-char limit enforced below.
with base as (
  select
    u.id,
    coalesce(
      nullif(
        left(regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_-]', '', 'g'), 20),
        ''
      ),
      'user'
    ) as b
  from auth.users u
),
-- The format check requires an alphanumeric first character and 3+ chars.
normalised as (
  select
    id,
    case
      when b !~ '^[a-z0-9]' then left('u' || b, 20)
      else b
    end as b
  from base
),
padded as (
  select id, case when length(b) < 3 then rpad(b, 3, '0') else b end as b
  from normalised
),
numbered as (
  select id, b, row_number() over (partition by b order by id) as rn
  from padded
)
update public.user_profiles p
set handle = case when n.rn = 1 then n.b else n.b || '-' || n.rn end
from numbered n
where p.id = n.id
  and p.handle is null;

-- ── Constraints ──────────────────────────────────────────────────────────────
-- 3–24 chars, lowercase alphanumeric plus _ and -, must start alphanumeric.
alter table public.user_profiles
  drop constraint if exists user_profiles_handle_format;
alter table public.user_profiles
  add constraint user_profiles_handle_format
  check (handle ~ '^[a-z0-9][a-z0-9_-]{2,23}$');

-- lower() rather than a plain unique index: the format check already forbids
-- uppercase, but this keeps uniqueness case-insensitive if that ever loosens.
drop index if exists user_profiles_handle_key;
create unique index user_profiles_handle_key
  on public.user_profiles (lower(handle));

-- Safe only because the backfill above covers every existing row.
alter table public.user_profiles
  alter column handle set not null;

-- Same trap as avatar_path: migration_onboarding.sql revoked blanket UPDATE and
-- re-granted per column, so a new column is not writable by the client until it
-- is granted explicitly.
grant update (handle) on public.user_profiles to authenticated;

-- ── New signups ──────────────────────────────────────────────────────────────
-- Generate a handle at signup so the column is never null for anyone. On the
-- rare collision, fall back to a suffix derived from the user's uuid — that is
-- race-free, unlike a loop that probes for the next free number.
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
  if exists (select 1 from public.user_profiles where lower(handle) = candidate) then
    candidate := left(base, 17) || '-' || substr(md5(new.id::text), 1, 6);
  end if;

  insert into public.user_profiles (id, handle)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ── Expose it ────────────────────────────────────────────────────────────────
-- Friend search reads handles through this view, so it has to carry one.
-- security_invoker = false is deliberate and unchanged: the view is the single
-- sanctioned window past user_profiles' select-own RLS. Still no role or
-- preferred_location_id here.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select id, handle, username, avatar_path
  from public.user_profiles;

alter view public.public_profiles owner to postgres;

comment on view public.public_profiles is
  'Read-only, non-sensitive slice of user_profiles (id, handle, username, avatar_path) that any signed-in user may read. Deliberately bypasses the select-own RLS on the base table.';

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;
