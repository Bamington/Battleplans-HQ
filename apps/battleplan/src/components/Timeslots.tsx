import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Badge,
  TrashBinMinimalistic, Pen2, ArrowRight,
} from '@battleplans/ui';
import { formatBookingTime } from '../hooks/useBookingData';
import type { LocationTimeslot } from '../hooks/useBookingData';

// ── Icons / day helpers ───────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

// Availability stores full day names (matching the booking queries). We present
// them Monday-first and badge them with a three-letter abbreviation.
const DAYS: { full: string; abbr: string }[] = [
  { full: 'Monday',    abbr: 'Mon' },
  { full: 'Tuesday',   abbr: 'Tue' },
  { full: 'Wednesday', abbr: 'Wed' },
  { full: 'Thursday',  abbr: 'Thu' },
  { full: 'Friday',    abbr: 'Fri' },
  { full: 'Saturday',  abbr: 'Sat' },
  { full: 'Sunday',    abbr: 'Sun' },
];
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── TimeslotItem ──────────────────────────────────────────────────────────────

export function TimeslotItem({ timeslot, onEdit, onChanged }: {
  timeslot: LocationTimeslot;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [futureCount, setFutureCount] = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const days = DAYS.filter(d => timeslot.availability?.includes(d.full)).map(d => d.abbr);

  const openDelete = async () => {
    setError(null);
    setFutureCount(null);
    setConfirmOpen(true);
    // Warn if upcoming bookings use this slot — but still allow the delete.
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('timeslot_id', timeslot.id)
      .gte('date', localToday());
    setFutureCount(count ?? 0);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const { error: delErr } = await supabase.from('timeslots').delete().eq('id', timeslot.id);
    setDeleting(false);
    if (delErr) { setError(delErr.message); return; }
    setConfirmOpen(false);
    onChanged();
  };

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-start shadow-md">

        {/* Text block */}
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <span className="font-heading text-lg text-white leading-6 truncate">{timeslot.name}</span>
          <span className="font-body text-sm text-neutral-50 leading-5">{formatBookingTime(timeslot)}</span>
          {days.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {days.map(d => <Badge key={d} color="primary" size="sm">{d}</Badge>)}
            </div>
          )}
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
          <DropdownItem icon={<Pen2 className="w-4 h-4" />} onClick={onEdit}>
            Edit Timeslot
          </DropdownItem>
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            onClick={openDelete}
          >
            <span className="text-red-400">Delete Timeslot</span>
          </DropdownItem>
        </Dropdown>

      </div>

      {/* Delete confirmation */}
      <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Delete Timeslot</h2>
          <p className="font-body text-base text-neutral-300">
            “{timeslot.name}” will be removed and its times will no longer be bookable.
          </p>
          {futureCount != null && futureCount > 0 && (
            <p className="font-body text-sm text-yellow-400">
              {futureCount} upcoming {futureCount === 1 ? 'booking uses' : 'bookings use'} this timeslot and may be affected.
            </p>
          )}
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
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

// ── TimeslotFormModal (add / edit) ────────────────────────────────────────────

const timeInputClass =
  'block w-full px-3 py-2.5 text-sm font-body rounded-lg border transition-colors ' +
  'border-neutral-600 bg-neutral-700 text-white focus:ring-1 focus:ring-primary-500 ' +
  'focus:border-primary-500 focus:outline-none [color-scheme:dark]';

export function TimeslotFormModal({ open, onClose, locationId, editing, onSaved }: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  editing?: LocationTimeslot | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;

  const [name,   setName]   = useState('');
  const [start,  setStart]  = useState('18:00');
  const [end,    setEnd]    = useState('21:00');
  const [days,   setDays]   = useState<string[]>([]);   // full names
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setStart(editing.start_time.slice(0, 5));   // "HH:MM:SS" -> "HH:MM"
      setEnd(editing.end_time.slice(0, 5));
      setDays(editing.availability ?? []);
    } else {
      setName(''); setStart('18:00'); setEnd('21:00'); setDays([]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const toggleDay = (full: string) =>
    setDays(ds => ds.includes(full) ? ds.filter(d => d !== full) : [...ds, full]);

  const canSubmit = !!name.trim() && !!start && !!end && days.length > 0 && !!locationId && !saving;

  const handleClose = () => { if (!saving) onClose(); };

  const handleSave = async () => {
    setError(null);
    if (end <= start) { setError('End time must be after the start time.'); return; }

    setSaving(true);
    // Preserve the day order rather than click order.
    const availability = DAYS.filter(d => days.includes(d.full)).map(d => d.full);
    const payload = {
      name:         name.trim(),
      start_time:   `${start}:00`,
      end_time:     `${end}:00`,
      availability,
    };

    const { error: saveErr } = editing
      ? await supabase.from('timeslots').update(payload).eq('id', editing.id)
      : await supabase.from('timeslots').insert({ ...payload, location_id: locationId });

    setSaving(false);
    if (saveErr) { setError(saveErr.message); return; }
    onSaved();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">{isEdit ? 'Edit Timeslot' : 'New Timeslot'}</h2>
          <p className="font-body text-base text-neutral-300">When your tables are available to be booked.</p>
        </div>

        <Input
          label="Name"
          type="text"
          placeholder="e.g. Evening"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={saving}
        />

        <div className="flex gap-3">
          <div className="flex flex-col gap-2 flex-1">
            <label className="block text-sm font-medium font-body text-white">Start Time</label>
            <input type="time" className={timeInputClass} value={start} disabled={saving}
              onChange={e => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <label className="block text-sm font-medium font-body text-white">End Time</label>
            <input type="time" className={timeInputClass} value={end} disabled={saving}
              onChange={e => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium font-body text-white">Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => {
              const on = days.includes(d.full);
              return (
                <button
                  key={d.full}
                  type="button"
                  disabled={saving}
                  aria-pressed={on}
                  onClick={() => toggleDay(d.full)}
                  className={[
                    'px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-colors',
                    on
                      ? 'bg-primary-900 text-primary-200 border border-primary-700'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white',
                  ].join(' ')}
                >
                  {d.abbr}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" color="secondary" size="sm" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            size="sm"
            loading={saving}
            disabled={!canSubmit}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleSave}
          >
            {isEdit ? 'Save' : 'Add Timeslot'}
          </Button>
        </div>

      </div>
    </Modal>
  );
}
