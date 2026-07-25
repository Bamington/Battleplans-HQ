-- 20260723040000_booking_share_address.sql
--
-- The invitee's booking modal shows the venue's full street address, which the
-- booking row doesn't carry (only location_name). Add it to the incoming view
-- by joining locations. Still no user_name / user_email — the sharer's private
-- name stays out.
--
-- Additive: recreates the view with one extra column. Idempotent.

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
    loc.address    as location_address,
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
  join public.bookings b        on b.id = s.booking_id
  left join public.locations loc on loc.id = b.location_id
  left join public.games g      on g.id = b.game_id
  join public.user_profiles sharer on sharer.id = s.shared_by_user_id
  where s.shared_with_user_id = auth.uid()
    and s.status in ('pending', 'accepted');

alter view public.my_incoming_booking_shares owner to postgres;
revoke all on public.my_incoming_booking_shares from anon, authenticated;
grant select on public.my_incoming_booking_shares to authenticated;
