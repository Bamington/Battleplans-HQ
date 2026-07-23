-- 20260723030000_booking_shares.sql
--
-- Booking sharing — send a booking to another user by @username.
--
-- The point (beyond "here's a game I booked"): a shared booking states who a
-- booking is WITH. When that past booking later nudges a battle to be logged,
-- the opponent is already a known user — no fuzzy matching, no privacy oracle.
--
-- Shapes, mirroring friendships:
--   * One row per (booking, recipient); multi-recipient by design.
--   * State changes go through SECURITY DEFINER functions, not an UPDATE policy
--     — RLS can't tell an accept from any other edit, so only the recipient may
--     accept/decline, enforced in the function.
--   * A share is NEVER a second bookings row — it's an association. Store stats
--     read `bookings` directly, so a phantom row would double-count and
--     double-book the table.
--   * The recipient sees the booking + the sharer's HANDLE + avatar only. The
--     views below exclude `bookings.user_name` / `user_email` — the sharer's
--     private "Your Name" stays private until they're friends.
--
-- Additive and safe on the shared DB: new table + functions + views, nothing
-- existing changes. The recipient view is security_invoker=false, so it reads
-- the shared booking regardless of the (separately deferred) bookings SELECT
-- tightening.
--
-- Idempotent: safe to re-run.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.booking_shares (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references public.bookings (id) on delete cascade,
  shared_by_user_id    uuid not null references auth.users (id) on delete cascade,
  shared_with_user_id  uuid not null references auth.users (id) on delete cascade,
  status               text not null default 'pending'
                       check (status in ('pending', 'accepted', 'declined')),
  created_at           timestamptz not null default now(),
  responded_at         timestamptz,
  constraint booking_shares_no_self check (shared_by_user_id <> shared_with_user_id),
  unique (booking_id, shared_with_user_id)
);

create index if not exists booking_shares_recipient_idx on public.booking_shares (shared_with_user_id);
create index if not exists booking_shares_booking_idx   on public.booking_shares (booking_id);
create index if not exists booking_shares_sharer_idx    on public.booking_shares (shared_by_user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.booking_shares enable row level security;

-- You only ever see shares you are part of.
drop policy if exists "booking_shares_select_own" on public.booking_shares;
create policy "booking_shares_select_own"
  on public.booking_shares for select
  to authenticated
  using (auth.uid() in (shared_by_user_id, shared_with_user_id));

-- No INSERT/UPDATE policy — both go through the functions below. The sharer may
-- withdraw a share (delete); the recipient declines via the function, not by
-- deleting, so a declined row survives.
drop policy if exists "booking_shares_delete_own" on public.booking_shares;
create policy "booking_shares_delete_own"
  on public.booking_shares for delete
  to authenticated
  using (auth.uid() = shared_by_user_id);

-- ── Share a booking ──────────────────────────────────────────────────────────
create or replace function public.share_booking(booking uuid, target_handle text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  target   uuid;
  existing public.booking_shares%rowtype;
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  -- Must own the booking. Same message whether it's missing or someone else's,
  -- so this can't probe for other people's booking ids.
  if not exists (select 1 from public.bookings where id = booking and user_id = me) then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;

  select id into target
  from public.user_profiles
  where lower(handle) = lower(regexp_replace(trim(target_handle), '^@', ''));

  if target is null then raise exception 'No user with that username.' using errcode = 'P0002'; end if;
  if target = me   then raise exception 'You cannot share a booking with yourself.' using errcode = '22023'; end if;

  -- A user who has blocked you can't be shared with — reported as "no user", the
  -- same secrecy blocking gets on friend requests.
  if exists (
    select 1 from public.friendships f
    where f.status = 'blocked' and f.blocked_by = target
      and least(f.requester_id, f.addressee_id)    = least(me, target)
      and greatest(f.requester_id, f.addressee_id) = greatest(me, target)
  ) then
    raise exception 'No user with that username.' using errcode = 'P0002';
  end if;

  select * into existing from public.booking_shares
  where booking_id = booking and shared_with_user_id = target;

  if found then
    if existing.status in ('pending', 'accepted') then
      raise exception 'You have already shared this booking with that user.' using errcode = '23505';
    end if;
    -- Previously declined: let the owner re-offer it.
    update public.booking_shares
    set status = 'pending', responded_at = null, created_at = now()
    where id = existing.id;
    return existing.id;
  end if;

  insert into public.booking_shares (booking_id, shared_by_user_id, shared_with_user_id, status)
  values (booking, me, target, 'pending')
  returning id into target;   -- reuse var to hold the new share id

  return target;
end;
$$;

-- ── Respond to a share ───────────────────────────────────────────────────────
create or replace function public.respond_to_booking_share(share uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me  uuid := auth.uid();
  row public.booking_shares%rowtype;
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select * into row from public.booking_shares where id = share;
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;

  -- Only the recipient may answer — the reason these live in a function.
  if row.shared_with_user_id <> me then
    raise exception 'Only the person a booking was shared with can respond.' using errcode = '42501';
  end if;
  if row.status <> 'pending' then
    raise exception 'That share has already been answered.' using errcode = '22023';
  end if;

  update public.booking_shares
  set status = case when accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = share;
end;
$$;

revoke all on function public.share_booking(uuid, text)               from public, anon;
revoke all on function public.respond_to_booking_share(uuid, boolean) from public, anon;
grant execute on function public.share_booking(uuid, text)               to authenticated;
grant execute on function public.respond_to_booking_share(uuid, boolean) to authenticated;

-- ── Views ────────────────────────────────────────────────────────────────────
-- security_invoker = false so the join can read the shared booking and the
-- other person's profile past their own RLS. Each view filters on auth.uid()
-- itself, which is what keeps that safe.

-- Bookings shared WITH me (pending + accepted). Booking + sharer's PUBLIC
-- identity only — deliberately no user_name / user_email.
drop view if exists public.my_incoming_booking_shares;
create view public.my_incoming_booking_shares
with (security_invoker = false) as
  select
    s.id           as share_id,
    s.status,
    s.created_at,
    s.responded_at,
    b.id           as booking_id,
    b.date,
    b.location_id,
    b.location_name,
    b.timeslot_name,
    b.timeslot_start_time,
    b.timeslot_end_time,
    g.id           as game_id,
    g.name         as game_name,
    g.slug         as game_slug,
    sharer.id          as sharer_id,
    sharer.handle      as sharer_handle,
    sharer.avatar_path as sharer_avatar_path
  from public.booking_shares s
  join public.bookings b       on b.id = s.booking_id
  left join public.games g     on g.id = b.game_id
  join public.user_profiles sharer on sharer.id = s.shared_by_user_id
  where s.shared_with_user_id = auth.uid()
    and s.status in ('pending', 'accepted');

alter view public.my_incoming_booking_shares owner to postgres;
revoke all on public.my_incoming_booking_shares from anon, authenticated;
grant select on public.my_incoming_booking_shares to authenticated;

-- Who I've shared each of my bookings with, and whether they've accepted.
drop view if exists public.my_outgoing_booking_shares;
create view public.my_outgoing_booking_shares
with (security_invoker = false) as
  select
    s.id      as share_id,
    s.status,
    s.created_at,
    s.responded_at,
    s.booking_id,
    recipient.id          as recipient_id,
    recipient.handle      as recipient_handle,
    recipient.avatar_path as recipient_avatar_path
  from public.booking_shares s
  join public.user_profiles recipient on recipient.id = s.shared_with_user_id
  where s.shared_by_user_id = auth.uid();

alter view public.my_outgoing_booking_shares owner to postgres;
revoke all on public.my_outgoing_booking_shares from anon, authenticated;
grant select on public.my_outgoing_booking_shares to authenticated;
