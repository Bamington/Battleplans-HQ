import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Select, SearchSelect,
  TrashBinMinimalistic, Pen2, ArrowRight,
} from '@battleplans/ui';
import DatePickerInput from './DatePickerInput';
import { formatDateLabel } from '../hooks/useBookingData';
import type { Location, BlockedDate } from '../hooks/useBookingData';

// ── Icons ─────────────────────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatBlockedTables(n: number | null): string {
  if (n === null) return 'All tables blocked';
  return `${n} ${n === 1 ? 'table' : 'tables'} blocked`;
}

// ── BlockedDateItem ───────────────────────────────────────────────────────────

export function BlockedDateItem({ blocked, locations, onChanged }: {
  blocked: BlockedDate;
  locations: Location[];
  onChanged: () => void;
}) {
  const [editOpen,    setEditOpen]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const { location, date, blocked_tables, description } = blocked;
  const isUrl = location.icon?.startsWith('http');

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
          <span className="font-heading text-lg text-white leading-6">{location.name}</span>
          <span className="font-body text-xs text-primary-300 leading-4">{formatBlockedTables(blocked_tables)}</span>
          <span className="font-body text-xs text-neutral-300 leading-4">{formatDateLabel(date)}</span>
          {description && <span className="font-body text-xs text-neutral-300 leading-4">{description}</span>}
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

type BlockMode = 'all' | 'specific';

export function BlockNewDateModal({ open, onClose, locations, editing, defaultLocationId, onSaved }: {
  open: boolean;
  onClose: () => void;
  locations: Location[];
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
  const [blockMode,   setBlockMode]   = useState<BlockMode>('all');
  const [tableCount,  setTableCount]  = useState('');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Populate the form when opened: from the edited record, or reset to defaults
  // (pre-selecting the caller's default / the sole venue).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLocationId(editing.location.id);
      setDate(editing.date);
      setBlockMode(editing.blocked_tables === null ? 'all' : 'specific');
      setTableCount(editing.blocked_tables === null ? '' : String(editing.blocked_tables));
      setDescription(editing.description ?? '');
    } else {
      setLocationId(initialLocationId);
      setDate(''); setBlockMode('all'); setTableCount(''); setDescription('');
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const specific    = blockMode === 'specific';
  const tableCountN = Number(tableCount);
  const tableCountOk = !specific || (Number.isInteger(tableCountN) && tableCountN > 0);
  const canSubmit   = !!locationId && !!date && tableCountOk;

  const handleClose = () => {
    if (saving) return;
    setLocationId(initialLocationId);
    setDate(''); setBlockMode('all'); setTableCount(''); setDescription('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const payload = {
      location_id:    locationId,
      date,
      blocked_tables: specific ? tableCountN : null,
      description:    description.trim() || null,
    };
    const { error: err } = isEdit
      ? await supabase.from('blocked_dates').update(payload).eq('id', editing!.id)
      : await supabase.from('blocked_dates').insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">{isEdit ? 'Edit Blocked Date' : 'Block New Date'}</h2>
          <p className="font-body text-base text-neutral-300">
            {isEdit ? 'Update this blocked date.' : 'Make a date unbookable at your venue.'}
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
          label="Date"
          value={date}
          min={today}
          onChange={setDate}
        />

        <Select
          label="Blocking Options"
          value={blockMode}
          onChange={e => setBlockMode(e.target.value as BlockMode)}
        >
          <option value="all">Block all tables</option>
          <option value="specific">Block specific number of tables</option>
        </Select>

        {specific && (
          <Input
            label="Number of Tables Blocked"
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 3"
            value={tableCount}
            onChange={e => setTableCount(e.target.value)}
          />
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
