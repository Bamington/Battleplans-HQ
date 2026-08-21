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
 * A RECURRING PACK IS ONE ROW, NOT MANY. `blocked_dates` has carried a
 * recurrence rule of its own since 20260812020000, and monthly since
 * 20260821000000 — the same columns, the same weekday names, the same -1-is-
 * last convention as a pack. So a Friday night that runs until December writes
 * one recurring block rather than seventeen dated ones, and the two stay in
 * step because they are the same rule copied across, not two calculations of
 * the same Fridays.
 *
 * A LEAGUE HOLDS NOTHING. Chris's call: its games are self-organised over
 * weeks, so closing the venue for the whole span would take out every table
 * for months to hold them for nobody in particular.
 */

import { supabase } from '@battleplans/ui';
import type { Pack, PackRecurrence } from './packs';

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

/** The columns a `blocked_dates` row needs to say when it applies. */
export interface BlockWhen {
  date: string;
  recurrence: PackRecurrence;
  interval_weeks: number;
  days_of_week: string[];
  week_of_month: number | null;
  until_date: string | null;
}

/** A pack whose table hold can be worked out. The envelope, plus the rule. */
export type BlockablePack = Pick<Pack,
  'starts_on' | 'ends_on' | 'schedule_shape' |
  'recurrence' | 'interval_weeks' | 'days_of_week' | 'week_of_month' | 'until_date'>;

/**
 * When a pack occupies its venue — as `blocked_dates` rows, not as dates.
 *
 * Three answers, and which one it is matters more than the count:
 *
 * - **A league: nothing.** See the file header.
 * - **A recurring pack: one recurring row**, its rule copied straight across.
 *   Never an expanded list of dates — the venue admin looking at their blocked
 *   dates should see "every Friday until December", which is what it is, and a
 *   pack that later runs a fortnight longer should move one row.
 * - **Anything else: one row per day it runs**, which is one for a one-day
 *   event and several for a tournament that spans a weekend.
 *
 * A pack with no start date occupies nothing. Blocking a venue on a date the
 * organiser has not chosen is worse than not blocking at all.
 */
export function packBlockWhen(pack: BlockablePack): BlockWhen[] {
  if (!pack.starts_on) return [];
  if (pack.schedule_shape === 'periods') return [];

  if (pack.recurrence !== 'none') {
    return [{
      date:           pack.starts_on,
      recurrence:     pack.recurrence,
      interval_weeks: pack.interval_weeks,
      days_of_week:   pack.days_of_week,
      week_of_month:  pack.week_of_month,
      until_date:     pack.until_date,
    }];
  }

  return packBlockDates(pack).map(date => ({
    date,
    recurrence: 'none' as PackRecurrence,
    interval_weeks: 1,
    days_of_week: [] as string[],
    week_of_month: null,
    until_date: null,
  }));
}

/**
 * The days a NON-recurring pack runs on, first to last.
 *
 * Every day of a multi-day event, because a tournament that spans a weekend
 * occupies the venue on both — the envelope's two ends are the same two ends
 * the days have. Capped, so a pack whose end date was typed as 2027 cannot
 * write a year of blocks.
 */
export function packBlockDates(pack: Pick<Pack, 'starts_on' | 'ends_on'>): string[] {
  if (!pack.starts_on) return [];
  if (!pack.ends_on || pack.ends_on <= pack.starts_on) return [pack.starts_on];

  const out: string[] = [];
  const last = new Date(`${pack.ends_on}T12:00:00`);
  for (let d = new Date(`${pack.starts_on}T12:00:00`); d <= last && out.length < 31; d.setDate(d.getDate() + 1)) {
    const pad = (n: number) => String(n).padStart(2, '0');
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return out;
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
  pack: BlockablePack & Pick<Pack, 'id' | 'name' | 'location_id'>,
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

  const when = packBlockWhen(pack);
  if (when.length === 0) return;

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

  const rows = when.map(w => ({
    location_id: pack.location_id,
    created_by: createdBy,
    // The venue admin sees this in BattlePlan's blocked-dates list, where a
    // bare date with no reason is the thing this integration must not create.
    description: pack.name,
    table_scope: selection.scope,
    // Legacy mirror — production capacity still reads it. See the file header.
    blocked_tables: selecting ? selection.tableIds.length : null,
    battlepack_id: pack.id,
    ...w,
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
