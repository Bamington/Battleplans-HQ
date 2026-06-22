/**
 * RygSimpleAddonForm.tsx — Generic name + description form for RYG addons
 *
 * Used for: Special Ability, Armor, Items — all of which only need a
 * name (from the addon.name field) and a description (from addon.description).
 */

import { useState } from 'react';
import Input from './Input';
import Button from './Button';
import type { AddonFormProps } from './AddAddonModal';

interface RygSimpleAddonFormProps extends AddonFormProps {
  namePlaceholder?: string;
  descPlaceholder?: string;
  saveLabel?:       string;
}

export default function RygSimpleAddonForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  namePlaceholder = 'Name',
  descPlaceholder = 'Description',
  saveLabel       = 'Save',
}: RygSimpleAddonFormProps) {
  const [name, setName]         = useState(editingAddon?.name ?? '');
  const [description, setDesc]  = useState(editingAddon?.description ?? '');

  const handleSave = () => {
    onSave(name.trim(), description.trim() || null, {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={namePlaceholder}
      />

      <div>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDesc(e.target.value)}
          placeholder={descPlaceholder}
          rows={5}
          style={{
            width:        '100%',
            fontSize:     14,
            padding:      '8px 10px',
            border:       '1px solid #d1d5db',
            borderRadius: 6,
            resize:       'vertical',
            fontFamily:   'inherit',
            boxSizing:    'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim() || saving} loading={saving}>{saveLabel}</Button>
      </div>
    </div>
  );
}
