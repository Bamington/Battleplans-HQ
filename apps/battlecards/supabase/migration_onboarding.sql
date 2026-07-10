-- migration_onboarding.sql
--
-- First-run onboarding fields on user_profiles:
--   • username              — a chosen display handle (BattleCards + BattlePlan)
--   • preferred_location_id — default booking location (BattlePlan only)
--
-- Run once in the Supabase SQL editor for the SHARED project
-- (dezjjuumsrpfioyfhyzg) that both apps use.

-- ── 1. Columns ───────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists username              text,
  add column if not exists preferred_location_id uuid
    references public.locations (id) on delete set null;

-- ── 2. Let users update their OWN row ────────────────────────────────────────
-- RLS gate: a user may update only the row whose id matches their uid.

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated
  using      (id = auth.uid())
  with check (id = auth.uid());

-- ── 3. Restrict WHICH columns they can change ────────────────────────────────
-- Column-level privileges stop a user escalating their own role: RLS lets them
-- touch their row, but they may only write these two columns. (Supabase grants
-- table-wide UPDATE to `authenticated` by default, so we narrow it here. Role
-- changes continue to go through the admin security-definer functions.)

revoke update on public.user_profiles from authenticated;
grant  update (username, preferred_location_id) on public.user_profiles to authenticated;
