/**
 * ShareDeckSheet.tsx — Turn a deck into a shareable link
 *
 * Opened from the ⋯ menu in a builder's left panel. Shows whether the deck is
 * currently shared, hands over the link to copy, and lets the owner stop
 * sharing again.
 *
 * Sharing is idempotent on the server (see share_deck in
 * migration_deck_sharing.sql): reopening this sheet on an already-shared deck
 * returns the same token, so a link the user has already sent someone never
 * silently dies just because they looked at the dialog again. Stopping, by
 * contrast, kills the link there and then — which is why it asks first.
 *
 * Composed from the shared Sheet / Button / Input primitives; it adds no new
 * visual language of its own.
 *
 * USAGE:
 *   <ShareDeckSheet
 *     open={shareOpen}
 *     onClose={() => setShareOpen(false)}
 *     deckId={deckId}
 *     deckName={deckName}
 *   />
 */

import { useCallback, useEffect, useState } from 'react';
import { Sheet, Button, Input, Text, supabase } from '@battleplans/ui';
import { Share, Copy, CheckCircle } from '@battleplans/ui';
import { shareDeck, unshareDeck, shareUrlFor } from '../lib/shareClient';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface ShareDeckSheetProps {
  /** Whether the sheet is visible. */
  open: boolean;
  /** Called on backdrop tap, swipe-down dismiss, or Done. */
  onClose: () => void;
  /** Deck being shared. */
  deckId: string;
  /** Deck name, shown so the user can see what they're about to publish.
   *  Null while the builder is still loading it, or for an unnamed deck. */
  deckName: string | null;
}

/** How long the copy button stays in its "Copied" state. */
const COPIED_MS = 2000;

// ── Component ─────────────────────────────────────────────────────────────────

const ShareDeckSheet = ({ open, onClose, deckId, deckName }: ShareDeckSheetProps) => {
  const [token,     setToken]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [working,   setWorking]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [confirming, setConfirming] = useState(false);

  // ── Current share state ───────────────────────────────────────────────────
  // Read on open rather than held by the caller, so the sheet is correct even
  // if the deck was shared from another device or an earlier session.

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfirming(false);

    supabase
      .from('decks')
      .select('share_token')
      .eq('id', deckId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Couldn't check whether this deck is shared.");
        else setToken((data?.share_token as string | null) ?? null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, deckId]);

  // Reset the transient copy state whenever the sheet closes.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      setToken(await shareDeck(deckId));
    } catch (err) {
      console.error('[BattleCards] Failed to share deck:', err);
      setError("Couldn't create a share link. Please try again.");
    } finally {
      setWorking(false);
    }
  }, [deckId]);

  const handleUnshare = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      await unshareDeck(deckId);
      setToken(null);
      setConfirming(false);
    } catch (err) {
      console.error('[BattleCards] Failed to stop sharing deck:', err);
      setError("Couldn't stop sharing. Please try again.");
    } finally {
      setWorking(false);
    }
  }, [deckId]);

  const handleCopy = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(token));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard access can be refused (insecure origin, or the user said no).
      // The link is on screen and selectable, so this is a soft failure.
      setError('Copy failed — you can select the link and copy it manually.');
    }
  }, [token]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onClose={onClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-4">

        <div className="flex flex-col gap-1">
          <Text variant="h5">Share deck</Text>
          <Text variant="paragraph" size="sm" color="secondary">{deckName || 'Untitled'}</Text>
        </div>

        {loading ? (
          <Text variant="paragraph" size="sm" color="secondary">Checking…</Text>
        ) : token ? (
          <>
            <Text variant="paragraph" size="sm" color="secondary">
              Anyone with this link can view this deck and copy it into their own
              decks. They can't change yours.
            </Text>

            <Input
              readOnly
              value={shareUrlFor(token)}
              aria-label="Share link"
              onFocus={e => e.currentTarget.select()}
              rightElement={
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy share link"
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  {copied
                    ? <CheckCircle className="size-4 text-green-400" />
                    : <Copy className="size-4" />}
                </button>
              }
            />

            {confirming ? (
              <div className="flex flex-col gap-2">
                <Text variant="paragraph" size="sm" color="secondary">
                  Stop sharing? The link above will stop working straight away,
                  including for anyone you've already sent it to. Copies they've
                  already made are theirs to keep.
                </Text>
                <div className="flex gap-2">
                  <Button
                    color="danger"
                    size="sm"
                    loading={working}
                    onClick={handleUnshare}
                  >
                    Stop sharing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(false)}
                  >
                    Keep sharing
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                className="self-start"
                onClick={() => setConfirming(true)}
              >
                Stop sharing
              </Button>
            )}
          </>
        ) : (
          <>
            <Text variant="paragraph" size="sm" color="secondary">
              Create a link to this deck. Anyone you send it to can view the
              cards and copy the deck for themselves — no account needed to look.
            </Text>
            <Button
              leftIcon={<Share className="size-4" />}
              loading={working}
              onClick={handleShare}
              className="self-start"
            >
              Create share link
            </Button>
          </>
        )}

        {error && (
          <Text variant="paragraph" size="sm" className="text-red-400">{error}</Text>
        )}
      </div>
    </Sheet>
  );
};

export default ShareDeckSheet;
