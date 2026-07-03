/**
 * Dropdown.tsx — Click-triggered dropdown menu
 *
 * Manages its own open/close state. Closes when clicking outside.
 *
 * USAGE EXAMPLES:
 *   <Dropdown trigger={<Button rightIcon={<ChevronDown className="w-4 h-4" />}>Options</Button>}>
 *     <DropdownItem onClick={() => {}}>Edit</DropdownItem>
 *     <DropdownItem icon={<TrashBin className="w-4 h-4" />} onClick={() => {}}>Delete</DropdownItem>
 *   </Dropdown>
 *
 *   <Dropdown trigger={<Button>Account</Button>} align="right">
 *     <DropdownHeader>
 *       <p className="font-semibold">Jane Lee</p>
 *       <p className="text-sm text-gray-500">jane@example.com</p>
 *     </DropdownHeader>
 *     <DropdownDivider />
 *     <DropdownItem>Settings</DropdownItem>
 *     <DropdownItem disabled>Billing (unavailable)</DropdownItem>
 *     <DropdownDivider />
 *     <DropdownItem>Sign out</DropdownItem>
 *   </Dropdown>
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Type definitions ──────────────────────────────────────────────────────────

export type DropdownAlign = 'left' | 'right';

export interface DropdownProps {
  /** The element that toggles the dropdown (e.g. a Button) */
  trigger: React.ReactNode;
  /** Aligns the menu to the left (default) or right edge of the trigger */
  align?: DropdownAlign;
  /** Minimum width of the menu — defaults to 'w-44' */
  menuClassName?: string;
  /** Extra classes on the outer container */
  className?: string;
  children: React.ReactNode;
}

export interface DropdownItemProps {
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Prevents interaction and greys out the item */
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export interface DropdownHeaderProps {
  className?: string;
  children: React.ReactNode;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * DropdownItem — A single clickable menu entry.
 * Must be rendered inside a Dropdown.
 */
export const DropdownItem = ({
  icon,
  disabled = false,
  onClick,
  className = '',
  children,
}: DropdownItemProps) => {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={[
          'w-full text-left flex items-center gap-2 px-4 py-2 text-sm font-body',
          disabled
            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white',
          className,
        ].filter(Boolean).join(' ')}
      >
        {icon && (
          <span className="shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </button>
    </li>
  );
};

/**
 * DropdownDivider — A thin horizontal rule for separating item groups.
 */
export const DropdownDivider = () => (
  <li role="separator" className="my-1 h-px bg-gray-100 dark:bg-gray-600" />
);

/**
 * DropdownHeader — A non-interactive section at the top of the menu,
 * typically used to show signed-in user info.
 */
export const DropdownHeader = ({ className = '', children }: DropdownHeaderProps) => (
  <li className={`px-4 py-3 text-sm text-gray-900 dark:text-white ${className}`}>
    {children}
  </li>
);

// ── Main component ────────────────────────────────────────────────────────────

const MENU_OFFSET_Y = 8; // matches the previous mt-2

const Dropdown = ({
  trigger,
  align     = 'left',
  menuClassName = 'w-44',
  className = '',
  children,
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  // Menu is rendered via a portal so it escapes any clipping ancestor
  // (overflow-hidden, overflow-x-auto with implicit y-auto, etc.). We
  // recompute its viewport position from the trigger's bounding rect
  // every time it opens, and close on scroll/resize so it doesn't
  // float away from the trigger.
  const [menuPos, setMenuPos] = useState<{
    top:    number;
    left?:  number;
    right?: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  // Compute the menu position synchronously on toggle so it's correct
  // on first paint without a useLayoutEffect cascade. Reads the trigger
  // wrapper's viewport rect; the menu is then rendered with
  // position:fixed at the matching coordinates.
  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const top = rect.bottom + MENU_OFFSET_Y;
      setMenuPos(
        align === 'right'
          ? { top, right: window.innerWidth - rect.right }
          : { top, left:  rect.left }
      );
    }
    setIsOpen(true);
  };

  // Close on outside click. The menu lives in a portal so it's NOT
  // inside triggerRef — we have to check both refs.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inTrigger = triggerRef.current?.contains(t);
      const inMenu    = menuRef.current?.contains(t);
      if (!inTrigger && !inMenu) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Close on scroll / resize so the menu doesn't float away from the
  // trigger when the page moves. The capture phase catches scroll on
  // any ancestor (including the overflow-x-auto row that triggered
  // the original bug).
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  return (
    <div ref={triggerRef} className={`inline-block ${className}`.trim()}>

      {/* Trigger — wrapped in a div to capture clicks without overriding
          the trigger element */}
      <div className="cursor-pointer" onClick={toggleOpen}>
        {trigger}
      </div>

      {/* Menu — portaled to document.body so no overflow ancestor can
          clip it. position:fixed coordinates from menuPos. */}
      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          className={[
            'fixed z-50 rounded-lg shadow-lg',
            'bg-white dark:bg-gray-700',
            'border border-gray-100 dark:border-gray-600',
            menuClassName,
          ].join(' ')}
          style={menuPos}
          role="menu"
        >
          <ul className="py-1 text-sm" onClick={() => setIsOpen(false)}>
            {children}
          </ul>
        </div>,
        document.body,
      )}

    </div>
  );
};

export default Dropdown;
