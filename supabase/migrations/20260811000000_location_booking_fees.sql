-- 20260811000000_location_booking_fees.sql
--
-- Table booking fees — the message a player sees before they confirm a booking.
--
-- No payment is taken anywhere in this flow. A fee row is purely something to
-- SHOW: an amount (so it can be badged, summed, and later charged) plus the
-- store's own wording explaining what the fee buys.
--
-- Three scopes, resolved most-specific-first at booking time:
--   timeslot  — this fee applies to one timeslot at this venue
--   day       — this fee applies to one weekday at this venue
--   default   — this fee applies to everything else
--
-- A venue that just wants "$10 a table, always" writes one `default` row and
-- never touches the other two. That is the case this schema optimises for; the
-- overrides are the exception, which is why they are rows rather than columns.
--
-- Purely additive: no existing table or policy changes, so it is safe to apply
-- to the shared database ahead of the app deploy that reads it.
--
-- Idempotent: safe to re-run.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.location_booking_fees (
    id           uuid default gen_random_uuid() primary key,
    location_id  uuid not null references public.locations (id) on delete cascade,
    scope        text not null,
    -- Full day name, matching timeslots.availability ('Monday', not 1 or 'Mon').
    day_of_week  text,
    timeslot_id  uuid references public.timeslots (id) on delete cascade,
    -- Minor units, so no float ever touches money. 1000 = $10.00.
    amount_cents integer not null,
    -- The store's own wording. NULL on an override means "reuse the default
    -- row's message", so a venue changing its blurb edits one row, not five.
    message      text,
    created_at   timestamptz default now(),
    updated_at   timestamptz default now(),

    constraint location_booking_fees_scope_check
        check (scope in ('default', 'day', 'timeslot')),
    constraint location_booking_fees_day_check
        check (day_of_week is null or day_of_week in (
            'Monday', 'Tuesday', 'Wednesday', 'Thursday',
            'Friday', 'Saturday', 'Sunday'
        )),
    constraint location_booking_fees_amount_check
        check (amount_cents >= 0),
    -- Each scope carries exactly the discriminator it needs and no other, so a
    -- row can never claim to be both a day rule and a timeslot rule.
    constraint location_booking_fees_shape_check check (
        (scope = 'default'  and day_of_week is null     and timeslot_id is null)
     or (scope = 'day'      and day_of_week is not null and timeslot_id is null)
     or (scope = 'timeslot' and day_of_week is null     and timeslot_id is not null)
    )
);

comment on table public.location_booking_fees is
  'Table booking fees shown to players before they confirm. Display only — no payment is taken. Resolved timeslot > day > default.';
comment on column public.location_booking_fees.amount_cents is
  'Fee in minor units (1000 = $10.00).';
comment on column public.location_booking_fees.message is
  'Store-authored explanation shown at booking time. NULL on an override falls back to the venue default row''s message.';

-- ── Uniqueness ───────────────────────────────────────────────────────────────
-- One rule per (venue, scope target). Partial indexes rather than a composite
-- unique: NULLs are distinct in a plain unique index, which would let a venue
-- accumulate any number of `default` rows.
create unique index if not exists location_booking_fees_default_key
    on public.location_booking_fees (location_id)
    where scope = 'default';

create unique index if not exists location_booking_fees_day_key
    on public.location_booking_fees (location_id, day_of_week)
    where scope = 'day';

create unique index if not exists location_booking_fees_timeslot_key
    on public.location_booking_fees (location_id, timeslot_id)
    where scope = 'timeslot';

create index if not exists location_booking_fees_location_id_idx
    on public.location_booking_fees using btree (location_id);

-- ── Keep updated_at honest ───────────────────────────────────────────────────
create or replace function public.touch_location_booking_fee()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists location_booking_fees_touch on public.location_booking_fees;
create trigger location_booking_fees_touch
    before update on public.location_booking_fees
    for each row execute function public.touch_location_booking_fee();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.location_booking_fees enable row level security;

-- Readable by everyone: the fee has to be visible before you book, and the
-- public venue pages show it too. It carries no personal data.
drop policy if exists "Anyone can read booking fees" on public.location_booking_fees;
create policy "Anyone can read booking fees"
    on public.location_booking_fees for select
    to authenticated, anon
    using (true);

-- Written by platform admins and admins of that venue — the same shape the
-- other venue-owned tables (timeslots, store_tables, blocked_dates) use.
drop policy if exists "Admins and location admins can manage booking fees" on public.location_booking_fees;
create policy "Admins and location admins can manage booking fees"
    on public.location_booking_fees
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles
            where user_profiles.id = auth.uid()
              and user_profiles.role = 'admin'
        )
        or exists (
            select 1 from public.locations
            where locations.id = location_booking_fees.location_id
              and locations.admins @> array[auth.uid()]
        )
    );
