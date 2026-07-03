import { useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { Json } from '../lib/database.types';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import MultiSelectDropdown from './MultiSelectDropdown';
import AddonListItem from './AddonListItem';
import Modal from './Modal';
import AddKeywordModal from './AddKeywordModal';
import AddToPackModal from './AddToPackModal';
import UploadPhotoModal from './UploadPhotoModal';
import AddCircle from '@battleplans/ui';
import AltArrowRight from '@battleplans/ui';

export interface BloodBowlCardFormProps {
  packId: string;
  gameId: string;
  onSaved:  (cardId: string) => void;
  onCancel: () => void;
  editingCard?: { id: string; name: string; stats: Record<string, unknown> | null };
}

const ATTR_OPTIONS = ['General', 'Agility', 'Passing', 'Strength', 'Mutations'];

type Phase = { type: 'stats' } | { type: 'content'; cardId: string };

interface Fields {
  unitName: string; teamName: string; playerRole: string; cost: string;
  move: number; strength: number; agility: number; passing: number; armor: number;
  primaryAttr: string[]; secondaryAttr: string[];
}

interface LoadedKeyword {
  keyword_id: string;
  keywords: { name: string; description: string | null } | null;
}

export default function BloodBowlCardForm({
  packId, gameId, onSaved, onCancel, editingCard,
}: BloodBowlCardFormProps) {
  const [phase, setPhase] = useState<Phase>({ type: 'stats' });
  const [f, setF] = useState<Fields>(() => {
    if (!editingCard) return { unitName: '', teamName: '', playerRole: '', cost: '', move: 0, strength: 0, agility: 0, passing: 0, armor: 0, primaryAttr: [], secondaryAttr: [] };
    const s = (editingCard.stats ?? {}) as Record<string, unknown>;
    return {
      unitName:    editingCard.name,
      teamName:    String(s.teamName ?? ''),
      playerRole:  String(s.playerRole ?? ''),
      cost:        String(s.cost ?? ''),
      move:        Number(s.ma ?? 0),
      strength:    Number(s.st ?? 0),
      agility:     Number(s.ag ?? 0),
      passing:     Number(s.pa ?? 0),
      armor:       Number(s.av ?? 0),
      primaryAttr: typeof s.primaryAttribute === 'string' && s.primaryAttribute ? s.primaryAttribute.split(', ') : [],
      secondaryAttr: typeof s.secondaryAttribute === 'string' && s.secondaryAttribute ? s.secondaryAttribute.split(', ') : [],
    };
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [cardKws,  setCardKws]  = useState<LoadedKeyword[]>([]);
  const [pickingKw, setPickingKw] = useState(false);
  const [addingKw, setAddingKw] = useState(false);
  const [kwParamsQueue, setKwParamsQueue] = useState<{ keywordId: string; name: string; schemaKey: string; schemaType: 'text' | 'number' }[]>([]);
  const [kwParamsCardId, setKwParamsCardId] = useState('');
  const [currentKwParamInput, setCurrentKwParamInput] = useState('');
  const [portraitUrl,      setPortraitUrl]      = useState<string | null>(null);
  const [portraitFilePath, setPortraitFilePath] = useState<string | null>(null);
  const [portraitOpen,     setPortraitOpen]     = useState(false);
  const [removingPortrait, setRemovingPortrait] = useState(false);

  async function loadContent(cardId: string) {
    const [kwRes, imgRes] = await Promise.all([
      supabase.from('card_keywords')
        .select('keyword_id, keywords(name, description)')
        .eq('card_id', cardId).order('sort_order'),
      supabase.from('card_images')
        .select('file_path')
        .eq('card_id', cardId)
        .eq('image_type', 'portrait')
        .limit(1),
    ]);
    setCardKws((kwRes.data ?? []) as unknown as LoadedKeyword[]);
    const fp = (imgRes.data?.[0] as { file_path: string } | undefined)?.file_path ?? null;
    setPortraitFilePath(fp);
    setPortraitUrl(fp ? supabase.storage.from('card-images').getPublicUrl(fp).data.publicUrl : null);
  }

  async function handleCreate() {
    setSaving(true); setError(null);
    const newStats = {
      teamName: f.teamName, playerRole: f.playerRole, cost: f.cost,
      primaryAttribute: f.primaryAttr.join(', '), secondaryAttribute: f.secondaryAttr.join(', '),
      ma: f.move, st: f.strength, ag: f.agility, pa: f.passing, av: f.armor,
    };
    try {
      if (editingCard) {
        const { error: err } = await supabase.from('cards')
          .update({ name: f.unitName || 'Unnamed Player', stats: newStats as Json })
          .eq('id', editingCard.id);
        if (err) throw err;
        await loadContent(editingCard.id);
        setPhase({ type: 'content', cardId: editingCard.id });
      } else {
        const { data, error: err } = await supabase.from('cards')
          .insert({ pack_id: packId, game_id: gameId, name: f.unitName || 'Unnamed Player', stats: newStats as Json, card_type: 'operative', is_template: true })
          .select('id').single();
        if (err) throw err;
        setPhase({ type: 'content', cardId: (data as { id: string }).id });
      }
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Failed to save card');
    } finally {
      setSaving(false);
    }
  }

  // ── Phase 1: stats ──────────────────────────────────────────────────────────

  if (phase.type === 'stats') {
    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">{editingCard ? 'Edit Player' : 'New Player'}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Player Name" value={f.unitName}   onChange={e => setF(p => ({ ...p, unitName: e.target.value }))}   placeholder="e.g. Griff Oberwald" disabled={saving} />
          <Input label="Team Name"   value={f.teamName}   onChange={e => setF(p => ({ ...p, teamName: e.target.value }))}   placeholder="e.g. Reikland Reavers" disabled={saving} />
          <Input label="Position"    value={f.playerRole} onChange={e => setF(p => ({ ...p, playerRole: e.target.value }))} placeholder="e.g. Blitzer" disabled={saving} />
          <Input label="Cost (gp)"   value={f.cost}       onChange={e => setF(p => ({ ...p, cost: e.target.value }))}       placeholder="e.g. 80,000" disabled={saving} />
        </div>

        <div className="grid grid-cols-5 gap-3">
          <Counter label="MA" value={f.move}     onChange={v => setF(p => ({ ...p, move: v }))}     min={0} />
          <Counter label="ST" value={f.strength} onChange={v => setF(p => ({ ...p, strength: v }))} min={0} />
          <Counter label="AG" value={f.agility}  onChange={v => setF(p => ({ ...p, agility: v }))}  min={0} />
          <Counter label="PA" value={f.passing}  onChange={v => setF(p => ({ ...p, passing: v }))}  min={0} />
          <Counter label="AV" value={f.armor}    onChange={v => setF(p => ({ ...p, armor: v }))}    min={0} />
        </div>

        <MultiSelectDropdown
          label="Primary Attributes"
          options={ATTR_OPTIONS}
          selected={f.primaryAttr}
          onChange={v => setF(p => ({ ...p, primaryAttr: v }))}
          placeholder="Select categories"
        />
        <MultiSelectDropdown
          label="Secondary Attributes"
          options={ATTR_OPTIONS}
          selected={f.secondaryAttr}
          onChange={v => setF(p => ({ ...p, secondaryAttr: v }))}
          placeholder="Select categories"
        />

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>
            {editingCard ? 'Save Changes' : 'Create Player'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase 2: content (skills only — BB has no addon forms) ──────────────────

  const { cardId } = phase;
  return (
    <div className="flex flex-col gap-6 p-5">
      <h2 className="font-heading text-xl text-white">
        {f.unitName || 'New Player'} — {editingCard ? 'Edit Skills' : 'Add Skills'}
      </h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Skills</h3>
          <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingKw(true)}>
            Add Skill
          </Button>
        </div>
        {cardKws.length === 0
          ? <p className="font-body text-sm text-gray-500 py-2">No skills yet.</p>
          : cardKws.map(k => (
              <AddonListItem key={k.keyword_id} name={k.keywords?.name ?? '(unknown)'} subtitle={k.keywords?.description ?? ''} addonTypeName="Skill"
                onDelete={async () => {
                  await supabase.from('card_keywords').delete().eq('card_id', cardId).eq('keyword_id', k.keyword_id);
                  await loadContent(cardId);
                }}
              />
            ))
        }
      </div>

      {/* Portrait Image */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-base text-gray-300">Portrait Image</h3>
          <div className="flex flex-col items-end gap-1">
            <Button variant="ghost" color="primary" size="sm" onClick={() => setPortraitOpen(true)}>
              {portraitUrl ? 'Change Portrait' : 'Add Portrait Image'}
            </Button>
            {portraitUrl && (
              <Button variant="ghost" color="danger" size="sm" loading={removingPortrait}
                onClick={async () => {
                  if (!portraitFilePath) return;
                  setRemovingPortrait(true);
                  await supabase.storage.from('card-images').remove([portraitFilePath]);
                  await supabase.from('card_images').delete().eq('card_id', cardId).eq('image_type', 'portrait');
                  setPortraitUrl(null);
                  setPortraitFilePath(null);
                  setRemovingPortrait(false);
                }}
              >
                Remove Portrait
              </Button>
            )}
          </div>
        </div>
        {portraitUrl && (
          <p className="font-body text-sm text-green-400">Portrait added.</p>
        )}
      </div>

      <div className="pt-1">
        <Button color="primary" rightIcon={<AltArrowRight className="size-4" />} onClick={() => onSaved(cardId)}>
          Done
        </Button>
      </div>

      {portraitOpen && (
        <UploadPhotoModal
          open
          onClose={() => setPortraitOpen(false)}
          game="blood-bowl"
          cardDbId={cardId}
          unitName={f.unitName || undefined}
          onImageUploaded={() => { void loadContent(cardId); }}
        />
      )}

      {pickingKw && (
        <AddToPackModal open onClose={() => setPickingKw(false)}
          entityType="keyword"
          gameId={gameId} targetPackId={packId} includeTargetPack
          title="Add Skill" newButtonLabel="New Skill"
          onCreateNew={() => { setPickingKw(false); setAddingKw(true); }}
          onAdded={() => setPickingKw(false)}
          onAddedWithIds={async ids => {
            const { data } = await supabase.from('keywords').select('id, name, params_schema').in('id', ids);
            const rows = (data ?? []) as { id: string; name: string; params_schema: { key: string; type: string }[] | null }[];
            const kwMap = new Map(rows.map(k => [k.id, k]));
            const noParams = ids.filter(id => !kwMap.get(id)?.params_schema?.length);
            const withParams = ids
              .filter(id => kwMap.get(id)?.params_schema?.length)
              .map(id => { const kw = kwMap.get(id)!; return { keywordId: id, name: kw.name, schemaKey: kw.params_schema![0].key, schemaType: kw.params_schema![0].type as 'text' | 'number' }; });
            if (noParams.length > 0) {
              await supabase.from('card_keywords').insert(
                noParams.map((keywordId, i) => ({ card_id: cardId, keyword_id: keywordId, params: {}, sort_order: cardKws.length + i }))
              );
              await loadContent(cardId);
            }
            if (withParams.length > 0) { setKwParamsQueue(withParams); setKwParamsCardId(cardId); setCurrentKwParamInput(''); }
            setPickingKw(false);
          }}
        />
      )}
      {addingKw && (
        <AddKeywordModal open onClose={() => setAddingKw(false)} gameSlug="blood-bowl" createOnly typeName="Skill"
          onKeywordSelected={async (kw) => {
            if (kw.hasParams && kw.paramValue === null) {
              setKwParamsQueue([{ keywordId: kw.keywordId, name: kw.keywordName, schemaKey: 'X', schemaType: 'number' }]);
              setKwParamsCardId(cardId);
              setCurrentKwParamInput('');
            } else {
              await supabase.from('card_keywords').insert({
                card_id: cardId, keyword_id: kw.keywordId,
                params: kw.hasParams && kw.paramValue !== null ? { X: kw.paramValue } : {},
                sort_order: cardKws.length,
              });
              await loadContent(cardId);
            }
            setAddingKw(false);
          }}
        />
      )}
      {kwParamsQueue.length > 0 && (
        <Modal open onClose={() => setKwParamsQueue([])}>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-xl text-white">Set value for {kwParamsQueue[0].name}</h2>
            <Input
              label="Value"
              value={currentKwParamInput}
              onChange={e => setCurrentKwParamInput(e.target.value)}
              type={kwParamsQueue[0].schemaType === 'number' ? 'number' : 'text'}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" color="secondary" onClick={() => setKwParamsQueue([])}>Cancel</Button>
              <Button color="primary" disabled={!currentKwParamInput.trim()}
                onClick={async () => {
                  const { keywordId, schemaKey, schemaType } = kwParamsQueue[0];
                  const raw = currentKwParamInput.trim();
                  await supabase.from('card_keywords').insert({
                    card_id: kwParamsCardId, keyword_id: keywordId,
                    params: { [schemaKey]: schemaType === 'number' ? Number(raw) : raw },
                    sort_order: cardKws.length,
                  });
                  await loadContent(kwParamsCardId);
                  setKwParamsQueue(prev => prev.slice(1));
                  setCurrentKwParamInput('');
                }}
              >Add</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
