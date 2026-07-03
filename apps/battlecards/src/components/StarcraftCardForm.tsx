import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AddonType, Addon, Json } from '../lib/database.types';
import type { StarcraftSupplyTier } from './StarcraftCard';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import StarcraftWeaponForm from './StarcraftWeaponForm';
import StarcraftAbilityForm from './StarcraftAbilityForm';
import StarcraftSupplyTiersModal from './StarcraftSupplyTiersModal';
import StarcraftAddKeywordModal from './StarcraftAddKeywordModal';
import AddToPackModal from './AddToPackModal';
import { starcraftWeaponSubtitle, starcraftAbilitySubtitle } from '../lib/addonSubtitles';
import AddCircle from '../icons/AddCircle';
import AltArrowRight from '../icons/AltArrowRight';

export interface StarcraftCardFormProps {
  packId:    string;
  gameId:    string;
  addonTypes: AddonType[];
  onSaved:  (cardId: string) => void;
  onCancel: () => void;
  editingCard?: { id: string; name: string; stats: Record<string, unknown> | null };
}

type Phase = { type: 'stats' } | { type: 'content'; cardId: string };

interface Fields {
  unitType: string; unitName: string; tags: string;
  speed: number; evade: number; armour: number;
  hitPoints: number; size: number; pointsCost: number;
  supplyTiers: StarcraftSupplyTier[];
}

interface LoadedAddon {
  id: string; name: string; description: string | null; stats: unknown;
  addon_type: { slug: string } | null;
}
interface LoadedKeyword {
  keyword_id: string;
  keywords: { name: string; description: string | null } | null;
}

export default function StarcraftCardForm({
  packId, gameId, addonTypes, onSaved, onCancel, editingCard,
}: StarcraftCardFormProps) {
  const [phase, setPhase] = useState<Phase>({ type: 'stats' });
  const [f, setF] = useState<Fields>(() => {
    if (!editingCard) return { unitType: '', unitName: '', tags: '', speed: 0, evade: 0, armour: 0, hitPoints: 0, size: 0, pointsCost: 0, supplyTiers: [{ supply: 0, maxModels: 1 }] };
    const s = (editingCard.stats ?? {}) as Record<string, unknown>;
    return {
      unitType:    editingCard.name,
      unitName:    String(s.unitName ?? ''),
      tags:        String(s.tags ?? ''),
      speed:       Number(s.speed ?? 0),
      evade:       Number(s.evade ?? 0),
      armour:      Number(s.armour ?? 0),
      hitPoints:   Number(s.hitPoints ?? 0),
      size:        Number(s.size ?? 0),
      pointsCost:  Number(s.pointsCost ?? 0),
      supplyTiers: Array.isArray(s.supplyTiers) ? s.supplyTiers as StarcraftSupplyTier[] : [{ supply: 0, maxModels: 1 }],
    };
  });
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Phase 2
  const [weapons,   setWeapons]   = useState<LoadedAddon[]>([]);
  const [rules,     setRules]     = useState<LoadedAddon[]>([]);
  const [cardKws,   setCardKws]   = useState<LoadedKeyword[]>([]);
  const [pickingW,  setPickingW]  = useState(false);
  const [addingW,   setAddingW]   = useState(false);
  const [editingW,  setEditingW]  = useState<LoadedAddon | null>(null);
  const [savingW,   setSavingW]   = useState(false);
  const [pickingR,  setPickingR]  = useState(false);
  const [addingR,   setAddingR]   = useState(false);
  const [editingR,  setEditingR]  = useState<LoadedAddon | null>(null);
  const [savingR,   setSavingR]   = useState(false);
  const [pickingKw, setPickingKw] = useState(false);
  const [addingKw,  setAddingKw]  = useState(false);
  const [kwParamsQueue, setKwParamsQueue] = useState<{ keywordId: string; name: string; schemaKey: string; schemaType: 'text' | 'number' }[]>([]);
  const [kwParamsCardId, setKwParamsCardId] = useState('');
  const [currentKwParamInput, setCurrentKwParamInput] = useState('');

  const weaponType = addonTypes.find(t => t.slug === 'weapons');
  const ruleType   = addonTypes.find(t => t.slug === 'rules');

  const loadContent = useCallback(async (cardId: string) => {
    const [wRes, kRes] = await Promise.all([
      supabase.from('card_addons')
        .select('addons(id, name, description, stats, addon_type:addon_types(slug))')
        .eq('card_id', cardId).order('sort_order'),
      supabase.from('card_keywords')
        .select('keyword_id, keywords(name, description)')
        .eq('card_id', cardId).order('sort_order'),
    ]);
    const all = (wRes.data ?? []).map(r => r.addons as unknown as LoadedAddon).filter(Boolean);
    setWeapons(all.filter(a => a.addon_type?.slug === 'weapons'));
    setRules(all.filter(a => a.addon_type?.slug === 'rules'));
    setCardKws((kRes.data ?? []) as unknown as LoadedKeyword[]);
  }, []);

  async function handleCreate() {
    setSaving(true); setError(null);
    const newStats = { unitName: f.unitName, speed: f.speed, evade: f.evade, armour: f.armour, hitPoints: f.hitPoints, size: f.size, pointsCost: f.pointsCost, supplyTiers: f.supplyTiers, tags: f.tags };
    try {
      if (editingCard) {
        const { error: err } = await supabase.from('cards')
          .update({ name: f.unitType || 'Unnamed Unit', stats: newStats as unknown as Json })
          .eq('id', editingCard.id);
        if (err) throw err;
        await loadContent(editingCard.id);
        setPhase({ type: 'content', cardId: editingCard.id });
      } else {
        const { data, error: err } = await supabase.from('cards')
          .insert({ pack_id: packId, game_id: gameId, name: f.unitType || 'Unnamed Unit', stats: newStats as unknown as Json, card_type: 'operative', is_template: true })
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

  // ── Weapon callbacks ────────────────────────────────────────────────────────

  const handleWeaponSave = useCallback(async (name: string, desc: string | null, stats: unknown): Promise<string> => {
    if (!weaponType) return '';
    setSavingW(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingW(false); return ''; }
    const { data, error: err } = await supabase.from('addons')
      .insert({ user_id: user.id, addon_type_id: weaponType.id, pack_id: packId, name, description: desc, stats: stats as Json })
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

  const handleWeaponEditSave = useCallback(async (name: string, desc: string | null, stats: unknown): Promise<string> => {
    if (!editingW) return '';
    setSavingW(true);
    await supabase.from('addons').update({ name, description: desc, stats: stats as Json }).eq('id', editingW.id);
    return editingW.id;
  }, [editingW]);

  const handleWeaponEditSaveComplete = useCallback(async (_id: string) => {
    if (phase.type === 'content') await loadContent(phase.cardId);
    setEditingW(null); setSavingW(false);
  }, [phase, loadContent]);

  // ── Rule (ability) callbacks ────────────────────────────────────────────────

  const handleRuleSave = useCallback(async (name: string, desc: string | null, stats: unknown): Promise<string> => {
    if (!ruleType) return '';
    setSavingR(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingR(false); return ''; }
    const { data, error: err } = await supabase.from('addons')
      .insert({ user_id: user.id, addon_type_id: ruleType.id, pack_id: packId, name, description: desc, stats: stats as Json })
      .select('id').single();
    if (err) { setSavingR(false); return ''; }
    return (data as { id: string }).id;
  }, [packId, ruleType]);

  const handleRuleSaveComplete = useCallback(async (addonId: string) => {
    if (phase.type !== 'content') return;
    await supabase.from('card_addons').insert({
      card_id: phase.cardId, addon_id: addonId, sort_order: weapons.length + rules.length,
    });
    await loadContent(phase.cardId);
    setAddingR(false); setSavingR(false);
  }, [phase, weapons.length, rules.length, loadContent]);

  const handleRuleEditSave = useCallback(async (name: string, desc: string | null, stats: unknown): Promise<string> => {
    if (!editingR) return '';
    setSavingR(true);
    await supabase.from('addons').update({ name, description: desc, stats: stats as Json }).eq('id', editingR.id);
    return editingR.id;
  }, [editingR]);

  const handleRuleEditSaveComplete = useCallback(async (_id: string) => {
    if (phase.type === 'content') await loadContent(phase.cardId);
    setEditingR(null); setSavingR(false);
  }, [phase, loadContent]);

  // ── Phase 1: stats ──────────────────────────────────────────────────────────

  if (phase.type === 'stats') {
    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">{editingCard ? 'Edit Unit' : 'New Unit'}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit Type (required)" value={f.unitType} onChange={e => setF(p => ({ ...p, unitType: e.target.value }))} placeholder="e.g. Marine" required disabled={saving} />
          <Input label="Unit Name (hero)"     value={f.unitName} onChange={e => setF(p => ({ ...p, unitName: e.target.value }))} placeholder="e.g. Jim Raynor" disabled={saving} />
          <div className="col-span-2">
            <Input label="Tags" value={f.tags} onChange={e => setF(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. Core, Light, Biological" disabled={saving} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Counter label="Speed"    value={f.speed}      onChange={v => setF(p => ({ ...p, speed: v }))}      min={0} />
          <Counter label="Evade"    value={f.evade}      onChange={v => setF(p => ({ ...p, evade: v }))}      min={0} />
          <Counter label="Armour"   value={f.armour}     onChange={v => setF(p => ({ ...p, armour: v }))}     min={0} />
          <Counter label="HP"       value={f.hitPoints}  onChange={v => setF(p => ({ ...p, hitPoints: v }))}  min={0} />
          <Counter label="Size"     value={f.size}       onChange={v => setF(p => ({ ...p, size: v }))}       min={0} />
          <Counter label="Points"   value={f.pointsCost} onChange={v => setF(p => ({ ...p, pointsCost: v }))} min={0} />
        </div>

        <Button variant="outline" color="secondary" onClick={() => setSupplyOpen(true)}>
          Supply Costs ({f.supplyTiers.length} tier{f.supplyTiers.length !== 1 ? 's' : ''})
        </Button>

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>
            {editingCard ? 'Save Changes' : 'Create Unit'}
          </Button>
        </div>

        <StarcraftSupplyTiersModal
          open={supplyOpen}
          tiers={f.supplyTiers}
          onSave={tiers => setF(p => ({ ...p, supplyTiers: tiers }))}
          onClose={() => setSupplyOpen(false)}
        />
      </div>
    );
  }

  // ── Phase 2: content ────────────────────────────────────────────────────────

  const { cardId } = phase;
  return (
    <div className="flex flex-col gap-6 p-5">
      <h2 className="font-heading text-xl text-white">
        {f.unitType || 'New Unit'} — {editingCard ? 'Edit Content' : 'Add Content'}
      </h2>

      {/* Weapons */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Weapons</h3>
          {weaponType && (
            <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingW(true)}>Add Weapon</Button>
          )}
        </div>
        {weapons.length === 0
          ? <p className="font-body text-sm text-gray-500 py-2">No weapons yet.</p>
          : weapons.map(w => (
              <AddonListItem key={w.id} name={w.name} subtitle={starcraftWeaponSubtitle(w)} addonTypeName="Weapon"
                onEdit={() => setEditingW(w)}
                onDelete={async () => {
                  await supabase.from('card_addons').delete().eq('card_id', cardId).eq('addon_id', w.id);
                  await loadContent(cardId);
                }}
              />
            ))
        }
      </div>

      {/* Special Rules */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Special Rules</h3>
          {ruleType && (
            <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingR(true)}>Add Rule</Button>
          )}
        </div>
        {rules.length === 0
          ? <p className="font-body text-sm text-gray-500 py-2">No special rules yet.</p>
          : rules.map(r => (
              <AddonListItem key={r.id} name={r.name} subtitle={starcraftAbilitySubtitle(r)} addonTypeName="Rule"
                onEdit={() => setEditingR(r)}
                onDelete={async () => {
                  await supabase.from('card_addons').delete().eq('card_id', cardId).eq('addon_id', r.id);
                  await loadContent(cardId);
                }}
              />
            ))
        }
      </div>

      {/* Keywords */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-gray-300">Keywords</h3>
          <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingKw(true)}>Add Keyword</Button>
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

      <div className="pt-1">
        <Button color="primary" rightIcon={<AltArrowRight className="size-4" />} onClick={() => onSaved(cardId)}>Done</Button>
      </div>

      {/* Sub-modals */}
      {pickingW && weaponType && (
        <AddToPackModal open onClose={() => setPickingW(false)}
          entityType="addon" addonTypeId={weaponType.id}
          gameId={gameId} targetPackId={packId} includeTargetPack
          title="Add Weapon" newButtonLabel="New Weapon"
          getAddonSubtitle={starcraftWeaponSubtitle}
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
      {pickingR && ruleType && (
        <AddToPackModal open onClose={() => setPickingR(false)}
          entityType="addon" addonTypeId={ruleType.id}
          gameId={gameId} targetPackId={packId} includeTargetPack
          title="Add Special Rule" newButtonLabel="New Rule"
          getAddonSubtitle={starcraftAbilitySubtitle}
          onCreateNew={() => { setPickingR(false); setAddingR(true); }}
          onAdded={() => setPickingR(false)}
          onAddedWithIds={async ids => {
            await supabase.from('card_addons').insert(
              ids.map((addonId, i) => ({ card_id: cardId, addon_id: addonId, sort_order: weapons.length + rules.length + i }))
            );
            await loadContent(cardId);
            setPickingR(false);
          }}
        />
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
      {addingW && (
        <Modal open onClose={() => !savingW && setAddingW(false)} className="max-w-md">
          <StarcraftWeaponForm editingAddon={null} saving={savingW} onCancel={() => setAddingW(false)}
            onSave={handleWeaponSave} onSaveComplete={handleWeaponSaveComplete} />
        </Modal>
      )}
      {editingW && (
        <Modal open onClose={() => !savingW && setEditingW(null)} className="max-w-md">
          <StarcraftWeaponForm editingAddon={editingW as unknown as Addon} saving={savingW} onCancel={() => setEditingW(null)}
            onSave={handleWeaponEditSave} onSaveComplete={handleWeaponEditSaveComplete} />
        </Modal>
      )}
      {addingR && (
        <Modal open onClose={() => !savingR && setAddingR(false)} className="max-w-md">
          <StarcraftAbilityForm editingAddon={null} saving={savingR} onCancel={() => setAddingR(false)}
            onSave={handleRuleSave} onSaveComplete={handleRuleSaveComplete} />
        </Modal>
      )}
      {editingR && (
        <Modal open onClose={() => !savingR && setEditingR(null)} className="max-w-md">
          <StarcraftAbilityForm editingAddon={editingR as unknown as Addon} saving={savingR} onCancel={() => setEditingR(null)}
            onSave={handleRuleEditSave} onSaveComplete={handleRuleEditSaveComplete} />
        </Modal>
      )}
      {addingKw && (
        <StarcraftAddKeywordModal open onClose={() => setAddingKw(false)} createOnly
          onKeywordSelected={async (kw) => {
            if (kw.hasValue && kw.value === null) {
              setKwParamsQueue([{ keywordId: kw.keywordId, name: kw.name, schemaKey: 'value', schemaType: 'text' }]);
              setKwParamsCardId(cardId);
              setCurrentKwParamInput('');
            } else {
              await supabase.from('card_keywords').insert({
                card_id: cardId, keyword_id: kw.keywordId,
                params: kw.hasValue && kw.value !== null ? { value: kw.value } : {},
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
