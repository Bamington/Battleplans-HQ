-- 20260720010000_booking_notification_trigger.sql
--
-- Emails the venue when one of their tables is booked or a booking is cancelled,
-- by calling the send-booking-notification edge function.
--
-- Notes on the shape of this:
--
--  * pg_net posts ASYNCHRONOUSLY. A booking must never fail or hang because
--    Resend is down, so nothing here blocks the transaction, and the whole body
--    is wrapped so an unexpected error can only warn, never abort the insert.
--
--  * Only bookings dated today or later notify. A past-dated insert is a
--    backfill, not someone booking a table — which matters here, because this
--    project imported 400 historical bookings in one go and would otherwise
--    have sent 400 emails. Same reasoning for deletes: a past booking being
--    tidied up hasn't "freed a table up".
--
--  * The shared secret is read from Supabase Vault rather than written here, so
--    nothing sensitive lands in the repo. Create it once (see below) with the
--    same value as the function's BOOKING_WEBHOOK_SECRET:
--
--      select vault.create_secret(
--        '<same value as BOOKING_WEBHOOK_SECRET>',
--        'booking_webhook_secret',
--        'Shared secret for the send-booking-notification edge function'
--      );
--
--  * Bulk-loading bookings? Disable the triggers around the import rather than
--    relying on the date guard:
--      alter table public.bookings disable trigger bookings_notify_created;
--      alter table public.bookings disable trigger bookings_notify_cancelled;

create extension if not exists pg_net;

create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer                       -- needs to read vault.decrypted_secrets
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_date   date;
  v_body   jsonb;
  -- Not a secret: the project ref is already public in the client bundle.
  v_url    text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-booking-notification';
begin
  v_date := case when tg_op = 'DELETE' then old.date else new.date end;

  -- Backfills and historical tidy-ups aren't things a store needs told about.
  if v_date is null or v_date < current_date then
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

drop trigger if exists bookings_notify_created on public.bookings;
create trigger bookings_notify_created
  after insert on public.bookings
  for each row execute function public.notify_booking_change();

drop trigger if exists bookings_notify_cancelled on public.bookings;
create trigger bookings_notify_cancelled
  after delete on public.bookings
  for each row execute function public.notify_booking_change();
