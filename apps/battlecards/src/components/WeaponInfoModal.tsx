/**
 * WeaponInfoModal.tsx — Read-only weapon detail modal
 *
 * Displays a weapon's properties: type, range, AP, points cost, and keywords.
 * Keywords are rendered as clickable badge chips.
 * Optionally shows an "Edit Weapon" button.
 *
 * USAGE:
 *   <WeaponInfoModal
 *     open={!!viewingWeapon}
 *     onClose={() => setViewingWeapon(null)}
 *     weapon={viewingWeapon}
 *     onEdit={() => startEditFlow(viewingWeapon)}
 *     onKeywordClick={(kw) => setViewingKeyword(kw)}
 *   />
 */

import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import CheckCircle from '../icons/CheckCircle';
import Pen2 from '../icons/Pen2';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeaponInfoKeyword {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

export interface WeaponInfoData {
  name:       string;
  type:       string;
  range:      string;
  ap:         string;
  pointsCost: string;
  weaponKeywords: WeaponInfoKeyword[];
}

export interface WeaponInfoModalProps {
  open: boolean;
  onClose: () => void;
  weapon: WeaponInfoData | null;
  /** When provided, shows an "Edit Weapon" button. */
  onEdit?: () => void;
  /** Called when a keyword chip is clicked. */
  onKeywordClick?: (kw: WeaponInfoKeyword) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const WeaponInfoModal = ({ open, onClose, weapon, onEdit, onKeywordClick }: WeaponInfoModalProps) => {
  if (!weapon) return null;

  const isCC = weapon.type === 'Close Combat';
  const points = Number(weapon.pointsCost) || 0;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3">

        <h5 className="font-heading text-xl text-white">
          {weapon.name}
        </h5>

        <div className="flex flex-col gap-1">
          <p className="font-body text-base font-medium text-white">
            {weapon.type} Weapon
          </p>
          {!isCC && weapon.range && (
            <p className="font-body text-base font-medium text-white">
              Range {weapon.range}
            </p>
          )}
          <p className="font-body text-base font-medium text-white">
            AP {weapon.ap}
          </p>
          {points > 0 && (
            <p className="font-body text-base font-medium text-white">
              Points Cost {points}
            </p>
          )}

          {weapon.weaponKeywords.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="font-body text-base font-medium text-white">Keywords:</span>
              {weapon.weaponKeywords.map(kw => (
                <Badge
                  key={kw.keywordId}
                >
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
        </div>

        <div className="flex items-center justify-end gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              leftIcon={<Pen2 className="size-4" />}
              onClick={onEdit}
            >
              Edit Weapon
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

export default WeaponInfoModal;
