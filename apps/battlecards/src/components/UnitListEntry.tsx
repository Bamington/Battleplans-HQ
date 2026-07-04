/**
 * UnitListEntry.tsx — Army list row component
 *
 * Displays a single unit entry in an army list. Shows the unit's name,
 * type, portrait, and build status. Supports an active/editing state.
 *
 * USAGE EXAMPLES:
 *   <UnitListEntry />
 *   <UnitListEntry status="complete" unitName="Jane-664" unitType="Spartan ZVEZDA" />
 *   <UnitListEntry status="pending"  unitName="Mk. VII Warrior" unitType="UNSC Marine" />
 *   <UnitListEntry status="complete" active unitName="Jane-664" unitType="Spartan ZVEZDA" />
 *   <UnitListEntry avatarSrc="/portraits/jane-664.png" status="complete" unitName="Jane-664" />
 */

import React from 'react';
import { CheckCircle } from '@battleplans/ui';
import { DangerCircle } from '@battleplans/ui';
import { Copy } from '@battleplans/ui';
import { TrashBinMinimalistic } from '@battleplans/ui';

// ── Type definitions ──────────────────────────────────────────────────────────

/** Build status of the unit entry */
export type UnitStatus = 'blank' | 'pending' | 'complete';

export interface UnitListEntryProps {
  /**
   * Build status of this unit.
   * - blank    — placeholder slot, not yet filled in
   * - pending  — unit added but has unsaved changes
   * - complete — unit is fully configured and saved
   */
  status?: UnitStatus;
  /**
   * Whether this entry is currently selected / being edited.
   * Applies a green border and highlights the name in success green.
   */
  active?: boolean;
  /**
   * Whether this unit has been activated this turn (its activation token
   * is at its effective max). Renders a green-tinted background + border
   * so the row reads as "filled in / done". Stacks with `active` — both
   * can be true simultaneously and stay visually distinguishable.
   * Used in play mode only; edit mode callers should leave it false.
   */
  activated?: boolean;
  /** Primary label — the unit's display name */
  unitName?: string;
  /**
   * Optional leading number badge shown before the unit name
   * (e.g. a Blood Bowl player's jersey number). Hidden when empty.
   */
  number?: string;
  /** Secondary label — unit faction or type (e.g. "Spartan ZVEZDA") */
  unitType?: string;
  /** Tertiary label — comma-separated addon/keyword preview (e.g. weapon names) */
  addonSummary?: string;
  /** URL for the unit's portrait or game icon */
  avatarSrc?: string;
  /** Called when the row is clicked */
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Whether deck edit mode is active — shows duplicate/delete icons */
  editMode?: boolean;
  /** Called when the duplicate button is clicked (edit mode only) */
  onDuplicate?: () => void;
  /** Called when the delete button is clicked (edit mode only) */
  onDelete?: () => void;
  /** Extra Tailwind classes on the root element */
  className?: string;
}

// ── Status icon ───────────────────────────────────────────────────────────────

const StatusIcon = ({ status, active }: { status: UnitStatus; active: boolean }) => {
  if (status === 'complete') {
    return <CheckCircle className="size-4 shrink-0 text-green-400" />;
  }
  if (status === 'pending') {
    return <DangerCircle className="size-4 shrink-0 text-amber-400" />;
  }
  // blank — plain outlined circle
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`size-4 shrink-0 ${active ? 'text-gray-600' : 'text-gray-700'}`}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const UnitListEntry = ({
  status    = 'blank',
  active    = false,
  activated = false,
  unitName,
  number,
  unitType,
  addonSummary,
  avatarSrc,
  onClick,
  editMode  = false,
  onDuplicate,
  onDelete,
  className = '',
}: UnitListEntryProps) => {

  const displayName = unitName ?? 'New Unit';

  // Name colour
  const nameColor = active && status === 'blank'
    ? 'text-green-400'
    : active
    ? 'text-gray-100'
    : status === 'blank'
    ? 'text-gray-500'
    : 'text-gray-100';

  // Subtitle text
  const subtitle = active && status === 'blank' ? 'currently editing' : (unitType ?? null);
  const subtitleColor = active && status === 'blank' ? 'text-green-700' : 'text-gray-500';

  // Background — `active` (selected) wins over `activated` so the
  // currently-viewed card stays clearly highlighted; activated unselected
  // rows pick up a green tint so a quick glance shows what's been used.
  const bgClass = active
    ? 'bg-gray-800'
    : activated
    ? 'bg-green-900/40'
    : 'bg-gray-900';

  // Border — `active` wins (bright green ring); activated unselected gets
  // a dimmer green border. Default is the existing gray with hover lift.
  const borderClass = active
    ? 'border-green-500'
    : activated
    ? 'border-green-800'
    : 'border-gray-700 hover:border-gray-600';

  const Tag = editMode ? 'div' : 'button';

  return (
    <Tag
      {...(!editMode && { type: 'button' as const })}
      onClick={onClick}
      className={[
        'w-full flex items-center gap-[9px] pr-1 rounded overflow-hidden border transition-colors text-left cursor-pointer',
        bgClass,
        borderClass,
        className,
      ].join(' ')}
    >
      {/* Portrait / icon — 42×42, flush to the left edge, gradient bg */}
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className="size-[42px] shrink-0 object-contain bg-gradient-to-b from-[#252525] to-[#181d24]"
        />
      ) : (
        <div className="size-[42px] shrink-0 flex items-center justify-center bg-gradient-to-b from-[#252525] to-[#181d24]">
          <span className="text-xs font-body font-medium text-gray-500">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className={`text-base font-medium font-body leading-6 truncate ${nameColor}`}>
          {number && (
            <span className="mr-1.5 font-bold text-gray-400 tabular-nums">
              #{number}
            </span>
          )}
          {displayName}
        </p>
        {subtitle && (
          <p className={`text-xs font-bold font-body uppercase tracking-[1.2px] leading-4 truncate ${subtitleColor}`}>
            {subtitle}
          </p>
        )}
        {addonSummary && (
          <p className="font-body text-[12px] leading-4 text-gray-400 truncate">
            {addonSummary}
          </p>
        )}
      </div>

      {/* Trailing icons */}
      {editMode ? (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
            className="shrink-0 p-0.5 rounded hover:bg-gray-700 transition-colors text-blue-400 hover:text-blue-300"
            title="Duplicate card"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="shrink-0 p-0.5 rounded hover:bg-gray-700 transition-colors text-red-400 hover:text-red-300"
            title="Delete card"
          >
            <TrashBinMinimalistic className="size-4" />
          </button>
        </>
      ) : (
        <StatusIcon status={status} active={active} />
      )}
    </Tag>
  );
};

export default UnitListEntry;
