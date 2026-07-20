/**
 * Modal.tsx — Reusable dialog overlay
 *
 * Renders a semi-transparent backdrop with a centred panel on top.
 * Clicking the backdrop dismisses the modal (calls onClose).
 *
 * USAGE EXAMPLES:
 *   <Modal open={isOpen} onClose={() => setIsOpen(false)}>
 *     <div className="p-5">Modal content here</div>
 *   </Modal>
 *
 *   <Modal open={isOpen} onClose={handleClose} className="max-w-sm">
 *     ...
 *   </Modal>
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the backdrop is clicked */
  onClose: () => void;
  /** Modal panel content */
  children: React.ReactNode;
  /** Extra Tailwind classes applied to the modal panel (e.g. max-w-sm) */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

// Desktop max-width lookup. Callers pass an unprefixed `max-w-*` (e.g.
// "max-w-md") to set the width; below lg we ignore it and cap every modal at
// 90vw so it isn't cramped on phones/tablets, then re-apply the caller's width
// only at lg+. The lg: variants must be written as literals here — Tailwind's
// JIT only generates classes it sees verbatim in source, so a dynamically
// built `lg:${token}` would never be emitted.
const LG_MAX_W: Record<string, string> = {
  'max-w-xs':    'lg:max-w-xs',
  'max-w-sm':    'lg:max-w-sm',
  'max-w-md':    'lg:max-w-md',
  'max-w-lg':    'lg:max-w-lg',
  'max-w-xl':    'lg:max-w-xl',
  'max-w-2xl':   'lg:max-w-2xl',
  'max-w-[80%]': 'lg:max-w-[80%]',
};
const DEFAULT_LG_MAX_W = 'lg:max-w-[50vw]';

const Modal = ({ open, onClose, children, className = '' }: ModalProps) => {
  // Split the caller's desktop max-width out of className: below lg every modal
  // is 90vw; the caller's width only applies at lg+.
  const callerMaxW = className.match(/max-w-\S+/)?.[0];
  const lgMaxW     = (callerMaxW && LG_MAX_W[callerMaxW]) || DEFAULT_LG_MAX_W;
  const restClass  = callerMaxW ? className.replace(callerMaxW, '').trim() : className;

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  // Portalled to <body> so the modal escapes any ancestor that would trap it.
  // Below lg the builder's side panels are bottom drawers with a `transform`
  // (which makes them the containing block for `position: fixed` children) plus
  // `overflow-hidden` — rendering inline left modals clipped inside the drawer.
  // Sitting on <body> also puts the modal above the drawer's own z-50.
  const overlay = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — full-width up to 90vw on mobile/tablet, caller's width at lg+ */}
      <div
        className={[
          'relative z-10 w-full max-w-[90vw]',
          lgMaxW,
          // Never taller than the viewport — long modals (e.g. paginated skill
          // pickers) would otherwise run off the top and bottom of a phone
          // screen, since the overlay centres them. Scroll inside instead.
          'max-h-[90dvh] overflow-y-auto',
          'bg-gray-800 border border-gray-700 rounded-lg shadow-xl',
          restClass,
        ].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default Modal;
