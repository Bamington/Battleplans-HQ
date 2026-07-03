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

const Modal = ({ open, onClose, children, className = '' }: ModalProps) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          'relative z-10 w-full',
          /max-w-/.test(className) ? '' : 'max-w-lg',
          'bg-gray-800 border border-gray-700 rounded-lg shadow-xl',
          className,
        ].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
