-- 20260809000000_venue_leads.sql
--
-- Where the /venue signup form's submissions land, plus an email to the
-- platform owner when one arrives.
--
-- The form is on a public marketing page, so this table is written by `anon`
-- with no session behind it. Three consequences shape everything below:
--
--  * Insert-only for the public. There is no select, update or delete policy
--    naming anon or authenticated, so a submitter can write a row and can
--    never read one back — including their own. A lead list is other venues'
--    contact details; it is not public data.
--
--  * Every text column is length-bounded. Without RLS-side limits an open
--    insert endpoint is a place to store arbitrary megabytes for free.
--
--  * The email goes out through the same pg_net + Vault + edge function path
--    the booking notifications use, for the same reason: a marketing form must
--    never hang or fail because Resend is having a bad day.
--
-- Additive only — new table, new function, new trigger. Nothing existing is
-- touched, so it is safe to apply to the shared database ahead of any deploy.

create table if not exists public.venue_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  contact_name  text not null check (length(btrim(contact_name)) between 1 and 120),
  email         text not null check (length(btrim(email)) between 3 and 200 and position('@' in email) > 1),
  venue_name    text not null check (length(btrim(venue_name)) between 1 and 160),
  role          text not null check (role in ('Owner', 'Manager', 'Team Member', 'Other')),

  -- Somewhere to record that a lead has been dealt with. Only an admin can
  -- ever change it; the form never sets it.
  status        text not null default 'new'
                check (status in ('new', 'contacted', 'listed', 'declined'))
);

comment on table public.venue_leads is
  'Signups from the /venue marketing form. Insert-only for the public; readable by platform admins.';

create index if not exists venue_leads_created_at_idx on public.venue_leads (created_at desc);

alter table public.venue_leads enable row level security;

-- Anyone may submit. `with check (true)` is deliberate: the column constraints
-- above are what validate the row, and a policy can't do a better job of it.
drop policy if exists "Anyone can submit a venue lead" on public.venue_leads;
create policy "Anyone can submit a venue lead"
  on public.venue_leads for insert
  to anon, authenticated
  with check (true);

-- Reading, and marking a lead as handled, is an admin-only affair.
drop policy if exists "Admins can read venue leads" on public.venue_leads;
create policy "Admins can read venue leads"
  on public.venue_leads for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update venue leads" on public.venue_leads;
create policy "Admins can update venue leads"
  on public.venue_leads for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );

-- Grants. Explicit rather than assumed: this project does not set
-- `auto_expose_new_tables`, so a new table in public reaches the Data API roles
-- only if it is granted to them. Each role gets exactly what its policies need
-- and nothing else, so anon being insert-only is true twice over — once in
-- privileges and once in policy. Loosening it should take two deliberate steps.
revoke all on public.venue_leads from anon, authenticated;
grant insert                 on public.venue_leads to anon;
grant insert, select, update on public.venue_leads to authenticated;
grant all                    on public.venue_leads to service_role;

-- ── Notification ─────────────────────────────────────────────────────────────
--
-- Reuses `booking_webhook_secret` from Vault rather than introducing a second
-- one. It gates the same thing — "the database may ask an edge function to send
-- an email" — and one secret to rotate is better than two. If it's missing the
-- insert still succeeds; only the email is skipped.

create extension if not exists pg_net;

create or replace function public.notify_venue_lead()
returns trigger
language plpgsql
security definer                       -- needs to read vault.decrypted_secrets
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  -- Not a secret: the project ref is already public in the client bundle.
  v_url    text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-venue-lead';
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'booking_webhook_secret'
  limit 1;

  if v_secret is null then
    raise warning 'notify_venue_lead: booking_webhook_secret missing from vault, skipping';
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-booking-secret', v_secret
    ),
    body    := jsonb_build_object('lead_id', new.id)
  );

  return null;

exception when others then
  -- A venue that filled the form in has done their part. Never lose the row
  -- because the notification failed.
  raise warning 'notify_venue_lead failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists venue_leads_notify on public.venue_leads;
create trigger venue_leads_notify
  after insert on public.venue_leads
  for each row execute function public.notify_venue_lead();
