/**
 * SharedItemPage.tsx — the public page behind a share link
 * (/s/:handle/:token, or the original /s/:token — only the code is looked up).
 *
 * Open to anyone, signed in or not, and strictly read-only. Everything comes
 * from get_shared_item(token): the shared model / collection / recipe and
 * everything inside it (a collection's models, a model's recipes) — purchase
 * dates are never included. A shared collection's models open to their own
 * read-only view right here.
 *
 * The read-only views themselves live in @battleplans/ui (bench/SharedViews),
 * shared with profiles in every app.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  supabase, Button, avatarUrl, ProfileLink,
  SharedModelView, SharedBoxView, SharedRecipeView, usePhotoViewer,
} from '@battleplans/ui';
import type { SharedModel } from '@battleplans/ui';
import { getSharedItem, sharePath } from '../lib/sharing';
import type { SharedPayload } from '../lib/sharing';

// Moved to @battleplans/ui; re-exported for existing imports (FriendModelModal).
export { SharedModelView, usePhotoViewer };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SharedItemPage() {
  // /s/<username>/<code> or the original /s/<code>. Only the code is looked
  // up; the username is for reading, and is corrected below.
  const { token = '', handle: urlHandle } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SharedPayload | null | undefined>(undefined);
  const [viewerId, setViewerId] = useState<string | null>(null);
  /** A collection's model opened from its list (back returns to the list). */
  const [openModel, setOpenModel] = useState<SharedModel | null>(null);
  const photos = usePhotoViewer();

  useEffect(() => {
    let cancelled = false;
    getSharedItem(token).then(p => { if (!cancelled) setPayload(p); });
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) setViewerId(data.session?.user?.id ?? null); });
    return () => { cancelled = true; };
  }, [token]);

  const title = payload?.item.name;
  useEffect(() => { document.title = title ? `${title} — BattleBench` : 'BattleBench'; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, [openModel]);

  // Show the owner's CURRENT username in the address: upgrades an old
  // /s/<code> link, and fixes one made before a username change.
  const ownerHandle = payload?.owner?.handle ?? null;
  useEffect(() => {
    if (!ownerHandle || ownerHandle === urlHandle) return;
    navigate(sharePath(token, ownerHandle), { replace: true });
  }, [ownerHandle, urlHandle, token, navigate]);

  const owner = payload?.owner;
  const ownerAvatar = useMemo(() => avatarUrl(owner?.avatar_path), [owner?.avatar_path]);
  const isOwner = !!viewerId && viewerId === owner?.id;

  return (
    <div className="min-h-dvh bg-neutral-950 flex flex-col">
      <header className="h-14 px-4 border-b border-neutral-800 flex items-center justify-between">
        <Link to="/" className="font-heading text-white text-base tracking-wide">BattleBench</Link>
        <Link to={viewerId ? '/app' : '/login'} className="font-body text-sm text-primary-400 hover:text-primary-300">
          {viewerId ? 'Open BattleBench' : 'Sign in'}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {payload === undefined ? (
          <p className="py-16 text-center font-body text-sm text-neutral-400">Loading…</p>
        ) : payload === null ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <h1 className="font-heading text-2xl text-white">This link isn't shared</h1>
            <p className="font-body text-sm text-neutral-400 max-w-sm">
              It may have been turned off by its owner, or the link is incomplete.
            </p>
          </div>
        ) : (
          <>
            {owner && (
              <div className="flex items-center gap-2.5">
                {ownerAvatar
                  ? <img src={ownerAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                  : <span className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700" aria-hidden="true" />}
                <span className="font-body text-sm text-neutral-300">
                  Shared by <span className="font-medium">{owner.handle ? <ProfileLink handle={owner.handle} /> : <span className="text-white">a BattleBench painter</span>}</span>
                </span>
                {isOwner && (
                  <Link to="/app" className="ml-auto"><Button size="xs" variant="outline" color="primary">This is yours — open in the app</Button></Link>
                )}
              </div>
            )}

            {openModel && (
              <button type="button" onClick={() => setOpenModel(null)}
                className="self-start font-body text-sm text-primary-400 hover:text-primary-300">
                ← Back to {payload.kind === 'box' ? payload.item.name : 'collection'}
              </button>
            )}

            <article className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
              {openModel ? (
                <SharedModelView key={openModel.id} model={openModel} openPhotos={photos.open} />
              ) : payload.kind === 'model' ? (
                <SharedModelView model={payload.item} openPhotos={photos.open} />
              ) : payload.kind === 'box' ? (
                <SharedBoxView box={payload.item} onOpenModel={setOpenModel} openPhotos={photos.open} />
              ) : (
                <SharedRecipeView recipe={payload.item} openPhotos={photos.open} />
              )}
            </article>

            {!viewerId && (
              <p className="text-center font-body text-sm text-neutral-400">
                Track your own collection, paint recipes and projects —{' '}
                <Link to="/login" className="text-primary-400 hover:text-primary-300">try BattleBench</Link>.
              </p>
            )}
          </>
        )}
      </main>
      {photos.viewer}
    </div>
  );
}
