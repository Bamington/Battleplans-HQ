import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AddonType, Addon, Json } from '../lib/database.types';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import HaloWeaponForm from './HaloWeaponForm';
import AddKeywordModal from './AddKeywordModal';
import AddToPackModal from './AddToPackModal';
import UploadPhotoModal from './UploadPhotoModal';
import { haloWeaponSubtitle } from '../lib/addonSubtitles';
import AddCircle from '../icons/AddCircle';
import AltArrowRight from '../icons/AltArrowRight';

export interface HaloCardFormProps {
  packId: string;
  gameId: string;
  addonTypes: AddonType[];
  onSaved:  (cardId: string) => void;
  onCancel: () => void;
  editingCard?: { id: string; name: string; stats: Record<string, unknown> | null };
  /** 'operative' (default) or 'rule' — drives which fields appear. */
  cardType?: 'operative' | 'rule';
}

type Phase = { type: 'stats' } | { type: 'content'; cardId: string };

interface Fields {
  unitName: string;
  ra: number; fi: number; sv: number;
  advance: number; sprint: number;
  hp: number; armour: number; pointsCost: number;
}

interface LoadedAddon {
  id: string; name: string; description: string | null; stats: unknown;
}
interface LoadedKeyword {
  keyword_id: string;
  keywords: { name: string; description: string | null } | null;
}

export default function HaloCardForm({
  packId, gameId, addonTypes, cardType = 'operative', onSaved, onCancel, editingCard,
}: HaloCardFormProps) {
  const [phase, setPhase] = useState<Phase>({ type: 'stats' });
  const [f, setF] = useState<Fields>(() => {
    if (!editingCard || cardType === 'rule') return { unitName: '', ra: 0, fi: 0, sv: 0, advance: 0, sprint: 0, hp: 0, armour: 0, pointsCost: 0 };
    const s = (editingCard.stats ?? {}) as Record<string, unknown>;
    return {
      unitName:   editingCard.name,
      ra:         Number(s.ra ?? 0),
      fi:         Number(s.fi ?? 0),
      sv:         Number(s.sv ?? 0),
      advance:    Number(s.advanceValue ?? 0),
      sprint:     Number(s.sprintValue ?? 0),
      hp:         Number(s.hp ?? 0),
      armour:     Number(s.ar ?? 0),
      pointsCost: Number(s.pointsCost ?? 0),
    };
  });
  const [ruleF, setRuleF] = useState<{ title: string; description: string }>(() => {
    if (!editingCard || cardType !== 'rule') return { title: '', description: '' };
    return { title: editingCard.name, description: String((editingCard.stats ?? {}).description ?? '') };
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [weapons,    setWeapons]    = useState<LoadedAddon[]>([]);
  const [cardKws,    setCardKws]    = useState<LoadedKeyword[]>([]);
  const [pickingW,   setPickingW]   = useState(false);
  const [addingW,    setAddingW]    = useState(false);
  const [editingW,   setEditingW]   = useState<LoadedAddon | null>(null);
  const [savingW,    setSavingW]    = useState(false);
  const [pickingKw,  setPickingKw]  = useState(false);
  const [addingKw,   setAddingKw]   = useState(false);
  const [kwParamsQueue, setKwParamsQueue] = useState<{ keywordId: string; name: string; schemaKey: string; schemaType: 'text' | 'number' }[]>([]);
  const [kwParamsCardId, setKwParamsCardId] = useState('');
  const [currentKwParamInput, setCurrentKwParamInput] = useState('');
  const [portraitUrl,      setPortraitUrl]      = useState<string | null>(null);
  const [portraitFilePath, setPortraitFilePath] = useState<string | null>(null);
  const [portraitOpen,     setPortraitOpen]     = useState(false);
  const [removingPortrait, setRemovingPortrait] = useState(false);

  const weaponType = addonTypes.find(t => t.slug === 'weapons');

  const loadContent = useCallback(async (cardId: string) => {
    const [wRes, kRes, imgRes] = await Promise.all([
      supabase.from('card_addons')
        .select('addons(id, name, description, stats)')
        .eq('card_id', cardId).order('sort_order'),
      supabase.from('card_keywords')
        .select('keyword_id, keywords(name, description)')
        .eq('card_id', cardId).order('sort_order'),
      supabase.from('card_images')
        .select('file_path')
        .eq('card_id', cardId)
        .eq('image_type', 'portrait')
        .limit(1),
    ]);
    setWeapons((wRes.data ?? []).map(r => r.addons as unknown as LoadedAddon).filter(Boolean));
    setCardKws((kRes.data ?? []) as unknown as LoadedKeyword[]);
    const fp = (imgRes.data?.[0] as { file_path: string } | undefined)?.file_path ?? null;
    setPortraitFilePath(fp);
    setPortraitUrl(fp ? supabase.storage.from('card-images').getPublicUrl(fp).data.publicUrl : null);
  }, []);

  async function handleCreate() {
    setSaving(true); setError(null);
    try {
      if (cardType === 'rule') {
        const ruleStats = { description: ruleF.description } as Json;
        if (editingCard) {
          const { error: err } = await supabase.from('cards')
            .update({ name: ruleF.title || 'New Rule', stats: ruleStats })
            .eq('id', editingCard.id);
          if (err) throw err;
          onSaved(editingCard.id);
        } else {
          const { data, error: err } = await supabase.from('cards')
            .insert({ pack_id: packId, game_id: gameId, name: ruleF.title || 'New Rule', stats: ruleStats, card_type: 'rule', is_template: true })
            .select('id').single();
          if (err) throw err;
          onSaved((data as { id: string }).id);
        }
        return;
      }
      const newStats = { ra: f.ra, fi: f.fi, sv: f.sv, advanceValue: f.advance, sprintValue: f.sprint, ar: f.armour, hp: f.hp, pointsCost: f.pointsCost, keywords: '' };
      if (editingCard) {
        const { error: err } = await supabase.from('cards')
          .update({ name: f.unitName || 'Unnamed Unit', stats: newStats as Json })
          .eq('id', editingCard.id);
        if (err) throw err;
        await loadContent(editingCard.id);
        setPhase({ type: 'content', cardId: editingCard.id });
      } else {
        const { data, error: err } = await supabase.from('cards')
          .insert({ pack_id: packId, game_id: gameId, name: f.unitName || 'Unnamed Unit', stats: newStats as Json, card_type: 'operative', is_template: true })
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

  const handleWeaponSave = useCallback(async (name: string, description: string | null, stats: unknown): Promise<string> => {
    if (!weaponType) return '';
    setSavingW(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingW(false); return ''; }
    const { data, error: err } = await supabase.from('addons')
      .insert({ user_id: user.id, addon_type_id: weaponType.id, pack_id: packId, name, description, stats: stats as Json })
      .select('id').single();
    if (err) { setSavingW(false); return ''; }
    return (data as { id: string }).id;
  }, [packId, weaponType]);

  const handleWeaponSaveComplete = useCallback(async (addonId: string) => {
    if (phase.type !== 'content') return;
    await supabase.from('card_addons').insert({
      card_id: phase.cardId, addon_id: addonId, sort_order: weapons.length,
    });
    await loadContent(phase.cardId);
    setAddingW(false); setSavingW(false);
  }, [phase, weapons.length, loadContent]);

  const handleWeaponEditSave = useCallback(async (name: string, description: string | null, stats: unknown): Promise<string> => {
    if (!editingW) return '';
    setSavingW(true);
    await supabase.from('addons').update({ name, description, stats: stats as Json }).eq('id', editingW.id);
    return editingW.id;
  }, [editingW]);

  const handleWeaponEditSaveComplete = useCallback(async (_id: string) => {
    if (phase.type === 'content') await loadContent(phase.cardId);
    setEditingW(null); setSavingW(false);
  }, [phase, loadContent]);

  // ── Phase 1 (rule): title + description ────────────────────────────────────

  if (phase.type === 'stats' && cardType === 'rule') {
    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">{editingCard ? 'Edit Rule Card' : 'New Rule Card'}</h2>
        <Input
          label="Title"
          value={ruleF.title}
          onChange={e => setRuleF(p => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Fire Support"
          disabled={saving}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium font-body text-white">Description</label>
          <textarea
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                       font-body text-white placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       min-h-[78px] resize-y disabled:opacity-50"
            placeholder="Rule text…"
            value={ruleF.description}
            onChange={e => setRuleF(p => ({ ...p, description: e.target.value }))}
            disabled={saving}
          />
        </div>
        {error && <p className="font-body text-sm text-red-400">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>
            {editingCard ? 'Save Changes' : 'Create Rule Card'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase 1: stats ──────────────────────────────────────────────────────────

  if (phase.type === 'stats') {
    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">{editingCard ? 'Edit Unit' : 'New Unit'}</h2>

        <Input
          label="Unit Name"
          value={f.unitName}
          onChange={e => setF(p => ({ ...p, unitName: e.target.value }))}
          placeholder="e.g. Elite Specialist"
          disabled={saving}
        />

        <div className="grid grid-cols-3 gap-3">
          <Counter label="RA"     value={f.ra}         onChange={v => setF(p => ({ ...p, ra: v }))}         min={0} />
          <Counter label="FI"     value={f.fi}         onChange={v => setF(p => ({ ...p, fi: v }))}         min={0} />
          <Counter label="SV"     value={f.sv}         onChange={v => setF(p => ({ ...p, sv: v }))}         min={0} />
          <Counter label="Advance" value={f.advance}   onChange={v => setF(p => ({ ...p, advance: v }))}   min={0} />
          <Counter label="Sprint"  value={f.sprint}    onChange={v => setF(p => ({ ...p, sprint: v }))}    min={0} />
          <Counter label="HP"      value={f.hp}        onChange={v => setF(p => ({ ...p, hp: v }))}        min={0} />
          <Counter label="Armour"  value={f.armour}    onChange={v => setF(p => ({ ...p, armour: v }))}    min={0} />
          <Counter label="Points"  value={f.pointsCost} onChange={v => setF(p => ({ ...p, pointsCost: v }))} min={0} />
        </div>

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>
            {editingCard ? 'Save Changes' : 'Create Unit'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase 2: content ────────────────────────────────────────────────────────

  const { cardId } = phase;
  return (
    <div className="flex flex-col gap-6 p-5">
      <h2 className="font-heading text-xl text-white">
        {f.unitName || 'New Unit'} — {editingCard ? 'Edit Content' : 'Add Content'}
      </h2>

      {/* Weapons */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Weapons</h3>
          {weaponType && (
            <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingW(true)}>
              Add Weapon
            </Button>
          )}
        </div>
        {weapons.length === 0
          ? <p className="font-body text-sm text-gray-500 py-2">No weapons yet.</p>
          : weapons.map(w => (
              <AddonListItem key={w.id} name={w.name} subtitle={haloWeaponSubtitle(w)} addonTypeName="Weapon"
                onEdit={() => setEditingW(w)}
                onDelete={async () => {
                  await supabase.from('card_addons').delete().eq('card_id', cardId).eq('addon_id', w.id);
                  await loadContent(cardId);
                }}
              />
            ))
        }
      </div>

      {/* Keywords */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Unit Keywords</h3>
          <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingKw(true)}>
            Add Keyword
          </Button>
        </div>
        {cardKws.length === 0
          ? <p className="font-body text-sm text-gray-500 py-2">No keywords yet.</p>
          : cardKws.map(k => (
              <AddonListItem key={k.keyword_id} name={k.keywords?.name ?? '(unknown)'} subtitle={k.keywords?.description ?? ''} addonTypeName="Keyword"
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
          game="halo-flashpoint"
          cardDbId={cardId}
          unitName={f.unitName || undefined}
          onImageUploaded={() => { void loadContent(cardId); }}
        />
      )}

      {pickingW && weaponType && (
        <AddToPackModal open onClose={() => setPickingW(false)}
          entityType="addon" addonTypeId={weaponType.id}
          gameId={gameId} targetPackId={packId} includeTargetPack
          title="Add Weapon" newButtonLabel="New Weapon"
          getAddonSubtitle={haloWeaponSubtitle}
          onCreateNew={() => { setPickingW(false); setAddingW(true); }}
          onAdded={() => setPickingW(false)}
          onAddedWithIds={async ids => {
            await supabase.from('card_addons').insert(
              ids.map((addonId, i) => ({ card_id: cardId, addon_id: addonId, sort_order: weapons.length + i }))
            );
            await loadContent(cardId);
            setPickingW(false);
          }}
        />
      )}
      {addingW && (
        <Modal open onClose={() => !savingW && setAddingW(false)} className="max-w-md">
          <HaloWeaponForm editingAddon={null} saving={savingW} onCancel={() => setAddingW(false)}
            onSave={handleWeaponSave} onSaveComplete={handleWeaponSaveComplete} />
        </Modal>
      )}
      {editingW && (
        <Modal open onClose={() => !savingW && setEditingW(null)} className="max-w-md">
          <HaloWeaponForm editingAddon={editingW as unknown as Addon} saving={savingW} onCancel={() => setEditingW(null)}
            onSave={handleWeaponEditSave} onSaveComplete={handleWeaponEditSaveComplete} />
        </Modal>
      )}
      {pickingKw && (
        <AddToPackModal open onClose={() => setPickingKw(false)}
          entityType="keyword"
          gameId={gameId} targetPackId={packId} includeTargetPack
          title="Add Keyword" newButtonLabel="New Keyword"
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
        <AddKeywordModal open onClose={() => setAddingKw(false)} gameSlug="halo-flashpoint" createOnly
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
