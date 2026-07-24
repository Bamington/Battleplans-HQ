-- 20260723050000_booking_share_leave.sql
--
-- Let an invitee leave a booking they accepted.
--
-- The delete policy only allowed the SHARER to remove a share (withdraw). But an
-- accepted invitee needs a way out too — otherwise a booking they said yes to is
-- one they can never back out of. Widen the delete to either party.
--
-- Additive (grants more, removes nothing) and safe on the shared DB.
-- Idempotent.

drop policy if exists "booking_shares_delete_own" on public.booking_shares;
create policy "booking_shares_delete_own"
  on public.booking_shares for delete
  to authenticated
  using (auth.uid() in (shared_by_user_id, shared_with_user_id));
