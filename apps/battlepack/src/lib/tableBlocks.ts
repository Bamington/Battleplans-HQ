/**
 * tableBlocks.ts — holding a venue's tables for a published pack.
 *
 * The BattlePack half of the BattlePlan integration. BattlePlan already models
 * a venue closing tables as `blocked_dates` (+ `blocked_date_tables` for the
 * specific-table case); this owns a pack's blocks within that model.
 *
 * TWO THINGS ABOUT THE MODEL, both easy to get wrong:
 *
 * A block is DAY-GRANULAR. There is no timeslot dimension — chosen tables come
 * out for the whole day. Do not add a timeslot picker here expecting it to
 * work; it would need a new join table and a change to the capacity maths in
 * BattlePlan's useBookingData, which is the code deciding whether customers can
 * book at all.
 *
 * `blocked_tables` is a LEGACY MIRROR that production still computes capacity
 * from — see 20260812030000. It has to stay truthful: the count of selected
 * tables, or null when the scope is 'all'. Writing a block without it silently
 * changes what the venue can sell.
 *
 * THE SHAPE IS BUILT FOR MULTI-DAY, though only one date is used today. Every
 * write goes through `syncPackBlocks`, which reconciles the pack's blocks
 * against a SET of dates from `packBlockDates`. Today that set is one date;
 * when multi-day and recurring events land, only `packBlockDates` changes —
 * or it starts emitting a recurrence rule instead, which the reconcile can
 * absorb without callers moving.
 */

import { supabase } from '@battleplans/ui';
import type { Pack } from './packs';

/** BattlePlan's own vocabulary — 'all' or a named subset. */
export type BlockTableScope = 'all' | 'selected';

export interface StoreTableOption {
  id: string;
  name: string;
  enabled: boolean;
}

export interface PackBlock {
  id: string;
  date: string;
  table_scope: BlockTableScope;
  tableIds: string[];
}

/** What the organiser has chosen, or that they have chosen nothing. */
export interface BlockSelection {
  /** Off entirely — the pack holds no tables. */
  enabled: boolean;
  scope: BlockTableScope;
  /** Only meaningful when scope is 'selected'. */
  tableIds: string[];
}

export const NO_BLOCK: BlockSelection = { enabled: false, scope: 'all', tableIds: [] };

/**
 * Which dates a pack occupies its venue on.
 *
 * ONE DATE TODAY. This is the seam the whole file is arranged around: a
 * multi-day event returns each of its days, and a Saturday league eventually
 * returns its occurrences — or is replaced by a recurrence rule, which is the
 * open question. Callers never assume a count, so that decision stays cheap.
 *
 * A pack with no start date occupies nothing. Blocking a venue on a date the
 * organiser has not chosen is worse than not blocking at all.
 */
export function packBlockDates(pack: Pick<Pack, 'starts_on' | 'ends_on' | 'timeline'>): string[] {
  if (!pack.starts_on) return [];
  return [pack.starts_on];
}

/**
 * Whether this venue is run on BattlePlan at all.
 *
 * Not every BattlePack organiser manages their shop's bookings, and offering to
 * close tables at a venue that has none is offering nothing. Enabled tables are
 * the test: a venue with none has nothing a block could take.
 */
export async function locationUsesBattlePlan(locationId: string | null): Promise<boolean> {
  if (!locationId) return false;
  const { count, error } = await supabase
    .from('store_tables')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('enabled', true);
  return !error && (count ?? 0) > 0;
}

/** The venue's bookable tables, for the picker. */
export async function listStoreTables(locationId: string | null): Promise<StoreTableOption[]> {
  if (!locationId) return [];
  const { data, error } = await supabase
    .from('store_tables')
    .select('id, name, enabled')
    .eq('location_id', locationId)
    .eq('enabled', true)
    .order('name');
  if (error) return [];
  return (data ?? []) as StoreTableOption[];
}

/** The blocks this pack currently owns. */
export async function getPackBlocks(packId: string): Promise<PackBlock[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('id, date, table_scope, blocked_date_tables(table_id)')
    .eq('battlepack_id', packId)
    .order('date');
  if (error) return [];

  return (data ?? []).map(row => {
    const r = row as { id: string; date: string; table_scope: BlockTableScope;
                       blocked_date_tables?: { table_id: string }[] | null };
    return {
      id: r.id,
      date: r.date,
      table_scope: r.table_scope,
      tableIds: (r.blocked_date_tables ?? []).map(t => t.table_id),
    };
  });
}

/** What the organiser's current blocks amount to, for showing the panel back. */
export async function readSelection(packId: string): Promise<BlockSelection> {
  const blocks = await getPackBlocks(packId);
  if (blocks.length === 0) return NO_BLOCK;
  const first = blocks[0];
  return { enabled: true, scope: first.table_scope, tableIds: first.tableIds };
}

/**
 * Make the pack's blocks match `selection`, across every date it occupies.
 *
 * RECONCILE, NOT CREATE. Publishing, changing the date, editing the table list
 * and turning blocking off are all the same operation: work out what should
 * exist, then make the database say that. A create-only path would leave the
 * old date blocked the first time somebody moved an event.
 *
 * The pack's own blocks are cleared first and rewritten. That is safe because
 * `battlepack_id` scopes the delete to blocks this pack owns — a venue admin's
 * hand-made blocks have a null battlepack_id and are never touched. Diffing
 * would save a handful of rows and risk exactly that.
 */
export async function syncPackBlocks(
  pack: Pick<Pack, 'id' | 'name' | 'location_id' | 'starts_on' | 'ends_on' | 'timeline'>,
  selection: BlockSelection,
): Promise<void> {
  if (!pack.location_id) return;

  // Only ever this pack's rows. Never a location-wide delete.
  const { error: clearError } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('battlepack_id', pack.id);
  if (clearError) throw clearError;

  if (!selection.enabled) return;

  const dates = packBlockDates(pack);
  if (dates.length === 0) return;

  const selecting = selection.scope === 'selected';
  // Nothing ticked is not a block. Writing scope 'selected' with no tables
  // would take nothing out while looking like it had.
  if (selecting && selection.tableIds.length === 0) return;

  // Who is doing this. A venue admin blocking their own shop does not need to
  // say, but an ORGANISER does: the policy added in 20260814060000 only lets a
  // nominated organiser write a block stamped with themselves, so that the
  // venue can see which person closed its Friday. Without this a TO publishing
  // a pack at a venue they do not own is refused at the last step.
  const { data: auth } = await supabase.auth.getUser();
  const createdBy = auth.user?.id ?? null;

  const rows = dates.map(date => ({
    location_id: pack.location_id,
    created_by: createdBy,
    date,
    // The venue admin sees this in BattlePlan's blocked-dates list, where a
    // bare date with no reason is the thing this integration must not create.
    description: pack.name,
    table_scope: selection.scope,
    // Legacy mirror — production capacity still reads it. See the file header.
    blocked_tables: selecting ? selection.tableIds.length : null,
    recurrence: 'none',
    interval_weeks: 1,
    days_of_week: [] as string[],
    until_date: null,
    battlepack_id: pack.id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('blocked_dates')
    .insert(rows)
    .select('id');
  if (insertError) throw insertError;

  if (!selecting) return;

  const links = (inserted ?? []).flatMap(({ id }: { id: string }) =>
    selection.tableIds.map(table_id => ({ blocked_date_id: id, table_id })),
  );
  if (links.length === 0) return;

  const { error: linkError } = await supabase.from('blocked_date_tables').insert(links);
  if (linkError) throw linkError;
}
