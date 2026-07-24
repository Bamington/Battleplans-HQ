-- 20260722030000_friendships.sql
--
-- Friendships — the relationship that later gates sharing bookings and battles.
--
-- Three things happen here:
--   1. `friendships`, one row per PAIR of users regardless of direction.
--   2. State changes go through SECURITY DEFINER functions, not an UPDATE
--      policy. RLS cannot compare the old row to the new one, so a plain
--      "you're party to this row" update policy would let a REQUESTER accept
--      their own request. The functions encode who may make which transition.
--   3. `public_profiles` loses `username`, and friends read it through
--      `my_friends` instead — the onboarding copy promises your name is private
--      until you book or accept a friend, and this is what makes that true.
--
-- Idempotent: safe to re-run.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'blocked')),
  -- Either party may block, so we must record which one did: only the blocker
  -- may lift it, and the blocked party must not be able to delete the row and
  -- start over.
  blocked_by   uuid references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_blocked_by_set check (
    (status = 'blocked') = (blocked_by is not null)
  )
);

-- THE important index. Without it, two people who request each other at the
-- same time produce two rows for one relationship, and every query afterwards
-- has to reconcile them. least/greatest makes the pair order-independent.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx    on public.friendships (status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.friendships enable row level security;

-- You can only ever see rows you are part of.
drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- No INSERT/UPDATE policy: both go through the functions below, which is what
-- stops a requester accepting their own request.

-- Unfriending or withdrawing is a delete, and either party may do it — except
-- on a blocked row, where only the blocker may lift it. Without that guard the
-- blocked party could simply delete the row and request again.
drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (
    auth.uid() in (requester_id, addressee_id)
    and (status <> 'blocked' or blocked_by = auth.uid())
  );

-- ── Send a request ───────────────────────────────────────────────────────────
-- Takes a handle (what the user typed) rather than an id, so the lookup and the
-- insert are one atomic step the client can't get between.
create or replace function public.send_friend_request(target_handle text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  target   uuid;
  existing public.friendships%rowtype;
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select id into target from public.user_profiles where lower(handle) = lower(trim(target_handle));

  -- Deliberately the same message for "no such user" as for "they blocked you"
  -- below: telling someone they've been blocked defeats the point of blocking.
  if target is null then raise exception 'No user with that username.' using errcode = 'P0002'; end if;
  if target = me   then raise exception 'You cannot add yourself.'     using errcode = '22023'; end if;

  select * into existing from public.friendships
  where least(requester_id, addressee_id)    = least(me, target)
    and greatest(requester_id, addressee_id) = greatest(me, target);

  if found then
    if existing.status = 'blocked' then
      if existing.blocked_by = me then
        raise exception 'You have blocked this user.' using errcode = '42501';
      end if;
      raise exception 'No user with that username.' using errcode = 'P0002';
    end if;

    if existing.status = 'accepted' then
      raise exception 'You are already friends.' using errcode = '23505';
    end if;

    if existing.status = 'pending' then
      -- They asked first and now we're asking back — that's mutual consent, so
      -- skip the pointless second prompt and just make them friends.
      if existing.addressee_id = me then
        update public.friendships
        set status = 'accepted', responded_at = now()
        where id = existing.id;
        return existing.id;
      end if;
      raise exception 'You have already sent that request.' using errcode = '23505';
    end if;

    if existing.status = 'declined' then
      -- The person who declined may start a fresh request (roles swap). The one
      -- who was declined may not — that's the anti-spam half of keeping the row.
      if existing.addressee_id = me then
        update public.friendships
        set requester_id = me, addressee_id = target,
            status = 'pending', responded_at = null, created_at = now()
        where id = existing.id;
        return existing.id;
      end if;
      raise exception 'That request was declined.' using errcode = '42501';
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (me, target, 'pending')
  returning id into target;

  return target;
end;
$$;

-- ── Respond to a request ─────────────────────────────────────────────────────
create or replace function public.respond_to_friend_request(friendship uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me  uuid := auth.uid();
  row public.friendships%rowtype;
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select * into row from public.friendships where id = friendship;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;

  -- The whole reason these live in a function: only the ADDRESSEE may answer,
  -- and only while it is still pending.
  if row.addressee_id <> me then
    raise exception 'Only the person who received a request can answer it.' using errcode = '42501';
  end if;
  if row.status <> 'pending' then
    raise exception 'That request has already been answered.' using errcode = '22023';
  end if;

  update public.friendships
  set status = case when accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = friendship;
end;
$$;

-- ── Block / unblock ──────────────────────────────────────────────────────────
-- Blocking works whether or not a relationship already exists, so it upserts.
create or replace function public.block_user(other_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null       then raise exception 'Not signed in.'       using errcode = '42501'; end if;
  if other_user = me  then raise exception 'You cannot block yourself.' using errcode = '22023'; end if;

  update public.friendships
  set status = 'blocked', blocked_by = me, responded_at = now()
  where least(requester_id, addressee_id)    = least(me, other_user)
    and greatest(requester_id, addressee_id) = greatest(me, other_user);

  if not found then
    insert into public.friendships (requester_id, addressee_id, status, blocked_by, responded_at)
    values (me, other_user, 'blocked', me, now());
  end if;
end;
$$;

create or replace function public.unblock_user(other_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  -- Only the blocker can lift it, and unblocking clears the relationship
  -- entirely rather than restoring whatever it was before.
  delete from public.friendships
  where least(requester_id, addressee_id)    = least(me, other_user)
    and greatest(requester_id, addressee_id) = greatest(me, other_user)
    and status = 'blocked'
    and blocked_by = me;
end;
$$;

revoke all on function public.send_friend_request(text)              from public, anon;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke all on function public.block_user(uuid)                       from public, anon;
revoke all on function public.unblock_user(uuid)                     from public, anon;
grant execute on function public.send_friend_request(text)              to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.block_user(uuid)                       to authenticated;
grant execute on function public.unblock_user(uuid)                     to authenticated;

-- ── Views ────────────────────────────────────────────────────────────────────
-- security_invoker = false so the join can read the OTHER person's profile past
-- user_profiles' select-own RLS. Each view filters on auth.uid() itself, which
-- is what keeps that safe — auth.uid() still resolves to the caller's JWT even
-- though the view executes as its owner.

-- Your accepted friends. This is the ONLY place `username` crosses between
-- users, which is what makes the "friends can see your name" promise true.
drop view if exists public.my_friends;
create view public.my_friends
with (security_invoker = false) as
  select
    f.id as friendship_id,
    p.id,
    p.handle,
    p.username,
    p.avatar_path,
    f.created_at,
    f.responded_at
  from public.friendships f
  join public.user_profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and auth.uid() in (f.requester_id, f.addressee_id);

alter view public.my_friends owner to postgres;
revoke all on public.my_friends from anon, authenticated;
grant select on public.my_friends to authenticated;

-- Outstanding requests, both directions. `direction` tells the client whether to
-- offer Accept/Decline or just "requested". Only the public identity is exposed
-- here — a pending request must not leak the sender's real name.
drop view if exists public.my_friend_requests;
create view public.my_friend_requests
with (security_invoker = false) as
  select
    f.id as friendship_id,
    p.id,
    p.handle,
    p.avatar_path,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end as direction,
    f.created_at
  from public.friendships f
  join public.user_profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'pending'
    and auth.uid() in (f.requester_id, f.addressee_id);

alter view public.my_friend_requests owner to postgres;
revoke all on public.my_friend_requests from anon, authenticated;
grant select on public.my_friend_requests to authenticated;

-- ── Close the privacy gap ────────────────────────────────────────────────────
-- `username` is the UI's "Your Name", which onboarding promises is private until
-- you book or accept a friend. It must not sit in the view every signed-in user
-- can read. Stores are unaffected: bookings snapshot user_name onto the booking
-- row at the time it's made.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select id, handle, avatar_path
  from public.user_profiles;

alter view public.public_profiles owner to postgres;

comment on view public.public_profiles is
  'Truly public slice of user_profiles (id, handle, avatar_path) readable by any signed-in user. `username` is deliberately NOT here — it is private until a booking or accepted friendship; friends read it via my_friends.';

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;
