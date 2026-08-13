-- 20260811010000_booking_fee_message_required.sql
--
-- Every booking fee must carry its own message.
--
-- 20260811000000 let an override leave `message` null and inherit the venue
-- default's wording. That was convenience at the cost of accuracy: a $15
-- Saturday rule silently borrowing a blurb that says "$10 for 3 hours" tells
-- the player something untrue. Stores own their messaging, so every rule states
-- its own terms — and a rule with nothing to say cannot be saved at all.
--
-- Follow-up rather than an edit to 20260811000000: that migration is already
-- applied to the shared database, so its recorded shape has to stay as it was.
--
-- Safe on live data: checked before writing, the only existing row has a
-- message, so nothing is rewritten or dropped.
--
-- Idempotent: safe to re-run.

-- Whitespace is not a message. The check runs first so the NOT NULL below can
-- never be satisfied by an empty string sneaking past the client.
alter table public.location_booking_fees
    drop constraint if exists location_booking_fees_message_check;
alter table public.location_booking_fees
    add constraint location_booking_fees_message_check
    check (btrim(message) <> '');

alter table public.location_booking_fees
    alter column message set not null;

comment on column public.location_booking_fees.message is
  'Store-authored explanation shown at booking time. Required — every fee states its own terms rather than inheriting another rule''s wording.';
