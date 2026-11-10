/**
 * PainterField.tsx — "Painted by me", and who else if not.
 *
 * On (the default): a second switch, "Painted for someone else", opens the
 * picker for who it's for. Off: the picker is for who painted it. One person
 * either way, from the user's people list with their Friends included.
 *
 * Controlled; the parent saves with painterColumns(). Used on Add Model, the
 * model's Painting tab and the Mark Painted dialog.
 */

import { OpponentPicker, type Opponent } from '@battleplans/ui';
import { Switch } from './Switch';
import type { PainterValue } from '../lib/painters';

export function PainterField({ value, onChange, options, disabled = false }: {
  value: PainterValue;
  onChange: (v: PainterValue) => void;
  /** From useOpponents(userId). */
  options: Opponent[];
  disabled?: boolean;
}) {
  const picking = !value.paintedByMe || value.forSomeone;
  return (
    <div className="flex flex-col gap-3">
      <Switch label="Painted by me" checked={value.paintedByMe} disabled={disabled}
        onChange={on => onChange({ paintedByMe: on, forSomeone: false, person: null })} />
      {value.paintedByMe && (
        <Switch label="Painted for someone else" checked={value.forSomeone} disabled={disabled}
          onChange={on => onChange({ ...value, forSomeone: on, person: null })} />
      )}
      {picking && (
        <OpponentPicker
          single
          label={value.paintedByMe ? 'Painted for' : 'Painted by'}
          placeholder="Search or add a person…"
          options={options}
          value={value.person ? [value.person] : []}
          onChange={v => onChange({ ...value, person: v[0] ?? null })}
        />
      )}
    </div>
  );
}
