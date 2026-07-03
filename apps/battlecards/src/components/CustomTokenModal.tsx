/**
 * CustomTokenModal.tsx — Create / edit a User-Created Token (UCT)
 *
 * Opens from the "Add Custom Token" entry at the bottom of the play-mode
 * TokenMenu (creation), or from a UCT's ⋯ menu in the same dropdown
 * (editing). The caller wires this to a `token_definitions` row scoped to
 * the current deck — see CardBuilderKillTeam's UCT handlers for details.
 *
 * Visual: a small live preview of the badge sits next to the form so the
 * user can see exactly what'll appear on cards as they pick a color and
 * type glyphs.
 *
 * USAGE:
 *   <CustomTokenModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     editing={tokenBeingEdited}  // null for create, object for edit
 *     onSave={async (data) => { ... }}
 *     onDelete={editing ? async () => { ... } : undefined}
 *   />
 */

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import TokenBadge from './TokenBadge';
import CheckCircle from '@battleplans/ui';
import CloseCircle from '@battleplans/ui';
import TrashBinMinimalistic from '@battleplans/ui';

// ── Brand palette ───────────────────────────────────────────────────────────
// Six swatches that match the existing visuals (placeholder KT token SVGs
// use the same hex values). Tweak in one place if the palette evolves.
export const CUSTOM_TOKEN_COLORS: { value: string; label: string }[] = [
  { value: '#f85908', label: 'Orange' },
  { value: '#dc2626', label: 'Red'    },
  { value: '#eab308', label: 'Yellow' },
  { value: '#16a34a', label: 'Green'  },
  { value: '#2563eb', label: 'Blue'   },
  { value: '#7c3aed', label: 'Purple' },
];

const DEFAULT_COLOR = CUSTOM_TOKEN_COLORS[0].value;

export interface CustomTokenFormValue {
  name:        string;
  description: string;
  color:       string;
  glyph:       string;
}

/** Thrown by `onSave` to surface validation problems inline on the form.
 *  Set `field` to target a specific input (e.g. 'name') so the message
 *  shows under that field via Input's `state="error"` / `helperText`. */
export class CustomTokenSaveError extends Error {
  field?: 'name';
  constructor(message: string, field?: 'name') {
    super(message);
    this.name = 'CustomTokenSaveError';
    this.field = field;
  }
}

export interface CustomTokenModalProps {
  open:    boolean;
  onClose: () => void;
  /** Null for create; pass the token's current values to enter edit mode. */
  editing?: CustomTokenFormValue | null;
  /** Called with the trimmed form value when the user saves. Throw a
   *  `CustomTokenSaveError` to display the message inline; any other
   *  thrown error surfaces under the Name field as a fallback. */
  onSave:  (value: CustomTokenFormValue) => void | Promise<void>;
  /** When provided, shows a Delete button. */
  onDelete?: () => void | Promise<void>;
}

const CustomTokenModal = ({
  open,
  onClose,
  editing,
  onSave,
  onDelete,
}: CustomTokenModalProps) => {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [color,       setColor]       = useState<string>(DEFAULT_COLOR);
  const [glyph,       setGlyph]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  /** Inline error shown under the Name input, populated when `onSave`
   *  throws a `CustomTokenSaveError` (typically a duplicate-name
   *  constraint violation). Cleared whenever the user edits the name. */
  const [nameError,   setNameError]   = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setColor(editing?.color ?? DEFAULT_COLOR);
    setGlyph(editing?.glyph ?? '');
    setSaving(false);
    setDeleting(false);
    setNameError(null);
  }, [open, editing]);

  // The badge previews use the typed glyph or, if empty, the first letter of
  // the name as a sensible default — same auto-fallback you'd get if you
  // saved without typing a glyph.
  const previewGlyph = (glyph || name.slice(0, 2)).toUpperCase();

  const canSave = name.trim() !== '' && !saving && !deleting;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setNameError(null);
    try {
      await onSave({
        name:        name.trim(),
        description: description.trim(),
        color,
        glyph:       (glyph || name.slice(0, 2)).toUpperCase().slice(0, 2),
      });
    } catch (err) {
      // CustomTokenSaveError carries an optional `field` so messages can
      // target the right input. Anything else falls through under Name.
      if (err instanceof CustomTokenSaveError) {
        setNameError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save token.';
        setNameError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || deleting || saving) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-4">

        <h5 className="font-heading text-xl text-white">
          {editing ? 'Edit Custom Token' : 'Add Custom Token'}
        </h5>

        {/* ── Live preview + name + glyph ────────────────────────────── */}
        <div className="flex items-center gap-4">
          <TokenBadge
            color={color}
            glyph={previewGlyph}
            size={64}
          />
          <div className="flex-1 flex flex-col gap-3">
            <Input
              label="Name"
              required
              placeholder="e.g. Charges, Marked, Smoke"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && canSave) handleSave();
              }}
              state={nameError ? 'error' : 'default'}
              helperText={nameError ?? undefined}
              autoFocus
            />
            <Input
              label="Glyph"
              placeholder="≤ 2 chars"
              value={glyph}
              onChange={e => setGlyph(e.target.value.toUpperCase().slice(0, 2))}
              helperText="Up to two characters drawn on the badge. Defaults to the first letters of the name."
            />
          </div>
        </div>

        {/* ── Color palette ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium font-body text-white">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CUSTOM_TOKEN_COLORS.map(c => {
              const selected = c.value === color;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={selected}
                  onClick={() => setColor(c.value)}
                  className="rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    width: 36,
                    height: 36,
                    background: c.value,
                    border: selected ? '3px solid #fff' : '3px solid transparent',
                    boxShadow: selected
                      ? '0 0 0 2px rgba(255,255,255,0.25), inset 0 0 0 2px rgba(0,0,0,0.25)'
                      : 'inset 0 0 0 2px rgba(0,0,0,0.25)',
                    transform: selected ? 'scale(1.06)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ── Description (optional) ─────────────────────────────────── */}
        <Input
          label="Description"
          placeholder="Optional — what this token represents"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <div className="border-t border-gray-700" />

        <div className="flex items-center justify-between gap-1 flex-wrap">
          {/* Delete on the left when editing — kept separated visually */}
          <div>
            {onDelete && (
              <Button
                variant="ghost"
                color="danger"
                leftIcon={<TrashBinMinimalistic className="size-4" />}
                disabled={busy}
                loading={deleting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              color="danger"
              leftIcon={<CloseCircle className="size-4" />}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              leftIcon={<CheckCircle className="size-4" />}
              disabled={!canSave}
              loading={saving}
              onClick={handleSave}
            >
              {editing ? 'Save Changes' : 'Add Token'}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default CustomTokenModal;
