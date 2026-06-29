/**
 * CardBuilderRyg.tsx — Repent Ye Foolish Gods warrior card builder
 *
 * LAYOUT (desktop ≥ 768px):
 * ┌──────────┬──────────────────────────┬────────────────────┐
 * │  Card    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * Route: /app/builder/ryg?deckId=<uuid>
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CenterViewport from '../components/CenterViewport';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import { useCardBuilder } from '../hooks/useCardBuilder';
import UnitListEntry from '../components/UnitListEntry';
import Input from '../components/Input';
import Counter from '../components/Counter';
import Button from '../components/Button';
import CardCarousel from '../components/CardCarousel';
import AddAddonModal from '../components/AddAddonModal';
import UploadPhotoModal from '../components/UploadPhotoModal';
import Modal from '../components/Modal';
import KeywordInfoModal from '../components/KeywordInfoModal';
import { type KeywordSelection } from '../components/AddKeywordModal';
import RygCard, { CARD_W, CARD_H, type RygSpell } from '../components/RygCard';
import SeptCard from '../components/SeptCard';
import GodCard from '../components/GodCard';
import RygWeaponForm, { type RygWeaponFormProps } from '../components/RygWeaponForm';
import RygSimpleAddonForm from '../components/RygSimpleAddonForm';
import RygWarriorTypeForm from '../components/RygWarriorTypeForm';
import RygTalentForm from '../components/RygTalentForm';
import RygSpellForm from '../components/RygSpellForm';
import RygSeptForm from '../components/RygSeptForm';
import RygDestinyForm from '../components/RygDestinyForm';
import RygSeptBenefitForm from '../components/RygSeptBenefitForm';
import RygGodForm from '../components/RygGodForm';
import UserRounded from '../icons/UserRounded';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Pen2 from '../icons/Pen2';
import { supabase } from '../lib/supabase';
import type { Addon, RygWarriorTypeStats, RygTalentStats, RygTalentParamField, RygSpellStats, RygSeptStats, RygDestinyStats, RygGodStats } from '../lib/database.types';
import { formatKeywordLabel } from '../lib/cardShape/util';
// @ts-ignore
import logoRyg from '../assets/games/card assets/ryg/icon.svg';
import logoRygLarge from '../assets/games/logo-ryg.png';

// ── Card-local data shapes ────────────────────────────────────────────────────

type LocalKeyword = KeywordSelection;

interface LocalSept    { addonId: string; name: string; prohibited: string; required: string; restricted: string; }
interface LocalDestiny { addonId: string; name: string; description: string; curse: string; }
interface LocalBenefit { addonId: string; name: string; description: string; }
interface LocalGod     { addonId: string; name: string; specialAbility: string; minions: string; servants: string; lieutenants: string; champions: string; }
interface SeptCardState { dbId?: string; sept: LocalSept | null; destiny: LocalDestiny | null; benefits: LocalBenefit[]; }
interface GodCardState  { dbId?: string; god: LocalGod | null; }

interface LocalTalent {
  addonId:       string;
  name:          string;
  description:   string;
  params?:       Record<string, string[]>;
  deferred?:     boolean;
  deferredLabel?: string;
}

interface LocalWarriorType {
  addonId:     string;
  typeName:    string;
  offense:     number;
  defense:     number;
  life:        number;
  tactics:     number;
  fate:        number;
  abilityDesc: string;
}

interface LocalWeapon {
  addonId:        string;
  name:           string;
  damage:         string;
  range:          number;
  cost:           number;
  description:    string;
  keywords:       string;
  weaponKeywords: LocalKeyword[];
}

interface LocalArmor {
  addonId:     string;
  name:        string;
  cost:        number;
  description: string;
}

interface LocalItem {
  addonId:     string;
  name:        string;
  cost:        number;
  description: string;
}

interface LocalSpell {
  addonId:      string;
  name:         string;
  spellType:    string;
  fateModifier: string;
  description:  string;
}

interface RygCardData {
  id:          string;
  dbId:        string | null;
  warriorName: string;
  warriorType: LocalWarriorType | null;
  sept:        string;
  offense:     number;
  defense:     number;
  life:        number;
  tactics:     number;
  fate:        number;
  talents:      string;
  talentAddons: LocalTalent[];
  weapons:     LocalWeapon[];
  armor:       LocalArmor[];
  items:       LocalItem[];
  spells:      LocalSpell[];
  portraitUrl: string | null;
}

const defaultCard = (): RygCardData => ({
  id:          crypto.randomUUID(),
  dbId:        null,
  warriorName: '',
  warriorType: null,
  sept:        '',
  offense:     0,
  defense:     0,
  life:        0,
  tactics:     0,
  fate:        0,
  talents:      '',
  talentAddons: [],
  weapons:     [],
  armor:       [],
  items:       [],
  spells:      [],
  portraitUrl: null,
});

const cardStats = (c: RygCardData) => ({
  sept:    c.sept,
  offense: c.offense,
  defense: c.defense,
  life:    c.life,
  tactics: c.tactics,
  fate:    c.fate,
});

const isBlank = (c: RygCardData) =>
  !c.warriorName && !c.warriorType &&
  c.offense === 0 && c.defense === 0 && c.life === 0 && c.tactics === 0 && c.fate === 0 &&
  c.weapons.length === 0 && c.armor.length === 0 && c.items.length === 0 && c.spells.length === 0;

const buildKeywordsStr = (kws: LocalKeyword[]) =>
  kws.map(k => formatKeywordLabel(k.keywordName, k.paramValue)).join(', ');

const buildTalentsStr = (talents: LocalTalent[]) =>
  talents.map(t => {
    const vals = t.params ? Object.values(t.params).flat().filter(Boolean) : [];
    return vals.length ? `${t.name} (${vals.join(', ')})` : t.name;
  }).join(', ');

// ── Retry helper ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T | undefined> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch { if (i < attempts - 1) await sleep(1000 * (i + 1)); }
  }
};

// ── Addon subtitle helpers ────────────────────────────────────────────────────

const weaponSubtitle = (addon: Addon): string => {
  const s = (addon.stats ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (s.damage) parts.push(String(s.damage));
  if (typeof s.range === 'number' && s.range > 0) parts.push(`${s.range}"`);
  if (typeof s.cost === 'number' && s.cost > 0) parts.push(`${s.cost}gp`);
  return parts.join(' · ') || 'No stats';
};

const spellSubtitle = (addon: Addon): string => {
  const s = (addon.stats ?? {}) as RygSpellStats;
  const parts: string[] = [];
  if (s.type)         parts.push(s.type);
  if (s.range != null && s.range > 0) parts.push(`${s.range}"`);
  if (s.fateModifier) parts.push(`Fate ${s.fateModifier}`);
  return parts.join(' · ') || '—';
};

const armorSubtitle = (addon: Addon): string => {
  const cost = (addon.stats as Record<string, unknown>)?.cost;
  const costStr = typeof cost === 'number' && cost > 0 ? `${cost}gp` : '';
  const desc = addon.description ? addon.description.slice(0, 50) + (addon.description.length > 50 ? '…' : '') : '';
  return [costStr, desc].filter(Boolean).join(' · ') || '—';
};

// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderRyg = () => {
  const [searchParams] = useSearchParams();
  const deckId         = searchParams.get('deckId');

  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isMobile, isShortHeight, mobilePanelOpen, layoutDeps,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  } = builder;

  // ── Card state ────────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState(() => {
    const card = defaultCard();
    return { cards: [card] as RygCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // ── Active view ───────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'warriors' | 'sept' | 'god'>('sept');

  // ── Sept / God card state ─────────────────────────────────────────────────
  const [septState, setSeptState] = useState<SeptCardState>({ sept: null, destiny: null, benefits: [] });
  const septDirtyRef = useRef(false);

  const [godState, setGodState] = useState<GodCardState>({ god: null });
  const godDirtyRef = useRef(false);

  // Sept / God picker modal state
  const [septPickerOpen,    setSeptPickerOpen]    = useState(false);
  const [destinyPickerOpen, setDestinyPickerOpen] = useState(false);
  const [benefitPickerOpen, setBenefitPickerOpen] = useState(false);
  const [godPickerOpen,     setGodPickerOpen]     = useState(false);

  const dirtyRef = useRef<Set<string>>(new Set());
  const prevSeptNameRef = useRef<string | null>(null);

  const updateActive = (patch: Partial<RygCardData>) => {
    dirtyRef.current.add(activeCardId);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === s.activeCardId ? { ...c, ...patch } : c),
    }));
  };

  // ── Load deck cards ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;

    supabase.from('decks').select('name').eq('id', deckId).single()
      .then(({ data }) => { if (data) setDeckName(data.name); });

    type AddonKwRow = {
      keyword_id: string;
      params:     Record<string, unknown> | null;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string }[] } | null;
    };
    type CardRow = {
      id:          string;
      name:        string;
      stats:       Record<string, unknown>;
      card_addons: {
        addon_id:   string;
        sort_order: number | null;
        params:     Record<string, string> | null;
        addons: {
          name:           string;
          description:    string | null;
          stats:          Record<string, unknown>;
          addon_type_id:  string;
          addon_keywords: AddonKwRow[];
        } | null;
      }[];
      card_keywords: {
        keyword_id: string;
        params:     Record<string, unknown> | null;
        sort_order: number | null;
        keywords:   { name: string; description: string | null; params_schema: { key: string; type: string }[] } | null;
      }[];
      card_images: { file_path: string; image_type: string }[];
    };

    supabase
      .from('addon_types')
      .select('id, slug, games!inner(slug)')
      .eq('games.slug', 'ryg')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data: addonTypes }) => {
        const typeIdToSlug: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });

        supabase
          .from('cards')
          .select('id, name, stats, card_addons(addon_id, sort_order, params, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)), card_images(file_path, image_type)')
          .eq('deck_id', deckId)
          .eq('card_type', 'operative')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .then(({ data, error }) => {
            if (error || !data || data.length === 0) return;

            const loaded = (data as unknown as CardRow[]).map(row => {
              const s = row.stats ?? {};
              const num = (v: unknown) => {
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                const n = parseInt(String(v ?? ''), 10);
                return Number.isFinite(n) ? n : 0;
              };

              const sortedAddons = [...(row.card_addons ?? [])]
                .filter(ca => ca.addons != null)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

              let warriorType: LocalWarriorType | null = null;
              const talentAddons: LocalTalent[]  = [];
              const weapons:      LocalWeapon[]  = [];
              const armor:        LocalArmor[]   = [];
              const items:        LocalItem[]    = [];
              const spells:       LocalSpell[]   = [];

              for (const ca of sortedAddons) {
                const addon = ca.addons!;
                const slug  = typeIdToSlug[addon.addon_type_id];
                const addonKws = [...(addon.addon_keywords ?? [])]
                  .filter(ak => ak.keywords != null)
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                const localKws: LocalKeyword[] = addonKws.map(ak => ({
                  keywordId:   ak.keyword_id,
                  keywordName: ak.keywords!.name,
                  description: ak.keywords!.description ?? '',
                  hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
                  paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
                }));

                if (slug === 'warrior-type') {
                  const ts = (addon.stats ?? {}) as RygWarriorTypeStats;
                  const n  = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : 0;
                  warriorType = {
                    addonId:     ca.addon_id,
                    typeName:    addon.name,
                    offense:     n(ts.offense),
                    defense:     n(ts.defense),
                    life:        n(ts.life),
                    tactics:     n(ts.tactics),
                    fate:        n(ts.fate),
                    abilityDesc: addon.description ?? '',
                  };
                } else if (slug === 'weapons') {
                  const ws = addon.stats;
                  weapons.push({
                    addonId:        ca.addon_id,
                    name:           addon.name,
                    damage:         typeof ws.damage === 'string' ? ws.damage : '',
                    range:          num(ws.range),
                    cost:           num(ws.cost),
                    description:    addon.description ?? '',
                    keywords:       buildKeywordsStr(localKws),
                    weaponKeywords: localKws,
                  });
                } else if (slug === 'talents') {
                  talentAddons.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '', params: (ca.params ?? undefined) as Record<string, string[]> | undefined });
                } else if (slug === 'armor') {
                  armor.push({ addonId: ca.addon_id, name: addon.name, cost: num((addon.stats as Record<string,unknown>).cost), description: addon.description ?? '' });
                } else if (slug === 'items') {
                  items.push({ addonId: ca.addon_id, name: addon.name, cost: num((addon.stats as Record<string,unknown>).cost), description: addon.description ?? '' });
                } else if (slug === 'spells') {
                  const ss = (addon.stats ?? {}) as RygSpellStats;
                  spells.push({ addonId: ca.addon_id, name: addon.name, spellType: ss.type ?? '', fateModifier: ss.fateModifier ?? '', description: addon.description ?? '' });
                }
              }


              const portraitImg = (row.card_images ?? []).find(i => i.image_type === 'portrait');
              let portraitUrl: string | null = null;
              if (portraitImg) {
                const { data: u } = supabase.storage.from('card-images').getPublicUrl(portraitImg.file_path);
                portraitUrl = u.publicUrl;
              }

              return {
                id:          row.id,
                dbId:        row.id,
                warriorName: row.name,
                warriorType,
                sept:        typeof s.sept === 'string' ? s.sept : '',
                offense:     num(s.offense),
                defense:     num(s.defense),
                life:        num(s.life),
                tactics:     num(s.tactics),
                fate:        num(s.fate),
                talents:      buildTalentsStr(talentAddons),
                talentAddons,
                weapons,
                armor,
                items,
                spells,
                portraitUrl,
              } as RygCardData;
            });

            setCardState({ cards: loaded, activeCardId: loaded[0].id });
          });
      });
  }, [deckId]);

  // ── Load sept / god card data ─────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;
    (async () => {
      const { data: addonTypes } = await supabase
        .from('addon_types')
        .select('id, slug, games!inner(slug)')
        .eq('games.slug', 'ryg');
      const typeSlug: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (addonTypes as any[] | null)?.forEach(t => { typeSlug[t.id] = t.slug; });

      const { data } = await supabase
        .from('cards')
        .select('id, card_type, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id))')
        .eq('deck_id', deckId)
        .in('card_type', ['sept', 'god']);

      if (!data) return;

      for (const row of data) {
        type ARow = { addon_id: string; sort_order: number; addons: { name: string; description: string | null; stats: unknown; addon_type_id: string } | null };
        const cas = (row.card_addons as unknown as ARow[]) ?? [];
        const sorted = [...cas].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        if (row.card_type === 'sept') {
          let sept: LocalSept | null = null;
          let destiny: LocalDestiny | null = null;
          const benefits: LocalBenefit[] = [];
          for (const ca of sorted) {
            const addon = ca.addons;
            if (!addon) continue;
            const slug = typeSlug[addon.addon_type_id];
            if (slug === 'septs') {
              const ss = (addon.stats ?? {}) as RygSeptStats;
              sept = { addonId: ca.addon_id, name: addon.name, prohibited: ss.prohibited ?? '', required: ss.required ?? '', restricted: ss.restricted ?? '' };
            } else if (slug === 'destinies') {
              const ds = (addon.stats ?? {}) as RygDestinyStats;
              destiny = { addonId: ca.addon_id, name: addon.name, description: ds.description ?? '', curse: ds.curse ?? '' };
            } else if (slug === 'sept-benefits') {
              benefits.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
            }
          }
          setSeptState({ dbId: row.id, sept, destiny, benefits });
        } else if (row.card_type === 'god') {
          let god: LocalGod | null = null;
          for (const ca of sorted) {
            const addon = ca.addons;
            if (!addon) continue;
            const slug = typeSlug[addon.addon_type_id];
            if (slug === 'gods') {
              const gs = (addon.stats ?? {}) as RygGodStats;
              god = { addonId: ca.addon_id, name: addon.name, specialAbility: gs.specialAbility ?? '', minions: gs.minions ?? '', servants: gs.servants ?? '', lieutenants: gs.lieutenants ?? '', champions: gs.champions ?? '' };
            }
          }
          setGodState({ dbId: row.id, god });
        }
      }
    })();
  }, [deckId]);

  // ── Propagate sept name to all warrior cards ──────────────────────────────
  useEffect(() => {
    const newName = septState.sept?.name ?? '';
    if (prevSeptNameRef.current === null) {
      prevSeptNameRef.current = newName;
      return;
    }
    if (prevSeptNameRef.current === newName) return;
    prevSeptNameRef.current = newName;
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        if (c.sept === newName) return c;
        dirtyRef.current.add(c.id);
        return { ...c, sept: newName };
      }),
    }));
  }, [septState.sept?.name]);

  // ── Auto-save (debounced 1s) — mirrors Kill Team card builder ───────────
  useEffect(() => {
    if (!deckId || dirtyRef.current.size === 0) return;

    const dirty = new Set(dirtyRef.current);
    const timer = setTimeout(async () => {
      dirtyRef.current.clear();

      for (let ci = 0; ci < cards.length; ci++) {
        const card = cards[ci];
        if (!dirty.has(card.id) || isBlank(card)) continue;

        await withRetry(async () => {
          let dbId = card.dbId;

          if (!dbId) {
            const { data, error } = await supabase
              .from('cards')
              .insert({ deck_id: deckId, name: card.warriorName || 'Unnamed Warrior', stats: cardStats(card), sort_order: ci })
              .select('id').single();
            if (error) throw error;
            dbId = data.id;
            setCardState(s => ({
              ...s,
              cards: s.cards.map(c => c.id === card.id ? { ...c, dbId: data.id } : c),
            }));
          } else {
            const { error } = await supabase
              .from('cards')
              .update({ name: card.warriorName || 'Unnamed Warrior', stats: cardStats(card), sort_order: ci })
              .eq('id', dbId);
            if (error) throw error;
          }

          await supabase.from('card_addons').delete().eq('card_id', dbId);
          const addonRows: { card_id: string; addon_id: string; sort_order: number; params: Record<string, string[]> }[] = [];
          let sortIdx = 0;
          if (card.warriorType) addonRows.push({ card_id: dbId!, addon_id: card.warriorType.addonId, sort_order: sortIdx++, params: {} });
          for (const t of card.talentAddons) addonRows.push({ card_id: dbId!, addon_id: t.addonId, sort_order: sortIdx++, params: t.params ?? {} });
          for (const w of card.weapons)      addonRows.push({ card_id: dbId!, addon_id: w.addonId, sort_order: sortIdx++, params: {} });
          for (const a of card.armor)        addonRows.push({ card_id: dbId!, addon_id: a.addonId, sort_order: sortIdx++, params: {} });
          for (const i of card.items)        addonRows.push({ card_id: dbId!, addon_id: i.addonId, sort_order: sortIdx++, params: {} });
          for (const s of card.spells)       addonRows.push({ card_id: dbId!, addon_id: s.addonId, sort_order: sortIdx++, params: {} });
          if (addonRows.length > 0) {
            await supabase.from('card_addons').insert(addonRows);
          }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [cards, deckId]);

  // ── Sept card auto-save ───────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || !septDirtyRef.current) return;
    septDirtyRef.current = false;
    const { sept, destiny, benefits, dbId } = septState;
    const isBlankSept = !sept && !destiny && benefits.length === 0;
    if (isBlankSept) return;
    const timer = setTimeout(async () => {
      const stats = {
        septAddonId:    sept?.addonId    ?? null,
        destinyAddonId: destiny?.addonId ?? null,
        benefits:       benefits.map(b => ({ addonId: b.addonId, name: b.name, description: b.description })),
      };
      let currentDbId = dbId;
      const septName = sept?.name ?? 'Unnamed Sept';
      if (!currentDbId) {
        const { data: insertData, error } = await supabase
          .from('cards')
          .insert({ deck_id: deckId, name: septName, stats, card_type: 'sept', sort_order: 0 })
          .select('id').single();
        if (error) { console.error('[BattleCards] sept card save error:', error); return; }
        currentDbId = insertData.id;
        setSeptState(prev => ({ ...prev, dbId: insertData.id }));
      } else {
        await supabase.from('cards').update({ name: septName, stats }).eq('id', currentDbId);
      }
      await supabase.from('card_addons').delete().eq('card_id', currentDbId);
      const rows: { card_id: string; addon_id: string; sort_order: number; params: object }[] = [];
      let idx = 0;
      if (sept)    rows.push({ card_id: currentDbId!, addon_id: sept.addonId,    sort_order: idx++, params: {} });
      if (destiny) rows.push({ card_id: currentDbId!, addon_id: destiny.addonId, sort_order: idx++, params: {} });
      for (const b of benefits) rows.push({ card_id: currentDbId!, addon_id: b.addonId, sort_order: idx++, params: {} });
      if (rows.length > 0) await supabase.from('card_addons').insert(rows);
    }, 1000);
    return () => clearTimeout(timer);
  }, [septState, deckId]);

  // ── God card auto-save ────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || !godDirtyRef.current) return;
    godDirtyRef.current = false;
    const { god, dbId } = godState;
    if (!god) return;
    const timer = setTimeout(async () => {
      const stats = { godAddonId: god.addonId };
      let currentDbId = dbId;
      if (!currentDbId) {
        const { data: insertData, error } = await supabase
          .from('cards')
          .insert({ deck_id: deckId, name: god.name, stats, card_type: 'god', sort_order: 0 })
          .select('id').single();
        if (error) { console.error('[BattleCards] god card save error:', error); return; }
        currentDbId = insertData.id;
        setGodState(prev => ({ ...prev, dbId: insertData.id }));
      } else {
        await supabase.from('cards').update({ name: god.name, stats }).eq('id', currentDbId);
      }
      await supabase.from('card_addons').delete().eq('card_id', currentDbId);
      await supabase.from('card_addons').insert([{ card_id: currentDbId!, addon_id: god.addonId, sort_order: 0, params: {} }]);
    }, 1000);
    return () => clearTimeout(timer);
  }, [godState, deckId]);

  // ── Ensure card row exists before image upload ────────────────────────────
  const ensureCardSaved = async (): Promise<string | null> => {
    if (activeCard.dbId) return activeCard.dbId;
    if (!deckId) return null;
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert({ deck_id: deckId, name: activeCard.warriorName || 'Unnamed Warrior', stats: cardStats(activeCard) })
        .select('id').single();
      if (error) throw error;
      setCardState(s => ({
        ...s,
        cards: s.cards.map(c => c.id === activeCard.id ? { ...c, dbId: data.id } : c),
      }));
      return data.id;
    } catch { return null; }
  };

  // ── Add / remove cards ───────────────────────────────────────────────────
  const addCard = () => {
    const card = { ...defaultCard(), sept: septState.sept?.name ?? '' };
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
  };

  const removeCard = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card?.dbId) await supabase.from('cards').delete().eq('id', card.dbId);
    setCardState(s => {
      const removedIdx = s.cards.findIndex(c => c.id === id);
      const remaining  = s.cards.filter(c => c.id !== id);
      const next       = remaining[Math.max(0, removedIdx - 1)] ?? remaining[0];
      const newCards   = remaining.length > 0 ? remaining : [defaultCard()];
      return { cards: newCards, activeCardId: next?.id ?? newCards[0].id };
    });
  };

  // ── Edit mode (drag-reorder) ──────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const dragItemRef  = useRef<number | null>(null);
  const dragOverRef  = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (i: number) => { dragItemRef.current = i; };
  const handleDragEnter = (i: number) => { dragOverRef.current = i; setDragOverIndex(i); };
  const handleDragEnd   = () => {
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
    if (from !== null && to !== null && from !== to) {
      setCardState(s => {
        const next = [...s.cards];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        next.forEach((c, idx) => {
          if (c.dbId) {
            withRetry(() => Promise.resolve(supabase.from('cards').update({ sort_order: idx }).eq('id', c.dbId!).then(r => { if (r.error) throw r.error; })));
          }
        });
        return { ...s, cards: next };
      });
    }
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  };

  // ── Modal state ───────────────────────────────────────────────────────────
  const [warriorTypeModalOpen, setWarriorTypeModalOpen] = useState(false);
  const [weaponModalOpen,      setWeaponModalOpen]      = useState(false);
  const [armorModalOpen,       setArmorModalOpen]       = useState(false);
  const [itemModalOpen,        setItemModalOpen]        = useState(false);
  const [spellModalOpen,       setSpellModalOpen]       = useState(false);
  const [photoModalOpen,       setPhotoModalOpen]       = useState(false);
  const [talentModalOpen,      setTalentModalOpen]      = useState(false);
  const [viewingTalent,        setViewingTalent]        = useState<{ name: string; description: string } | null>(null);
  const [pendingTalentParams,  setPendingTalentParams]  = useState<{
    addonId:      string;
    name:         string;
    description:  string;
    paramsSchema: RygTalentParamField[];
    selections:   Record<string, string[]>;
    /** Instruction text set by the warrior type author for this deferred choice. */
    deferredLabel?: string;
    /** When set, this picker is part of a deferred warrior-type apply sequence. */
    onConfirm?:   (params: Record<string, string[]>) => void;
  } | null>(null);

  // Pending keywords set by RygWeaponForm so onAdd can seed the weapon
  const pendingWeaponKws = useRef<LocalKeyword[]>([]);

  // Pending talents set by RygWarriorTypeForm so onAdd can seed the card
  const pendingWarriorTypeTalents = useRef<LocalTalent[]>([]);

  // Addon being edited (weapons)
  const [, setEditingAddon] = useState<Addon | null>(null);

  // ── Portrait upload / delete ──────────────────────────────────────────────
  const handlePortraitUploaded = (url: string) => {
    updateActive({ portraitUrl: url });
  };

  const handleDeletePortrait = async () => {
    updateActive({ portraitUrl: null });
    const dbId = activeCard.dbId;
    if (!dbId) return;
    await supabase.from('card_images').delete().eq('card_id', dbId).eq('image_type', 'portrait');
  };

  // ── Weapon keyword sync after edit ────────────────────────────────────────
  const syncWeaponKeywords = (addonId: string, kws: LocalKeyword[]) => {
    setCardState(s => ({
      ...s,
      cards: s.cards.map(card => ({
        ...card,
        weapons: card.weapons.map(w =>
          w.addonId === addonId
            ? { ...w, keywords: buildKeywordsStr(kws), weaponKeywords: kws }
            : w,
        ),
      })),
    }));
  };

  // ── Weapon add/edit form wrapped for AddAddonModal ────────────────────────
  const WeaponFormWithCallbacks = useCallback((props: RygWeaponFormProps) => (
    <RygWeaponForm
      {...props}
      onPendingKeywords={kws => { pendingWeaponKws.current = kws; }}
      onKeywordsSaved={syncWeaponKeywords}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []);

  const WarriorTypeFormComponent = useCallback(
    (props: Parameters<typeof RygWarriorTypeForm>[0]) => (
      <RygWarriorTypeForm
        {...props}
        onPendingTalents={talents => { pendingWarriorTypeTalents.current = talents.map(t => ({ addonId: t.id, name: t.name, description: t.description, params: t.params as Record<string, string[]> | undefined, deferred: t.deferred, deferredLabel: t.deferredLabel })); }}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const ArmorForm = useCallback((props: Parameters<typeof RygSimpleAddonForm>[0]) => (
    <RygSimpleAddonForm
      {...props}
      showCost
      namePlaceholder="Armor Name"
      descPlaceholder="Describe the armor's effect…"
      saveLabel="Save Armor"
    />
  ), []);

  const ItemForm = useCallback((props: Parameters<typeof RygSimpleAddonForm>[0]) => (
    <RygSimpleAddonForm
      {...props}
      showCost
      namePlaceholder="Item Name"
      descPlaceholder="Describe the item's effect…"
      saveLabel="Save Item"
    />
  ), []);

  const TalentForm = useCallback((props: Parameters<typeof RygTalentForm>[0]) => (
    <RygTalentForm {...props} />
  ), []);

  const SpellForm = useCallback((props: Parameters<typeof RygSpellForm>[0]) => (
    <RygSpellForm {...props} />
  ), []);

  const SeptFormComponent    = useCallback((props: Parameters<typeof RygSeptForm>[0])        => <RygSeptForm {...props} />,        []);
  const DestinyFormComponent = useCallback((props: Parameters<typeof RygDestinyForm>[0])     => <RygDestinyForm {...props} />,     []);
  const BenefitFormComponent = useCallback((props: Parameters<typeof RygSeptBenefitForm>[0]) => <RygSeptBenefitForm {...props} />, []);
  const GodFormComponent     = useCallback((props: Parameters<typeof RygGodForm>[0])         => <RygGodForm {...props} />,         []);

  // ── Render ────────────────────────────────────────────────────────────────

  const cardToProps = (card: RygCardData) => ({
    warriorName:        card.warriorName,
    type:               card.warriorType?.typeName ?? '',
    sept:               card.sept,
    offense:            card.offense,
    defense:            card.defense,
    life:               card.life,
    tactics:            card.tactics,
    fate:               card.fate,
    talents:            card.talents,
    talentList:         card.talentAddons.map(t => ({
      addonId:     t.addonId,
      name:        t.name,
      description: t.description,
      displayName: t.params && Object.keys(t.params).length > 0
        ? `${t.name} (${Object.values(t.params).flat().filter(Boolean).join(', ')})`
        : t.name,
    })),
    specialAbilityDesc: card.warriorType?.abilityDesc || undefined,
    weapons:            card.weapons.map(w => ({ id: w.addonId, name: w.name, damage: w.damage, range: w.range, cost: w.cost, description: w.description, keywords: w.keywords, keywordList: w.weaponKeywords.map(kw => ({ name: kw.keywordName, description: kw.description })) })),
    armor:              card.armor.map(a => ({ id: a.addonId, name: a.name, cost: a.cost, description: a.description })),
    items:              card.items.map(i => ({ id: i.addonId, name: i.name, cost: i.cost, description: i.description })),
    spells:             card.spells.map((s): RygSpell => ({ id: s.addonId, name: s.name, spellType: s.spellType, fateModifier: s.fateModifier, description: s.description })),
    portrait:           card.portraitUrl ?? undefined,
  });

  // ── Card list row renderer ────────────────────────────────────────────────
  const renderCardRow = (card: RygCardData, i: number) => {
    const addonCount = card.weapons.length + card.armor.length + card.items.length;
    const addonSummary = addonCount === 0 ? undefined : `${addonCount} item${addonCount !== 1 ? 's' : ''}`;
    const unitType = [card.warriorType?.typeName, card.sept].filter(Boolean).join(' · ') || undefined;
    const status = isBlank(card) ? 'blank' : 'complete';

    return (
      <div
        key={card.id}
        draggable={editMode}
        onDragStart={() => handleDragStart(i)}
        onDragEnter={() => handleDragEnter(i)}
        onDragEnd={handleDragEnd}
        onDragOver={e => e.preventDefault()}
        style={{ opacity: editMode && dragOverIndex === i ? 0.5 : 1 }}
      >
        <UnitListEntry
          unitName={card.warriorName || 'Unnamed Warrior'}
          unitType={unitType}
          addonSummary={addonSummary}
          avatarSrc={card.portraitUrl ?? logoRyg}
          status={status}
          active={activeView === 'warriors' && card.id === activeCardId}
          activated={false}
          editMode={editMode}
          onClick={() => { setCardState(s => ({ ...s, activeCardId: card.id })); setActiveView('warriors'); }}
          onDuplicate={undefined}
          onDelete={() => removeCard(card.id)}
        />
      </div>
    );
  };

  return (
    <BuilderShell
      navbar={
        <Navbar fixed={false}>
          {deckId && (
            <Link
              to={`/app/print?deckId=${deckId}`}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Print
            </Link>
          )}
        </Navbar>
      }
      topBar={
        <EditSubnav
          className="lg:hidden"
          cardListOpen={cardListOpen}
          editorOpen={editorOpen}
          onToggleCardList={toggleCardList}
          onToggleEditor={toggleEditor}
        />
      }
      leftPanelOpen={cardListOpen}
      leftPanel={
        <CardListPanel
          deckName={deckName}
          editingDeckName={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={n => commitDeckName(n, { persist: true })}
          onCancelEdit={() => setEditingDeckName(false)}
          headerAction={
            <button
              onClick={() => setEditMode(m => !m)}
              className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              aria-label={editMode ? 'Done editing' : 'Reorder warriors'}
            >
              {editMode ? <CheckCircle className="w-5 h-5" /> : <Pen2 className="w-5 h-5" />}
            </button>
          }
          footer={
            !editMode && (
              <Button className="w-full" onClick={addCard}>
                <AddCircle className="w-4 h-4" /> Add Warrior
              </Button>
            )
          }
        >
          <nav className="flex flex-col gap-1">
            {/* Sept + God cards always appear first */}
            {deckId && (
              <>
                <UnitListEntry
                  unitName={septState.sept?.name ?? 'Sept Card'}
                  unitType="Sept Card"
                  avatarSrc={logoRyg}
                  status={septState.sept ? 'complete' : 'blank'}
                  active={activeView === 'sept'}
                  activated={false}
                  editMode={false}
                  onClick={() => setActiveView('sept')}
                  onDuplicate={undefined}
                  onDelete={undefined}
                />
                <UnitListEntry
                  unitName={godState.god?.name ?? 'God Card'}
                  unitType="God Card"
                  avatarSrc={logoRyg}
                  status={godState.god ? 'complete' : 'blank'}
                  active={activeView === 'god'}
                  activated={false}
                  editMode={false}
                  onClick={() => setActiveView('god')}
                  onDuplicate={undefined}
                  onDelete={undefined}
                />
              </>
            )}

            {/* Warriors section separator */}
            <h3 className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]">
              <span>Warriors</span>
              <span className="flex-1 h-px bg-gray-700" />
            </h3>

            {cards.map((card, i) => renderCardRow(card, i))}
          </nav>
        </CardListPanel>
      }
      center={
        activeView === 'sept' ? (
          <CenterViewport logo={<img src={logoRygLarge} alt="Repent Ye Foolish Gods" className="h-10 w-auto" />} mobilePanelOpen={mobilePanelOpen} isShortHeight={isShortHeight} isMobile={isMobile}>
            <CardCarousel
              items={[{ id: 'sept-card' }]}
              activeId="sept-card"
              onActiveChange={() => {}}
              cardWidth={CARD_W}
              cardHeight={CARD_H}
              className="w-full flex-1 min-h-0"
              renderItem={() => (
                <SeptCard
                  septName={septState.sept?.name ?? ''}
                  prohibited={septState.sept?.prohibited}
                  required={septState.sept?.required}
                  restricted={septState.sept?.restricted}
                  benefits={septState.benefits.map(b => ({ name: b.name, description: b.description }))}
                  destinyName={septState.destiny?.name}
                  destinyDesc={septState.destiny?.description}
                  destinyCurse={septState.destiny?.curse}
                />
              )}
            />
          </CenterViewport>
        ) : activeView === 'god' ? (
          <CenterViewport logo={<img src={logoRygLarge} alt="Repent Ye Foolish Gods" className="h-10 w-auto" />} mobilePanelOpen={mobilePanelOpen} isShortHeight={isShortHeight} isMobile={isMobile}>
            <CardCarousel
              items={[{ id: 'god-card' }]}
              activeId="god-card"
              onActiveChange={() => {}}
              cardWidth={CARD_W}
              cardHeight={CARD_H}
              className="w-full flex-1 min-h-0"
              renderItem={() => (
                <GodCard
                  godName={godState.god?.name}
                  specialAbility={godState.god?.specialAbility}
                  minions={godState.god?.minions}
                  servants={godState.god?.servants}
                  lieutenants={godState.god?.lieutenants}
                  champions={godState.god?.champions}
                />
              )}
            />
          </CenterViewport>
        ) : (
          <CenterViewport
            logo={<img src={logoRygLarge} alt="Repent Ye Foolish Gods" className="h-10 w-auto" />}
            mobilePanelOpen={mobilePanelOpen}
            isShortHeight={isShortHeight}
            isMobile={isMobile}
          >
            <CardCarousel
              items={cards}
              activeId={activeCardId}
              onActiveChange={id => setCardState(s => ({ ...s, activeCardId: id }))}
              cardWidth={CARD_W}
              cardHeight={CARD_H}
              className="w-full flex-1 min-h-0"
              renderItem={(card, role) => (
                <RygCard
                  {...cardToProps(card)}
                  onTalentClick={setViewingTalent}
                  {...(role === 'active' ? {
                    onChangeName:    (v: string) => updateActive({ warriorName: v }),
                    onChangeSept:    (v: string) => updateActive({ sept: v }),
                    onChangeTalents: (v: string) => updateActive({ talents: v }),
                  } : {})}
                />
              )}
              layoutDeps={layoutDeps}
            />
          </CenterViewport>
        )
      }
      rightPanelOpen={editorOpen}
      rightPanel={
        activeView === 'sept' ? (
          <EditorPanel title="Sept Card">
            <div className="flex flex-col gap-4 p-4">
              {/* Sept */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Sept</p>
                {septState.sept ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{septState.sept.name}</p>
                    <button type="button" aria-label="Remove sept" onClick={() => { septDirtyRef.current = true; setSeptState(ss => ({ ...ss, sept: null })); }} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"><CloseCircle className="size-4" /></button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setSeptPickerOpen(true)}>Add Sept</Button>
                )}
              </div>
              {/* Destiny */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Destiny</p>
                {septState.destiny ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{septState.destiny.name}</p>
                    <button type="button" aria-label="Remove destiny" onClick={() => { septDirtyRef.current = true; setSeptState(ss => ({ ...ss, destiny: null })); }} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"><CloseCircle className="size-4" /></button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setDestinyPickerOpen(true)}>Add Destiny</Button>
                )}
              </div>
              {/* Benefits */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Benefits</p>
                {septState.benefits.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {septState.benefits.map(b => (
                      <div key={b.addonId} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                        <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{b.name}</p>
                        <button type="button" aria-label={`Remove ${b.name}`} onClick={() => { septDirtyRef.current = true; setSeptState(ss => ({ ...ss, benefits: ss.benefits.filter(x => x.addonId !== b.addonId) })); }} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"><CloseCircle className="size-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setBenefitPickerOpen(true)}>Add Benefit</Button>
              </div>
            </div>
          </EditorPanel>
        ) : activeView === 'god' ? (
          <EditorPanel title="God Card">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">God</p>
                {godState.god ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{godState.god.name}</p>
                    <button type="button" aria-label="Remove god" onClick={() => { godDirtyRef.current = true; setGodState(gs => ({ ...gs, god: null })); }} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"><CloseCircle className="size-4" /></button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setGodPickerOpen(true)}>Add God</Button>
                )}
              </div>
            </div>
          </EditorPanel>
        ) : (
        <EditorPanel title="Edit Warrior">

          {/* Warrior Type */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Warrior Type</p>
            {activeCard.warriorType && (
              <div className="flex items-start gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-gray-200 truncate">
                    {activeCard.warriorType.typeName}
                  </p>
                  {activeCard.warriorType.abilityDesc && (
                    <p className="font-body text-xs text-gray-500 truncate">
                      {activeCard.warriorType.abilityDesc.slice(0, 60)}{activeCard.warriorType.abilityDesc.length > 60 ? '…' : ''}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Change warrior type"
                  onClick={() => setWarriorTypeModalOpen(true)}
                  className="shrink-0 text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <Pen2 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove warrior type"
                  onClick={() => updateActive({ warriorType: null })}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            )}
            {!activeCard.warriorType && (
              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setWarriorTypeModalOpen(true)}
              >
                Select Warrior Type
              </Button>
            )}
          </section>

          {/* Warrior Name */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Identity</p>
            <Input
              label="Warrior Name"
              value={activeCard.warriorName}
              onChange={e => updateActive({ warriorName: e.target.value })}
              placeholder="Gary the Stabber"
            />
          </section>

          {/* Portrait */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Portrait</p>
            {activeCard.portraitUrl ? (
              <div className="flex flex-wrap gap-1">
                <Button
                  leftIcon={<UserRounded className="w-4 h-4" />}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => { await ensureCardSaved(); setPhotoModalOpen(true); }}
                >
                  Replace Portrait
                </Button>
                <Button
                  leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
                  variant="ghost"
                  color="danger"
                  size="sm"
                  onClick={handleDeletePortrait}
                >
                  Remove Portrait
                </Button>
              </div>
            ) : (
              <Button
                leftIcon={<UserRounded className="w-4 h-4" />}
                variant="outline"
                size="sm"
                onClick={async () => { await ensureCardSaved(); setPhotoModalOpen(true); }}
              >
                Upload Portrait Image
              </Button>
            )}
          </section>

          {/* Stats */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Stats</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              {(['offense', 'defense', 'life', 'tactics', 'fate'] as const).map(key => (
                <Counter
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={activeCard[key]}
                  onChange={v => updateActive({ [key]: v })}
                  min={0}
                  max={99}
                  className="w-full"
                />
              ))}
            </div>
          </section>

          {/* Talents */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Talents</p>
            {activeCard.talentAddons.map(t => (
              <div
                key={t.addonId}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <p className="font-body text-sm font-medium text-gray-200 flex-1 min-w-0 truncate">
                  {buildTalentsStr([t])}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => {
                    const next = activeCard.talentAddons.filter(x => x.addonId !== t.addonId);
                    updateActive({ talentAddons: next, talents: buildTalentsStr(next) });
                  }}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            <Button
              leftIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setTalentModalOpen(true)}
            >
              Add Talent
            </Button>
          </section>

          {/* Weapons */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Weapons</p>
            {activeCard.weapons.map(w => (
              <div
                key={w.addonId}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-gray-200 truncate">{w.name}</p>
                  <p className="font-body text-xs text-gray-500 truncate">
                    {[w.damage, w.range > 0 ? `${w.range}"` : '', w.cost > 0 ? `${w.cost}gp` : ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${w.name}`}
                  onClick={async () => {
                    const { data } = await supabase.from('addons').select('*').eq('id', w.addonId).single();
                    if (data) setEditingAddon(data as Addon);
                    setWeaponModalOpen(true);
                  }}
                  className="shrink-0 text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <Pen2 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${w.name}`}
                  onClick={() => {
                    dirtyRef.current.add(activeCardId);
                    updateActive({ weapons: activeCard.weapons.filter(x => x.addonId !== w.addonId) });
                  }}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            <Button
              leftIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setWeaponModalOpen(true)}
            >
              Add Weapon
            </Button>
          </section>

          {/* Armor */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Armor</p>
            {activeCard.armor.map(a => (
              <div
                key={a.addonId}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-gray-200 truncate">{a.name}</p>
                  <p className="font-body text-xs text-gray-500 truncate">
                    {[a.cost > 0 ? `${a.cost}gp` : '', a.description].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => updateActive({ armor: activeCard.armor.filter(x => x.addonId !== a.addonId) })}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            <Button
              leftIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setArmorModalOpen(true)}
            >
              Add Armor
            </Button>
          </section>

          {/* Items */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Items</p>
            {activeCard.items.map(i => (
              <div
                key={i.addonId}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-gray-200 truncate">{i.name}</p>
                  <p className="font-body text-xs text-gray-500 truncate">
                    {[i.cost > 0 ? `${i.cost}gp` : '', i.description].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${i.name}`}
                  onClick={() => updateActive({ items: activeCard.items.filter(x => x.addonId !== i.addonId) })}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            <Button
              leftIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setItemModalOpen(true)}
            >
              Add Item
            </Button>
          </section>

          {/* Spells */}
          <section className="space-y-3">
            <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Spells</p>
            {activeCard.spells.map(s => (
              <div
                key={s.addonId}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-gray-200 truncate">{s.name}</p>
                  <p className="font-body text-xs text-gray-500 truncate">
                    {[s.spellType, s.fateModifier ? `Fate ${s.fateModifier}` : ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => updateActive({ spells: activeCard.spells.filter(x => x.addonId !== s.addonId) })}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            <Button
              leftIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setSpellModalOpen(true)}
            >
              Add Spell
            </Button>
          </section>

        </EditorPanel>
        )
      }
      modals={
        <>
          <KeywordInfoModal
            open={!!viewingTalent}
            onClose={() => setViewingTalent(null)}
            name={viewingTalent?.name ?? ''}
            description={viewingTalent?.description ?? ''}
            typeName="Talent"
          />

          {photoModalOpen && (
            <UploadPhotoModal
              game="ryg"
              open
              cardDbId={activeCard.dbId}
              onClose={() => setPhotoModalOpen(false)}
              onImageUploaded={handlePortraitUploaded}
            />
          )}

          {talentModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="talents"
              addonTypeName="Talent"
              excludeAddonIds={activeCard.talentAddons.map(t => t.addonId)}
              onClose={() => setTalentModalOpen(false)}
              onAdd={addon => {
                setTalentModalOpen(false);
                const ps = (addon.stats as RygTalentStats)?.paramsSchema;
                if (ps && ps.length > 0) {
                  setPendingTalentParams({ addonId: addon.id, name: addon.name, description: addon.description ?? '', paramsSchema: ps, selections: {} });
                } else {
                  const next = [...activeCard.talentAddons, { addonId: addon.id, name: addon.name, description: addon.description ?? '' }];
                  updateActive({ talentAddons: next, talents: buildTalentsStr(next) });
                }
              }}
              onDeleted={id => {
                const next = activeCard.talentAddons.filter(t => t.addonId !== id);
                updateActive({ talentAddons: next, talents: buildTalentsStr(next) });
              }}
              getSubtitle={addon => addon.description ? addon.description.slice(0, 60) + (addon.description.length > 60 ? '…' : '') : '—'}
              CreateFormComponent={TalentForm}
            />
          )}

          {pendingTalentParams && (
            <Modal open onClose={() => setPendingTalentParams(null)} className="max-w-sm">
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <h5 className="font-heading text-xl text-white">{pendingTalentParams.name}</h5>
                  <p className="font-body text-sm text-gray-400 mt-1">
                    {pendingTalentParams.deferredLabel || 'Choose the options for this warrior.'}
                  </p>
                </div>
                {pendingTalentParams.paramsSchema.map(field => {
                  const selected = pendingTalentParams.selections[field.key] ?? [];
                  const atMax = field.maxSelections !== undefined && selected.length >= field.maxSelections;
                  const toggle = (opt: string) => setPendingTalentParams(prev => {
                    if (!prev) return prev;
                    const cur = prev.selections[field.key] ?? [];
                    if (cur.includes(opt)) return { ...prev, selections: { ...prev.selections, [field.key]: cur.filter(v => v !== opt) } };
                    if (field.maxSelections !== undefined && cur.length >= field.maxSelections) return prev;
                    return { ...prev, selections: { ...prev.selections, [field.key]: [...cur, opt] } };
                  });
                  return (
                    <div key={field.key}>
                      <p className="font-body text-sm font-medium text-white mb-2">
                        {field.label}
                        {field.maxSelections !== undefined && (
                          <span className="text-gray-400 font-normal"> (max {field.maxSelections})</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {field.options.map(opt => {
                          const isSelected = selected.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggle(opt)}
                              disabled={!isSelected && atMax}
                              className={`px-3 py-1.5 rounded-full text-sm font-body border transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : atMax
                                    ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
                                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <Button
                    leftIcon={<CheckCircle className="size-4" />}
                    disabled={pendingTalentParams.paramsSchema.some(f => !(pendingTalentParams.selections[f.key]?.length))}
                    onClick={() => {
                      const t = pendingTalentParams;
                      setPendingTalentParams(null);
                      if (t.onConfirm) {
                        t.onConfirm(t.selections);
                        return;
                      }
                      const next = [...activeCard.talentAddons, { addonId: t.addonId, name: t.name, description: t.description, params: t.selections }];
                      updateActive({ talentAddons: next, talents: buildTalentsStr(next) });
                    }}
                  >
                    Confirm
                  </Button>
                  <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={() => setPendingTalentParams(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {warriorTypeModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="warrior-type"
              addonTypeName="Warrior Type"
              excludeAddonIds={activeCard.warriorType ? [activeCard.warriorType.addonId] : []}
              onClose={() => { setWarriorTypeModalOpen(false); pendingWarriorTypeTalents.current = []; }}
              onAdd={async addon => {
                const ts = (addon.stats ?? {}) as RygWarriorTypeStats;
                const n  = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : 0;
                let talents = pendingWarriorTypeTalents.current;
                pendingWarriorTypeTalents.current = [];
                const richTalents = ts.talents ?? [];
                const talentIds   = richTalents.length > 0
                  ? richTalents.map(t => t.id)
                  : (ts.talentIds ?? []);
                if (talents.length === 0 && talentIds.length > 0) {
                  const { data } = await supabase
                    .from('addons')
                    .select('id, name, description, stats')
                    .in('id', talentIds);
                  if (data) {
                    const byId       = new Map(data.map(a => [a.id, a]));
                    const paramsById  = Object.fromEntries(richTalents.map(t => [t.id, t.params]));
                    const deferredSet      = new Set(richTalents.filter(t => t.deferred).map(t => t.id));
                    const deferredLabelMap = Object.fromEntries(richTalents.filter(t => t.deferred).map(t => [t.id, t.deferredLabel]));
                    talents = talentIds
                      .filter(id => byId.has(id))
                      .map(id => {
                        const a = byId.get(id)!;
                        const isDeferred = deferredSet.has(id);
                        return { addonId: a.id, name: a.name, description: a.description ?? '', params: paramsById[id], deferred: isDeferred, deferredLabel: isDeferred ? deferredLabelMap[id] : undefined };
                      });
                  }
                }

                const warriorType = {
                  addonId:     addon.id,
                  typeName:    addon.name,
                  offense:     n(ts.offense),
                  defense:     n(ts.defense),
                  life:        n(ts.life),
                  tactics:     n(ts.tactics),
                  fate:        n(ts.fate),
                  abilityDesc: addon.description ?? '',
                };
                const applyWarriorType = (finalTalents: LocalTalent[]) => {
                  const cleaned = finalTalents.map(({ deferred: _d, ...t }) => t);
                  updateActive({
                    warriorType,
                    offense:      n(ts.offense),
                    defense:      n(ts.defense),
                    life:         n(ts.life),
                    tactics:      n(ts.tactics),
                    fate:         n(ts.fate),
                    talentAddons: cleaned,
                    talents:      buildTalentsStr(cleaned),
                  });
                  setWarriorTypeModalOpen(false);
                };

                // Find deferred talents and fetch their paramsSchema
                const deferredTalents = talents.filter(t => t.deferred);
                if (deferredTalents.length > 0) {
                  const { data: schemaData } = await supabase
                    .from('addons')
                    .select('id, stats')
                    .in('id', deferredTalents.map(t => t.addonId));
                  const schemaById = new Map(
                    (schemaData ?? []).map(a => [a.id, ((a.stats as RygTalentStats)?.paramsSchema ?? []) as RygTalentParamField[]])
                  );
                  const mutableTalents = talents.map(t => ({ ...t }));
                  let queueIdx = 0;
                  const processNext = () => {
                    if (queueIdx >= deferredTalents.length) {
                      applyWarriorType(mutableTalents);
                      return;
                    }
                    const dt = deferredTalents[queueIdx];
                    const paramsSchema = schemaById.get(dt.addonId) ?? [];
                    if (!paramsSchema.length) {
                      queueIdx++;
                      processNext();
                      return;
                    }
                    const talentIdx = mutableTalents.findIndex(t => t.addonId === dt.addonId);
                    setPendingTalentParams({
                      addonId: dt.addonId, name: dt.name, description: dt.description,
                      paramsSchema, selections: {}, deferredLabel: dt.deferredLabel,
                      onConfirm: (params) => {
                        if (talentIdx >= 0) mutableTalents[talentIdx] = { ...mutableTalents[talentIdx], params };
                        queueIdx++;
                        processNext();
                      },
                    });
                  };
                  processNext();
                } else {
                  applyWarriorType(talents);
                }
              }}
              onDeleted={id => {
                if (activeCard.warriorType?.addonId === id) updateActive({ warriorType: null });
              }}
              getSubtitle={addon => {
                const ts = (addon.stats ?? {}) as RygWarriorTypeStats;
                const stats = ['OFF','DEF','LIF','TAC','FAT']
                  .map((label, i) => `${label} ${[ts.offense, ts.defense, ts.life, ts.tactics, ts.fate][i] ?? 0}`)
                  .join(' · ');
                return stats;
              }}
              CreateFormComponent={WarriorTypeFormComponent}
            />
          )}

          {weaponModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="weapons"
              addonTypeName="Weapon"
              excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
              onClose={() => { setWeaponModalOpen(false); setEditingAddon(null); pendingWeaponKws.current = []; }}
              onAdd={async addon => {
                const ws = (addon.stats ?? {}) as Record<string, unknown>;
                let kws = pendingWeaponKws.current;
                pendingWeaponKws.current = [];
                // Picking an existing weapon: pending kws are empty, fetch from DB
                if (kws.length === 0) {
                  const { data: kwData } = await supabase
                    .from('addon_keywords')
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
                    .eq('addon_id', addon.id)
                    .order('sort_order');
                  if (kwData) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    kws = (kwData as any[])
                      .filter(ak => ak.keywords != null)
                      .map(ak => ({
                        keywordId:   ak.keyword_id as string,
                        keywordName: ak.keywords.name as string,
                        description: (ak.keywords.description ?? '') as string,
                        hasParams:   Array.isArray(ak.keywords.params_schema) && ak.keywords.params_schema.length > 0,
                        paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
                      }));
                  }
                }
                updateActive({
                  weapons: [...activeCard.weapons, {
                    addonId:        addon.id,
                    name:           addon.name,
                    damage:         typeof ws.damage === 'string' ? ws.damage : '',
                    range:          typeof ws.range === 'number' ? ws.range : 0,
                    cost:           typeof ws.cost === 'number' ? ws.cost : 0,
                    description:    addon.description ?? '',
                    keywords:       buildKeywordsStr(kws),
                    weaponKeywords: kws,
                  }],
                });
                setWeaponModalOpen(false);
              }}
              onDeleted={id => updateActive({ weapons: activeCard.weapons.filter(w => w.addonId !== id) })}
              getSubtitle={weaponSubtitle}
              CreateFormComponent={WeaponFormWithCallbacks}
            />
          )}

          {armorModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="armor"
              addonTypeName="Armor"
              excludeAddonIds={activeCard.armor.map(a => a.addonId)}
              onClose={() => setArmorModalOpen(false)}
              onAdd={addon => {
                const ws = (addon.stats ?? {}) as Record<string, unknown>;
                updateActive({
                  armor: [...activeCard.armor, { addonId: addon.id, name: addon.name, cost: typeof ws.cost === 'number' ? ws.cost : 0, description: addon.description ?? '' }],
                });
                setArmorModalOpen(false);
              }}
              onDeleted={id => updateActive({ armor: activeCard.armor.filter(a => a.addonId !== id) })}
              getSubtitle={armorSubtitle}
              CreateFormComponent={ArmorForm}
            />
          )}

          {itemModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="items"
              addonTypeName="Item"
              excludeAddonIds={activeCard.items.map(i => i.addonId)}
              onClose={() => setItemModalOpen(false)}
              onAdd={addon => {
                const ws = (addon.stats ?? {}) as Record<string, unknown>;
                updateActive({
                  items: [...activeCard.items, { addonId: addon.id, name: addon.name, cost: typeof ws.cost === 'number' ? ws.cost : 0, description: addon.description ?? '' }],
                });
                setItemModalOpen(false);
              }}
              onDeleted={id => updateActive({ items: activeCard.items.filter(i => i.addonId !== id) })}
              getSubtitle={armorSubtitle}
              CreateFormComponent={ItemForm}
            />
          )}

          {spellModalOpen && (
            <AddAddonModal
              open
              gameSlug="ryg"
              addonTypeSlug="spells"
              addonTypeName="Spell"
              excludeAddonIds={activeCard.spells.map(sp => sp.addonId)}
              prioritiseByPrerequisites
              prerequisiteContext={activeCard.talentAddons.map(t => ({
                addonId:  t.addonId,
                name:     t.name,
                typeSlug: 'talents',
                params:   t.params,
              }))}
              onClose={() => setSpellModalOpen(false)}
              onAdd={addon => {
                const ss = (addon.stats ?? {}) as RygSpellStats;
                updateActive({
                  spells: [...activeCard.spells, {
                    addonId:      addon.id,
                    name:         addon.name,
                    spellType:    ss.type ?? '',
                    fateModifier: ss.fateModifier ?? '',
                    description:  addon.description ?? '',
                  }],
                });
                setSpellModalOpen(false);
              }}
              onDeleted={id => updateActive({ spells: activeCard.spells.filter(sp => sp.addonId !== id) })}
              getSubtitle={spellSubtitle}
              CreateFormComponent={SpellForm}
            />
          )}

          {/* Sept pickers */}
          {septPickerOpen && (
            <AddAddonModal open gameSlug="ryg" addonTypeSlug="septs" addonTypeName="Sept"
              excludeAddonIds={septState.sept ? [septState.sept.addonId] : []}
              onClose={() => setSeptPickerOpen(false)}
              onAdd={async addon => {
                const ss = (addon.stats ?? {}) as RygSeptStats;
                setSeptPickerOpen(false);
                const patch: Partial<SeptCardState> = {
                  sept: { addonId: addon.id, name: addon.name, prohibited: ss.prohibited ?? '', required: ss.required ?? '', restricted: ss.restricted ?? '' },
                };
                const benefitIds = ss.benefitIds ?? [];
                if (benefitIds.length > 0) {
                  const { data: benefitData } = await supabase.from('addons').select('id, name, description').in('id', benefitIds);
                  if (benefitData) {
                    const byId = new Map(benefitData.map(a => [a.id, a]));
                    patch.benefits = benefitIds.filter(id => byId.has(id)).map(id => { const a = byId.get(id)!; return { addonId: a.id, name: a.name, description: a.description ?? '' }; });
                  }
                }
                septDirtyRef.current = true;
                setSeptState(prev => ({ ...prev, ...patch }));
              }}
              onDeleted={() => { septDirtyRef.current = true; setSeptState(prev => ({ ...prev, sept: null })); }}
              getSubtitle={a => a.description ?? '—'}
              CreateFormComponent={SeptFormComponent}
            />
          )}
          {destinyPickerOpen && (
            <AddAddonModal open gameSlug="ryg" addonTypeSlug="destinies" addonTypeName="Destiny"
              excludeAddonIds={septState.destiny ? [septState.destiny.addonId] : []}
              onClose={() => setDestinyPickerOpen(false)}
              onAdd={addon => {
                const ds = (addon.stats ?? {}) as RygDestinyStats;
                septDirtyRef.current = true;
                setSeptState(prev => ({ ...prev, destiny: { addonId: addon.id, name: addon.name, description: ds.description ?? '', curse: ds.curse ?? '' } }));
                setDestinyPickerOpen(false);
              }}
              onDeleted={() => { septDirtyRef.current = true; setSeptState(prev => ({ ...prev, destiny: null })); }}
              getSubtitle={a => a.description ?? '—'}
              CreateFormComponent={DestinyFormComponent}
            />
          )}
          {benefitPickerOpen && (
            <AddAddonModal open gameSlug="ryg" addonTypeSlug="sept-benefits" addonTypeName="Sept Benefit"
              excludeAddonIds={septState.benefits.map(b => b.addonId)}
              onClose={() => setBenefitPickerOpen(false)}
              onAdd={addon => {
                septDirtyRef.current = true;
                setSeptState(prev => ({ ...prev, benefits: [...prev.benefits, { addonId: addon.id, name: addon.name, description: addon.description ?? '' }] }));
                setBenefitPickerOpen(false);
              }}
              onDeleted={id => { septDirtyRef.current = true; setSeptState(prev => ({ ...prev, benefits: prev.benefits.filter(b => b.addonId !== id) })); }}
              getSubtitle={a => a.description ? a.description.slice(0, 60) + (a.description.length > 60 ? '…' : '') : '—'}
              CreateFormComponent={BenefitFormComponent}
            />
          )}
          {/* God picker */}
          {godPickerOpen && (
            <AddAddonModal open gameSlug="ryg" addonTypeSlug="gods" addonTypeName="God"
              excludeAddonIds={godState.god ? [godState.god.addonId] : []}
              onClose={() => setGodPickerOpen(false)}
              onAdd={addon => {
                const gs = (addon.stats ?? {}) as RygGodStats;
                godDirtyRef.current = true;
                setGodState(prev => ({ ...prev, god: { addonId: addon.id, name: addon.name, specialAbility: gs.specialAbility ?? '', minions: gs.minions ?? '', servants: gs.servants ?? '', lieutenants: gs.lieutenants ?? '', champions: gs.champions ?? '' } }));
                setGodPickerOpen(false);
              }}
              onDeleted={() => { godDirtyRef.current = true; setGodState(prev => ({ ...prev, god: null })); }}
              getSubtitle={a => (a.stats as RygGodStats)?.specialAbility?.slice(0, 60) ?? '—'}
              CreateFormComponent={GodFormComponent}
            />
          )}

        </>
      }
    />
  );
};

export default CardBuilderRyg;
