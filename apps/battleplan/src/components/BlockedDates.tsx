import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Select, SearchSelect, Badge, Checkbox,
  TrashBinMinimalistic, Pen2, ArrowRight,
} from '@battleplans/ui';
import DatePickerInput from './DatePickerInput';
import { formatDateLabel } from '../hooks/useBookingData';
import type {
  Location, BlockedDate, BlockRecurrence, BlockTableScope, StoreTable,
} from '../hooks/useBookingData';

/** Local YYYY-MM-DD — toISOString would shift the day either side of UTC. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Which tables a block covers, named where possible.
 *
 * `tables` is the venue's current table list; a block can reference a table
 * that has since been deleted, so anything unresolved is counted rather than
 * dropped — "3 tables blocked" is still true, and quietly showing 2 would not be.
 */
export function formatBlockedTables(
  block:  { table_scope: BlockTableScope; tableIds: string[] },
  tables: StoreTable[] = [],
): string {
  if (block.table_scope === 'all') return 'All tables blocked';
  if (block.tableIds.length === 0) return 'No tables blocked';

  const byId    = new Map(tables.map(t => [t.id, t.name]));
  const named   = block.tableIds.map(id => byId.get(id)).filter(Boolean) as string[];
  const unknown = block.tableIds.length - named.length;

  if (named.length === 0) {
    return `${unknown} ${unknown === 1 ? 'table' : 'tables'} blocked`;
  }

  const list = named.length <= 3
    ? named.join(', ')
    : `${named.slice(0, 3).join(', ')} +${named.length - 3} more`;
  return unknown > 0 ? `${list} +${unknown} more` : `${list} blocked`;
}

/** Week order, so 'Friday, Monday' always reads 'Monday, Friday'. */
const WEEK_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

/** 1 → '', 2 → '2nd ', 3 → '3rd ', 4 → '4th ' — the gap in "every ___ Friday". */
function ordinalPrefix(n: number): string {
  if (n <= 1) return '';
  const suffix = n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} `;
}

/**
 * Which occurrence of a weekday a monthly rule means.
 *
 * -1 is "last", not "fifth". A fifth Friday exists in some months and not
 * others, so a rule counting to five would skip most of the year, while "last"
 * is what a club actually means and always resolves.
 */
const WEEK_OF_MONTH_LABELS: Record<number, string> = {
  1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', [-1]: 'Last',
};

/** The picker's own order — "Last" belongs at the end, not before "First". */
const WEEK_OF_MONTH_OPTIONS = [1, 2, 3, 4, -1] as const;

/** '2026-08-15' → '15/08/26', for the compact end-date suffix. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * When this block bites, in one line: a date for a one-off, or the pattern and
 * its end for a series.
 */
export function describeBlockSchedule(b: {
  date: string;
  recurrence: string;
  interval_weeks: number;
  days_of_week: string[];
  week_of_month?: number | null;
  until_date: string | null;
}): string {
  if (b.recurrence !== 'weekly' && b.recurrence !== 'monthly') return formatDateLabel(b.date);

  const days = WEEK_DAYS.filter(d => b.days_of_week.includes(d));
  const list =
    days.length === 0 ? 'day'
  : days.length === 1 ? days[0]
  : `${days.slice(0, -1).join(', ')} & ${days[days.length - 1]}`;

  // "First Friday of the month" reads as the whole pattern, so it does not take
  // the "Every ___" opening the weekly rule needs.
  const pattern = b.recurrence === 'monthly'
    ? `${WEEK_OF_MONTH_LABELS[b.week_of_month ?? 1] ?? 'First'} ${list} of the month`
    : `Every ${ordinalPrefix(b.interval_weeks)}${list}`;

  return b.until_date ? `${pattern}, until ${shortDate(b.until_date)}` : pattern;
}

// ── BlockedDateItem ───────────────────────────────────────────────────────────

export function BlockedDateItem({ blocked, locations, tables = [], onChanged }: {
  blocked: BlockedDate;
  locations: Location[];
  /** The venue's tables, so the block can name what it covers. */
  tables?: StoreTable[];
  onChanged: () => void;
}) {
  const [editOpen,    setEditOpen]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const { location, date, description, recurrence, hostHandle } = blocked;
  const isUrl     = location.icon?.startsWith('http');
  const recurring = recurrence !== 'none';

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('blocked_dates').delete().eq('id', blocked.id);
    setDeleting(false);
    if (!error) { setConfirmOpen(false); onChanged(); }
  };

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-center shadow-md">

        {/* Store icon thumbnail */}
        <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
          {isUrl
            ? <img src={location.icon} alt={location.name} className="w-full h-full object-cover" />
            : location.icon
              ? <span className="text-3xl leading-none">{location.icon}</span>
              : <span className="font-heading text-white text-lg">{location.name[0]?.toUpperCase()}</span>}
        </div>

        {/* Text block */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* The event, not the venue. This list only ever shows one venue's
              blocks, so its name on every row said nothing — while the thing
              that actually distinguishes them, the event the tables are held
              for, was buried at the bottom. A pack's block carries the pack
              name here (syncPackBlocks writes it); a venue's own block carries
              whatever reason was typed. Falls back to the venue rather than
              rendering a headless row when neither was given. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-heading text-lg text-white leading-6">{description || location.name}</span>
            {recurring && <Badge color="primary" size="sm">Repeats</Badge>}
          </div>
          <span className="font-body text-xs text-primary-300 leading-4">{formatBlockedTables(blocked, tables)}</span>
          <span className="font-body text-xs text-neutral-300 leading-4">{describeBlockSchedule(blocked)}</span>
          {/* A series' start only matters once it's in the future; saying
              "from" a date that has passed is noise. */}
          {recurring && date > localToday() && (
            <span className="font-body text-xs text-neutral-400 leading-4">Starting {formatDateLabel(date)}</span>
          )}
          {/* Who holds the tables, when that is not the person reading. A club
              or TO can block a venue's tables for its own event, and the
              venue's admins should be able to see whose event it is without
              opening anything. Silent for your own blocks. */}
          {hostHandle && <span className="font-body text-xs text-neutral-400 leading-4">@{hostHandle}</span>}
        </div>

        {/* 3-dot menu */}
        <Dropdown
          align="right"
          trigger={
            <button type="button" className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0">
              <MenuDotsIcon />
            </button>
          }
        >
          <DropdownItem
            icon={<Pen2 className="w-4 h-4" />}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </DropdownItem>
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            onClick={() => setConfirmOpen(true)}
          >
            <span className="text-red-400">Delete</span>
          </DropdownItem>
        </Dropdown>

      </div>

      {/* Edit modal */}
      <BlockNewDateModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        locations={locations}
        tables={tables}
        editing={blocked}
        onSaved={() => { setEditOpen(false); onChanged(); }}
      />

      {/* Delete confirmation modal */}
      <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Delete Blocked Date</h2>
          <p className="font-body text-base text-neutral-300">
            This date will become bookable again at {location.name}.
          </p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              loading={deleting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleDelete}
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── BlockNewDateModal ─────────────────────────────────────────────────────────

export function BlockNewDateModal({ open, onClose, locations, tables = [], editing, defaultLocationId, onSaved }: {
  open: boolean;
  onClose: () => void;
  locations: Location[];
  /** The venue's tables, to choose from. */
  tables?: StoreTable[];
  editing?: BlockedDate | null;
  /** Pre-selected venue for new blocks (still switchable). Ignored when editing. */
  defaultLocationId?: string;
  onSaved: () => void;
}) {
  const singleVenue = locations.length === 1;
  const isEdit      = !!editing;

  // Fallback venue for new blocks: the caller's default, else the sole venue.
  const initialLocationId = defaultLocationId ?? (singleVenue && locations[0] ? locations[0].id : '');

  const [locationId,  setLocationId]  = useState('');
  const [date,        setDate]        = useState('');
  const [tableScope,  setTableScope]  = useState<BlockTableScope>('all');
  const [tableIds,    setTableIds]    = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Recurrence
  const [recurrence, setRecurrence] = useState<BlockRecurrence>('none');
  const [interval,   setInterval]   = useState('1');
  const [days,       setDays]       = useState<string[]>([]);
  const [weekOfMonth, setWeekOfMonth] = useState('1');
  const [untilDate,  setUntilDate]  = useState('');

  const today = localToday();

  // Populate the form when opened: from the edited record, or reset to defaults
  // (pre-selecting the caller's default / the sole venue).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLocationId(editing.location.id);
      setDate(editing.date);
      setTableScope(editing.table_scope ?? 'all');
      setTableIds(editing.tableIds ?? []);
      setDescription(editing.description ?? '');
      setRecurrence(editing.recurrence ?? 'none');
      setInterval(String(editing.interval_weeks ?? 1));
      setDays(editing.days_of_week ?? []);
      setWeekOfMonth(String(editing.week_of_month ?? 1));
      setUntilDate(editing.until_date ?? '');
    } else {
      setLocationId(initialLocationId);
      setDate(''); setTableScope('all'); setTableIds([]); setDescription('');
      setRecurrence('none'); setInterval('1'); setDays([]); setUntilDate('');
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const selecting = tableScope === 'selected';
  // A "selected" block naming nothing would block nothing while looking like
  // it blocks something.
  const tablesOk  = !selecting || tableIds.length > 0;

  const toggleTable = (id: string) =>
    setTableIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const repeats  = recurrence !== 'none';
  const monthly  = recurrence === 'monthly';
  // A weekly rule with no days would block nothing while looking like it does,
  // so it can't be saved. The database refuses it too.
  const daysOk   = !repeats || days.length > 0;
  const untilOk  = !repeats || !untilDate || untilDate >= date;
  const canSubmit = !!locationId && !!date && tablesOk && daysOk && untilOk;

  const toggleDay = (d: string) =>
    setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]);

  const handleClose = () => {
    if (saving) return;
    setLocationId(initialLocationId);
    setDate(''); setTableScope('all'); setTableIds([]); setDescription('');
    setRecurrence('none'); setInterval('1'); setDays([]); setUntilDate('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const chosen = selecting ? tableIds : [];
    const payload = {
      location_id:    locationId,
      date,
      table_scope:    tableScope,
      // Legacy mirror. Production still computes capacity from this column, so
      // it has to stay truthful until 2.15 is everywhere. See 20260812030000.
      blocked_tables: selecting ? chosen.length : null,
      description:    description.trim() || null,
      recurrence,
      // Kept consistent with the scope: a one-off carries no schedule, so
      // switching a rule back to "does not repeat" clears its pattern rather
      // than leaving orphaned days behind for the next edit to resurrect.
      // Weeks are how a weekly rule counts and not how a monthly one does, so
      // a monthly rule pins this to 1 rather than carrying a number nothing
      // reads. The database refuses anything else.
      interval_weeks: recurrence === 'weekly' ? Math.max(1, Number(interval) || 1) : 1,
      days_of_week:   repeats ? WEEK_DAYS.filter(d => days.includes(d)) : [],
      week_of_month:  monthly ? Number(weekOfMonth) : null,
      until_date:     repeats && untilDate ? untilDate : null,
    };
    // The block row first — its id is what the table rows hang off.
    const { data, error: err } = isEdit
      ? await supabase.from('blocked_dates').update(payload).eq('id', editing!.id).select('id').single()
      : await supabase.from('blocked_dates').insert(payload).select('id').single();

    if (err || !data) { setSaving(false); setError(err?.message ?? 'Could not save this block.'); return; }
    const blockId = (data as { id: string }).id;

    // Replace the selection wholesale rather than diffing it: the set is a
    // handful of rows, and a delete-then-insert can't leave a table linked
    // that the admin just unticked.
    const { error: delErr } = await supabase
      .from('blocked_date_tables').delete().eq('blocked_date_id', blockId);
    if (delErr) { setSaving(false); setError(delErr.message); return; }

    if (chosen.length > 0) {
      const { error: linkErr } = await supabase
        .from('blocked_date_tables')
        .insert(chosen.map(id => ({ blocked_date_id: blockId, table_id: id })));
      if (linkErr) { setSaving(false); setError(linkErr.message); return; }
    }

    setSaving(false);
    onSaved();
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">{isEdit ? 'Edit Blocked Date' : 'Block New Date'}</h2>
          <p className="font-body text-base text-neutral-300">
            {isEdit
              ? 'Update this block. Changes apply to every future occurrence.'
              : 'Make a date unbookable — once, or on a repeating schedule.'}
          </p>
        </div>

        {!singleVenue && (
          <SearchSelect
            label="Location"
            placeholder="Choose a Venue"
            searchPlaceholder="Search venues…"
            value={locationId}
            onChange={setLocationId}
            emptyLabel="No venues match your search."
            options={locations.map(l => {
              const isUrl = l.icon?.startsWith('http');
              return {
                value: l.id,
                label: l.name,
                icon: (
                  <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
                    {isUrl
                      ? <img src={l.icon} alt="" className="w-full h-full object-cover" />
                      : l.icon
                        ? <span className="text-base leading-none">{l.icon}</span>
                        : <span className="font-body text-xs font-bold text-primary-300 uppercase">{l.name[0]}</span>}
                  </span>
                ),
              };
            })}
          />
        )}

        <DatePickerInput
          label={repeats ? 'Starting From' : 'Date'}
          value={date}
          // An existing series keeps its original start, which is now in the
          // past; clamping to today would silently move it on the next save.
          min={repeats && editing ? undefined : today}
          onChange={setDate}
        />

        <Select
          label="Repeats"
          value={recurrence}
          onChange={e => setRecurrence(e.target.value as BlockRecurrence)}
        >
          <option value="none">Does not repeat</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </Select>

        {repeats && (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-neutral-800 border border-neutral-700">

            {monthly ? (
              /* Which occurrence of the chosen weekday, not which date. "The
                 12th" drifts across the week and is almost never what a club
                 night means. */
              <Select
                label="Which Week"
                value={weekOfMonth}
                onChange={e => setWeekOfMonth(e.target.value)}
              >
                {/* Bare ordinals, not "First of the month" — that reads as the
                    1st. The summary below spells the whole rule out once the
                    day is picked, which is where the ambiguity actually goes. */}
                {WEEK_OF_MONTH_OPTIONS.map(n => (
                  <option key={n} value={String(n)}>{WEEK_OF_MONTH_LABELS[n]}</option>
                ))}
              </Select>
            ) : (
              <Select
                label="How Often"
                value={interval}
                onChange={e => setInterval(e.target.value)}
              >
                <option value="1">Every week</option>
                <option value="2">Every 2nd week</option>
                <option value="3">Every 3rd week</option>
                <option value="4">Every 4th week</option>
              </Select>
            )}

            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium font-body text-white">Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map(d => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={saving}
                      aria-pressed={on}
                      onClick={() => toggleDay(d)}
                      className={[
                        'px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-colors',
                        on
                          ? 'bg-primary-900 text-primary-200 border border-primary-700'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white',
                      ].join(' ')}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {!daysOk && (
                <p className="font-body text-xs text-yellow-400">
                  Pick at least one day, or this rule would block nothing.
                </p>
              )}
            </div>

            <DatePickerInput
              label="Until (Optional)"
              value={untilDate}
              min={date || today}
              onChange={setUntilDate}
            />
            {!untilOk && (
              <p className="font-body text-xs text-yellow-400">
                The end date can't be before the start date.
              </p>
            )}
            {untilOk && !untilDate && (
              <p className="font-body text-xs text-neutral-400">
                Leave blank to repeat until you delete this block.
              </p>
            )}

            {/* The rule in one sentence, from the same function the saved block
                is described by — so what is confirmed here is exactly what the
                list will say afterwards. It is also where "First" stops being
                ambiguous, because the day is named alongside it. */}
            {daysOk && (
              <p className="font-body text-sm text-white border-t border-neutral-700 pt-3">
                {describeBlockSchedule({
                  date,
                  recurrence,
                  interval_weeks: Number(interval) || 1,
                  days_of_week:   days,
                  week_of_month:  monthly ? Number(weekOfMonth) : null,
                  until_date:     untilDate || null,
                })}
              </p>
            )}

          </div>
        )}

        <Select
          label="Which Tables"
          value={tableScope}
          onChange={e => setTableScope(e.target.value as BlockTableScope)}
        >
          <option value="all">Block all tables</option>
          <option value="selected">Block specific tables</option>
        </Select>

        {selecting && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-neutral-800 border border-neutral-700">
            {tables.length === 0 ? (
              <p className="font-body text-sm text-yellow-400">
                This venue has no tables yet — add some before blocking individual ones.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium font-body text-white">Tables</label>
                  <button
                    type="button"
                    disabled={saving}
                    className="font-body text-xs text-primary-300 hover:text-primary-200 transition-colors"
                    onClick={() => setTableIds(
                      tableIds.length === tables.length ? [] : tables.map(t => t.id)
                    )}
                  >
                    {tableIds.length === tables.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>

                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {tables.map(t => (
                    <Checkbox
                      key={t.id}
                      label={
                        <span className="flex items-center gap-2">
                          <span>{t.name}</span>
                          {/* Free text now, so an unlabelled table simply has
                              no badge instead of being called Wargaming. */}
                          {t.label?.trim() && (
                            <Badge color="gray" size="sm">{t.label}</Badge>
                          )}
                          {/* A disabled table takes no bookings anyway, so
                              blocking it changes nothing — say so rather than
                              let someone think they've done something. */}
                          {!t.enabled && <span className="font-body text-xs text-neutral-500">disabled</span>}
                        </span>
                      }
                      checked={tableIds.includes(t.id)}
                      disabled={saving}
                      onChange={() => toggleTable(t.id)}
                    />
                  ))}
                </div>

                {!tablesOk && (
                  <p className="font-body text-xs text-yellow-400">
                    Pick at least one table, or this block would block nothing.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="block-date-description"
            className="block text-sm font-medium font-body text-white"
          >
            Description
          </label>
          <textarea
            id="block-date-description"
            rows={4}
            placeholder="Why is this date blocked? (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto"
          />
        </div>

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" color="danger" size="sm" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            size="sm"
            loading={saving}
            disabled={!canSubmit}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleConfirm}
          >
            {isEdit ? 'Save Changes' : 'Create Blocked Date'}
          </Button>
        </div>

      </div>
    </Modal>
  );
}
