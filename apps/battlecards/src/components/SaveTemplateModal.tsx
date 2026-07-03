/**
 * SaveTemplateModal.tsx — Prompts for a template name, then persists.
 *
 * Opens from the "Save as Template" button in the card edit panel.
 * The caller handles the actual DB write — this component just
 * collects (and validates) the template name.
 *
 * USAGE:
 *   <SaveTemplateModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     defaultName={activeCard.unitName}
 *     onSave={async (name) => { await saveTemplate(name); }}
 *   />
 */

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';

export interface SaveTemplateModalProps {
  open:    boolean;
  onClose: () => void;
  /** Prefilled into the name field. Pass the current unit/rule name; leave blank if it's still the default. */
  defaultName?: string;
  /** Called with the trimmed template name when the user confirms. May be async. */
  onSave: (name: string) => void | Promise<void>;
  /** Body copy describing what this template remembers. Defaults to the card-template blurb. */
  description?: string;
  /** Placeholder text for the name input. */
  namePlaceholder?: string;
}

const DEFAULT_DESCRIPTION =
  'You’ll be able to use this template to create new cards in the future. Templates remember all their stats, keywords, and traits.';

const SaveTemplateModal = ({
  open,
  onClose,
  defaultName = '',
  onSave,
  description = DEFAULT_DESCRIPTION,
  namePlaceholder = 'This replaces the unit’s name.',
}: SaveTemplateModalProps) => {
  const [name, setName]     = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSaving(false);
    }
  }, [open, defaultName]);

  const canSave = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(name.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3">

        <h5 className="font-heading text-xl text-white">Save Template</h5>

        <p className="font-body text-sm text-gray-300">
          {description}
        </p>

        <Input
          label="Template Name"
          required
          placeholder={namePlaceholder}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && canSave) handleSave();
          }}
          autoFocus
        />

        <div className="border-t border-gray-700" />

        <div className="flex items-center justify-end gap-1 flex-wrap">
          <Button
            variant="ghost"
            color="danger"
            leftIcon={<CloseCircle className="size-4" />}
            disabled={saving}
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
            Save Template
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default SaveTemplateModal;
