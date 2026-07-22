-- 20260723000000_friend_top_games.sql
--
-- A friend's most-played games, for the profile modal.
--
-- `battles` is owner-only (SELECT is `user_id = auth.uid()`), so no one can
-- read another user's battles directly — which is correct, and stays correct.
-- This adds ONE sanctioned window: a SECURITY DEFINER function that returns a
-- narrow aggregate (per-game played/won counts) and ONLY when the caller is an
-- accepted friend of the target.
--
-- The friendship check inside the function is the whole security boundary. It
-- runs as the owner, so it bypasses the battles RLS — meaning the gate must be
-- airtight: pass any user_id you like, and you get nothing back unless you two
-- are actually friends. No raw battle rows ever leave the function, only counts.
--
-- Forward-looking: an opt-in public profile later becomes one extra OR in the
-- gate (`... or target has opted in`), not a rewrite.
--
-- Idempotent: safe to re-run.

create or replace function public.friend_top_games(
  target_user_id uuid,
  limit_n int default 3
)
returns table (
  game_id uuid,
  name    text,
  slug    text,
  played  bigint,
  won     bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;  -- not signed in: empty, never an error that hints at anything
  end if;

  -- The gate. Anything other than an accepted friendship (a stranger, a merely
  -- pending request, a block, or yourself passed as the target) yields nothing.
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id)    = least(me, target_user_id)
      and greatest(f.requester_id, f.addressee_id) = greatest(me, target_user_id)
  ) then
    return;
  end if;

  return query
    select
      g.id,
      g.name,
      g.slug,
      count(*)                                        as played,
      count(*) filter (where b.result = 'won')        as won
    from public.battles b
    join public.games g on g.id = b.game_id
    where b.user_id = target_user_id
    group by g.id, g.name, g.slug
    -- Most played first; won then name only to make ties deterministic.
    order by played desc, won desc, g.name asc
    limit greatest(0, least(limit_n, 20));  -- clamp so a caller can't ask for everything
end;
$$;

revoke all on function public.friend_top_games(uuid, int) from public, anon;
grant execute on function public.friend_top_games(uuid, int) to authenticated;

comment on function public.friend_top_games(uuid, int) is
  'Per-game played/won counts for target_user_id, returned only to an accepted friend. Bypasses battles RLS deliberately; the friendship check is the boundary. Never returns raw battle rows.';
