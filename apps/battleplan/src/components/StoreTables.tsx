import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Select, Checkbox,
  TrashBinMinimalistic, Pen2, ArrowRight,
} from '@battleplans/ui';
import { formatBookingTime, formatDateLabel, findImpactedBookings } from '../hooks/useBookingData';
import type { StoreTable, TableSize, LocationTimeslot, ImpactedSlot } from '../hooks/useBookingData';

// ── Icons / helpers ───────────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

const SIZE_LABELS: Record<TableSize, string> = {
  wargaming: 'Wargaming',
  tcg:       'TCG',
};

/** Post-change capacity of each timeslot once `table` stops contributing to it. */
function capacityAfter(tsIds: string[], table: StoreTable, allTables: StoreTable[]): Record<string, number> {
  const others = allTables.filter(t => t.id !== table.id);
  const rec: Record<string, number> = {};
  for (const ts of tsIds) rec[ts] = others.filter(t => t.enabled && t.timeslotIds.includes(ts)).length;
  return rec;
}

// ── Impact display ────────────────────────────────────────────────────────────

function ImpactList({ impacted }: { impacted: ImpactedSlot[] }) {
  const total = impacted.reduce((s, i) => s + i.overflow, 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-sm text-red-300">
        {total} upcoming {total === 1 ? 'booking' : 'bookings'} will be left without a table:
      </p>
      <div className="flex flex-col gap-1.5 max-h-[35vh] overflow-y-auto">
        {impacted.map(s => (
          <div key={s.date + s.timeslotId} className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex flex-col gap-0.5">
            <span className="font-heading text-sm text-white">{formatDateLabel(s.date)} · {s.timeLabel}</span>
            <span className="font-body text-xs text-red-300">
              {s.bookingCount} {s.bookingCount === 1 ? 'booking' : 'bookings'}, {s.capacityAfter} {s.capacityAfter === 1 ? 'table' : 'tables'} after this change
            </span>
            <span className="font-body text-xs text-neutral-400 truncate">{s.customers.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactWarningModal({ open, impacted, actionLabel, loading, onConfirm, onCancel }: {
  open: boolean;
  impacted: ImpactedSlot[];
  actionLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !loading && onCancel()} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">Bookings will be affected</h2>
          <p className="font-body text-base text-neutral-300">
            This change reduces table availability. You can still continue — the venue will need to sort out these bookings.
          </p>
        </div>
        <ImpactList impacted={impacted} />
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" size="sm" disabled={loading} onClick={onCancel}>
            Cancel
          </Button>
          <Button color="danger" size="sm" loading={loading} rightIcon={<ArrowRight className="w-4 h-4" />} onClick={onConfirm}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── StoreTableItem ────────────────────────────────────────────────────────────

export function StoreTableItem({ table, allTables, timeslots, locationId, onEdit, onChanged }: {
  table: StoreTable;
  allTables: StoreTable[];
  timeslots: LocationTimeslot[];
  locationId: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<ImpactedSlot[]>([]);
  const [deleting,     setDeleting]     = useState(false);
  const [busy,         setBusy]         = useState(false);
  const [toggleImpact, setToggleImpact] = useState<ImpactedSlot[] | null>(null);

  const applyToggle = async (next: boolean) => {
    setBusy(true);
    const { error } = await supabase.from('store_tables').update({ enabled: next }).eq('id', table.id);
    setBusy(false);
    if (!error) onChanged();
  };

  const handleToggle = async (next: boolean) => {
    // Turning ON only adds capacity — never impacts existing bookings.
    if (next) { applyToggle(true); return; }
    setBusy(true);
    const impacted = await findImpactedBookings(locationId, capacityAfter(table.timeslotIds, table, allTables));
    setBusy(false);
    if (impacted.length === 0) { applyToggle(false); return; }
    setToggleImpact(impacted);
  };

  const openDelete = async () => {
    setDeleteImpact([]);
    setConfirmOpen(true);
    // A disabled table contributes no capacity, so deleting it impacts nothing.
    if (table.enabled) {
      const impacted = await findImpactedBookings(locationId, capacityAfter(table.timeslotIds, table, allTables));
      setDeleteImpact(impacted);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('store_tables').delete().eq('id', table.id);
    setDeleting(false);
    if (!error) { setConfirmOpen(false); onChanged(); }
  };

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-3 items-center shadow-md">

        {/* Text block */}
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-lg text-white leading-6">{table.name}</span>
            <span className="font-body text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">
              {SIZE_LABELS[table.size]}
            </span>
          </div>
          <span className="font-body text-xs text-neutral-300 leading-4">
            Available for {table.timeslotIds.length} of {timeslots.length} {timeslots.length === 1 ? 'timeslot' : 'timeslots'}
          </span>
          <span className={`font-body text-xs leading-4 ${table.enabled ? 'text-green-400' : 'text-neutral-500'}`}>
            {table.enabled ? 'On — bookable' : 'Off — not bookable'}
          </span>
        </div>

        {/* Quick on/off toggle */}
        <Checkbox
          color="green"
          checked={table.enabled}
          disabled={busy}
          onChange={e => handleToggle(e.target.checked)}
          aria-label={`Toggle ${table.name} bookings`}
        />

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
            Edit
          </DropdownItem>
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            onClick={openDelete}
          >
            <span className="text-red-400">Delete</span>
          </DropdownItem>
        </Dropdown>

      </div>

      {/* Turn-off impact warning */}
      <ImpactWarningModal
        open={toggleImpact !== null}
        impacted={toggleImpact ?? []}
        actionLabel="Turn Off Anyway"
        loading={busy}
        onConfirm={async () => { await applyToggle(false); setToggleImpact(null); }}
        onCancel={() => setToggleImpact(null)}
      />

      {/* Delete confirmation modal (with impact, if any) */}
      <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Delete Table</h2>
          <p className="font-body text-base text-neutral-300">
            {table.name} will be removed and can no longer be booked.
          </p>
          {deleteImpact.length > 0 && <ImpactList impacted={deleteImpact} />}
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

// ── TableFormModal (add / edit) ───────────────────────────────────────────────

export function TableFormModal({ open, onClose, locationId, timeslots, allTables, editing, defaultName, onSaved }: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  timeslots: LocationTimeslot[];
  allTables: StoreTable[];
  editing?: StoreTable | null;
  defaultName?: string;
  onSaved: () => void;
}) {
  const isEdit = !!editing;

  const [name,        setName]        = useState('');
  const [size,        setSize]        = useState<TableSize>('wargaming');
  const [enabled,     setEnabled]     = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [editImpact,  setEditImpact]  = useState<ImpactedSlot[] | null>(null);

  // Populate on open: from the edited table, or defaults (new tables start
  // available for every timeslot).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setSize(editing.size);
      setEnabled(editing.enabled);
      setSelectedIds(editing.timeslotIds);
    } else {
      setName(defaultName ?? '');
      setSize('wargaming');
      setEnabled(true);
      setSelectedIds(timeslots.map(t => t.id));
    }
    setError(null);
    setEditImpact(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const toggleTimeslot = (id: string) =>
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const canSubmit = !!name.trim() && !!locationId;

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  // Actual persistence — runs after the impact check (if any) is cleared.
  const doSave = async () => {
    setSaving(true);
    setError(null);

    let tableId = editing?.id;

    if (editing) {
      const { error: updErr } = await supabase.from('store_tables')
        .update({ name: name.trim(), size, enabled })
        .eq('id', editing.id);
      if (updErr) { setError(updErr.message); setSaving(false); return; }
      // Reconcile availability by replacing the whole set.
      const { error: delErr } = await supabase.from('store_table_timeslots')
        .delete().eq('table_id', editing.id);
      if (delErr) { setError(delErr.message); setSaving(false); return; }
    } else {
      const { data, error: insErr } = await supabase.from('store_tables')
        .insert({ location_id: locationId, name: name.trim(), size, enabled })
        .select('id').single();
      if (insErr || !data) { setError(insErr?.message ?? 'Failed to create table.'); setSaving(false); return; }
      tableId = data.id as string;
    }

    if (tableId && selectedIds.length > 0) {
      const rows = selectedIds.map(timeslot_id => ({ table_id: tableId!, timeslot_id }));
      const { error: linkErr } = await supabase.from('store_table_timeslots').insert(rows);
      if (linkErr) { setError(linkErr.message); setSaving(false); return; }
    }

    setSaving(false);
    setEditImpact(null);
    onSaved();
    handleClose();
  };

  const handleSaveClick = async () => {
    if (!canSubmit) return;
    // Only edits can reduce capacity — a brand-new table only adds tables.
    if (editing) {
      // Timeslots this table currently powers but won't after the change.
      const losing = editing.timeslotIds.filter(ts => !(enabled && selectedIds.includes(ts)));
      if (editing.enabled && losing.length > 0) {
        setSaving(true);
        const impacted = await findImpactedBookings(locationId, capacityAfter(losing, editing, allTables));
        setSaving(false);
        if (impacted.length > 0) { setEditImpact(impacted); return; }
      }
    }
    doSave();
  };

  const allSelected = timeslots.length > 0 && selectedIds.length === timeslots.length;

  return (
    <>
      <Modal open={open} onClose={handleClose} className="max-w-md">
        <div className="flex flex-col gap-4 p-5">

          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-xl text-white">{isEdit ? 'Edit Table' : 'Add Table'}</h2>
            <p className="font-body text-base text-neutral-300">
              {isEdit ? 'Update this table.' : 'Add a bookable table to this venue.'}
            </p>
          </div>

          <Input
            label="Name"
            type="text"
            placeholder="e.g. Table 1"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <Select
            label="Size"
            value={size}
            onChange={e => setSize(e.target.value as TableSize)}
          >
            <option value="wargaming">Wargaming</option>
            <option value="tcg">TCG</option>
          </Select>

          <Checkbox
            color="green"
            label="Available for bookings"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium font-body text-white">Timeslot availability</label>
              {timeslots.length > 0 && (
                <button
                  type="button"
                  className="font-body text-xs text-primary-400 hover:text-primary-300"
                  onClick={() => setSelectedIds(allSelected ? [] : timeslots.map(t => t.id))}
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
            {timeslots.length === 0 ? (
              <p className="font-body text-sm text-neutral-500">This venue has no timeslots yet.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto">
                {timeslots.map(ts => (
                  <Checkbox
                    key={ts.id}
                    checked={selectedIds.includes(ts.id)}
                    onChange={() => toggleTimeslot(ts.id)}
                    label={
                      <span className="font-body text-sm text-white">
                        {ts.name} <span className="text-neutral-400">· {formatBookingTime(ts)}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            )}
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
              onClick={handleSaveClick}
            >
              {isEdit ? 'Save Changes' : 'Create Table'}
            </Button>
          </div>

        </div>
      </Modal>

      {/* Edit impact warning */}
      <ImpactWarningModal
        open={editImpact !== null}
        impacted={editImpact ?? []}
        actionLabel="Save Anyway"
        loading={saving}
        onConfirm={() => { setEditImpact(null); doSave(); }}
        onCancel={() => setEditImpact(null)}
      />
    </>
  );
}
