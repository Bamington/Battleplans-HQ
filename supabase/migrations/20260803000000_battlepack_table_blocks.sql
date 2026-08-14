-- 20260803000000_battlepack_table_blocks.sql
--
-- Let a published BattlePack hold tables at its venue.
--
-- An event occupies a shop. BattlePlan already models that as `blocked_dates`
-- with `blocked_date_tables` for the specific-table case, so this does not
-- invent a mechanism — it gives an existing one an owner.
--
-- NO NEW WRITE POLICY IS NEEDED, which is worth stating so nobody adds one.
-- `blocked_dates` is already writable by a location's admins, and a pack can
-- only be created by an admin of the location it names. The person publishing
-- is by construction someone who could already block that venue's tables by
-- hand; this just saves them doing it twice.
--
-- OWNERSHIP IS THE POINT. Without the link, publishing an event would scatter
-- blocks that nobody could trace back — a venue admin months later finding
-- their Saturday closed with a description and no reason. The FK makes the pack
-- responsible for its own block, and lets BattlePlan say where a block came
-- from.
--
-- ON DELETE CASCADE, not SET NULL. A block exists because an event does. Delete
-- the pack and the block should go with it, not linger as an orphan holding a
-- venue closed for something that is not happening.
--
-- Idempotent: safe to re-run.

alter table public.blocked_dates
  add column if not exists battlepack_id uuid references public.battlepacks (id) on delete cascade;

comment on column public.blocked_dates.battlepack_id is
  'The BattlePack that created this block, when one did. NULL for blocks a venue admin made by hand. CASCADE: the block exists because the event does.';

-- The trigger below and BattlePlan both look blocks up by pack.
create index if not exists blocked_dates_battlepack_id_idx
  on public.blocked_dates (battlepack_id)
  where battlepack_id is not null;

-- ── Unpublishing releases the tables ─────────────────────────────────────────
--
-- In a trigger rather than in the client, deliberately. Unpublishing is one
-- UPDATE from the browser; if the tab closes between that and a follow-up
-- delete, the venue stays closed for an event that is no longer running and
-- nothing will ever correct it. The database is the half that cannot be
-- interrupted.
--
-- Deletion is handled by the FK's CASCADE, so this only has to care about the
-- status transition.

create or replace function public.battlepack_release_tables()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when it LEAVES published. Editing a published pack must not disturb
  -- the block the organiser has already tuned.
  if old.status = 'published' and new.status is distinct from 'published' then
    delete from public.blocked_dates where battlepack_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists battlepack_release_tables_trigger on public.battlepacks;

create trigger battlepack_release_tables_trigger
  after update of status on public.battlepacks
  for each row
  execute function public.battlepack_release_tables();

comment on function public.battlepack_release_tables() is
  'Drops a pack''s table blocks when it stops being published. In the database rather than the client so a closed tab cannot leave a venue blocked for an event that is not running.';

-- ── Venue staff can SEE their venue's packs ──────────────────────────────────
--
-- BattlePlan's store view is about to carry an Upcoming Events column, and the
-- people who most need to know an event is coming are the ones working the
-- counter. Staff are not admins — they cannot create, edit or publish a pack —
-- but they should not be the last to hear that Saturday is booked out.
--
-- READ ONLY, and only that. `is_location_staff` is the same check the rest of
-- BattlePlan uses for counter bookings, so staff access has one definition.
--
-- The owner-drafts case is NOT handled here. A pack's own creator is already an
-- admin of its location — that is enforced at insert — so they can read it
-- through the admin branch. "You only see your own drafts" is a filter the
-- column applies, not a permission: staff at a venue can already read every
-- pack there, and pretending otherwise in the client would be theatre.

drop policy if exists "Store admins read their packs" on public.battlepacks;

create policy "Store admins and staff read their packs"
    ON public.battlepacks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations l
            WHERE l.id = battlepacks.location_id
              AND l.admins @> ARRAY[auth.uid()]
        )
        OR public.is_location_staff(battlepacks.location_id)
    );
