-- ============================================================================
-- Carry the table type through to a shared booking
-- ============================================================================
--
-- The booking detail modal now shows which KIND of table was booked. The same
-- modal serves a friend who has been invited to someone else's booking, and it
-- reads `my_incoming_booking_shares`, which did not carry the label — so the
-- invited friend was the one person shown a detail panel with a hole in it.
--
-- APPENDED, NOT REORDERED. `create or replace view` refuses to rename or retype
-- an existing column, and the client selects `*` and maps the fields it knows,
-- so a new column on the end is invisible to the deployed build and safe to
-- apply ahead of the app.
--
-- Nothing is newly exposed. The invitee can already read this booking's date,
-- venue, address and timeslot through this view; which kind of table it is for
-- is the same booking, and strictly less identifying than what is already here.
-- The view's real privacy line — the sharer's public handle and avatar, never
-- their real name — is untouched.

create or replace view public.my_incoming_booking_shares as
  select s.id            as share_id,
         s.status,
         s.created_at,
         s.responded_at,
         b.id            as booking_id,
         b.date,
         b.location_id,
         b.location_name,
         loc.address     as location_address,
         b.timeslot_name,
         b.timeslot_start_time,
         b.timeslot_end_time,
         g.id            as game_id,
         g.name          as game_name,
         g.slug          as game_slug,
         sharer.id           as sharer_id,
         sharer.handle       as sharer_handle,
         sharer.avatar_path  as sharer_avatar_path,
         b.table_label                                    -- new, on the end
    from public.booking_shares s
    join public.bookings b        on b.id  = s.booking_id
    left join public.locations loc on loc.id = b.location_id
    left join public.games g       on g.id  = b.game_id
    join public.user_profiles sharer on sharer.id = s.shared_by_user_id
   where s.shared_with_user_id = auth.uid()
     and s.status = any (array['pending', 'accepted']);
