-- 20260820020000_battlepack_audience_size.sql
--
-- Let an organiser find out how many people would be emailed, before they do
-- the thing that emails them.
--
-- 20260820010000 made a date change on a published pack send mail to everyone
-- holding a calendar entry for it. That is the right behaviour and it is also
-- an invisible consequence: an organiser nudging a start time by fifteen
-- minutes has no way of knowing they just wrote to forty people. The editor
-- now asks them to confirm — and a confirmation that cannot say HOW MANY is a
-- vague warning that gets clicked through.
--
-- A COUNT, AND NOTHING ELSE. Who saved an event is not the organiser's
-- business: it is a list of named individuals who did something private, and
-- the reason to surface any of it is to make the size of a blast legible before
-- it goes. So this returns an integer and there is no sibling function that
-- returns the people.
--
-- Guarded by can_edit_battlepack, and returns 0 rather than raising when the
-- caller cannot edit the pack. Nobody should be able to ask how popular
-- somebody else's event is, and a caller who is not entitled to the number
-- should not be able to tell "no permission" from "nobody yet".
--
-- Purely additive: one function. Idempotent: safe to re-run.

create or replace function public.battlepack_calendar_audience_size(pack uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.can_edit_battlepack(pack) then (
      select count(*)::integer
      from public.battlepack_calendar_adds a
      where a.pack_id = pack
    )
    else 0
  end;
$$;

comment on function public.battlepack_calendar_audience_size(uuid) is
  'How many people have this pack in their calendar, for the editor''s "this will email N people" confirmation. A count only — never the people. Returns 0 to anyone who cannot edit the pack.';

-- Naming anon explicitly, not just PUBLIC. This database grants EXECUTE on new
-- public functions to anon by default, as a real grant to the role, and
-- revoking from PUBLIC does not touch it — see 20260820000100, which exists
-- because that was learned the hard way.
revoke all on function public.battlepack_calendar_audience_size(uuid) from public, anon;
grant execute on function public.battlepack_calendar_audience_size(uuid) to authenticated;

-- ------------------------------------------------------------
-- HOW MANY ARE STALE RIGHT NOW
--
-- A different question from the one above, for a narrower door.
--
-- The audience size answers "if I change this date, who hears about it" —
-- everyone, near enough, because a new date makes every held date wrong.
-- Publishing is not like that. A pack that is withdrawn, edited and put back
-- emails only the people whose held date no longer matches, which may be all of
-- them or none, and the difference is knowable BEFORE the button is pressed
-- because the dates are already saved by then — publishing only moves `status`.
--
-- Same predicate as battlepack_stale_calendar_adds, minus the requirement that
-- the pack already be published, since the whole point is to ask before it is.
-- If the two ever disagree the warning stops matching the email, so they are
-- written to be read side by side.
-- ------------------------------------------------------------
create or replace function public.battlepack_pending_notify_count(pack uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.can_edit_battlepack(pack) then (
      select count(*)::integer
      from public.battlepack_calendar_adds a
      join public.battlepacks p on p.id = a.pack_id
      where a.pack_id = pack
        and public.battlepack_date_signature(a.starts_on, a.ends_on, a.starts_at)
            is distinct from public.battlepack_date_signature(p.starts_on, p.ends_on, p.starts_at)
        and a.notified_signature
            is distinct from public.battlepack_date_signature(p.starts_on, p.ends_on, p.starts_at)
    )
    else 0
  end;
$$;

comment on function public.battlepack_pending_notify_count(uuid) is
  'How many people would be emailed if this pack were published as it currently stands — holders whose date no longer matches and who have not already been told about the current one. For the editor''s publish confirmation; a count only, never the people.';

revoke all on function public.battlepack_pending_notify_count(uuid) from public, anon;
grant execute on function public.battlepack_pending_notify_count(uuid) to authenticated;
