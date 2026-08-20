-- 20260820010000_battlepack_change_notifications.sql
--
-- Tell the people holding a calendar entry when the event moves or comes down.
--
-- 20260820000000 built the list and said plainly that nothing read it. This is
-- the half that reads it: two triggers on `battlepacks` that hand
-- `send-pack-change-notification` a pack and let the function do the mailing.
--
-- WHY THE FUNCTION ASKS US WHO, RATHER THAN BEING TOLD. The decision "this
-- person is holding a date that is no longer true" is a comparison between two
-- dates and a suppression check, and doing it in TypeScript would mean the
-- Edge Function rebuilding a date signature that Postgres already knows how to
-- build — two implementations of one rule, in two languages, that agree until
-- one of them meets a time with microseconds on it. So the trigger says only
-- WHICH PACK CHANGED, and the function calls back for the audience.
--
-- The exception is deletion, where there is nothing left to call back about:
-- the pack row is gone and `battlepack_calendar_adds` cascades with it. That
-- one is a BEFORE DELETE trigger which gathers the recipients while they still
-- exist and sends them in the payload — the same shape the booking
-- cancellation has used since 20260720010000, for the same reason.
--
-- Purely additive: two columns, four functions, two triggers. Nothing existing
-- is altered. Idempotent: safe to re-run.

create extension if not exists pg_net;

-- ------------------------------------------------------------
-- WHAT WE HAVE ALREADY TOLD THEM
--
-- The snapshot columns keep meaning what they have always meant: the date the
-- reader put in their calendar. They are deliberately NOT updated when we send
-- an email — being told a date has moved is not the same as having fixed your
-- diary, and overwriting the snapshot would quietly claim it was.
--
-- So suppression gets its own column. `notified_signature` is the pack's date
-- as it stood when we last wrote to this person about it, which makes the
-- rule "tell them when the pack disagrees with what they hold, unless that is
-- the disagreement we already wrote about". Two date changes in a row send two
-- emails, which is right; one date change does not send two, which is the
-- point.
-- ------------------------------------------------------------
alter table public.battlepack_calendar_adds
  add column if not exists notified_signature text,
  add column if not exists notified_at        timestamptz;

comment on column public.battlepack_calendar_adds.notified_signature is
  'The pack''s date signature as at the last email we sent this person about it. NULL means never written to. Suppression only — never a claim about what is in their calendar, which is what the starts_on/ends_on/starts_at snapshot is for.';

-- ------------------------------------------------------------
-- ONE DEFINITION OF "THE SAME DATE"
--
-- Every comparison below goes through this, so "changed" cannot mean one thing
-- in the audience query and another in the suppression check. A null is a
-- real value here — a pack losing its date is a change worth an email — hence
-- the placeholder rather than a null-propagating concatenation.
-- ------------------------------------------------------------
create or replace function public.battlepack_date_signature(
  d_start date, d_end date, t_start time
)
returns text
language sql
immutable
as $$
  select coalesce(d_start::text, '-') || '|' ||
         coalesce(d_end::text,   '-') || '|' ||
         coalesce(t_start::text, '-');
$$;

comment on function public.battlepack_date_signature(date, date, time) is
  'A pack''s date/time as one comparable string. The single definition of whether two dates are "the same" for notification purposes.';

-- ------------------------------------------------------------
-- WHO NEEDS TELLING THAT IT MOVED
--
-- Everybody whose held date differs from the pack's current one, minus anybody
-- already written to about that exact current date. Returns the signature it
-- decided on, so the caller marks with the value this query used rather than
-- one it computed for itself a second later.
--
-- Only ever for a published pack: a draft is not something anyone could have
-- added, and a withdrawn one is handled by the audience function below.
-- ------------------------------------------------------------
create or replace function public.battlepack_stale_calendar_adds(pack uuid)
returns table (
  user_id         uuid,
  held_starts_on  date,
  held_ends_on    date,
  held_starts_at  time,
  signature       text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.starts_on, a.ends_on, a.starts_at,
         public.battlepack_date_signature(p.starts_on, p.ends_on, p.starts_at)
  from public.battlepack_calendar_adds a
  join public.battlepacks p on p.id = a.pack_id
  where a.pack_id = pack
    and p.status = 'published'
    and public.battlepack_date_signature(a.starts_on, a.ends_on, a.starts_at)
        is distinct from public.battlepack_date_signature(p.starts_on, p.ends_on, p.starts_at)
    and a.notified_signature
        is distinct from public.battlepack_date_signature(p.starts_on, p.ends_on, p.starts_at);
$$;

comment on function public.battlepack_stale_calendar_adds(uuid) is
  'Everyone holding a calendar entry whose date no longer matches this published pack, excluding anyone already emailed about the pack''s current date. Returns the date each one is holding, so the email can say what it is changing FROM.';

-- ------------------------------------------------------------
-- WHO NEEDS TELLING THAT IT IS OFF
--
-- Everybody, without reference to dates: it does not matter whether their
-- diary is accurate when the event is not happening. No suppression column is
-- consulted either, because the trigger only fires on the published → not
-- published EDGE, which cannot repeat without a republish in between.
-- ------------------------------------------------------------
create or replace function public.battlepack_calendar_audience(pack uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id from public.battlepack_calendar_adds a where a.pack_id = pack;
$$;

-- ------------------------------------------------------------
-- MARK AS TOLD
--
-- Called after Resend has accepted the message, and only for the addresses it
-- accepted — so a send that fails halfway leaves the rest still owed an email
-- rather than silently written off.
-- ------------------------------------------------------------
create or replace function public.battlepack_mark_calendar_notified(
  pack uuid, who uuid[], sig text
)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with marked as (
    update public.battlepack_calendar_adds
       set notified_signature = sig,
           notified_at        = now()
     where pack_id = pack
       and user_id = any(who)
    returning 1
  )
  select count(*)::integer from marked;
$$;

-- Service role only, all three. These read one person's saved events and
-- another's audience: nothing here should be reachable from a browser, and the
-- Edge Function is the only intended caller.
--
-- Naming anon explicitly, not just PUBLIC — see 20260820000100. This database
-- grants EXECUTE on new public functions to anon by default, and revoking from
-- PUBLIC does not take that away.
revoke all on function public.battlepack_stale_calendar_adds(uuid)          from public, anon, authenticated;
revoke all on function public.battlepack_calendar_audience(uuid)            from public, anon, authenticated;
revoke all on function public.battlepack_mark_calendar_notified(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.battlepack_stale_calendar_adds(uuid)          to service_role;
grant execute on function public.battlepack_calendar_audience(uuid)            to service_role;
grant execute on function public.battlepack_mark_calendar_notified(uuid, uuid[], text) to service_role;

-- battlepack_date_signature is a pure string builder over values the caller
-- already has, so it stays readable — it is used in the queries above and is
-- worth having available for a manual check.

-- ------------------------------------------------------------
-- THE TRIGGER
--
-- Shaped like notify_booking_change (20260720010000) and for the same reasons:
-- pg_net posts asynchronously so an organiser's save can never hang on Resend,
-- and the whole body is wrapped so a notification problem can only warn, never
-- abort the edit that caused it.
--
-- THE SHARED SECRET IS THE BOOKING ONE, ON PURPOSE. It gates exactly the same
-- thing — "the caller is our own Postgres trigger, not somebody who found the
-- URL" — and standing up a second secret means creating it in TWO places that
-- cannot check each other (Edge Function secrets AND the vault), which is the
-- step this project has got wrong before. `pack_webhook_secret` is preferred
-- if it exists, so splitting them later is one vault insert and one
-- `secrets set`, with no code change.
-- ------------------------------------------------------------
create or replace function public.notify_battlepack_change()
returns trigger
language plpgsql
security definer                       -- needs to read vault.decrypted_secrets
set search_path = public, extensions, vault
as $$
declare
  v_secret     text;
  v_body       jsonb;
  v_recipients jsonb;
  -- Not a secret: the project ref is already public in every client bundle.
  v_url        text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-pack-change-notification';
begin
  -- Nobody saved it, so there is nobody to tell. Checked first because it is
  -- the common case by a wide margin — most packs are edited before anyone has
  -- ever seen them.
  if not exists (
    select 1 from public.battlepack_calendar_adds a
    where a.pack_id = case when tg_op = 'DELETE' then old.id else new.id end
  ) then
    return case when tg_op = 'DELETE' then old else null end;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name in ('pack_webhook_secret', 'booking_webhook_secret')
  -- Prefer the pack-specific one when both exist. 'p' sorts before 'b'
  -- descending, which is the whole trick and is why it is spelled out.
  order by name desc
  limit 1;

  if v_secret is null then
    raise warning 'notify_battlepack_change: no webhook secret in vault, skipping';
    return case when tg_op = 'DELETE' then old else null end;
  end if;

  if tg_op = 'DELETE' then
    -- Gathered here because this is the last moment they exist: the cascade
    -- from battlepack_calendar_adds runs as part of this delete.
    select coalesce(jsonb_agg(a.user_id), '[]'::jsonb) into v_recipients
    from public.battlepack_calendar_adds a where a.pack_id = old.id;

    v_body := jsonb_build_object(
      'event', 'deleted',
      'recipients', v_recipients,
      'pack', jsonb_build_object(
        'id',        old.id,
        'name',      old.name,
        'slug',      old.slug,
        'starts_on', old.starts_on,
        'ends_on',   old.ends_on,
        'starts_at', old.starts_at
      )
    );
  elsif new.status = 'published' then
    v_body := jsonb_build_object('event', 'moved', 'pack_id', new.id);
  else
    v_body := jsonb_build_object('event', 'withdrawn', 'pack_id', new.id);
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-booking-secret', v_secret
    ),
    body    := v_body
  );

  return case when tg_op = 'DELETE' then old else null end;

exception when others then
  -- Never let a notification problem take an organiser's edit down with it.
  raise warning 'notify_battlepack_change failed: %', sqlerrm;
  return case when tg_op = 'DELETE' then old else null end;
end;
$$;

-- The WHEN clause is the whole guard. The editor autosaves, so this trigger
-- would otherwise run on every keystroke-debounced write to a pack — and
-- `is distinct from` is what makes a save that re-writes the same date cost
-- nothing.
--
-- `old.status is distinct from new.status` is in the moved condition on
-- purpose: a pack republished after a withdrawal has an audience holding
-- whatever date it had before, and the date columns need not have moved in the
-- same statement for those people to be stale. The audience query decides; this
-- only decides whether to ask.
drop trigger if exists battlepacks_notify_change on public.battlepacks;
create trigger battlepacks_notify_change
  after update of starts_on, ends_on, starts_at, status on public.battlepacks
  for each row
  when (
    (new.status = 'published' and (
          old.starts_on is distinct from new.starts_on
       or old.ends_on   is distinct from new.ends_on
       or old.starts_at is distinct from new.starts_at
       or old.status    is distinct from new.status
    ))
    or (old.status = 'published' and new.status is distinct from 'published')
  )
  execute function public.notify_battlepack_change();

-- BEFORE, not AFTER: an AFTER DELETE row trigger runs alongside the referential
-- action that empties battlepack_calendar_adds, and the recipients have to be
-- read while they are certainly still there.
drop trigger if exists battlepacks_notify_deleted on public.battlepacks;
create trigger battlepacks_notify_deleted
  before delete on public.battlepacks
  for each row execute function public.notify_battlepack_change();

-- Bulk-editing packs? Disable the triggers around it rather than trusting the
-- WHEN clause to spare you:
--   alter table public.battlepacks disable trigger battlepacks_notify_change;
--   alter table public.battlepacks disable trigger battlepacks_notify_deleted;
