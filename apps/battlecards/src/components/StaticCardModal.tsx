/**
 * StaticCardModal.tsx — Create / edit a static (image-only) card in a pack
 *
 * Used by the Pack Editor for List Builder games (games with no custom card
 * builder). A static card is a name, a card type, the game's numeric stats
 * (e.g. HP for play-mode tokens) and a card face image.
 *
 * Face images upload to card-images/packs/{packId}/{uuid}.{ext} and are stored
 * on cards.face_path. Replacing a face uploads a NEW file and never deletes the
 * old one: imported copies of this card still reference the old path.
 *
 * "Save & Add Another" keeps the modal open with the type preserved, for
 * entering a whole set quickly.
 *
 * USAGE:
 *   <StaticCardModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     packId={pack.id}
 *     gameId={pack.game_id}
 *     statSchema={pack.game.stat_schema}
 *     printSize={pack.game.print_size}
 *     defaultCardType="operative"
 *     card={editingCard}            // omit for create mode
 *     onSaved={() => reload()}
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@battleplans/ui';
import { Input } from '@battleplans/ui';
import { Select } from '@battleplans/ui';
import { Button } from '@battleplans/ui';
import { Text } from '@battleplans/ui';
import StaticCard, { cardFaceUrl, nativeCardHeight } from './StaticCard';
import { supabase } from '@battleplans/ui';
import type { CardTypeSizes, Json, StatField } from '../lib/database.types';
import { printSizeFor } from '../lib/cardSizes';

export type StaticCardType = 'operative' | 'rule';

export interface StaticCardModalCard {
  id:        string;
  name:      string;
  card_type: string;
  stats:     Record<string, Json>;
  face_path: string | null;
}

export interface StaticCardModalProps {
  open:            boolean;
  onClose:         () => void;
  packId:          string;
  gameId:          string;
  /** Game stat schema — only number fields are shown. */
  statSchema:      StatField[];
  /** [w_mm, h_mm] — sets the preview aspect ratio. */
  printSize?:      [number, number] | null;
  /** Per-card-type size overrides (games.card_type_sizes), e.g. portrait tactics. */
  cardTypeSizes?:  CardTypeSizes | null;
  /** Card type preselected in create mode. */
  defaultCardType?: StaticCardType;
  /** Existing card → edit mode. */
  card?:           StaticCardModalCard | null;
  /** Called after each successful save. */
  onSaved:         () => void;
}

const TYPE_OPTIONS = [
  { value: 'operative', label: 'Unit' },
  { value: 'rule',      label: 'Tactic / Rule' },
];

const PREVIEW_W = 180;
const NATIVE_W  = 750;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

const StaticCardModal = ({
  open, onClose, packId, gameId, statSchema, printSize, cardTypeSizes,
  defaultCardType = 'operative', card, onSaved,
}: StaticCardModalProps) => {
  const numberFields = statSchema.filter(f => f.type === 'number');
  const isEdit = Boolean(card);

  const [name, setName]         = useState('');
  const [cardType, setCardType] = useState<StaticCardType>(defaultCardType);
  const [stats, setStats]       = useState<Record<string, string>>({});
  const [file, setFile]         = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = (type: StaticCardType) => {
    setName('');
    setCardType(type);
    setStats({});
    setFile(null);
    setError(null);
  };

  // (Re)initialise whenever the modal opens or the edited card changes.
  useEffect(() => {
    if (!open) return;
    if (card) {
      setName(card.name);
      setCardType(card.card_type === 'rule' ? 'rule' : 'operative');
      setStats(Object.fromEntries(
        Object.entries(card.stats ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ));
      setFile(null);
      setError(null);
    } else {
      resetForm(defaultCardType);
    }
  }, [open, card, defaultCardType]);

  // Object URL for the locally picked file.
  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (f.size > MAX_FILE_SIZE) { setError('Image must be under 30 MB.'); return; }
    setError(null);
    setFile(f);
    // Prefill the name from the file name in create mode.
    if (!isEdit && !name.trim()) {
      setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
    }
  };

  const nativeH = nativeCardHeight(NATIVE_W, printSizeFor({ print_size: printSize, card_type_sizes: cardTypeSizes }, cardType));
  const previewUrl = filePreview ?? cardFaceUrl(card?.face_path);

  const save = async (addAnother: boolean) => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!isEdit && !file) { setError('Choose a card face image.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      let facePath = card?.face_path ?? null;
      if (file) {
        const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
        facePath = `packs/${packId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('card-images')
          .upload(facePath, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
      }

      const statValues: Record<string, number> = {};
      for (const f of numberFields) {
        const n = Number(stats[f.key]);
        if (stats[f.key] !== undefined && stats[f.key] !== '' && Number.isFinite(n)) statValues[f.key] = n;
      }
      // Tactics carry no unit stats.
      const finalStats = cardType === 'rule' ? {} : statValues;

      if (card) {
        const { error: updErr } = await supabase.from('cards')
          .update({ name: name.trim(), card_type: cardType, stats: finalStats, face_path: facePath })
          .eq('id', card.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('cards').insert({
          user_id: user.id, game_id: gameId, pack_id: packId, deck_id: null,
          is_template: true, name: name.trim(), card_type: cardType,
          stats: finalStats, face_path: facePath,
        });
        if (insErr) throw insErr;
      }

      onSaved();
      if (addAnother && !isEdit) {
        resetForm(cardType);
        fileInputRef.current?.focus();
      } else {
        onClose();
      }
    } catch (e) {
      console.error('[StaticCardModal] save failed:', e);
      setError((e as { message?: string })?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} className="max-w-2xl w-full">
      <div className="p-5 flex flex-col gap-5">
        <Text variant="h5">{isEdit ? 'Edit Card' : 'Add Card'}</Text>

        <div className="flex flex-col sm:flex-row gap-5">
          {/* Face preview + picker */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div
              className="relative overflow-hidden"
              style={{ width: PREVIEW_W, height: Math.round(nativeH * (PREVIEW_W / NATIVE_W)) }}
            >
              <div style={{ transform: `scale(${PREVIEW_W / NATIVE_W})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StaticCard faceUrl={previewUrl} name={name || 'Card face'} width={NATIVE_W} height={nativeH} />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
              {previewUrl ? 'Replace Image' : 'Choose Image'}
            </Button>
          </div>

          {/* Fields */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <Input label="Name" required value={name} onChange={e => setName(e.target.value)} maxLength={80} />
            <Select
              label="Card type"
              options={TYPE_OPTIONS}
              value={cardType}
              onChange={e => setCardType(e.target.value as StaticCardType)}
            />
            {cardType === 'operative' && numberFields.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {numberFields.map(f => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type="number"
                    inputMode="numeric"
                    value={stats[f.key] ?? ''}
                    onChange={e => setStats(s => ({ ...s, [f.key]: e.target.value }))}
                  />
                ))}
              </div>
            )}
            {cardType === 'operative' && numberFields.length > 0 && (
              <Text color="secondary" size="sm">Stats drive play-mode tokens (e.g. the HP bar) — the card face itself is just the image.</Text>
            )}
          </div>
        </div>

        {error && <Text color="danger" size="sm">{error}</Text>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" color="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          {!isEdit && (
            <Button variant="outline" onClick={() => save(true)} loading={saving}>Save &amp; Add Another</Button>
          )}
          <Button onClick={() => save(false)} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

export default StaticCardModal;
