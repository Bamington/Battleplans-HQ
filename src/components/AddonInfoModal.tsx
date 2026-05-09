/**
 * AddonInfoModal.tsx — Read-only addon detail modal (generic across games)
 *
 * UNIVERSAL — works for any addon type from any game (weapons, abilities,
 * skills, etc.). Caller passes the addon's display data + a `statRows` array
 * of game-specific stat lines, and optionally an `onEdit` callback to expose
 * an "Edit X" button.
 *
 * In use by: Kill Team (weapons + abilities). TODO: migrate Halo Flashpoint's
 * `WeaponInfoModal` to this when convenient — same shape, just data-driven.
 *
 * USAGE:
 *   <AddonInfoModal
 *     open={!!viewing}
 *     onClose={() => setViewing(null)}
 *     name={viewing?.name ?? ''}
 *     description={viewing?.description}
 *     statRows={[
 *       { label: 'Attack', value: viewing.attack },
 *       { label: 'Hit',    value: viewing.hit },
 *     ]}
 *     keywords={viewing?.weaponKeywords ?? []}
 *     addonTypeName="Weapon"
 *     onEdit={() => startEdit(viewing)}
 *     onKeywordClick={(kw) => setViewingKeyword(kw)}
 *   />
 */

import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import CheckCircle from '../icons/CheckCircle';
import Pen2 from '../icons/Pen2';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AddonInfoKeyword {
  keywordId:   string;
  keywordName: string;
  description: string;
  hasParams:   boolean;
  paramValue:  number | null;
}

export interface AddonInfoStatRow {
  label: string;
  value: string | number;
}

export interface AddonInfoModalProps {
  open: boolean;
  onClose: () => void;
  /** Display name — rendered as the modal title. */
  name: string;
  /** Optional description, rendered as a paragraph above the stat rows. */
  description?: string | null;
  /** Game-specific stat lines. Caller decides which to show. */
  statRows?: AddonInfoStatRow[];
  /** Keyword attachments — rendered as badge chips. */
  keywords?: AddonInfoKeyword[];
  /**
   * Display label for the addon type, e.g. "Weapon" or "Ability".
   * Used to label the Edit button: `Edit ${addonTypeName}`.
   */
  addonTypeName?: string;
  /** When provided, shows an Edit button that calls this callback. */
  onEdit?: () => void;
  /** Called when a keyword chip is clicked. */
  onKeywordClick?: (kw: AddonInfoKeyword) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const AddonInfoModal = ({
  open,
  onClose,
  name,
  description,
  statRows = [],
  keywords = [],
  addonTypeName,
  onEdit,
  onKeywordClick,
}: AddonInfoModalProps) => {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3">

        <h5 className="font-heading text-xl text-white">{name}</h5>

        {description && (
          <p className="font-body text-sm text-gray-300 leading-snug whitespace-pre-wrap">
            {description}
          </p>
        )}

        {statRows.length > 0 && (
          <div className="flex flex-col gap-1">
            {statRows.map((r, i) => (
              <p key={i} className="font-body text-base font-medium text-white">
                <span className="text-gray-400">{r.label}: </span>
                {r.value}
              </p>
            ))}
          </div>
        )}

        {keywords.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-base font-medium text-white">Keywords:</span>
            {keywords.map(kw => (
              <Badge key={kw.keywordId}>
                {onKeywordClick ? (
                  <button
                    type="button"
                    className="underline text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    onClick={() => onKeywordClick(kw)}
                  >
                    {kw.paramValue != null ? `${kw.keywordName} (${kw.paramValue})` : kw.keywordName}
                  </button>
                ) : (
                  kw.paramValue != null ? `${kw.keywordName} (${kw.paramValue})` : kw.keywordName
                )}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              leftIcon={<Pen2 className="size-4" />}
              onClick={onEdit}
            >
              {addonTypeName ? `Edit ${addonTypeName}` : 'Edit'}
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
};

export default AddonInfoModal;
