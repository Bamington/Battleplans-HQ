/**
 * RygWeaponForm.tsx — RYG weapon create/edit form
 *
 * Rendered inside AddAddonModal's CreateFormComponent slot.
 * Fields: Name, Damage (free-text die spec), Range (number, 0=melee),
 * Keywords (via AddKeywordModal, same pattern as Kill Team weapons).
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatKeywordLabel } from '../lib/cardShape/util';
import type { AddonFormProps } from './AddAddonModal';
import AddKeywordModal, { type KeywordSelection } from './AddKeywordModal';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import AddCircle from '../icons/AddCircle';
import CloseCircle from '../icons/CloseCircle';

export interface RygWeaponFormProps extends AddonFormProps {
  onPendingKeywords?: (keywords: KeywordSelection[]) => void;
  onKeywordsSaved?:   (addonId: string, keywords: KeywordSelection[]) => void;
  onSaveComplete?:    (addonId: string) => void;
}

export default function RygWeaponForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onPendingKeywords,
  onKeywordsSaved,
  onSaveComplete,
}: RygWeaponFormProps) {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [name,     setName]     = useState(editingAddon?.name ?? '');
  const [damage,   setDamage]   = useState(typeof s.damage === 'string' ? s.damage : '');
  const [range,    setRange]    = useState<number>(typeof s.range === 'number' ? s.range : 0);
  const [keywords, setKeywords] = useState<KeywordSelection[]>([]);
  const [kwModalOpen, setKwModalOpen] = useState(false);

  // Load existing keywords when editing
  useEffect(() => {
    if (!editingAddon?.id) return;
    supabase
      .from('addon_keywords')
      .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
      .eq('addon_id', editingAddon.id)
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return;
        const loaded: KeywordSelection[] = (data as unknown as {
          keyword_id: string;
          params: Record<string, unknown> | null;
          sort_order: number | null;
          keywords: { name: string; description: string | null; params_schema: { key: string; type: string }[] } | null;
        }[]).map(r => ({
          keywordId:   r.keyword_id,
          keywordName: r.keywords?.name ?? '',
          description: r.keywords?.description ?? '',
          hasParams:   Array.isArray(r.keywords?.params_schema) && r.keywords!.params_schema.length > 0,
          paramValue:  r.params?.X != null ? Number(r.params.X) : null,
        }));
        setKeywords(loaded);
      });
  }, [editingAddon?.id]);

  const removeKeyword = (id: string) =>
    setKeywords(prev => prev.filter(k => k.keywordId !== id));

  const handleSave = async () => {
    onPendingKeywords?.(keywords);
    try {
      const addonId = await onSave(name.trim(), null, { damage, range });

      // Sync addon_keywords
      await supabase.from('addon_keywords').delete().eq('addon_id', addonId);
      if (keywords.length > 0) {
        await supabase.from('addon_keywords').insert(
          keywords.map((k, i) => ({
            addon_id:   addonId,
            keyword_id: k.keywordId,
            params:     k.paramValue != null ? { X: k.paramValue } : null,
            sort_order: i,
          })),
        );
      }
      onKeywordsSaved?.(addonId, keywords);
      onSaveComplete?.(addonId);
    } finally {
      onPendingKeywords?.([]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input
        label="Weapon Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Battleaxe"
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Damage"
            value={damage}
            onChange={e => setDamage(e.target.value)}
            placeholder="e.g. 1D6+3"
          />
        </div>
        <div>
          <Counter
            label="Range (inches)"
            value={range}
            onChange={setRange}
            min={0}
            max={999}
          />
        </div>
      </div>

      <HR />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Keywords</span>
          <Button size="sm" variant="secondary" onClick={() => setKwModalOpen(true)}>
            <AddCircle /> Add Keyword
          </Button>
        </div>
        {keywords.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6b7280' }}>No keywords yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {keywords.map(k => (
              <Badge key={k.keywordId} variant="default">
                {formatKeywordLabel(k.keywordName, k.paramValue)}
                <button
                  onClick={() => removeKeyword(k.keywordId)}
                  style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <CloseCircle style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim() || saving} loading={saving}>Save Weapon</Button>
      </div>

      {kwModalOpen && (
        <AddKeywordModal
          open
          gameSlug="ryg"
          onClose={() => setKwModalOpen(false)}
          onSelect={sel => {
            setKeywords(prev =>
              prev.some(k => k.keywordId === sel.keywordId)
                ? prev
                : [...prev, sel],
            );
            setKwModalOpen(false);
          }}
          excludeKeywordIds={keywords.map(k => k.keywordId)}
        />
      )}
    </div>
  );
}
