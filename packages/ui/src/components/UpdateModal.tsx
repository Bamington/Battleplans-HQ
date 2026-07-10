/**
 * UpdateModal.tsx — Full "News & Updates" release note
 *
 * Opened from the News & Updates panel on each app's home screen when the user
 * clicks "Read Update". Shows the note's title, its metadata (version, publish
 * date, author) and the full markdown body.
 *
 * The author's name comes from `updates.published_by_name`, snapshotted when the
 * update was published — RLS on user_profiles is select-own, so the client can't
 * resolve another user's name at read time.
 *
 * USAGE:
 *   const { updates } = useUpdates('battleplan');
 *   <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
 */

import Modal from './Modal';
import Button from './Button';
import MarkdownBody from './MarkdownBody';
import type { AppUpdate } from '../hooks/useUpdates';

export interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
  /** The note to show. Renders nothing when null. */
  update: AppUpdate | null;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Colour theming for the full-size note. Structure lives in MarkdownBody. */
const MODAL_PROSE = [
  'text-base leading-6 text-gray-300',
  '[&_strong]:text-white',
  '[&_h1]:text-white [&_h2]:text-white [&_h3]:text-white',
  '[&_a]:text-blue-400',
  '[&_code]:bg-gray-900',
].join(' ');

export default function UpdateModal({ open, onClose, update }: UpdateModalProps) {
  if (!open || !update) return null;

  const meta = [
    update.version && `v${update.version}`,
    formatDate(update.published_at),
    update.published_by_name,
  ].filter(Boolean).join(' • ');

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="p-5 flex flex-col gap-4">

        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
            {update.title}
          </h1>
          {meta && <p className="font-body text-sm text-gray-400">{meta}</p>}
        </div>

        {update.body && (
          <MarkdownBody className={`${MODAL_PROSE} max-h-[60vh] overflow-y-auto`}>
            {update.body}
          </MarkdownBody>
        )}

        <div className="flex justify-end">
          <Button variant="outline" color="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </Modal>
  );
}
