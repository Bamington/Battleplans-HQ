/**
 * FriendModelModal.tsx — a friend's model that's credited to you, read-only.
 *
 * Opened from My Models for a card marked "Painted for …" / "Painted by …".
 * It's the share page's model view (get_friend_model reuses its JSON), in the
 * same Sheet the model modal uses, with whose model it is at the top. No edit
 * controls: the model is the friend's.
 */

import { useEffect, useState } from 'react';
import { Sheet, avatarUrl } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { SharedModelView, usePhotoViewer } from '../pages/SharedItemPage';
import { getFriendModel, type FriendModelPayload } from '../lib/sharing';

/** The credit, worded from the viewer's side. */
export function friendCreditLine(direction: FriendModelPayload['direction'], ownerName: string): string {
  return direction === 'painted_by_viewer' ? `You painted this for ${ownerName}` : `Painted for you by ${ownerName}`;
}

export function FriendModelModal({ modelId, ownerName, onClose, payload: given }: {
  /** The model to show; null closes the modal. */
  modelId: string | null;
  /** The friend's name as you know them (falls back to their @username). */
  ownerName?: string | null;
  onClose: () => void;
  /** Gallery only: show this instead of fetching. */
  payload?: FriendModelPayload | null;
}) {
  const [fetched, setFetched] = useState<FriendModelPayload | null | undefined>(undefined);
  const photos = usePhotoViewer();

  useEffect(() => {
    if (!modelId || given) return;
    let cancelled = false;
    setFetched(undefined);
    getFriendModel(modelId).then(p => { if (!cancelled) setFetched(p); });
    return () => { cancelled = true; };
  }, [modelId, given]);

  const data = given ?? fetched;
  const name = ownerName || (data?.owner?.handle ? `@${data.owner.handle}` : 'a friend');
  const avatar = avatarUrl(data?.owner?.avatar_path ?? null);

  return (
    <>
      <Sheet open={modelId !== null} onClose={onClose} className="max-w-2xl">
        <div className="flex flex-col overflow-y-auto max-h-[90vh]">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-neutral-800">
            {avatar
              ? <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-neutral-700" />
              : <span className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700" aria-hidden="true" />}
            <span className="flex-1 min-w-0 font-body text-sm text-neutral-300 truncate">
              {name}’s model <span className="text-neutral-500">· view only</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
          </div>
          {data === undefined ? (
            <p className="py-16 text-center font-body text-sm text-neutral-400">Loading…</p>
          ) : data === null ? (
            <p className="py-16 px-6 text-center font-body text-sm text-neutral-400">
              This model isn’t shared with you any more.
            </p>
          ) : (
            <SharedModelView model={data.item} openPhotos={photos.open} painterLine={friendCreditLine(data.direction, name)} />
          )}
        </div>
      </Sheet>
      {photos.viewer}
    </>
  );
}
