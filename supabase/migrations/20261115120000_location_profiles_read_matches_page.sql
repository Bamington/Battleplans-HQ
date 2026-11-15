-- ============================================================
-- location_profiles: public reads match exactly who can see the page
-- ============================================================
-- 20261113170000 let anyone read a row with is_public set. But a test club
-- with is_public on is still hidden by get_location_profile (test locations
-- are only for their own people), so its About and tagline could be read
-- straight from the table with the anon key while the page itself said
-- "No one goes by @…".
--
-- Now the public policy mirrors get_location_profile's rule: a real venue, or
-- a real club that opted in. is_public on a venue row means nothing, as
-- before. The admins' own policy is unchanged.
--
-- Policy only: nothing reads these rows that this narrows for (the page goes
-- through get_location_profile, the editor through the admins' policy).
-- ============================================================

drop policy if exists "Anyone reads public location profiles" on public.location_profiles;
create policy "Anyone reads public location profiles"
    on public.location_profiles for select
    to anon, authenticated
    using (
      exists (
        select 1 from public.locations l
         where l.id = location_profiles.location_id
           and not l.is_test
           and (l.kind = 'venue' or (l.kind = 'club' and location_profiles.is_public))
      )
    );
