-- 20260811040000_bookings_on_behalf.sql
--
-- Venue admins and staff can take a booking for someone else.
--
-- The shape of this is decided by one requirement: a booking taken at the
-- counter is REAL whether or not the customer ever joins BattlePlan. The venue
-- needs its table reserved today; whether an invited stranger ever signs up is
-- their business. So the booking must not depend on the user existing.
--
-- Hence `user_id` becomes nullable. A null means "a guest we haven't linked to
-- an account yet"; `user_name` and `user_email` already carry who they are, and
-- that's all the venue needs. If that address later signs up, the booking
-- silently becomes theirs (see handle_new_user below).
--
-- This is the trap the abandoned friend-invites hit, avoided rather than
-- repeated: there is nothing here to accept or decline, so no record has to sit
-- "pending" forever, and an invite to an address that never signs up simply
-- never gets claimed. It costs nothing and nobody is left waiting.
--
-- Backward compatible: every existing booking keeps its user_id, and both
-- rewritten policies are strict supersets of the ones they replace.
--
-- Idempotent: safe to re-run.

-- ── Columns ──────────────────────────────────────────────────────────────────
-- Dropping NOT NULL never invalidates an existing row.
alter table public.bookings
    alter column user_id drop not null;

comment on column public.bookings.user_id is
  'The account this booking belongs to. NULL means a guest booked at the counter who has no account yet — user_name/user_email identify them, and handle_new_user() claims the booking if that address signs up.';

alter table public.bookings
    add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

comment on column public.bookings.created_by_user_id is
  'Who actually made this booking. Differs from user_id when a venue admin or staff member took it on someone''s behalf.';

-- Set by the invite edge function once it has actually sent something, so an
-- unsent invite is distinguishable from one that went out.
alter table public.bookings
    add column if not exists invite_sent_at timestamptz;

-- Claiming looks bookings up by address, and the guest set is tiny next to the
-- whole table, so index only the rows that can ever be claimed.
create index if not exists bookings_unclaimed_guest_idx
    on public.bookings (lower(user_email))
    where user_id is null and user_email is not null;

-- ── Who may create a booking ─────────────────────────────────────────────────
-- Superset of "Users can insert own bookings": booking for yourself is
-- unchanged, and a venue member may now book at their OWN venue for anyone.
--
-- Note this does let a venue attribute a booking to an arbitrary user id. That
-- is the feature — taking a phone booking for a regular — and it is bounded to
-- venues that person already administers or works at. `created_by_user_id =
-- auth.uid()` stops them forging who took it.
drop policy if exists "Users can insert own bookings" on public.bookings;
drop policy if exists "Insert own bookings, or a venue member booking for someone" on public.bookings;
create policy "Insert own bookings, or a venue member booking for someone"
    on public.bookings for insert
    to authenticated
    with check (
        auth.uid() = user_id
        or (
            created_by_user_id = auth.uid()
            and (
                public.is_location_admin(location_id)
                or public.is_location_staff(location_id)
            )
        )
    );

-- ── Who may cancel a booking ─────────────────────────────────────────────────
-- Superset of the previous policy, adding venue staff. A customer who rings up
-- to cancel shouldn't need a manager fetched.
drop policy if exists "Users and admins can delete bookings" on public.bookings;
drop policy if exists "Owner, admin, venue-admin, or venue-staff can delete bookings" on public.bookings;
create policy "Owner, admin, venue-admin, or venue-staff can delete bookings"
    on public.bookings for delete
    to authenticated
    using (
        auth.uid() = user_id
        or public.is_platform_admin()
        or public.is_location_admin(location_id)
        or public.is_location_staff(location_id)
    );

-- ── Don't email a venue about its own booking ────────────────────────────────
-- Unchanged except for the new guard: when the person performing the change is
-- an admin or staff member of that venue, they are standing at the counter and
-- already know. Emailing them trains people to ignore the notifications that
-- do matter.
--
-- Keyed on auth.uid() rather than created_by_user_id so it covers cancellations
-- too, where the row is already gone and only the actor is knowable.
create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer                       -- needs to read vault.decrypted_secrets
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_date   date;
  v_loc    uuid;
  v_body   jsonb;
  -- Not a secret: the project ref is already public in the client bundle.
  v_url    text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-booking-notification';
begin
  v_date := case when tg_op = 'DELETE' then old.date        else new.date        end;
  v_loc  := case when tg_op = 'DELETE' then old.location_id else new.location_id end;

  -- Backfills and historical tidy-ups aren't things a store needs told about.
  if v_date is null or v_date < current_date then
    return null;
  end if;

  -- The venue did this itself.
  if v_loc is not null
     and (public.is_location_admin(v_loc) or public.is_location_staff(v_loc)) then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'booking_webhook_secret'
  limit 1;

  if v_secret is null then
    raise warning 'notify_booking_change: booking_webhook_secret missing from vault, skipping';
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_body := jsonb_build_object('event', 'created', 'booking_id', new.id);
  else
    -- The row is already gone by the time this runs, so send its values rather
    -- than an id the function could never look up.
    v_body := jsonb_build_object(
      'event',   'cancelled',
      'booking', jsonb_build_object(
        'id',          old.id,
        'date',        old.date,
        'user_name',   old.user_name,
        'user_email',  old.user_email,
        'location_id', old.location_id,
        'timeslot_id', old.timeslot_id,
        'game_id',     old.game_id
      )
    );
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-booking-secret', v_secret
    ),
    body    := v_body
  );

  return null;

exception when others then
  -- Never let a notification problem take a booking down with it.
  raise warning 'notify_booking_change failed: %', sqlerrm;
  return null;
end;
$$;

-- ── Claim guest bookings on signup ───────────────────────────────────────────
-- Unchanged handle/profile logic from 20260722000000, plus the claim.
--
-- The claim is in its own block with its own handler: this trigger runs on
-- every signup, and no booking problem may ever stop someone creating an
-- account. Worst case the claim is skipped and the venue still has its booking.
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

  -- Any table a venue booked for this address before they had an account is
  -- now theirs. Silent by design: they asked for the table, so finding it
  -- waiting is the expected outcome, not a surprise to be consented to.
  begin
    if new.email is not null then
      update public.bookings
      set user_id = new.id
      where user_id is null
        and user_email is not null
        and lower(user_email) = lower(new.email);
    end if;
  exception when others then
    raise warning 'handle_new_user: claiming guest bookings failed: %', sqlerrm;
  end;

  return new;
end;
$$;
