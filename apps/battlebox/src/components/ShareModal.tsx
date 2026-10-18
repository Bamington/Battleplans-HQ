/**
 * ShareModal.tsx — Share a model, collection or recipe.
 *
 * Three settings, saved the moment one is picked:
 *   Not shared            — only you
 *   Anyone with the link  — a secret link (battlebench.app/s/<code>)
 *   Public                — the link, and listed for anyone to find (search
 *                           is coming; the setting is stored now)
 * With a link, it's shown with Copy and (where the device has one) the native
 * share sheet. Turning sharing off deletes the link for good.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon, PickRow } from './paintPickerBits';
import { fetchShareState, setShareLevel, shareUrl } from '../lib/sharing';
import type { ShareKind, ShareLevel, ShareState } from '../lib/sharing';

const KIND_LABEL: Record<ShareKind, string> = { model: 'model', box: 'collection', recipe: 'recipe' };

const LEVELS: { value: ShareLevel; title: string; subtitle: string }[] = [
  { value: 'none',   title: 'Not shared',           subtitle: 'Only you can see it.' },
  { value: 'link',   title: 'Anyone with the link', subtitle: 'Only people you send the link to can open it.' },
  { value: 'public', title: 'Public',               subtitle: 'Anyone can open it, and find it once search arrives.' },
];

export function ShareModal({ kind, itemId, itemName, onClose }: {
  kind: ShareKind;
  /** The item to share; null closes the modal. */
  itemId: string | null;
  itemName: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [saving, setSaving] = useState<ShareLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setState(null); setError(null); setCopied(false);
    fetchShareState(kind, itemId).then(async s => {
      if (cancelled) return;
      // Public from the old app but no link yet: make one so there's
      // something to copy.
      if (s.level !== 'none' && !s.token) {
        const { state: made } = await setShareLevel(kind, itemId, s.level);
        if (!cancelled) setState(made ?? s);
      } else setState(s);
    });
    return () => { cancelled = true; };
  }, [kind, itemId]);

  if (!itemId) return null;

  const pick = async (level: ShareLevel) => {
    if (!state || level === state.level || saving) return;
    setSaving(level); setError(null); setCopied(false);
    const { state: next, error: err } = await setShareLevel(kind, itemId, level);
    setSaving(null);
    if (err || !next) { setError('Could not change sharing. Please try again.'); return; }
    setState(next);
  };

  const url = state?.token ? shareUrl(state.token) : null;

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Could not copy — select the link and copy it instead.'); }
  };
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const nativeShare = async () => {
    if (!url) return;
    try { await navigator.share({ title: itemName, url }); } catch { /* dismissed */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <h2 className="font-heading text-xl text-white truncate">Share {KIND_LABEL[kind]}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white shrink-0"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="font-body text-sm text-neutral-300 truncate">{itemName}</p>

          {!state ? (
            <p className="py-6 text-center font-body text-sm text-neutral-400">Loading…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Who can see it">
                {LEVELS.map(l => (
                  <PickRow key={l.value} title={saving === l.value ? `${l.title}…` : l.title} subtitle={l.subtitle}
                    selected={state.level === l.value} onSelect={() => pick(l.value)} />
                ))}
              </div>

              {url && (
                <div className="flex flex-col gap-2">
                  <span className="font-body text-sm font-medium text-white">Link</span>
                  <Input size="sm" readOnly value={url} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
                  <div className="flex gap-2">
                    <Button size="sm" color="primary" className="flex-1 justify-center" onClick={copy}>
                      {copied ? 'Copied!' : 'Copy link'}
                    </Button>
                    {canNativeShare && (
                      <Button size="sm" variant="outline" color="primary" className="flex-1 justify-center" onClick={nativeShare}>
                        Share…
                      </Button>
                    )}
                  </div>
                  <p className="font-body text-xs text-neutral-500">
                    Viewers see everything except purchase dates, and can't change anything. Choosing “Not shared” turns this link off for good.
                  </p>
                </div>
              )}
            </>
          )}

          {error && <p className="font-body text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
