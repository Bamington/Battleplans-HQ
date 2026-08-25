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
  /**
   * Play-mode token values, keyed by token-definition id. Enemies take damage
   * like warriors do, so they go through the same token engine. This is never
   * written to cards.stats — it belongs to the play session.
   */
  tokenState: Record<string, number>;
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
  abilities:  [],
  weapons:    [],
  equipment:  [],
  tokenState: {},
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

/** Shape of the keyword rows hanging off a weapon addon. */
type AddonKeywordRow = {
  params:   Record<string, unknown> | null;
  sort_order: number | null;
  keywords: { name: string } | null;
};

/**
 * "Edged, One-Handed, Piercing" from a weapon's keyword rows.
 *
 * Enemy weapons read the same addon_keywords the warrior card does, rather than
 * a string kept in the addon's description — so a weapon shared between a
 * warrior and an enemy reads identically on both, and the pack's canonical
 * keyword data is what shows.
 */
const keywordString = (rows: AddonKeywordRow[] | null | undefined): string =>
  [...(rows ?? [])]
    .filter(r => r.keywords != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => {
      const x = r.params?.X;
      return x != null ? `${r.keywords!.name} (${x})` : r.keywords!.name;
    })
    .join(', ');

/** A card with no name and nothing attached isn't worth a row yet. */
const isBlank = (e: EnemyCardData) =>
  e.name.trim() === '' && e.abilities.length === 0 &&
  e.weapons.length === 0 && e.equipment.length === 0;

/** An enemy offered by a pack, for the "add enemy" picker. */
export interface PackEnemy {
  /** cards.id of the pack's template row. */
  id:        string;
  name:      string;
  enemyType: string;
  aiType:    string;
  packName:  string;
}

export interface UseRygEnemiesResult {
  enemies:     EnemyCardData[];
  loading:     boolean;
  /** Enemies available from official or imported packs. */
  packEnemies: PackEnemy[];
  /** Copy a pack enemy into this deck, with its abilities, weapons and gear. */
  addEnemyFromPack: (templateId: string) => Promise<string | null>;
  addEnemy:    () => string;
  updateEnemy: (id: string, patch: Partial<EnemyCardData>) => void;
  removeEnemy: (id: string) => Promise<void>;
  /**
   * Replace the list without marking anything dirty — for the play-mode token
   * engine, whose changes belong to the play session rather than the deck.
   * Saving them as card edits would rewrite every enemy row on every tap.
   */
  patchEnemies: (updater: (list: EnemyCardData[]) => EnemyCardData[]) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRygEnemies(deckId: string | null): UseRygEnemiesResult {
  const [enemies, setEnemies] = useState<EnemyCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [packEnemies, setPackEnemies] = useState<PackEnemy[]>([]);

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
        .select('id, name, stats, sort_order, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(params, sort_order, keywords(name))))')
        .eq('deck_id', deckId)
        .eq('card_type', 'enemy')
        .order('sort_order', { ascending: true });

      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      type AddonRow = {
        addon_id: string;
        sort_order: number | null;
        addons: { name: string; description: string | null; stats: unknown; addon_type_id: string; addon_keywords: AddonKeywordRow[] | null } | null;
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
              keywords: keywordString(addon.addon_keywords),
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
          tokenState: {},
        };
      });

      setEnemies(loaded);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [deckId]);

  // ── Enemies offered by packs ──────────────────────────────────────────────
  //
  // No ownership filter is needed: the RLS on cards already exposes a pack's
  // cards when the pack is public or the caller owns it, so this returns
  // exactly what this user is entitled to see.

  useEffect(() => {
    let cancelled = false;

    const loadPacks = async () => {
      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'ryg').single();
      if (cancelled || !game) return;

      const { data, error } = await supabase
        .from('cards')
        .select('id, name, stats, packs!inner(name, game_id)')
        .eq('card_type', 'enemy')
        .eq('is_template', true)
        .eq('packs.game_id', game.id)
        .order('name');

      if (cancelled || error || !data) return;

      setPackEnemies((data as unknown as {
        id: string; name: string; stats: Record<string, unknown>;
        packs: { name: string } | null;
      }[]).map(row => ({
        id:        row.id,
        name:      row.name,
        enemyType: typeof row.stats?.enemyType === 'string' ? row.stats.enemyType : '',
        aiType:    typeof row.stats?.aiType    === 'string' ? row.stats.aiType    : '',
        packName:  row.packs?.name ?? '',
      })));
    };

    void loadPacks();
    return () => { cancelled = true; };
  }, []);

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

  /**
   * Copy a pack enemy into this deck.
   *
   * The card is written immediately rather than left to the autosave, because
   * its attachments need a card id to hang off — and the addons are cloned into
   * the player's own library rather than referenced in place. Referencing the
   * pack's rows would read fine, but the player couldn't then edit the
   * enemy's kit: addons_update is owner-scoped, and a pack's addons belong to
   * whoever published it.
   *
   * A clone is reused when the player already has an addon of the same type and
   * name, so adding three Carrion doesn't leave three Daggers in their library.
   */
  const addEnemyFromPack = useCallback(async (templateId: string): Promise<string | null> => {
    if (!deckId) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tpl, error: tplErr } = await supabase
      .from('cards')
      .select('id, name, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(params, sort_order, keywords(name))))')
      .eq('id', templateId)
      .single();

    if (tplErr || !tpl) {
      console.error('[BattleCards] Could not read the pack enemy:', tplErr);
      return null;
    }

    const s = (tpl.stats ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' ? v : 0);

    const { data: created, error: cardErr } = await supabase
      .from('cards')
      .insert({
        deck_id:    deckId,
        card_type:  'enemy',
        name:       tpl.name,
        stats:      s,
        sort_order: ENEMY_SORT_BASE + enemies.length,
      })
      .select('id').single();

    if (cardErr || !created) {
      console.error('[BattleCards] Could not add the enemy:', cardErr);
      return null;
    }

    type SrcAddon = {
      addon_id: string;
      sort_order: number | null;
      addons: { name: string; description: string | null; stats: unknown; addon_type_id: string; addon_keywords: AddonKeywordRow[] | null } | null;
    };

    const sources = [...((tpl.card_addons ?? []) as unknown as SrcAddon[])]
      .filter(ca => ca.addons != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const abilities: EnemyAttachment[] = [];
    const weapons:   EnemyWeaponData[] = [];
    const equipment: EnemyAttachment[] = [];
    const links: { card_id: string; addon_id: string; sort_order: number }[] = [];

    for (let i = 0; i < sources.length; i++) {
      const src   = sources[i];
      const addon = src.addons!;

      // Reuse the player's matching addon where there is one.
      const { data: mine } = await supabase
        .from('addons')
        .select('id')
        .eq('user_id', user.id)
        .eq('addon_type_id', addon.addon_type_id)
        .eq('name', addon.name)
        .is('pack_id', null)
        .maybeSingle();

      let addonId = mine?.id as string | undefined;

      if (!addonId) {
        const { data: clone, error: cloneErr } = await supabase
          .from('addons')
          .insert({
            user_id:        user.id,
            addon_type_id:  addon.addon_type_id,
            name:           addon.name,
            description:    addon.description,
            stats:          addon.stats ?? {},
            pack_source_id: src.addon_id,
          })
          .select('id').single();
        if (cloneErr || !clone) {
          console.error('[BattleCards] Could not copy an addon:', cloneErr);
          continue;
        }
        addonId = clone.id as string;
      }

      links.push({ card_id: created.id as string, addon_id: addonId, sort_order: i });

      const slug = typeSlugRef.current[addon.addon_type_id];
      if (slug === ABILITY_SLUG) {
        abilities.push({ addonId, name: addon.name, description: addon.description ?? '' });
      } else if (slug === WEAPON_SLUG) {
        const ws = (addon.stats ?? {}) as RygWeaponStats;
        weapons.push({
          addonId, name: addon.name,
          damage: ws.damage ?? '', range: ws.range ?? 0,
          keywords: keywordString(addon.addon_keywords),
        });
      } else if (EQUIPMENT_SLUGS.includes(slug)) {
        equipment.push({ addonId, name: addon.name, description: addon.description ?? '' });
      }
    }

    if (links.length > 0) await supabase.from('card_addons').insert(links);

    const fresh: EnemyCardData = {
      id:         crypto.randomUUID(),
      dbId:       created.id as string,
      kind:       'enemy',
      name:       tpl.name,
      enemyType:  typeof s.enemyType === 'string' ? s.enemyType : 'Minion',
      aiType:     typeof s.aiType    === 'string' ? s.aiType    : 'Dross',
      offense:    num(s.offense),
      defense:    num(s.defense),
      life:       num(s.life),
      tactics:    num(s.tactics),
      fate:       num(s.fate),
      abilities, weapons, equipment,
      tokenState: {},
    };

    setEnemies(list => [...list, fresh]);
    return fresh.id;
  }, [deckId, enemies.length]);

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

  const patchEnemies = useCallback(
    (updater: (list: EnemyCardData[]) => EnemyCardData[]) => setEnemies(updater),
    [],
  );

  return {
    enemies, loading, packEnemies,
    addEnemy, addEnemyFromPack, updateEnemy, removeEnemy, patchEnemies,
  };
}
