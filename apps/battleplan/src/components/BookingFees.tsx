import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Select, Badge,
  TrashBinMinimalistic, Pen2, ArrowRight,
} from '@battleplans/ui';
import { formatBookingTime, formatFeeAmount } from '../hooks/useBookingData';
import type { BookingFee, FeeScope, LocationTimeslot } from '../hooks/useBookingData';

// ── Icons ─────────────────────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

/** Column header icon — a price tag, matching the other Manage Store columns. */
export const FeeIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24.6 6H38a4 4 0 0 1 4 4v13.4a4 4 0 0 1-1.17 2.83L25.4 41.66a4 4 0 0 1-5.66 0L6.34 28.26a4 4 0 0 1 0-5.66L21.77 7.17A4 4 0 0 1 24.6 6Z"
      stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <circle cx="33" cy="15" r="3" stroke="currentColor" strokeWidth="2.5"/>
  </svg>
);

// ── Days ──────────────────────────────────────────────────────────────────────

/** Full names, matching timeslots.availability and the fee table's check. */
export const FEE_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** What this rule covers, in the store's own terms. */
export function formatFeeScope(fee: BookingFee, timeslots: LocationTimeslot[]): string {
  if (fee.scope === 'day') return `Every ${fee.day_of_week}`;
  if (fee.scope === 'timeslot') {
    const ts = timeslots.find(t => t.id === fee.timeslot_id);
    return ts ? `${ts.name} (${formatBookingTime(ts)})` : 'One timeslot';
  }
  return 'All bookings';
}

/**
 * Default rule first, then weekdays in week order, then timeslots by name — so
 * the list reads as "here's the venue fee, and here's where it differs".
 */
export function sortFees(fees: BookingFee[], timeslots: LocationTimeslot[]): BookingFee[] {
  const scopeRank: Record<FeeScope, number> = { default: 0, day: 1, timeslot: 2 };
  const tsName = (id: string | null) => timeslots.find(t => t.id === id)?.name ?? '';
  return [...fees].sort((a, b) =>
    scopeRank[a.scope] - scopeRank[b.scope]
    || FEE_DAYS.indexOf(a.day_of_week as typeof FEE_DAYS[number])
       - FEE_DAYS.indexOf(b.day_of_week as typeof FEE_DAYS[number])
    || tsName(a.timeslot_id).localeCompare(tsName(b.timeslot_id))
  );
}

/** "10" / "10.50" → cents. Returns null when the text isn't a usable amount. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, '');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Cents → the plain number the amount input edits ("$10" → "10"). */
function amountToInput(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

// ── BookingFeeItem ────────────────────────────────────────────────────────────

export function BookingFeeItem({ fee, timeslots, hasDefault, onEdit, onChanged }: {
  fee: BookingFee;
  timeslots: LocationTimeslot[];
  /** Whether the venue has a default rule, so deleting an override can say what it falls back to. */
  hasDefault: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const isDefault = fee.scope === 'default';

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const { error: delErr } = await supabase.from('location_booking_fees').delete().eq('id', fee.id);
    setDeleting(false);
    if (delErr) { setError(delErr.message); return; }
    setConfirmOpen(false);
    onChanged();
  };

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-start shadow-md">

        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-lg text-white leading-6">{formatFeeAmount(fee.amount_cents)}</span>
            {isDefault && <Badge color="primary" size="sm">Default</Badge>}
          </div>
          <span className="font-body text-sm text-neutral-50 leading-5">
            {formatFeeScope(fee, timeslots)}
          </span>
          <span className="font-body text-xs text-neutral-300 leading-4 line-clamp-3">{fee.message}</span>
        </div>

        <Dropdown
          align="right"
          trigger={
            <button type="button" className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0">
              <MenuDotsIcon />
            </button>
          }
        >
          <DropdownItem icon={<Pen2 className="w-4 h-4" />} onClick={onEdit}>
            Edit Fee
          </DropdownItem>
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            onClick={() => { setError(null); setConfirmOpen(true); }}
          >
            <span className="text-red-400">Delete Fee</span>
          </DropdownItem>
        </Dropdown>

      </div>

      {/* Delete confirmation */}
      <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Delete Fee</h2>
          <p className="font-body text-base text-neutral-300">
            {isDefault
              ? 'Bookings that aren’t covered by another fee will no longer show a charge.'
              : `“${formatFeeScope(fee, timeslots)}” will fall back to ${hasDefault ? 'your default fee' : 'no fee'}.`}
          </p>
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

// ── BookingFeeFormModal (add / edit) ──────────────────────────────────────────

export function BookingFeeFormModal({
  open, onClose, locationId, timeslots, fees, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  timeslots: LocationTimeslot[];
  /** Existing rules, so the form can hide targets that are already taken. */
  fees: BookingFee[];
  editing?: BookingFee | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;

  const [scope,   setScope]   = useState<FeeScope>('default');
  const [day,     setDay]     = useState<string>('');
  const [tsId,    setTsId]    = useState<string>('');
  const [amount,  setAmount]  = useState('');
  const [message, setMessage] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const hasDefault = fees.some(f => f.scope === 'default');

  // Targets already spoken for. The database enforces this too — catching it
  // here just turns a unique-violation into a sentence the store can act on.
  const takenDays = new Set(
    fees.filter(f => f.scope === 'day' && f.id !== editing?.id).map(f => f.day_of_week)
  );
  const takenTimeslots = new Set(
    fees.filter(f => f.scope === 'timeslot' && f.id !== editing?.id).map(f => f.timeslot_id)
  );

  const availableDays      = FEE_DAYS.filter(d => !takenDays.has(d));
  const availableTimeslots = timeslots.filter(t => !takenTimeslots.has(t.id));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setScope(editing.scope);
      setDay(editing.day_of_week ?? '');
      setTsId(editing.timeslot_id ?? '');
      setAmount(amountToInput(editing.amount_cents));
      setMessage(editing.message ?? '');
    } else {
      // A venue's first rule is almost always its default; once that exists,
      // anything new is an exception, so open on the first free weekday.
      const nextScope: FeeScope = hasDefault ? 'day' : 'default';
      setScope(nextScope);
      setDay(availableDays[0] ?? '');
      setTsId(availableTimeslots[0]?.id ?? '');
      setAmount(''); setMessage('');
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const amountCents = parseAmount(amount);
  const targetOk =
    scope === 'default'  ? (isEdit || !hasDefault)
  : scope === 'day'      ? !!day
  : /* timeslot */         !!tsId;
  // Every rule states its own terms — a fee with no wording can't be saved.
  const messageOk = !!message.trim();
  const canSubmit = amountCents !== null && messageOk && targetOk && !!locationId && !saving;

  const handleClose = () => { if (!saving) onClose(); };

  const handleSave = async () => {
    if (amountCents === null) { setError('Enter a fee amount, like 10 or 10.50.'); return; }
    if (!messageOk) { setError('Write the message players will see for this fee.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      scope,
      day_of_week: scope === 'day'      ? day  : null,
      timeslot_id: scope === 'timeslot' ? tsId : null,
      amount_cents: amountCents,
      message: message.trim(),
    };

    const { error: saveErr } = editing
      ? await supabase.from('location_booking_fees').update(payload).eq('id', editing.id)
      : await supabase.from('location_booking_fees').insert({ ...payload, location_id: locationId });

    setSaving(false);
    if (saveErr) {
      // The partial unique indexes are the backstop for a target that was taken
      // between opening the form and saving it.
      setError(saveErr.code === '23505'
        ? 'There is already a fee for that. Edit the existing one instead.'
        : saveErr.message);
      return;
    }
    onSaved();
  };

  const noTargetsLeft =
    (scope === 'day'      && availableDays.length === 0)
 || (scope === 'timeslot' && availableTimeslots.length === 0);

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">{isEdit ? 'Edit Fee' : 'Add Fee'}</h2>
          <p className="font-body text-base text-neutral-300">
            What players are told they’ll pay to book a table. BattlePlan doesn’t take the payment.
          </p>
        </div>

        <Select
          label="Applies To"
          value={scope}
          disabled={saving}
          onChange={e => setScope(e.target.value as FeeScope)}
        >
          <option value="default" disabled={!isEdit && hasDefault}>
            All bookings{!isEdit && hasDefault ? ' — already set' : ''}
          </option>
          <option value="day">A day of the week</option>
          <option value="timeslot">A single timeslot</option>
        </Select>

        {scope === 'day' && (
          <Select label="Day" value={day} disabled={saving} onChange={e => setDay(e.target.value)}>
            <option value="">{availableDays.length === 0 ? 'Every day already has a fee' : 'Choose a day'}</option>
            {/* `takenDays` excludes the rule being edited, so its own day stays
                selectable rather than vanishing from its own form. */}
            {availableDays.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        )}

        {scope === 'timeslot' && (
          <Select label="Timeslot" value={tsId} disabled={saving} onChange={e => setTsId(e.target.value)}>
            <option value="">
              {timeslots.length === 0
                ? 'Add a timeslot first'
                : availableTimeslots.length === 0
                  ? 'Every timeslot already has a fee'
                  : 'Choose a timeslot'}
            </option>
            {availableTimeslots.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {formatBookingTime(t)}</option>
            ))}
          </Select>
        )}

        <Input
          label="Fee"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="e.g. 10"
          helperText="Enter 0 if this booking is free."
          value={amount}
          disabled={saving}
          onChange={e => setAmount(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="booking-fee-message" className="block text-sm font-medium font-body text-white">
            Message Shown To Players
          </label>
          <textarea
            id="booking-fee-message"
            rows={4}
            required
            aria-required="true"
            disabled={saving}
            placeholder="e.g. Table booking at this store is $10 for 3 hours. If there is no other reservation, you can keep your table longer at no additional cost."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto"
          />
          <p className="font-body text-xs text-neutral-400">
            Required. Shown before a player confirms their booking — spell out what
            this fee covers, including the amount and how long the table is theirs.
          </p>
        </div>

        {noTargetsLeft && !isEdit && (
          <p className="font-body text-sm text-yellow-400">
            {scope === 'day'
              ? 'Every day of the week already has its own fee.'
              : timeslots.length === 0
                ? 'This venue has no timeslots yet — add one before setting a per-timeslot fee.'
                : 'Every timeslot already has its own fee.'}
          </p>
        )}

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
            {isEdit ? 'Save' : 'Add Fee'}
          </Button>
        </div>

      </div>
    </Modal>
  );
}
