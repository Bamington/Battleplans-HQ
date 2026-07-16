/**
 * ConfirmDialog.tsx — Small portalled yes/no confirmation, above everything.
 */

import { createPortal } from 'react-dom';
import { Button } from '@battleplans/ui';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h2 className="font-heading text-lg text-white">{title}</h2>
        {message && <p className="font-body text-sm text-neutral-400">{message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" color="secondary" onClick={onCancel}>Cancel</Button>
          <Button color="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
