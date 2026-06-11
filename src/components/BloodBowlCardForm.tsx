import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import MultiSelectDropdown from './MultiSelectDropdown';
import AddonListItem from './AddonListItem';
import AddKeywordModal from './AddKeywordModal';
import AddToPackModal from './AddToPackModal';
import AddCircle from '../icons/AddCircle';
import AltArrowRight from '../icons/AltArrowRight';

export interface BloodBowlCardFormProps {
  packId: string;
  gameId: string;
  onSaved:  (cardId: string) => void;
  onCancel: () => void;
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
  packId, gameId, onSaved, onCancel,
}: BloodBowlCardFormProps) {
  const [phase, setPhase] = useState<Phase>({ type: 'stats' });
  const [f, setF] = useState<Fields>({
    unitName: '', teamName: '', playerRole: '', cost: '',
    move: 0, strength: 0, agility: 0, passing: 0, armor: 0,
    primaryAttr: [], secondaryAttr: [],
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [cardKws,  setCardKws]  = useState<LoadedKeyword[]>([]);
  const [pickingKw, setPickingKw] = useState(false);
  const [addingKw, setAddingKw] = useState(false);

  async function loadContent(cardId: string) {
    const { data } = await supabase.from('card_keywords')
      .select('keyword_id, keywords(name, description)')
      .eq('card_id', cardId).order('sort_order');
    setCardKws((data ?? []) as unknown as LoadedKeyword[]);
  }

  async function handleCreate() {
    setSaving(true); setError(null);
    try {
      const { data, error: err } = await supabase.from('cards')
        .insert({
          pack_id: packId, game_id: gameId,
          name: f.unitName || 'Unnamed Player',
          stats: {
            teamName:           f.teamName,
            playerRole:         f.playerRole,
            cost:               f.cost,
            primaryAttribute:   f.primaryAttr.join(', '),
            secondaryAttribute: f.secondaryAttr.join(', '),
            ma: f.move, st: f.strength, ag: f.agility, pa: f.passing, av: f.armor,
          } as Json,
          card_type: 'operative',
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

  // ── Phase 1: stats ──────────────────────────────────────────────────────────

  if (phase.type === 'stats') {
    return (
      <div className="flex flex-col gap-5 p-5">
        <h2 className="font-heading text-xl text-white">New Player</h2>

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
            Create Player
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
        {f.unitName || 'New Player'} — Add Skills
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

      <div className="pt-1">
        <Button color="primary" rightIcon={<AltArrowRight className="size-4" />} onClick={() => onSaved(cardId)}>
          Done
        </Button>
      </div>

      {pickingKw && (
        <AddToPackModal open onClose={() => setPickingKw(false)}
          entityType="keyword"
          gameId={gameId} targetPackId={packId}
          title="Add Skill" newButtonLabel="New Skill"
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
        <AddKeywordModal open onClose={() => setAddingKw(false)} gameSlug="blood-bowl" createOnly typeName="Skill"
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
