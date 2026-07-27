/**
 * RoundsBreaksForm.tsx — the right panel for the Rounds & Breaks category.
 *
 * The second of the three write paths: `schedule` storage, meaning real rows in
 * `battlepack_schedule_items` rather than jsonb. This one is genuinely
 * relational — the document queries it, the organiser reorders it, and each row
 * is a typed record rather than free text — which is exactly why it earned a
 * table of its own.
 *
 * REORDERING is a single batch renumber, not a shuffle through spare ordinals.
 * The unique constraint on (pack_id, ordinal) is DEFERRABLE INITIALLY DEFERRED,
 * so the transient collision while two rows share a number never surfaces: the
 * check happens at the end of the transaction, by which time the day is
 * consistent again.
 *
 * Rows are optimistic. Dragging a round up and waiting for a round trip before
 * it moves would feel broken, so local order changes immediately and the
 * database catches up; a failure reloads from the row of record.
 */

import { useEffect, useState } from 'react';
import {
  Button, HR, Input, Select, Callout,
  AddCircle, AltArrowDown, AltArrowUp, TrashBinMinimalistic,
} from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import type { ScheduleItem } from '../../lib/packs';
import {
  addScheduleItem, deleteScheduleItem, reorderSchedule, updateScheduleItem,
} from '../../lib/packs';

const KIND_OPTIONS = [
  { value: 'round', label: 'Round' },
  { value: 'break', label: 'Break' },
];

/**
 * The four writes this form makes, injectable so the gallery can drive it from
 * memory. Every other form talks to the database through the editor's
 * `onChange`; this one cannot, because its shape is rows in another table
 * rather than a patch to the pack. Naming the operations is the smallest seam
 * that keeps the component demonstrable without a session — and the ordering
 * logic is the part most worth being able to exercise.
 */
export interface ScheduleOps {
  add: (packId: string, kind: ScheduleItem['kind'], ordinal: number, label: string) => Promise<unknown>;
  update: (id: string, patch: Partial<ScheduleItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (items: ScheduleItem[]) => Promise<void>;
}

const LIVE_OPS: ScheduleOps = {
  add: addScheduleItem,
  update: updateScheduleItem,
  remove: deleteScheduleItem,
  reorder: reorderSchedule,
};

/** What a new row is called, so the organiser rarely has to type a label. */
function defaultLabel(kind: ScheduleItem['kind'], existing: ScheduleItem[]): string {
  if (kind === 'break') return 'Break';
  const rounds = existing.filter(i => i.kind === 'round').length;
  return `Round ${rounds + 1}`;
}

/** `time` columns come back as HH:MM:SS; <input type="time"> wants HH:MM. */
const toTimeInput = (v: string | null) => (v ? v.slice(0, 5) : '');

const RoundsBreaksForm = ({
  pack, schedule, reload, ops = LIVE_OPS,
}: CategoryFormProps & { ops?: ScheduleOps }) => {
  const [items, setItems] = useState<ScheduleItem[]>(schedule);
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  useEffect(() => { setItems(schedule); }, [schedule]);

  /** Run a write, roll the view back to the database on failure. */
  async function persist(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the schedule.');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const add = (kind: ScheduleItem['kind']) =>
    persist(() => ops.add(pack.id, kind, items.length, defaultLabel(kind, items)).then(() => {}));

  const remove = (item: ScheduleItem) =>
    persist(async () => {
      await ops.remove(item.id);
      // Close the gap the deletion leaves, so ordinals stay 0..n-1 and the
      // document's numbering has no holes in it.
      await ops.reorder(items.filter(i => i.id !== item.id));
    });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);                                  // optimistic
    persist(() => ops.reorder(next));
  };

  const patch = (item: ScheduleItem, p: Partial<ScheduleItem>) => {
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...p } : i)));
    persist(() => ops.update(item.id, p));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-body text-sm font-bold text-white">The Day</h3>
        <HR />
      </div>

      {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

      {items.length === 0 && (
        <p className="font-body text-sm text-gray-500">
          Nothing scheduled yet. Not every event has rounds — a narrative or
          campaign day may have none at all, and this category can be removed.
        </p>
      )}

      {items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-2 p-2 bg-gray-800/60 border border-gray-700 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="font-body font-bold text-xs text-gray-500 tabular-nums w-6 shrink-0">
              {String(index).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <Select
                value={item.kind}
                onChange={e => patch(item, { kind: e.target.value as ScheduleItem['kind'] })}
                options={KIND_OPTIONS}
              />
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0 || busy}
                aria-label="Move up"
                className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <AltArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1 || busy}
                aria-label="Move down"
                className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <AltArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                disabled={busy}
                aria-label={`Remove ${item.label ?? 'item'}`}
                className="p-1 rounded text-gray-400 hover:text-red-400 disabled:opacity-30 cursor-pointer"
              >
                <TrashBinMinimalistic className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Input
            size="sm"
            placeholder={item.kind === 'round' ? 'Round 1' : 'Lunch'}
            defaultValue={item.label ?? ''}
            onBlur={e => {
              const label = e.target.value.trim();
              if (label !== (item.label ?? '')) patch(item, { label: label || null });
            }}
          />

          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label="Start time"
              value={toTimeInput(item.starts_at)}
              onChange={e => patch(item, { starts_at: e.target.value || null })}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 font-body text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="font-body text-xs text-gray-500">to</span>
            <input
              type="time"
              aria-label="End time"
              value={toTimeInput(item.ends_at)}
              onChange={e => patch(item, { ends_at: e.target.value || null })}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 font-body text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          leftIcon={<AddCircle className="w-4 h-4" />}
          disabled={busy}
          onClick={() => add('round')}
        >
          Add Round
        </Button>
        <Button
          size="sm"
          variant="outline"
          color="secondary"
          className="flex-1"
          leftIcon={<AddCircle className="w-4 h-4" />}
          disabled={busy}
          onClick={() => add('break')}
        >
          Add Break
        </Button>
      </div>
    </div>
  );
};

export default RoundsBreaksForm;
