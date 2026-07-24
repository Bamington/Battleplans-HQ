-- 20260724030000_friend_request_by_email.sql
--
-- Add a friend by email — without ever telling the sender whether that address
-- has an account. Only auth.users holds emails, so the lookup has to run inside
-- a SECURITY DEFINER function the client cannot reach directly.
--
-- If the email maps to a user, we quietly reuse send_friend_request (via their
-- handle) to create the normal in-app request. Every outcome that would give the
-- address away — already friends, already requested, blocked, yourself, a prior
-- decline, or simply no such user — is swallowed, so a valid address is
-- indistinguishable from an invalid one and the caller always gets the same
-- silent success. The UI then shows one generic "if they have an account…" line.
--
-- No email is sent (that path isn't built yet) and no new table is needed: a
-- matching user simply receives a friend request like any other. Purely
-- additive, so it's safe on the shared DB ahead of the deploy.
--
-- Idempotent.

create or replace function public.send_friend_request_by_email(target_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me            uuid := auth.uid();
  target_handle text;
begin
  if me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;

  select p.handle into target_handle
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where lower(u.email) = lower(trim(target_email))
  limit 1;

  -- Reveal nothing. On a match, best-effort create the request; every error
  -- (already friends, already sent, blocked, self, declined) is deliberately
  -- discarded so the caller can't tell a real address from a made-up one.
  if target_handle is not null then
    begin
      perform public.send_friend_request(target_handle);
    exception when others then
      null;
    end;
  end if;
end;
$$;

revoke all on function public.send_friend_request_by_email(text) from public, anon;
grant execute on function public.send_friend_request_by_email(text) to authenticated;
