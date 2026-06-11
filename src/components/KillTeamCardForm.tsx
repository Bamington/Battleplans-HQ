import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AddonType, Addon, Json } from '../lib/database.types';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import KillTeamWeaponForm from './KillTeamWeaponForm';
import KillTeamAbilityForm from './KillTeamAbilityForm';
import AddKeywordModal from './AddKeywordModal';
import AddToPackModal from './AddToPackModal';
import { killTeamWeaponSubtitle, killTeamAbilitySubtitle } from '../lib/addonSubtitles';
import AddCircle from '../icons/AddCircle';
import AltArrowRight from '../icons/AltArrowRight';

export interface KillTeamCardFormProps {
  packId:    string;
  gameId:    string;
  addonTypes: AddonType[];
  /** 'operative' (default) or 'rule' — drives which fields appear. */
  cardType?: 'operative' | 'rule';
  onSaved:  (cardId: string) => void;
  onCancel: () => void;
}

type Phase = { type: 'stats' } | { type: 'content'; cardId: string };

interface OperativeFields {
  operativeName: string; role: string; teamName: string; tags: string;
  actions: number; movement: number; save: number; wounds: number; baseSize: number;
}
interface RuleFields {
  ruleTitle: string; ruleDescription: string;
}

interface LoadedAddon {
  id: string; name: string; description: string | null; stats: unknown;
  addon_type: { slug: string } | null;
}
interface LoadedKeyword {
  keyword_id: string;
  keywords: { name: string; description: string | null } | null;
}

export default function KillTeamCardForm({
  packId, gameId, addonTypes, cardType = 'operative', onSaved, onCancel,
}: KillTeamCardFormProps) {
  const [phase,  setPhase]  = useState<Phase>({ type: 'stats' });
  const [opF,    setOpF]    = useState<OperativeFields>({
    operativeName: '', role: '', teamName: '', tags: '',
    actions: 0, movement: 0, save: 0, wounds: 0, baseSize: 0,
  });
  const [ruleF,  setRuleF]  = useState<RuleFields>({ ruleTitle: '', ruleDescription: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Phase 2
  const [weapons,    setWeapons]    = useState<LoadedAddon[]>([]);
  const [abilities,  setAbilities]  = useState<LoadedAddon[]>([]);
  const [cardKws,    setCardKws]    = useState<LoadedKeyword[]>([]);
  const [pickingW,   setPickingW]   = useState(false);
  const [addingW,    setAddingW]    = useState(false);
  const [editingW,   setEditingW]   = useState<LoadedAddon | null>(null);
  const [savingW,    setSavingW]    = useState(false);
  const [pickingA,   setPickingA]   = useState(false);
  const [addingA,    setAddingA]    = useState(false);
  const [editingA,   setEditingA]   = useState<LoadedAddon | null>(null);
  const [savingA,    setSavingA]    = useState(false);
  const [pickingKw,  setPickingKw]  = useState(false);
  const [addingKw,   setAddingKw]   = useState(false);

  const weaponType  = addonTypes.find(t => t.slug === 'weapons');
  const abilityType = addonTypes.find(t => t.slug === 'abilities');

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
    setAbilities(all.filter(a => a.addon_type?.slug === 'abilities'));
    setCardKws((kRes.data ?? []) as unknown as LoadedKeyword[]);
  }, []);

  async function handleCreate() {
    setSaving(true); setError(null);
    try {
      const isRule = cardType === 'rule';
      const { data, error: err } = await supabase.from('cards')
        .insert({
          pack_id: packId, game_id: gameId,
          name: isRule ? (ruleF.ruleTitle || 'Unnamed Rule') : (opF.operativeName || 'Unnamed Operative'),
          stats: isRule
            ? ({ description: ruleF.ruleDescription } as Json)
            : ({
                role:     opF.role,     teamName: opF.teamName, tags: opF.tags,
                actions:  opF.actions,  movement: opF.movement, save: opF.save,
                wounds:   opF.wounds,   baseSize: opF.baseSize,
              } as Json),
          card_type: cardType,
          is_template: true,
        })
        .select('id').single();
      if (err) throw err;
      setPhase({ type: 'content', cardId: (data as { id: string }).id });
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Failed to create card');
    } finally {
      setSaving(false);
    }
  }

  // ── Weapon callbacks ────────────────────────────────────────────────────────

  const handleWeaponSave = useCallback(async (name: string, desc: string, stats: unknown): Promise<string> => {
    if (!weaponType) return '';
    setSavingW(true);
    const { data, error: err } = await supabase.from('addons')
      .insert({ addon_type_id: weaponType.id, pack_id: packId, name, description: desc, stats: stats as Json })
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

  const handleWeaponEditSave = useCallback(async (name: string, desc: string, stats: unknown): Promise<string> => {
    if (!editingW) return '';
    setSavingW(true);
    await supabase.from('addons').update({ name, description: desc, stats: stats as Json }).eq('id', editingW.id);
    return editingW.id;
  }, [editingW]);

  const handleWeaponEditSaveComplete = useCallback(async (_id: string) => {
    if (phase.type === 'content') await loadContent(phase.cardId);
    setEditingW(null); setSavingW(false);
  }, [phase, loadContent]);

  // ── Ability callbacks ───────────────────────────────────────────────────────

  const handleAbilitySave = useCallback(async (name: string, desc: string, stats: unknown): Promise<string> => {
    if (!abilityType) return '';
    setSavingA(true);
    const { data, error: err } = await supabase.from('addons')
      .insert({ addon_type_id: abilityType.id, pack_id: packId, name, description: desc, stats: stats as Json })
      .select('id').single();
    if (err) { setSavingA(false); return ''; }
    return (data as { id: string }).id;
  }, [packId, abilityType]);

  const handleAbilitySaveComplete = useCallback(async (addonId: string) => {
    if (phase.type !== 'content') return;
    await supabase.from('card_addons').insert({
      card_id: phase.cardId, addon_id: addonId, sort_order: weapons.length + abilities.length,
    });
    await loadContent(phase.cardId);
    setAddingA(false); setSavingA(false);
  }, [phase, weapons.length, abilities.length, loadContent]);

  const handleAbilityEditSave = useCallback(async (name: string, desc: string, stats: unknown): Promise<string> => {
    if (!editingA) return '';
    setSavingA(true);
    await supabase.from('addons').update({ name, description: desc, stats: stats as Json }).eq('id', editingA.id);
    return editingA.id;
  }, [editingA]);

  const handleAbilityEditSaveComplete = useCallback(async (_id: string) => {
    if (phase.type === 'content') await loadContent(phase.cardId);
    setEditingA(null); setSavingA(false);
  }, [phase, loadContent]);

  // ── Phase 1: stats ──────────────────────────────────────────────────────────

  if (phase.type === 'stats') {
    if (cardType === 'rule') {
      return (
        <div className="flex flex-col gap-5 p-5">
          <h2 className="font-heading text-xl text-white">New Rule Card</h2>
          <Input label="Title" value={ruleF.ruleTitle} onChange={e => setRuleF(p => ({ ...p, ruleTitle: e.target.value }))} placeholder="e.g. Honour the Chapter" disabled={saving} />
          <Input label="Description (optional)" value={ruleF.ruleDescription} onChange={e => setRuleF(p => ({ ...p, ruleDescription: e.target.value }))} placeholder="Rule text…" disabled={saving} />
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
          <div className="flex items-center gap-3 pt-1">
            <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
            <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>Create Rule Card</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">New Operative</h2>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Operative Name" value={opF.operativeName} onChange={e => setOpF(p => ({ ...p, operativeName: e.target.value }))} placeholder="e.g. Fire Warrior" disabled={saving} />
          <Input label="Role"           value={opF.role}          onChange={e => setOpF(p => ({ ...p, role: e.target.value }))}          placeholder="e.g. Gunner" disabled={saving} />
          <Input label="Team / Faction" value={opF.teamName}      onChange={e => setOpF(p => ({ ...p, teamName: e.target.value }))}      placeholder="e.g. T'au Empire" disabled={saving} />
          <Input label="Tags"           value={opF.tags}          onChange={e => setOpF(p => ({ ...p, tags: e.target.value }))}          placeholder="e.g. Infantry, T'au" disabled={saving} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Counter label="Actions"  value={opF.actions}  onChange={v => setOpF(p => ({ ...p, actions: v }))}  min={0} />
          <Counter label={'Move (”)'} value={opF.movement} onChange={v => setOpF(p => ({ ...p, movement: v }))} min={0} />
          <Counter label="Save (+)" value={opF.save}     onChange={v => setOpF(p => ({ ...p, save: v }))}     min={0} />
          <Counter label="Wounds"   value={opF.wounds}   onChange={v => setOpF(p => ({ ...p, wounds: v }))}   min={0} />
          <Counter label="Base (mm)" value={opF.baseSize} onChange={v => setOpF(p => ({ ...p, baseSize: v }))} min={0} />
        </div>

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button color="primary" loading={saving} rightIcon={<AltArrowRight className="size-4" />} onClick={handleCreate}>Create Operative</Button>
        </div>
      </div>
    );
  }

  // ── Phase 2: content ────────────────────────────────────────────────────────

  const { cardId } = phase;
  const displayName = cardType === 'rule'
    ? (ruleF.ruleTitle || 'New Rule Card')
    : (opF.operativeName || 'New Operative');

  return (
    <div className="flex flex-col gap-6 p-5">
      <h2 className="font-heading text-xl text-white">{displayName} — Add Content</h2>

      {cardType === 'operative' && (
        <>
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
                  <AddonListItem key={w.id} name={w.name} subtitle={killTeamWeaponSubtitle(w)} addonTypeName="Weapon"
                    onEdit={() => setEditingW(w)}
                    onDelete={async () => {
                      await supabase.from('card_addons').delete().eq('card_id', cardId).eq('addon_id', w.id);
                      await loadContent(cardId);
                    }}
                  />
                ))
            }
          </div>

          {/* Abilities */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base text-gray-300">Abilities</h3>
              {abilityType && (
                <Button variant="ghost" color="primary" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setPickingA(true)}>Add Ability</Button>
              )}
            </div>
            {abilities.length === 0
              ? <p className="font-body text-sm text-gray-500 py-2">No abilities yet.</p>
              : abilities.map(a => (
                  <AddonListItem key={a.id} name={a.name} subtitle={killTeamAbilitySubtitle(a)} addonTypeName="Ability"
                    onEdit={() => setEditingA(a)}
                    onDelete={async () => {
                      await supabase.from('card_addons').delete().eq('card_id', cardId).eq('addon_id', a.id);
                      await loadContent(cardId);
                    }}
                  />
                ))
            }
          </div>
        </>
      )}

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
          gameId={gameId} targetPackId={packId}
          title="Add Weapon" newButtonLabel="New Weapon"
          getAddonSubtitle={killTeamWeaponSubtitle}
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
          <KillTeamWeaponForm editingAddon={null} saving={savingW} onCancel={() => setAddingW(false)}
            onSave={handleWeaponSave} onSaveComplete={handleWeaponSaveComplete} />
        </Modal>
      )}
      {editingW && (
        <Modal open onClose={() => !savingW && setEditingW(null)} className="max-w-md">
          <KillTeamWeaponForm editingAddon={editingW as unknown as Addon} saving={savingW} onCancel={() => setEditingW(null)}
            onSave={handleWeaponEditSave} onSaveComplete={handleWeaponEditSaveComplete} />
        </Modal>
      )}
      {pickingA && abilityType && (
        <AddToPackModal open onClose={() => setPickingA(false)}
          entityType="addon" addonTypeId={abilityType.id}
          gameId={gameId} targetPackId={packId}
          title="Add Ability" newButtonLabel="New Ability"
          getAddonSubtitle={killTeamAbilitySubtitle}
          onCreateNew={() => { setPickingA(false); setAddingA(true); }}
          onAdded={() => setPickingA(false)}
          onAddedWithIds={async ids => {
            await supabase.from('card_addons').insert(
              ids.map((addonId, i) => ({ card_id: cardId, addon_id: addonId, sort_order: weapons.length + abilities.length + i }))
            );
            await loadContent(cardId);
            setPickingA(false);
          }}
        />
      )}
      {addingA && (
        <Modal open onClose={() => !savingA && setAddingA(false)} className="max-w-md">
          <KillTeamAbilityForm editingAddon={null} saving={savingA} onCancel={() => setAddingA(false)}
            onSave={handleAbilitySave} onSaveComplete={handleAbilitySaveComplete} />
        </Modal>
      )}
      {editingA && (
        <Modal open onClose={() => !savingA && setEditingA(null)} className="max-w-md">
          <KillTeamAbilityForm editingAddon={editingA as unknown as Addon} saving={savingA} onCancel={() => setEditingA(null)}
            onSave={handleAbilityEditSave} onSaveComplete={handleAbilityEditSaveComplete} />
        </Modal>
      )}
      {pickingKw && (
        <AddToPackModal open onClose={() => setPickingKw(false)}
          entityType="keyword"
          gameId={gameId} targetPackId={packId}
          title="Add Keyword" newButtonLabel="New Keyword"
          onCreateNew={() => { setPickingKw(false); setAddingKw(true); }}
          onAdded={() => setPickingKw(false)}
          onAddedWithIds={async ids => {
            await supabase.from('card_keywords').insert(
              ids.map((keywordId, i) => ({ card_id: cardId, keyword_id: keywordId, params: [], sort_order: cardKws.length + i }))
            );
            await loadContent(cardId);
            setPickingKw(false);
          }}
        />
      )}
      {addingKw && (
        <AddKeywordModal open onClose={() => setAddingKw(false)} gameSlug="kill-team" createOnly
          onKeywordSelected={async ({ keywordId }) => {
            await supabase.from('card_keywords').insert({
              card_id: cardId, keyword_id: keywordId, params: [], sort_order: cardKws.length,
            });
            await loadContent(cardId);
            setAddingKw(false);
          }}
        />
      )}
    </div>
  );
}
