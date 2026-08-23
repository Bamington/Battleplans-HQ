/**
 * useRygEnemies — enemy cards for a RYG deck
 *
 * Enemies live in the deck alongside warriors, as sept and god cards already
 * do, and always sort to the end of it. They carry the same five stats a
 * warrior has, plus an Enemy Type and an AI Type, and hang abilities, weapons
 * and equipment off card_addons like every other RYG card.
 *
 * The logic lives here rather than inside CardBuilderRyg because that file is
 * already 2,000 lines; the builder consumes this hook and keeps its own diff to
 * state and markup.
 *
 * SORT ORDER
 * Warriors save with sort_order = their index. Enemies save at
 * ENEMY_SORT_BASE + index, which is far enough above any realistic warrior
 * count that they land at the end of the deck without the two having to
 * coordinate. See ENEMY_SORT_BASE.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { RygWeaponStats } from '../lib/database.types';

// ── Options ──────────────────────────────────────────────────────────────────

export const ENEMY_TYPES = [
  'Minion', 'Servant', 'Lieutenant', 'Champion',
  'Legendary Monster', 'Vanquisher', 'God',
] as const;

export const AI_TYPES = [
  'Dross', 'Defender', 'Hunter', 'Commander',
  'Legendary Monster', 'God',
] as const;

/** Keeps enemies after warriors in a deck without the two sharing a counter. */
const ENEMY_SORT_BASE = 1000;

/** Addon type slugs an enemy card draws from. */
const ABILITY_SLUG   = 'enemy-abilities';
const WEAPON_SLUG    = 'weapons';
const EQUIPMENT_SLUGS = ['armor', 'items'];

// ── Shapes ───────────────────────────────────────────────────────────────────

/** An ability or a piece of equipment — a name and what it does. */
export interface EnemyAttachment {
  addonId:     string;
  name:        string;
  description: string;
}

export interface EnemyWeaponData {
  addonId:  string;
  name:     string;
  damage:   string;
  range:    number;
  keywords: string;
}

export interface EnemyCardData {
  id:        string;
  dbId:      string | null;
  /** Discriminator — the builder's carousel holds warriors and enemies together. */
  kind:      'enemy';
  name:      string;
  enemyType: string;
  aiType:    string;
  offense:   number;
  defense:   number;
  life:      number;
  tactics:   number;
  fate:      number;
  abilities: EnemyAttachment[];
  weapons:   EnemyWeaponData[];
  equipment: EnemyAttachment[];
}

export const defaultEnemy = (): EnemyCardData => ({
  id:        crypto.randomUUID(),
  dbId:      null,
  kind:      'enemy',
  name:      '',
  enemyType: 'Minion',
  aiType:    'Dross',
  offense:   0,
  defense:   0,
  life:      0,
  tactics:   0,
  fate:      0,
  abilities: [],
  weapons:   [],
  equipment: [],
});

/** What lands in cards.stats. Enemy and AI type ride along with the numbers. */
const enemyStats = (e: EnemyCardData) => ({
  enemyType: e.enemyType,
  aiType:    e.aiType,
  offense:   e.offense,
  defense:   e.defense,
  life:      e.life,
  tactics:   e.tactics,
  fate:      e.fate,
});

/** A card with no name and nothing attached isn't worth a row yet. */
const isBlank = (e: EnemyCardData) =>
  e.name.trim() === '' && e.abilities.length === 0 &&
  e.weapons.length === 0 && e.equipment.length === 0;

export interface UseRygEnemiesResult {
  enemies:     EnemyCardData[];
  loading:     boolean;
  addEnemy:    () => string;
  updateEnemy: (id: string, patch: Partial<EnemyCardData>) => void;
  removeEnemy: (id: string) => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRygEnemies(deckId: string | null): UseRygEnemiesResult {
  const [enemies, setEnemies] = useState<EnemyCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Ids of enemies changed since the last save, so a debounced write only
  // touches what moved — the same approach the warrior autosave uses.
  const dirtyRef = useRef<Set<string>>(new Set());

  // addon_type id → slug, for splitting a card's addons back into abilities,
  // weapons and equipment on load.
  const typeSlugRef = useRef<Record<string, string>>({});

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!deckId) { setLoading(false); return; }

    let cancelled = false;

    const load = async () => {
      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'ryg').single();
      if (cancelled || !game) { setLoading(false); return; }

      const { data: types } = await supabase
        .from('addon_types').select('id, slug').eq('game_id', game.id);
      if (cancelled) return;
      const slugById: Record<string, string> = {};
      for (const t of (types ?? []) as { id: string; slug: string }[]) slugById[t.id] = t.slug;
      typeSlugRef.current = slugById;

      const { data, error } = await supabase
        .from('cards')
        .select('id, name, stats, sort_order, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id))')
        .eq('deck_id', deckId)
        .eq('card_type', 'enemy')
        .order('sort_order', { ascending: true });

      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      type AddonRow = {
        addon_id: string;
        sort_order: number | null;
        addons: { name: string; description: string | null; stats: unknown; addon_type_id: string } | null;
      };

      const loaded: EnemyCardData[] = (data as unknown as {
        id: string; name: string; stats: Record<string, unknown>; card_addons: AddonRow[];
      }[]).map(row => {
        const s = row.stats ?? {};
        const num = (v: unknown) => (typeof v === 'number' ? v : 0);

        const abilities: EnemyAttachment[] = [];
        const weapons:   EnemyWeaponData[] = [];
        const equipment: EnemyAttachment[] = [];

        const sorted = [...(row.card_addons ?? [])]
          .filter(ca => ca.addons != null)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        for (const ca of sorted) {
          const addon = ca.addons!;
          const slug  = slugById[addon.addon_type_id];
          if (slug === ABILITY_SLUG) {
            abilities.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
          } else if (slug === WEAPON_SLUG) {
            const ws = (addon.stats ?? {}) as RygWeaponStats;
            weapons.push({
              addonId:  ca.addon_id,
              name:     addon.name,
              damage:   ws.damage ?? '',
              range:    ws.range ?? 0,
              keywords: addon.description ?? '',
            });
          } else if (EQUIPMENT_SLUGS.includes(slug)) {
            equipment.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
          }
        }

        return {
          id:        crypto.randomUUID(),
          dbId:      row.id,
          kind:      'enemy' as const,
          name:      row.name ?? '',
          enemyType: typeof s.enemyType === 'string' ? s.enemyType : 'Minion',
          aiType:    typeof s.aiType    === 'string' ? s.aiType    : 'Dross',
          offense:   num(s.offense),
          defense:   num(s.defense),
          life:      num(s.life),
          tactics:   num(s.tactics),
          fate:      num(s.fate),
          abilities, weapons, equipment,
        };
      });

      setEnemies(loaded);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [deckId]);

  // ── Save ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!deckId || dirtyRef.current.size === 0) return;

    const timer = setTimeout(async () => {
      const dirty = new Set(dirtyRef.current);
      dirtyRef.current.clear();

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!dirty.has(e.id) || isBlank(e)) continue;

        const payload = {
          name:       e.name.trim() || 'Unnamed Enemy',
          stats:      enemyStats(e),
          sort_order: ENEMY_SORT_BASE + i,
        };

        let dbId = e.dbId;

        if (!dbId) {
          const { data, error } = await supabase
            .from('cards')
            .insert({ deck_id: deckId, card_type: 'enemy', ...payload })
            .select('id').single();
          if (error || !data) { console.error('[BattleCards] Could not save enemy:', error); continue; }
          dbId = data.id as string;
          setEnemies(list => list.map(x => (x.id === e.id ? { ...x, dbId } : x)));
        } else {
          const { error } = await supabase.from('cards').update(payload).eq('id', dbId);
          if (error) { console.error('[BattleCards] Could not save enemy:', error); continue; }
        }

        // Attachments are replaced wholesale, matching the warrior save. Order
        // within the card is abilities, then weapons, then equipment — the
        // order they appear on the card.
        await supabase.from('card_addons').delete().eq('card_id', dbId);
        const rows: { card_id: string; addon_id: string; sort_order: number }[] = [];
        let idx = 0;
        for (const a of e.abilities) rows.push({ card_id: dbId, addon_id: a.addonId, sort_order: idx++ });
        for (const w of e.weapons)   rows.push({ card_id: dbId, addon_id: w.addonId, sort_order: idx++ });
        for (const q of e.equipment) rows.push({ card_id: dbId, addon_id: q.addonId, sort_order: idx++ });
        if (rows.length > 0) await supabase.from('card_addons').insert(rows);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [enemies, deckId]);

  // ── Mutators ──────────────────────────────────────────────────────────────

  const addEnemy = useCallback(() => {
    const fresh = defaultEnemy();
    dirtyRef.current.add(fresh.id);
    setEnemies(list => [...list, fresh]);
    return fresh.id;
  }, []);

  const updateEnemy = useCallback((id: string, patch: Partial<EnemyCardData>) => {
    dirtyRef.current.add(id);
    setEnemies(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const removeEnemy = useCallback(async (id: string) => {
    const target = enemies.find(e => e.id === id);
    setEnemies(list => list.filter(e => e.id !== id));
    dirtyRef.current.delete(id);
    // Children go with it — card_addons cascades on the cards row.
    if (target?.dbId) await supabase.from('cards').delete().eq('id', target.dbId);
  }, [enemies]);

  return { enemies, loading, addEnemy, updateEnemy, removeEnemy };
}
