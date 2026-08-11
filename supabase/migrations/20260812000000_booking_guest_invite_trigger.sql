-- 20260812000000_booking_guest_invite_trigger.sql
--
-- Invite the guest when a venue books a table for someone with no account.
--
-- Deliberately a separate trigger from `bookings_notify_created` rather than a
-- branch inside it: different recipient, different email, different failure
-- consequences. The venue notification going out has nothing to do with whether
-- the guest invite did, and one silently suppressing the other would be a bad
-- surprise. They are also suppressed on opposite conditions — the venue is NOT
-- told when its own staff booked, which is exactly when a guest IS invited.
--
-- Same guarantees as the notification trigger:
--   * pg_net posts asynchronously; a booking must never fail or hang because
--     Resend is down, so the whole body only ever warns.
--   * Past-dated inserts are backfills, not someone booking a table.
--   * The shared secret comes from Vault, reusing booking_webhook_secret —
--     edge function secrets are per-project, so it is already set.
--
-- The edge function re-checks every condition before it emails anyone, so this
-- trigger is the fast filter rather than the authority.
--
-- Idempotent: safe to re-run.

create or replace function public.invite_booking_guest()
returns trigger
language plpgsql
security definer                       -- needs to read vault.decrypted_secrets
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_url    text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-booking-invite';
begin
  -- Only unclaimed guest bookings with somewhere to send to.
  if new.user_id is not null or new.user_email is null or btrim(new.user_email) = '' then
    return null;
  end if;

  -- Already invited (e.g. a re-run or a manual retry that succeeded).
  if new.invite_sent_at is not null then
    return null;
  end if;

  -- A historical import isn't someone to email out of the blue.
  if new.date is null or new.date < current_date then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'booking_webhook_secret'
  limit 1;

  if v_secret is null then
    raise warning 'invite_booking_guest: booking_webhook_secret missing from vault, skipping';
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-booking-secret', v_secret
    ),
    body    := jsonb_build_object('booking_id', new.id)
  );

  return null;

exception when others then
  -- The venue still has its booking; a missed invite is not worth losing it.
  raise warning 'invite_booking_guest failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists bookings_invite_guest on public.bookings;
create trigger bookings_invite_guest
  after insert on public.bookings
  for each row execute function public.invite_booking_guest();
