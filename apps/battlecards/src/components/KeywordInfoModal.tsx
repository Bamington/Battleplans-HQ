/**
 * KeywordInfoModal.tsx — Keyword detail modal with optional edit action
 *
 * Displays a keyword's name and description in a modal overlay.
 * Triggered by clicking a keyword link (blue underlined text).
 * Optionally shows an "Edit Keyword" button when onEdit is provided.
 *
 * USAGE:
 *   <KeywordInfoModal
 *     open={!!viewingKeyword}
 *     onClose={() => setViewingKeyword(null)}
 *     name="Optics"
 *     description="A weapon with the Optics keyword adds a +1 die modifier…"
 *     onEdit={() => openEditFlow(viewingKeyword)}
 *   />
 */

import Modal from './Modal';
import Button from './Button';
import CheckCircle from '../icons/CheckCircle';
import Pen2 from '../icons/Pen2';

export interface KeywordInfoModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  description: string;
  /** When provided, shows an "Edit Keyword" button. */
  onEdit?: () => void;
  /** Display name for the entity type — defaults to "Keyword". Use "Skill" for Blood Bowl. */
  typeName?: string;
}

const KeywordInfoModal = ({ open, onClose, name, description, onEdit, typeName = 'Keyword' }: KeywordInfoModalProps) => (
  <Modal open={open} onClose={onClose} className="max-w-md">
    <div className="p-5 flex flex-col gap-3">

      <h5 className="font-heading text-xl text-white">
        {name}
      </h5>

      {description && (
        <p className="font-body text-base font-medium text-white whitespace-pre-wrap">
          {description}
        </p>
      )}

      <div className="flex items-center justify-end gap-1">
        {onEdit && (
          <Button
            variant="ghost"
            leftIcon={<Pen2 className="size-4" />}
            onClick={onEdit}
          >
            Edit {typeName}
          </Button>
        )}
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          onClick={onClose}
        >
          Close
        </Button>
      </div>

    </div>
  </Modal>
);

export default KeywordInfoModal;
