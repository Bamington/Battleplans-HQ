/**
 * CardBuilderHaloFlashpoint.tsx — Halo Flashpoint card builder screen
 *
 * Allows the user to edit a Halo Flashpoint unit card. The live card component
 * (HaloFlashpointCard) is rendered in the centre column, wired to the editor
 * state in the right panel.
 *
 * LAYOUT:
 * ┌──────────────────────────────────────────────────────────┐
 * │  Navbar (fixed, full width)                              │
 * ├──────────┬──────────────────────────┬────────────────────┤
 * │  Unit    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * Route: /app/builder/halo-flashpoint?deckId=<uuid>
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import Navbar from '../components/Navbar';
import ModeToggle, { type Mode } from '../components/ModeToggle';
import PlaySubnav, { type PlayTab } from '../components/PlaySubnav';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import CenterViewport from '../components/CenterViewport';
import { useCardBuilder } from '../hooks/useCardBuilder';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import UnitListEntry from '../components/UnitListEntry';
import Input from '../components/Input';
import Counter from '../components/Counter';
import Button from '../components/Button';
import HR from '../components/HR';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import CardCarousel from '../components/CardCarousel';
import AttachedAddonRow from '../components/AttachedAddonRow';
import Modal from '../components/Modal';
import AddAddonModal, { type AddonFormProps } from '../components/AddAddonModal';
import AddKeywordModal, { type KeywordSelection } from '../components/AddKeywordModal';
import HaloWeaponForm from '../components/HaloWeaponForm';
import RichTextEditor from '../components/RichTextEditor';
import KeywordInfoModal from '../components/KeywordInfoModal';
// TODO: migrate to the universal `AddonInfoModal` (src/components/AddonInfoModal.tsx).
// Same shape, just data-driven via `statRows` instead of hardcoded weapon fields.
// Kill Team already uses the universal modal for weapons + abilities.
import WeaponInfoModal from '../components/WeaponInfoModal';
import HaloFlashpointRuleCard from '../components/HaloFlashpointRuleCard';
import Badge from '../components/Badge';
import Card, { CardBody } from '../components/Card';
import Magnifer from '../icons/Magnifer';
import UploadPhotoModal from '../components/UploadPhotoModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import NewCardModal, { type NewCardModalTemplate } from '../components/NewCardModal';
import UserRounded from '../icons/UserRounded';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Diskette from '../icons/Diskette';
import ArrowRight from '../icons/ArrowRight';
import Pen2 from '../icons/Pen2';
import Play from '../icons/Play';
import AltArrowDown from '../icons/AltArrowDown';
import HamburgerMenu from '../icons/HamburgerMenu';
import { supabase } from '../lib/supabase';
import { fetchConstraints, getMaxLength, getMaxAddons, getMaxKeywords, getMaxRules, isAtLimit } from '../lib/constraints';
import TokenMenu from '../components/TokenMenu';
import type { Addon, HaloFlashpointStats, EntityConstraints, TokenDefinition } from '../lib/database.types';
import { formatKeywordLabel } from '../lib/cardShape/util';
import { haloWeaponSubtitle } from '../lib/addonSubtitles';
import logoHaloFlashpoint from '../assets/games/logo-halo-flashpoint.png';
import iconHaloFlashpoint from '../assets/games/card assets/halo/icon.png';

// ── Navbar height ─────────────────────────────────────────────────────────────

// ── Card native dimensions ────────────────────────────────────────────────────
const CARD_W = 1270;
const CARD_H = 890;

// ── Local weapon shape ────────────────────────────────────────────────────────
// Mirrors HaloWeapon but carries the Supabase addon ID for edit/delete.

// Same shape as the keyword-selection contract exposed by AddKeywordModal /
// HaloWeaponForm. Aliased so the rest of this file keeps its older name.
type LocalKeywordAttachment = KeywordSelection;

interface LocalWeapon {
  addonId:    string;
  type:       string;
  name:       string;
  range:      string;
  ap:         string;
  keywords:   string;
  pointsCost: string;
  weaponKeywords: LocalKeywordAttachment[];
}

// ── Card data type ────────────────────────────────────────────────────────────

interface HaloCardData {
  id:          string;        // stable local React key
  dbId:        string | null; // Supabase row id (null = not yet saved)
  unitName:    string;
  keywords:    string;        // computed display string for the card renderer
  unitKeywords: LocalKeywordAttachment[];
  ra:          number;
  fi:          number;
  sv:          number;
  advance:     number;
  sprint:      number;
  hp:          number;
  armour:      number;
  pointsCost:  number;
  weapons:       LocalWeapon[];
  portraitUrl:   string | null; // public URL from Supabase Storage
  portraitStyle: string | null; // null = default, 'portraitFramed' = frame overlay
  avatarUrl:     string | null; // square thumbnail for lists
  tokenState:    Record<string, number>; // keyed by token def ID — ephemeral play-mode state
}

const defaultCard = (): HaloCardData => ({
  id:            crypto.randomUUID(),
  dbId:          null,
  unitName:      '',
  keywords:      '',
  unitKeywords:  [],
  ra:            0,
  fi:            0,
  sv:            0,
  advance:       0,
  sprint:        0,
  hp:            0,
  armour:        0,
  pointsCost:    0,
  weapons:       [],
  portraitUrl:   null,
  portraitStyle: null,
  avatarUrl:     null,
  tokenState:    {},
});

// ── Persistence helpers ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T | undefined> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch { if (i < attempts - 1) await sleep(1000 * (i + 1)); }
  }
};

const isHaloCardBlank = (c: HaloCardData): boolean =>
  !c.unitName && c.unitKeywords.length === 0 &&
  c.ra === 0 && c.fi === 0 && c.sv === 0 &&
  c.advance === 0 && c.sprint === 0 && c.hp === 0 && c.armour === 0 &&
  c.pointsCost === 0 && c.weapons.length === 0;

const toHaloStats = (c: HaloCardData): HaloFlashpointStats => ({
  keywords:     c.keywords,
  ra:           c.ra,
  fi:           c.fi,
  sv:           c.sv,
  advanceValue: c.advance,
  sprintValue:  c.sprint,
  ar:           c.armour,
  hp:           c.hp,
  pointsCost:   c.pointsCost,
});

// Per-keyword "Name" / "Name (X)" formatting goes through the shared
// formatKeywordLabel — same primitive the pack editor's shapers use.
const buildKeywordsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws.map(k => formatKeywordLabel(k.keywordName, k.paramValue)).join(', ');


// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderHaloFlashpoint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deckId = searchParams.get('deckId');

  // ── Play mode toggle ─────────────────────────────────────────────────────────
  const [appMode, setAppMode] = useState<Mode>('edit');

  // ── Shared builder chrome (panel toggles, responsive, deck-name) ────────────
  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isMobile, isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit,
  } = builder;
  const [playTab, setPlayTab] = useState<PlayTab>('units');

  const [ruleSearchQuery, setRuleSearchQuery] = useState('');

  // ── Keyword card fade-out/fade-in transition ────────────────────────────────
  const [kwDisplayId, setKwDisplayId] = useState<string>('');
  const [kwFading, setKwFading] = useState(false);

  /** When switching to play mode, pick the initial subnav tab based on what's currently viewed. */
  const handleModeChange = (mode: Mode) => {
    if (mode === 'play') {
      setPlayTab(ruleState.activeRuleId ? 'rules' : 'units');
      setRuleSearchQuery('');
      // Initialise token starting values for cards that haven't been touched yet
      if (tokenDefinitions.length > 0) {
        setCardState(prev => ({
          ...prev,
          cards: prev.cards.map(c => {
            if (Object.keys(c.tokenState).length > 0) return c;
            const ts: Record<string, number> = {};
            for (const def of tokenDefinitions) {
              if (def.starting_value != null) ts[def.id] = def.starting_value;
            }
            return { ...c, tokenState: ts };
          }),
        }));
      }
    }
    setAppMode(mode);
  };

  /** Update a token value for the active card. */
  const handleTokenChange = (tokenDefId: string, newValue: number) => {
    setCardState(prev => ({
      ...prev,
      cards: prev.cards.map(c =>
        c.id === prev.activeCardId
          ? { ...c, tokenState: { ...c.tokenState, [tokenDefId]: newValue } }
          : c
      ),
    }));
  };

  /** Update a token value for a specific card (used for direct overlay clicks). */
  const handleTokenChangeForCard = (cardId: string, tokenDefId: string, newValue: number) => {
    setCardState(prev => ({
      ...prev,
      cards: prev.cards.map(c =>
        c.id === cardId
          ? { ...c, tokenState: { ...c.tokenState, [tokenDefId]: newValue } }
          : c
      ),
    }));
  };

  /** Build the tokenOverlay prop for a card — only in play mode with tokens loaded. */
  const buildTokenOverlayProp = (c: HaloCardData) => {
    if (appMode !== 'play' || tokenDefinitions.length === 0) return undefined;
    return {
      definitions: tokenDefinitions,
      unitKeywords: c.unitKeywords.map(k => ({
        keywordName: k.keywordName,
        paramValue:  k.paramValue,
      })),
      state: c.tokenState,
      onChange: (tokenDefId: string, newValue: number) =>
        handleTokenChangeForCard(c.id, tokenDefId, newValue),
    };
  };

  // ── Edit mode (reorder + rename + duplicate + delete) ────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  // ── Card list state ───────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState(() => {
    const card = defaultCard();
    return { cards: [card] as HaloCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // ── Dirty tracking (cards that need saving) ───────────────────────────────────
  const dirtyCardsRef = useRef<Set<string>>(new Set());

  // ── DB-driven constraints ─────────────────────────────────────────────────────
  const [cardConstraints, setCardConstraints] = useState<EntityConstraints>({});
  const [weaponConstraints, setWeaponConstraints] = useState<EntityConstraints>({});
  const [keywordConstraints, setKeywordConstraints] = useState<EntityConstraints>({});
  const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinition[]>([]);
  useEffect(() => {
    fetchConstraints('halo-flashpoint', 'card').then(setCardConstraints);
    fetchConstraints('halo-flashpoint', 'addon', 'weapons').then(setWeaponConstraints);
    fetchConstraints('halo-flashpoint', 'keyword').then(setKeywordConstraints);
    // Fetch token definitions for play mode
    (async () => {
      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'halo-flashpoint').single();
      if (!game) return;
      const { data } = await supabase
        .from('token_definitions').select('*')
        .eq('game_id', game.id).order('sort_order');
      if (data) setTokenDefinitions(data as TokenDefinition[]);
    })();
  }, []);

  // ── Rule state (deck-level) ────────────────────────────────────────────────
  interface LocalRule {
    id:          string;        // stable local React key
    cardId:      string | null; // cards table id (null until first save)
    title:       string;
    description: string;
  }

  const [ruleState, setRuleState] = useState<{
    rules:        LocalRule[];
    activeRuleId: string | null;
  }>({ rules: [], activeRuleId: null });
  const { rules: deckRules, activeRuleId } = ruleState;
  const activeRule = deckRules.find(r => r.id === activeRuleId) ?? null;

  // ── Unified carousel sequence: unit cards then rules (alphabetical) ────────
  type CarouselItem = { id: string; kind: 'card' } | { id: string; kind: 'rule' };
  const sortedRules = [...deckRules].sort((a, b) => a.title.localeCompare(b.title));
  const carouselItems: CarouselItem[] = [
    ...cards.map(c => ({ id: c.id, kind: 'card' as const })),
    ...sortedRules.map(r => ({ id: r.id, kind: 'rule' as const })),
  ];
  const activeItemId = activeRuleId || activeCardId;

  // When activeItemId changes (after carousel transition ends), swap displayed keywords and fade in
  useEffect(() => {
    if (!kwDisplayId) { setKwDisplayId(activeItemId); return; }
    if (activeItemId === kwDisplayId) return;
    setKwDisplayId(activeItemId);
    setKwFading(false);
  }, [activeItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play mode: combined rules + keywords list ─────────────────────────────
  const playRulesAndKeywords = (() => {
    // Rules (alphabetical by title)
    const ruleItems = [...deckRules]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(r => ({ key: `rule-${r.id}`, title: r.title, description: r.description }));

    // Deduplicate keywords across all cards and their weapons
    const kwMap = new Map<string, { name: string; description: string }>();
    for (const c of cards) {
      for (const k of c.unitKeywords) {
        if (!kwMap.has(k.keywordId)) kwMap.set(k.keywordId, { name: k.keywordName, description: k.description });
      }
      for (const w of c.weapons) {
        for (const k of w.weaponKeywords) {
          if (!kwMap.has(k.keywordId)) kwMap.set(k.keywordId, { name: k.keywordName, description: k.description });
        }
      }
    }
    const kwItems = [...kwMap.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(k => ({ key: `kw-${k.name}`, title: k.name, description: k.description }));

    return [...ruleItems, ...kwItems];
  })();

  // ── Token turn helpers (New Turn button) ──────────────────────────────────
  /**
   * Resolve the effective max for a token on a given card, following the same
   * rules as TokenOverlay: stat_role='max' or keyword_value_role='max' override
   * the static max_value.
   */
  const resolveTokenMax = (
    def: TokenDefinition,
    card: HaloCardData,
  ): number | null => {
    let effMax: number | null = def.max_value ?? null;
    if (def.stat_key === 'hp' && def.stat_role === 'max') effMax = card.hp;
    if (def.keyword_name && def.keyword_value_role === 'max') {
      const kw = card.unitKeywords.find(
        k => k.keywordName.toLowerCase() === def.keyword_name!.toLowerCase()
      );
      if (kw?.paramValue != null) effMax = kw.paramValue;
    }
    return effMax;
  };

  /**
   * "New Turn" handler: for every card, apply each token's `refresh_on_turn`
   * delta, clamped to [min_value ?? 0, effectiveMax].
   */
  const handleNewTurn = () => {
    const turnDefs = tokenDefinitions.filter(d => d.refresh_on_turn !== 0);
    if (turnDefs.length === 0) return;
    setCardState(prev => ({
      ...prev,
      cards: prev.cards.map(card => {
        const ts = { ...card.tokenState };
        for (const def of turnDefs) {
          const current = ts[def.id] ?? def.starting_value ?? 0;
          const effMax = resolveTokenMax(def, card);
          const lo = def.min_value ?? 0;
          const hi = effMax ?? Number.POSITIVE_INFINITY;
          ts[def.id] = Math.max(lo, Math.min(hi, current + def.refresh_on_turn));
        }
        return { ...card, tokenState: ts };
      }),
    }));
  };

  /** True when this specific card has all its activation tokens at their
   *  effective max — i.e. the unit has been activated this turn. Drives
   *  the unit-list "filled in" treatment in play mode. */
  const isCardActivated = (card: HaloCardData): boolean => {
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    return actDefs.every(def => {
      const current = card.tokenState[def.id] ?? def.starting_value ?? 0;
      const effMax = resolveTokenMax(def, card);
      return effMax != null ? current >= effMax : current >= 1;
    });
  };

  /**
   * Primary-styled when every card has all of its activation tokens fully on
   * (current value equals effective max, or ≥ 1 when no max is set).
   */
  const allActivated = (() => {
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0 || cards.length === 0) return false;
    return cards.every(isCardActivated);
  })();

  const [ruleConstraints, setRuleConstraints]           = useState<EntityConstraints>({});
  const dirtyRulesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchConstraints('halo-flashpoint', 'rule').then(setRuleConstraints);
  }, []);

  const selectRule = (ruleId: string) => {
    setRuleState(s => ({ ...s, activeRuleId: ruleId }));
    // Deselect unit card
    setCardState(s => ({ ...s, activeCardId: '' }));
  };

  const selectCard = (cardId: string) => {
    setCardState(s => ({ ...s, activeCardId: cardId }));
    // Deselect rule
    setRuleState(s => ({ ...s, activeRuleId: null }));
  };

  const updateActiveRule = (patch: Partial<LocalRule>) => {
    if (activeRuleId) dirtyRulesRef.current.add(activeRuleId);
    setRuleState(s => ({
      ...s,
      rules: s.rules.map(r => r.id === s.activeRuleId ? { ...r, ...patch } : r),
    }));
  };

  const addRuleCard = () => {
    const local: LocalRule = {
      id:          crypto.randomUUID(),
      cardId:      null,
      title:       '',
      description: '',
    };
    dirtyRulesRef.current.add(local.id);
    setRuleState(s => ({ ...s, rules: [...s.rules, local], activeRuleId: local.id }));
    setCardState(s => ({ ...s, activeCardId: '' }));
  };

  const duplicateRule = (localId: string) => {
    const source = deckRules.find(r => r.id === localId);
    if (!source) return;
    const clone: LocalRule = {
      id:          crypto.randomUUID(),
      cardId:      null,
      title:       source.title,
      description: source.description,
    };
    dirtyRulesRef.current.add(clone.id);
    setRuleState(s => ({ ...s, rules: [...s.rules, clone] }));
  };

  const removeRule = (localId: string) => {
    const rule = deckRules.find(r => r.id === localId);
    dirtyRulesRef.current.delete(localId);
    setRuleState(s => {
      const remaining = s.rules.filter(r => r.id !== localId);
      return {
        rules: remaining,
        activeRuleId: s.activeRuleId === localId ? null : s.activeRuleId,
      };
    });
    if (rule?.cardId) {
      supabase.from('cards').delete().eq('id', rule.cardId)
        .then(({ error }) => {
          if (error) console.error('[BattleCards] Failed to delete rule card:', error);
        });
    }
  };

  const updateActiveCard = (patch: Partial<HaloCardData>) => {
    dirtyCardsRef.current.add(activeCardId);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === s.activeCardId ? { ...c, ...patch } : c),
    }));
  };

  const addBlankCard = () => {
    const card = defaultCard();
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
    setRuleState(s => ({ ...s, activeRuleId: null }));
  };

  // ── New Card modal (shown when templates exist) ─────────────────────────────
  const [newCardModalOpen, setNewCardModalOpen] = useState(false);
  const [newCardTemplates, setNewCardTemplates] = useState<NewCardModalTemplate[]>([]);

  // ── New Rule modal (shown when rule templates exist) ─────────────────────────
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false);
  const [newRuleTemplates, setNewRuleTemplates] = useState<NewCardModalTemplate[]>([]);

  const addCard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addBlankCard(); return; }

      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'halo-flashpoint')
        .single();
      if (!game) { addBlankCard(); return; }

      const [libRes, packsRes] = await Promise.all([
        supabase
          .from('cards')
          .select('id, name, card_addons(sort_order, addons(name)), card_keywords(sort_order, keywords(name))')
          .eq('user_id', user.id)
          .eq('game_id', game.id)
          .eq('is_template', true)
          .is('pack_id', null)
          .order('name'),
        supabase
          .from('packs')
          .select('id, name')
          .eq('owner_user_id', user.id)
          .eq('game_id', game.id),
      ]);

      type TemplateRow = {
        id: string; name: string; pack_id?: string;
        card_addons?: { sort_order: number | null; addons: { name: string } | null }[];
        card_keywords?: { sort_order: number | null; keywords: { name: string } | null }[];
      };
      const addonSummaryFor = (t: Pick<TemplateRow, 'card_addons' | 'card_keywords'>): string | undefined => {
        const addons = (t.card_addons ?? []).slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(a => a.addons?.name).filter((n): n is string => Boolean(n));
        if (addons.length) return addons.join(', ');
        const kws = (t.card_keywords ?? []).slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(k => k.keywords?.name).filter((n): n is string => Boolean(n));
        return kws.length ? kws.join(', ') : undefined;
      };
      const libTemplates: NewCardModalTemplate[] =
        ((libRes.data ?? []) as unknown as TemplateRow[]).map(t => ({
          id: t.id, name: t.name, source: 'library' as const, addonSummary: addonSummaryFor(t),
        }));

      const packsMap = new Map(
        ((packsRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]),
      );
      let packTemplates: NewCardModalTemplate[] = [];
      if (packsMap.size > 0) {
        const { data: packCards } = await supabase
          .from('cards')
          .select('id, name, pack_id, card_addons(sort_order, addons(name)), card_keywords(sort_order, keywords(name))')
          .in('pack_id', [...packsMap.keys()])
          .eq('is_template', true)
          .order('name');
        packTemplates = ((packCards ?? []) as unknown as (TemplateRow & { pack_id: string })[]).map(t => ({
          id: t.id, name: t.name, source: 'pack' as const, packName: packsMap.get(t.pack_id), addonSummary: addonSummaryFor(t),
        }));
      }

      const allTemplates = [...packTemplates, ...libTemplates];
      if (allTemplates.length === 0) { addBlankCard(); return; }

      setNewCardTemplates(allTemplates);
      setNewCardModalOpen(true);
    } catch (err) {
      console.error('[BattleCards] Failed to load templates:', err);
      addBlankCard();
    }
  };

  const createFromTemplate = async (templateId: string) => {
    if (!deckId) return;

    type AddonKeywordRow = {
      keyword_id: string;
      params: Record<string, unknown>;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
    };
    type TemplateRow = {
      name: string;
      stats: HaloFlashpointStats;
      card_addons: {
        addon_id: string;
        sort_order: number | null;
        addons: { name: string; stats: Record<string, unknown>; addon_keywords: AddonKeywordRow[] } | null;
      }[];
      card_keywords: AddonKeywordRow[];
    };

    const { data: tmpl, error } = await supabase
      .from('cards')
      .select('name, stats, card_addons(addon_id, sort_order, addons(name, stats, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('id', templateId)
      .single();
    if (error || !tmpl) { console.error('[BattleCards] Template fetch failed:', error); return; }

    const src = tmpl as unknown as TemplateRow;

    const { data: newRow, error: insertErr } = await supabase
      .from('cards')
      .insert({
        deck_id:    deckId,
        name:       src.name,
        stats:      src.stats,
        sort_order: cards.length,
      })
      .select('id')
      .single();
    if (insertErr || !newRow) { console.error('[BattleCards] Card insert failed:', insertErr); return; }

    const addons = src.card_addons ?? [];
    if (addons.length > 0) {
      await supabase.from('card_addons').insert(
        addons.map(a => ({ card_id: newRow.id, addon_id: a.addon_id, sort_order: a.sort_order })),
      );
    }

    const kws = src.card_keywords ?? [];
    if (kws.length > 0) {
      await supabase.from('card_keywords').insert(
        kws.map(k => ({ card_id: newRow.id, keyword_id: k.keyword_id, params: k.params, sort_order: k.sort_order })),
      );
    }

    const loadedUnitKeywords: LocalKeywordAttachment[] = kws
      .filter(k => k.keywords != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(k => ({
        keywordId:   k.keyword_id,
        keywordName: k.keywords!.name,
        description: k.keywords!.description ?? '',
        hasParams:   Array.isArray(k.keywords!.params_schema) && k.keywords!.params_schema.length > 0,
        paramValue:  k.params?.X != null ? Number(k.params.X) : null,
      }));

    const sortedAddons = [...addons]
      .filter(ca => ca.addons != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const weapons: LocalWeapon[] = sortedAddons.map(ca => {
      const ws = ca.addons!.stats;
      const addonKws = [...(ca.addons!.addon_keywords ?? [])]
        .filter(ak => ak.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const wkws: LocalKeywordAttachment[] = addonKws.map(ak => ({
        keywordId:   ak.keyword_id,
        keywordName: ak.keywords!.name,
        description: ak.keywords!.description ?? '',
        hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
        paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
      }));
      return {
        addonId:        ca.addon_id,
        name:           ca.addons!.name,
        type:           String(ws.type     ?? ''),
        range:          String(ws.range    ?? ''),
        ap:             String(ws.ap       ?? ''),
        keywords:       buildKeywordsDisplayString(wkws) || String(ws.keywords ?? ''),
        pointsCost:     String(ws.pointsCost ?? ''),
        weaponKeywords: wkws,
      };
    });

    const s = (src.stats ?? {}) as HaloFlashpointStats;
    const localCard: HaloCardData = {
      id:            crypto.randomUUID(),
      dbId:          newRow.id,
      unitName:      src.name,
      keywords:      buildKeywordsDisplayString(loadedUnitKeywords) || (s.keywords ?? ''),
      unitKeywords:  loadedUnitKeywords,
      ra:            s.ra           ?? 0,
      fi:            s.fi           ?? 0,
      sv:            s.sv           ?? 0,
      advance:       s.advanceValue ?? 0,
      sprint:        s.sprintValue  ?? 0,
      hp:            s.hp           ?? 0,
      armour:        s.ar           ?? 0,
      pointsCost:    s.pointsCost   ?? 0,
      weapons,
      portraitUrl:   null,
      portraitStyle: null,
      avatarUrl:     null,
      tokenState:    {},
    };

    setCardState(st => ({ cards: [...st.cards, localCard], activeCardId: localCard.id }));
    setRuleState(st => ({ ...st, activeRuleId: null }));
    setNewCardModalOpen(false);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', templateId);
      if (error) throw error;
      setNewCardTemplates(list => {
        const next = list.filter(t => t.id !== templateId);
        if (next.length === 0) setNewCardModalOpen(false);
        return next;
      });
    } catch (err) {
      console.error('[BattleCards] Failed to delete template:', err);
    }
  };

  // ── Rule template picker (mirrors addCard / createFromTemplate for rules) ──

  const addRule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addRuleCard(); return; }

      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'halo-flashpoint').single();
      if (!game) { addRuleCard(); return; }

      const [libRes, packsRes] = await Promise.all([
        supabase
          .from('cards')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('game_id', game.id)
          .eq('is_template', true)
          .eq('card_type', 'rule')
          .is('pack_id', null)
          .order('name'),
        supabase
          .from('packs')
          .select('id, name')
          .eq('owner_user_id', user.id)
          .eq('game_id', game.id),
      ]);

      const libTemplates: NewCardModalTemplate[] = ((libRes.data ?? []) as { id: string; name: string }[]).map(
        t => ({ id: t.id, name: t.name, source: 'library' as const }),
      );

      const packsMap = new Map(
        ((packsRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]),
      );
      let packTemplates: NewCardModalTemplate[] = [];
      if (packsMap.size > 0) {
        const { data: packCards } = await supabase
          .from('cards')
          .select('id, name, pack_id')
          .in('pack_id', [...packsMap.keys()])
          .eq('is_template', true)
          .eq('card_type', 'rule')
          .order('name');
        packTemplates = ((packCards ?? []) as { id: string; name: string; pack_id: string }[]).map(t => ({
          id: t.id, name: t.name, source: 'pack' as const, packName: packsMap.get(t.pack_id),
        }));
      }

      const allTemplates = [...packTemplates, ...libTemplates];
      if (allTemplates.length === 0) { addRuleCard(); return; }

      setNewRuleTemplates(allTemplates);
      setNewRuleModalOpen(true);
    } catch (err) {
      console.error('[BattleCards] Failed to load rule templates:', err);
      addRuleCard();
    }
  };

  const createRuleFromTemplate = async (templateId: string) => {
    if (!deckId) return;

    const { data: tmpl, error } = await supabase
      .from('cards')
      .select('name, stats')
      .eq('id', templateId)
      .single();
    if (error || !tmpl) { console.error('[BattleCards] Rule template fetch failed:', error); return; }

    const src = tmpl as { name: string; stats: Record<string, unknown> | null };

    const { data: newRow, error: insertErr } = await supabase
      .from('cards')
      .insert({
        deck_id:   deckId,
        name:      src.name,
        stats:     src.stats ?? {},
        card_type: 'rule',
      })
      .select('id')
      .single();
    if (insertErr || !newRow) { console.error('[BattleCards] Rule card insert failed:', insertErr); return; }

    const local: LocalRule = {
      id:          crypto.randomUUID(),
      cardId:      (newRow as { id: string }).id,
      title:       src.name,
      description: String(src.stats?.description ?? ''),
    };

    setRuleState(s => ({ ...s, rules: [...s.rules, local], activeRuleId: local.id }));
    setCardState(s => ({ ...s, activeCardId: '' }));
    setNewRuleModalOpen(false);
  };

  const deleteRuleTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', templateId);
      if (error) throw error;
      setNewRuleTemplates(list => {
        const next = list.filter(t => t.id !== templateId);
        if (next.length === 0) setNewRuleModalOpen(false);
        return next;
      });
    } catch (err) {
      console.error('[BattleCards] Failed to delete rule template:', err);
    }
  };

  const deleteCard = async (cardId: string) => {
    const cardToDelete = cards.find(c => c.id === cardId);

    setCardState(s => {
      if (s.cards.length <= 1) return s;

      const deleteIndex = s.cards.findIndex(c => c.id === cardId);
      if (deleteIndex === -1) return s;

      const nextCards = s.cards.filter(c => c.id !== cardId);
      const nextActiveCardId = s.activeCardId === cardId
        ? nextCards[Math.min(deleteIndex, nextCards.length - 1)].id
        : s.activeCardId;

      return {
        cards: nextCards,
        activeCardId: nextActiveCardId,
      };
    });

    dirtyCardsRef.current.delete(cardId);

    if (cardToDelete?.dbId) {
      const { error } = await supabase.from('cards').delete().eq('id', cardToDelete.dbId);
      if (error) {
        console.error('[BattleCards] Failed to delete card:', error);
      }
    }
  };

  const [deleteCardConfirmOpen, setDeleteCardConfirmOpen] = useState(false);
  const [cardPendingDelete, setCardPendingDelete] = useState<HaloCardData | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

  const requestDeleteCard = (card: HaloCardData) => {
    setCardPendingDelete(card);
    setDeleteCardConfirmOpen(true);
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardPendingDelete) return;
    setDeletingCard(true);
    try {
      await deleteCard(cardPendingDelete.id);
      setDeleteCardConfirmOpen(false);
      setCardPendingDelete(null);
    } finally {
      setDeletingCard(false);
    }
  };

  /** Propagate a keyword definition update (name/description) across ALL cards. */
  const propagateKeywordUpdate = useCallback((keywordId: string, newName: string, newDescription: string, newHasParams: boolean) => {
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        let changed = false;

        // Update unit keywords
        const newUnitKws = c.unitKeywords.map(k => {
          if (k.keywordId !== keywordId) return k;
          changed = true;
          return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
        });

        // Update weapon keywords
        const newWeapons = c.weapons.map(w => {
          const newWkws = w.weaponKeywords.map(k => {
            if (k.keywordId !== keywordId) return k;
            changed = true;
            return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
          });
          if (newWkws === w.weaponKeywords) return w;
          return { ...w, weaponKeywords: newWkws, keywords: buildKeywordsDisplayString(newWkws) };
        });

        if (!changed) return c;
        dirtyCardsRef.current.add(c.id);
        return { ...c, unitKeywords: newUnitKws, keywords: buildKeywordsDisplayString(newUnitKws), weapons: newWeapons };
      }),
    }));
  }, []);

  // ── Deck name inline rename ─────────────────────────────────────────────────
  // `startDeckNameEdit` comes from useCardBuilder. `commitDeckName` skips the
  // Supabase persist when editMode is on, since editMode batches its own save.
  const commitDeckName = useCallback(
    (newName: string) => builder.commitDeckName(newName, { persist: !editMode }),
    [builder, editMode],
  );

  // ── Drag reorder handlers ──────────────────────────────────────────────────
  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverRef.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const from = dragItemRef.current;
    const to = dragOverRef.current;
    if (from == null || to == null || from === to) {
      setDragOverIndex(null);
      return;
    }
    setCardState(s => {
      const reordered = [...s.cards];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return { ...s, cards: reordered };
    });
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  }, []);

  // ── Duplicate card ─────────────────────────────────────────────────────────
  const duplicateCard = useCallback(async (cardId: string) => {
    const source = cards.find(c => c.id === cardId);
    if (!source || !deckId) return;

    const cloneId = crypto.randomUUID();
    let cloneDbId: string | null = null;
    let clonePortraitUrl: string | null = source.portraitUrl;
    let cloneAvatarUrl: string | null = source.avatarUrl;

    // If the source card has persisted images, copy them in storage
    if (source.dbId && (source.portraitUrl || source.avatarUrl)) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create the new card in DB first so we have a card_id for images
        const { data: newRow, error: insertErr } = await supabase
          .from('cards')
          .insert({
            deck_id: deckId,
            name: source.unitName || 'Unnamed Unit',
            stats: toHaloStats(source),
            portrait_style: source.portraitStyle,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        cloneDbId = newRow.id;

        // Find the source card's images
        const { data: srcImages } = await supabase
          .from('card_images')
          .select('file_path, image_type, sort_order')
          .eq('card_id', source.dbId);

        if (srcImages && srcImages.length > 0) {
          for (const img of srcImages) {
            const ext = img.file_path.split('.').pop() ?? 'jpg';
            const prefix = img.image_type === 'avatar' ? 'avatar-' : '';
            const newFileName = `${prefix}${crypto.randomUUID()}.${ext}`;
            const newPath = `${user.id}/${cloneDbId}/${newFileName}`;

            await supabase.storage.from('card-images').copy(img.file_path, newPath);

            const { data: { publicUrl } } = supabase.storage
              .from('card-images')
              .getPublicUrl(newPath);

            await supabase.from('card_images').insert({
              card_id: cloneDbId,
              file_path: newPath,
              image_type: img.image_type,
              sort_order: img.sort_order,
            });

            if (img.image_type === 'portrait') clonePortraitUrl = publicUrl;
            if (img.image_type === 'avatar') cloneAvatarUrl = publicUrl;
          }
        }
      } catch (err) {
        console.error('[BattleCards] Failed to duplicate images:', err);
      }
    }

    const clone: HaloCardData = {
      ...source,
      id: cloneId,
      dbId: cloneDbId,
      portraitUrl: clonePortraitUrl,
      avatarUrl: cloneAvatarUrl,
      weapons: source.weapons.map(w => ({ ...w })),
    };
    // Mark clone dirty so auto-save persists its keywords + weapons
    dirtyCardsRef.current.add(cloneId);
    setCardState(s => {
      const idx = s.cards.findIndex(c => c.id === cardId);
      const next = [...s.cards];
      next.splice(idx + 1, 0, clone);
      return { cards: next, activeCardId: clone.id };
    });
  }, [cards, deckId]);

  // ── Delete card ────────────────────────────────────────────────────────────
  const handleDeleteCard = useCallback(async () => {
    if (!confirmDeleteCardId) return;
    const card = cards.find(c => c.id === confirmDeleteCardId);
    setDeletingCard(true);
    try {
      if (card?.dbId) {
        await supabase.from('cards').delete().eq('id', card.dbId);
      }
      setCardState(s => {
        const remaining = s.cards.filter(c => c.id !== confirmDeleteCardId);
        if (remaining.length === 0) {
          const fresh = defaultCard();
          return { cards: [fresh], activeCardId: fresh.id };
        }
        const needNewActive = s.activeCardId === confirmDeleteCardId;
        return { cards: remaining, activeCardId: needNewActive ? remaining[0].id : s.activeCardId };
      });
    } catch (err) {
      console.error('[BattleCards] Failed to delete card:', err);
    } finally {
      setDeletingCard(false);
      setConfirmDeleteCardId(null);
    }
  }, [confirmDeleteCardId, cards]);

  // ── Done button — persist order + deck name ─────────────────────────────────
  const handleDoneEditing = useCallback(async () => {
    if (!deckId) { setEditMode(false); return; }
    setSavingEdits(true);
    try {
      // Save deck name
      await supabase.from('decks').update({ name: deckName || 'Untitled' }).eq('id', deckId);

      // Save card sort_order
      await Promise.all(
        cards.map((card, i) => {
          if (!card.dbId) return Promise.resolve();
          return supabase.from('cards').update({ sort_order: i }).eq('id', card.dbId);
        })
      );
    } catch (err) {
      console.error('[BattleCards] Failed to save edit mode changes:', err);
    } finally {
      setSavingEdits(false);
      setEditMode(false);
    }
  }, [deckId, deckName, cards]);

  // ── Load deck + cards on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;

    supabase.from('decks').select('name').eq('id', deckId).single()
      .then(({ data }) => { if (data) setDeckName(data.name); });

    // Load rule cards (card_type='rule')
    supabase
      .from('cards')
      .select('id, name, stats')
      .eq('deck_id', deckId)
      .eq('card_type', 'rule')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[BattleCards] Failed to load rule cards:', error); return; }
        if (!data || data.length === 0) return;
        const loaded: LocalRule[] = (data as { id: string; name: string; stats: Record<string, unknown> | null }[])
          .map(row => ({
            id:          crypto.randomUUID(),
            cardId:      row.id,
            title:       row.name ?? '',
            description: String(row.stats?.description ?? ''),
          }));
        setRuleState({ rules: loaded, activeRuleId: null });
      });

    type AddonKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: HaloFlashpointStats; portrait_style: string | null; card_type: string | null;
      card_addons: { addon_id: string; sort_order: number | null; addons: { name: string; stats: Record<string, unknown>; addon_keywords: AddonKeywordRow[] } | null }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
      card_keywords: AddonKeywordRow[];
    };

    supabase
      .from('cards')
      .select('id, name, stats, portrait_style, card_type, card_addons(addon_id, sort_order, addons(name, stats, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[BattleCards] Failed to load cards:', error); return; }
        if (!data || data.length === 0) return;
        const loaded = (data as unknown as CardRow[]).filter(row => row.card_type !== 'rule').map(row => {
          const s = row.stats ?? {};
          const sortedAddons = [...(row.card_addons ?? [])]
            .filter(ca => ca.addons != null)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          // Resolve card images by type to public URLs
          const allImages = row.card_images ?? [];
          const portraitImg = allImages.find(i => i.image_type === 'portrait');
          const avatarImg   = allImages.find(i => i.image_type === 'avatar');

          let portraitUrl: string | null = null;
          if (portraitImg) {
            const { data: urlData } = supabase.storage
              .from('card-images')
              .getPublicUrl(portraitImg.file_path);
            portraitUrl = urlData.publicUrl;
          }

          let avatarUrl: string | null = null;
          if (avatarImg) {
            const { data: urlData } = supabase.storage
              .from('card-images')
              .getPublicUrl(avatarImg.file_path);
            avatarUrl = urlData.publicUrl;
          }

          const sortedCardKeywords = [...(row.card_keywords ?? [])]
            .filter(ck => ck.keywords != null)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          const loadedUnitKeywords: LocalKeywordAttachment[] = sortedCardKeywords.map(ck => ({
            keywordId: ck.keyword_id,
            keywordName: ck.keywords!.name,
            description: ck.keywords!.description ?? '',
            hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
            paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
          }));

          return {
            id:       row.id,
            dbId:     row.id,
            unitName: row.name,
            keywords: buildKeywordsDisplayString(loadedUnitKeywords) || (s.keywords ?? ''),
            unitKeywords: loadedUnitKeywords,
            ra:       s.ra           ?? 0,
            fi:       s.fi           ?? 0,
            sv:       s.sv           ?? 0,
            advance:  s.advanceValue ?? 0,
            sprint:   s.sprintValue  ?? 0,
            hp:       s.hp           ?? 0,
            armour:   s.ar           ?? 0,
            pointsCost: s.pointsCost ?? 0,
            portraitUrl,
            portraitStyle: row.portrait_style ?? null,
            avatarUrl,
            tokenState: {},
            weapons: sortedAddons.map(ca => {
              const ws = ca.addons!.stats;
              const addonKws = [...(ca.addons!.addon_keywords ?? [])]
                .filter(ak => ak.keywords != null)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const wkws: LocalKeywordAttachment[] = addonKws.map(ak => ({
                keywordId: ak.keyword_id,
                keywordName: ak.keywords!.name,
                description: ak.keywords!.description ?? '',
                hasParams: Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
                paramValue: ak.params?.X != null ? Number(ak.params.X) : null,
              }));
              return {
                addonId:  ca.addon_id,
                name:     ca.addons!.name,
                type:     String(ws.type     ?? ''),
                range:    String(ws.range    ?? ''),
                ap:       String(ws.ap       ?? ''),
                keywords: buildKeywordsDisplayString(wkws) || String(ws.keywords ?? ''),
                pointsCost: String(ws.pointsCost ?? ''),
                weaponKeywords: wkws,
              };
            }),
          } as HaloCardData;
        });
        setCardState({ cards: loaded, activeCardId: loaded[0].id });
      });
  }, [deckId]);

  // ── Auto-save (debounced 1s) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || dirtyCardsRef.current.size === 0) return;

    const dirty = new Set(dirtyCardsRef.current);
    const timer = setTimeout(async () => {
      dirtyCardsRef.current.clear();

      for (let ci = 0; ci < cards.length; ci++) {
        const card = cards[ci];
        if (!dirty.has(card.id) || isHaloCardBlank(card)) continue;

        await withRetry(async () => {
          let dbId = card.dbId;

          if (!dbId) {
            const { data, error } = await supabase
              .from('cards')
              .insert({ deck_id: deckId, name: card.unitName || 'Unnamed Unit', stats: toHaloStats(card), portrait_style: card.portraitStyle, sort_order: ci })
              .select('id')
              .single();
            if (error) throw error;
            dbId = data.id;
            setCardState(s => ({
              ...s,
              cards: s.cards.map(c => c.id === card.id ? { ...c, dbId: data.id } : c),
            }));
          } else {
            const { error } = await supabase
              .from('cards')
              .update({ name: card.unitName || 'Unnamed Unit', stats: toHaloStats(card), portrait_style: card.portraitStyle, sort_order: ci })
              .eq('id', dbId);
            if (error) throw error;
          }

          // Sync card_addons: delete all then re-insert in order
          await supabase.from('card_addons').delete().eq('card_id', dbId);
          if (card.weapons.length > 0) {
            const { error } = await supabase.from('card_addons').insert(
              card.weapons.map((w, i) => ({ card_id: dbId!, addon_id: w.addonId, sort_order: i }))
            );
            if (error) throw error;
          }

          // Sync card_keywords: delete all then re-insert in order
          await supabase.from('card_keywords').delete().eq('card_id', dbId);
          if (card.unitKeywords.length > 0) {
            const { error } = await supabase.from('card_keywords').insert(
              card.unitKeywords.map((k, i) => ({
                card_id: dbId!,
                keyword_id: k.keywordId,
                params: k.paramValue != null ? { X: k.paramValue } : {},
                sort_order: i,
              }))
            );
            if (error) throw error;
          }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [cards, deckId]);

  // ── Auto-save rule cards (debounced 1s) ────────────────────────────────────
  useEffect(() => {
    if (!deckId || dirtyRulesRef.current.size === 0) return;

    const timer = setTimeout(async () => {
      const dirty = new Set(dirtyRulesRef.current);
      dirtyRulesRef.current.clear();

      for (const rule of deckRules) {
        if (!dirty.has(rule.id)) continue;
        if (!rule.title.trim() && !rule.description.trim()) continue;

        if (!rule.cardId) {
          const { data, error } = await supabase
            .from('cards')
            .insert({ deck_id: deckId, name: rule.title || 'New Rule', stats: { description: rule.description } as Record<string, unknown>, card_type: 'rule' })
            .select('id')
            .single();
          if (error) {
            console.error('[BattleCards] Failed to create rule card:', error);
          } else if (data) {
            const newId = (data as { id: string }).id;
            setRuleState(s => ({
              ...s,
              rules: s.rules.map(r => r.id === rule.id ? { ...r, cardId: newId } : r),
            }));
          }
        } else {
          const { error } = await supabase
            .from('cards')
            .update({ name: rule.title || 'New Rule', stats: { description: rule.description } as Record<string, unknown> })
            .eq('id', rule.cardId);
          if (error) console.error('[BattleCards] Failed to update rule card:', error);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [deckRules, deckId]);

  // ── Ensure card is saved (needed before image upload) ────────────────────────
  const ensureCardSaved = async (): Promise<string | null> => {
    if (activeCard.dbId) return activeCard.dbId;
    if (!deckId) return null;
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          deck_id: deckId,
          name: activeCard.unitName || 'Unnamed Unit',
          stats: toHaloStats(activeCard),
          portrait_style: activeCard.portraitStyle,
        })
        .select('id')
        .single();
      if (error) throw error;
      setCardState(s => ({
        ...s,
        cards: s.cards.map(c =>
          c.id === activeCard.id ? { ...c, dbId: data.id } : c,
        ),
      }));
      return data.id;
    } catch {
      return null;
    }
  };

  // ── Save-as-template modal ──────────────────────────────────────────────────
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const saveAsTemplate = async (templateName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: game, error: gameErr } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'halo-flashpoint')
        .single();
      if (gameErr || !game) throw gameErr ?? new Error('Game lookup failed');

      const sourceDbId = await ensureCardSaved();

      const { data: tmpl, error: insertErr } = await supabase
        .from('cards')
        .insert({
          user_id:     user.id,
          game_id:     game.id,
          is_template: true,
          name:        templateName,
          stats:       toHaloStats(activeCard),
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      if (sourceDbId) {
        const [{ data: srcAddons }, { data: srcKeywords }] = await Promise.all([
          supabase.from('card_addons').select('addon_id, sort_order').eq('card_id', sourceDbId),
          supabase.from('card_keywords').select('keyword_id, params, sort_order').eq('card_id', sourceDbId),
        ]);

        if (srcAddons && srcAddons.length > 0) {
          await supabase.from('card_addons').insert(
            srcAddons.map(a => ({ card_id: tmpl.id, addon_id: a.addon_id, sort_order: a.sort_order })),
          );
        }
        if (srcKeywords && srcKeywords.length > 0) {
          await supabase.from('card_keywords').insert(
            srcKeywords.map(k => ({ card_id: tmpl.id, keyword_id: k.keyword_id, params: k.params, sort_order: k.sort_order })),
          );
        }
      }

      setTemplateModalOpen(false);
    } catch (err) {
      console.error('[BattleCards] Failed to save template:', err);
    }
  };

  // ── Save-rule-as-template modal ──────────────────────────────────────────
  const [ruleTemplateModalOpen, setRuleTemplateModalOpen] = useState(false);

  const saveRuleAsTemplate = async (templateName: string) => {
    if (!activeRule) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: game, error: gameErr } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'halo-flashpoint')
        .single();
      if (gameErr || !game) throw gameErr ?? new Error('Game lookup failed');

      const { error: insertErr } = await supabase
        .from('rules')
        .insert({
          user_id:     user.id,
          game_id:     game.id,
          is_template: true,
          title:       templateName,
          description: activeRule.description || null,
        });
      if (insertErr) throw insertErr;

      setRuleTemplateModalOpen(false);
    } catch (err) {
      console.error('[BattleCards] Failed to save rule template:', err);
    }
  };

  // ── Add Weapon modal ─────────────────────────────────────────────────────────
  const [weaponModalOpen, setWeaponModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen]           = useState(false);
  const [deletePortraitConfirm, setDeletePortraitConfirm] = useState(false);
  const [deletingPortrait, setDeletingPortrait]           = useState(false);
  const [unitKeywordModalOpen, setUnitKeywordModalOpen]  = useState(false);
  const [viewingUnitKeyword, setViewingUnitKeyword]      = useState<LocalKeywordAttachment | null>(null);
  const [editingUnitKw, setEditingUnitKw]                = useState<LocalKeywordAttachment | null>(null);
  const [editingWeaponKw, setEditingWeaponKw]            = useState<LocalKeywordAttachment | null>(null);
  const [viewingWeapon, setViewingWeapon]                = useState<LocalWeapon | null>(null);
  const [editingWeaponAddon, setEditingWeaponAddon]      = useState<Addon | null>(null);
  const [savingWeaponEdit, setSavingWeaponEdit]          = useState(false);

  // Snapshot of the weapon-form's keyword selection at save-time. HaloWeaponForm
  // hands these over via the `onPendingKeywords` callback right before its
  // onSave fires; handleWeaponAdded (which runs AFTER onSave resolves) reads
  // them here so the new weapon's in-memory `weaponKeywords` matches what the
  // user just picked, without re-querying addon_keywords for a row we just
  // wrote.
  const pendingWeaponKeywordsRef = useRef<LocalKeywordAttachment[] | null>(null);

  // Bind HaloWeaponForm to this builder's context (constraints, the
  // pending-keywords side-channel, and the cross-card propagation hook)
  // so AddAddonModal — which only knows the bare AddonFormProps contract —
  // can render it without each call-site re-supplying these. Stable
  // identity via useCallback so AddAddonModal doesn't re-mount the form
  // on every render.
  const WeaponFormWithContext = useCallback(
    (props: AddonFormProps) => (
      <HaloWeaponForm
        {...props}
        weaponConstraints={weaponConstraints}
        keywordConstraints={keywordConstraints}
        onPendingKeywords={(kws) => { pendingWeaponKeywordsRef.current = kws; }}
        onPropagateKeywordUpdate={propagateKeywordUpdate}
      />
    ),
    [weaponConstraints, keywordConstraints, propagateKeywordUpdate],
  );

  const handleWeaponAdded = async (addon: Addon) => {
    const s = addon.stats as Record<string, unknown>;

    // Use pending keywords from the create form if available
    let wkws = pendingWeaponKeywordsRef.current;
    pendingWeaponKeywordsRef.current = null;

    // For existing weapons picked from the list, fetch from DB
    if (!wkws) {
      const { data: akData } = await supabase
        .from('addon_keywords')
        .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
        .eq('addon_id', addon.id)
        .order('sort_order');

      wkws = (akData ?? [])
        .filter((ak: any) => ak.keywords != null)
        .map((ak: any) => ({
          keywordId: ak.keyword_id,
          keywordName: ak.keywords.name,
          description: ak.keywords.description ?? '',
          hasParams: Array.isArray(ak.keywords.params_schema) && ak.keywords.params_schema.length > 0,
          paramValue: ak.params?.X != null ? Number(ak.params.X) : null,
        }));
    }

    const weapon: LocalWeapon = {
      addonId:    addon.id,
      name:       addon.name,
      type:       String(s.type       ?? ''),
      range:      String(s.range      ?? ''),
      ap:         String(s.ap         ?? ''),
      keywords:   wkws.length > 0 ? buildKeywordsDisplayString(wkws) : String(s.keywords ?? ''),
      pointsCost: String(s.pointsCost ?? ''),
      weaponKeywords: wkws,
    };
    updateActiveCard({ weapons: [...activeCard.weapons, weapon] });
  };

  const handleWeaponDeleted = (addonId: string) => {
    cards.forEach(c => {
      if (c.weapons.some(w => w.addonId === addonId)) dirtyCardsRef.current.add(c.id);
    });
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => ({
        ...c,
        weapons: c.weapons.filter(w => w.addonId !== addonId),
      })),
    }));
  };

  // ── Remove portrait handler ──────────────────────────────────────────────────
  const handleDeletePortrait = async () => {
    if (!activeCard.dbId) return;
    setDeletingPortrait(true);
    try {
      // 1. Get card_images rows for this card
      const { data: images } = await supabase
        .from('card_images')
        .select('id, file_path')
        .eq('card_id', activeCard.dbId);

      if (images && images.length > 0) {
        // 2. Delete files from storage
        const paths = images.map(img => img.file_path);
        await supabase.storage.from('card-images').remove(paths);

        // 3. Delete card_images rows
        await supabase
          .from('card_images')
          .delete()
          .eq('card_id', activeCard.dbId);
      }

      // 4. Clear portrait_style on the card
      await supabase
        .from('cards')
        .update({ portrait_style: null })
        .eq('id', activeCard.dbId);

      // 5. Update local state
      updateActiveCard({ portraitUrl: null, portraitStyle: null });
      setDeletePortraitConfirm(false);
    } catch (err) {
      console.error('[BattleCards] Failed to delete portrait:', err);
    } finally {
      setDeletingPortrait(false);
    }
  };

  // ── Card carousel ────────────────────────────────────────────────────────────
  // All carousel mechanics (scale, drag, snap, zoom) live in <CardCarousel>.
  // The remaining game-specific concerns — keyword fade timing, mixed
  // card/rule items, play-mode overlays — are wired in via that component's
  // props at render time below.

  return (
    <BuilderShell
      navbar={
        <Navbar fixed={false}>
          {/* Desktop (lg+): full mode toggle + Print link */}
          <div className="hidden lg:flex items-center gap-3">
            {deckId && (
              <Link to={`/app/print?deckId=${deckId}`}>
                <Button variant="ghost" color="secondary" size="xs">Print</Button>
              </Link>
            )}
            <ModeToggle mode={appMode} onModeChange={handleModeChange} />
          </div>

          {/* Tablet/Mobile (<lg): collapsed mode dropdown */}
          <Dropdown
            align="right"
            className="lg:hidden"
            menuClassName="w-32"
            trigger={
              <Button color="primary" size="xs" rightIcon={<AltArrowDown className="w-4 h-4" />}>
                {appMode === 'edit' ? 'Edit' : 'Play'}
              </Button>
            }
          >
            {appMode !== 'edit' && (
              <DropdownItem icon={<Pen2 className="w-4 h-4" />} onClick={() => handleModeChange('edit')}>
                Edit
              </DropdownItem>
            )}
            {appMode !== 'play' && (
              <DropdownItem icon={<Play className="w-4 h-4" />} onClick={() => handleModeChange('play')}>
                Play
              </DropdownItem>
            )}
            {deckId && (
              <DropdownItem onClick={() => navigate(`/app/print?deckId=${deckId}`)}>
                Print
              </DropdownItem>
            )}
          </Dropdown>
        </Navbar>
      }
      topBar={
        appMode === 'play' ? (
          <PlaySubnav tab={playTab} onTabChange={setPlayTab} />
        ) : appMode === 'edit' ? (
          <EditSubnav
            className="lg:hidden"
            cardListOpen={cardListOpen}
            onToggleCardList={toggleCardList}
            editorOpen={editorOpen}
            onToggleEditor={toggleEditor}
          />
        ) : null
      }
      leftPanelOpen={cardListOpen}
      leftPanel={
        // Panel renders in BOTH edit and play modes — play mode needs it
        // for the activation/rules grouping. Edit-only chrome (header
        // action, add/done footer) is gated internally so play mode just
        // shows the read-only list.
        <CardListPanel
          deckName={deckName}
          editingDeckName={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={commitDeckName}
          onCancelEdit={() => setEditingDeckName(false)}
          headerAction={appMode === 'edit' ? (
            <button
              type="button"
              onClick={() => editMode ? handleDoneEditing() : setEditMode(true)}
              className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title={editMode ? 'Done editing' : 'Edit deck'}
            >
              {editMode
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <Pen2 className="w-4 h-4" />
              }
            </button>
          ) : undefined}
          footer={appMode === 'edit' ? (
            <>
              <HR className="!my-0" />
              {editMode ? (
                <Button
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  color="primary"
                  size="sm"
                  className="w-full"
                  onClick={handleDoneEditing}
                  loading={savingEdits}
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addCard}
                  >
                    Add Unit
                  </Button>
                  <Button
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isAtLimit(deckRules.length, getMaxRules(cardConstraints))}
                    onClick={addRule}
                  >
                    Add Rule
                  </Button>
                </>
              )}
            </>
          ) : undefined}
        >
            {(() => {
              // Render a single unit row. `dragIndex` is the card's index
              // in the full `cards` array (used by edit-mode drag handlers);
              // pass -1 in play mode where drag handlers don't fire.
              const renderRow = (card: HaloCardData, dragIndex: number) => (
                <div
                  key={card.id}
                  className={`flex items-center gap-1 ${
                    editMode && dragOverIndex === dragIndex ? 'border-t-2 border-blue-500' : 'border-t-2 border-transparent'
                  }`}
                  onDragOver={editMode ? (e) => handleDragOver(e, dragIndex) : undefined}
                  onDrop={editMode ? handleDrop : undefined}
                >
                  {editMode && (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(dragIndex)}
                      onDragEnd={handleDragEnd}
                      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-gray-500 hover:text-gray-300"
                    >
                      <HamburgerMenu className="w-4 h-4" />
                    </div>
                  )}
                  <div className={editMode ? 'flex-1 min-w-0' : 'w-full'}>
                    <UnitListEntry
                      status={card.dbId ? 'complete' : 'blank'}
                      unitName={card.unitName || undefined}
                      addonSummary={card.weapons.map(w => w.name).filter(Boolean).join(', ') || undefined}
                      avatarSrc={card.avatarUrl ?? iconHaloFlashpoint}
                      active={card.id === activeCardId && !activeRuleId}
                      activated={appMode === 'play' && isCardActivated(card)}
                      editMode={editMode}
                      onDuplicate={() => duplicateCard(card.id)}
                      onDelete={() => setConfirmDeleteCardId(card.id)}
                      onClick={() => selectCard(card.id)}
                    />
                  </div>
                  {editMode && (
                    <button
                      type="button"
                      aria-label={`Delete ${card.unitName || 'unit'}`}
                      onClick={e => {
                        e.stopPropagation();
                        requestDeleteCard(card);
                      }}
                      disabled={cards.length <= 1}
                      className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={cards.length <= 1 ? 'At least one unit is required' : 'Delete unit'}
                    >
                      <TrashBinMinimalistic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );

              // Edit mode (and any non-play state): deck order so drag
              // reordering tracks the user's intended position.
              if (appMode !== 'play') {
                return cards.map((card, i) => renderRow(card, i));
              }

              // Play mode: non-activated units first, then an Activated
              // sub-section (only when populated) pinned beneath them.
              // Rules continue to render in the separate block below.
              const nonActivated: HaloCardData[] = [];
              const activated:    HaloCardData[] = [];
              for (const c of cards) {
                if (isCardActivated(c)) activated.push(c);
                else                    nonActivated.push(c);
              }

              return (
                <>
                  {nonActivated.map(card => renderRow(card, -1))}

                  {activated.length > 0 && (
                    <>
                      <h3
                        key="activated-header"
                        className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]"
                      >
                        <span>Activated</span>
                        <span className="flex-1 h-px bg-gray-700" />
                      </h3>
                      {activated.map(card => renderRow(card, -1))}
                    </>
                  )}
                </>
              );
            })()}

            {/* Rules sub-header — only in play mode, only when there are
                rules to list. Matches the "Activated" header styling so
                the play-mode list reads as clearly-grouped sections. */}
            {appMode === 'play' && deckRules.length > 0 && (
              <h3
                key="rules-header"
                className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]"
              >
                <span>Rules</span>
                <span className="flex-1 h-px bg-gray-700" />
              </h3>
            )}

            {/* Rules — listed after units, sorted alphabetically */}
            {[...deckRules].sort((a, b) => a.title.localeCompare(b.title)).map(rule => (
              <div key={rule.id} className="flex items-center gap-1">
                {editMode && (
                  <div className="shrink-0 p-0.5 text-gray-700">
                    <HamburgerMenu className="w-4 h-4" />
                  </div>
                )}
                <div className={editMode ? 'flex-1 min-w-0' : 'w-full'}>
                  <UnitListEntry
                    status={rule.cardId ? 'complete' : 'blank'}
                    unitName={rule.title || 'New Rule'}
                    unitType="Rule"
                    active={rule.id === activeRuleId}
                    editMode={editMode}
                    onDuplicate={() => duplicateRule(rule.id)}
                    onDelete={() => removeRule(rule.id)}
                    onClick={() => selectRule(rule.id)}
                  />
                </div>
              </div>
            ))}
        </CardListPanel>
      }
      center={
        appMode === 'play' && playTab === 'rules' ? (
          <main className="flex-1 flex flex-col overflow-hidden bg-gray-950">
            <div className="flex-1 overflow-y-auto py-5 px-5">
              <Input
                leftIcon={<Magnifer className="w-4 h-4" />}
                placeholder="Search for a Rule"
                value={ruleSearchQuery}
                onChange={e => setRuleSearchQuery(e.target.value)}
                className="mb-4"
              />
              <div className="flex flex-col gap-2.5">
                {playRulesAndKeywords
                  .filter(item => {
                    if (!ruleSearchQuery) return true;
                    const q = ruleSearchQuery.toLowerCase();
                    return item.title.toLowerCase().includes(q)
                      || item.description.toLowerCase().includes(q);
                  })
                  .map(item => (
                    <Card key={item.key} className="!bg-gray-800 !border-gray-700">
                      <CardBody className="p-5 space-y-3">
                        <h5 className="font-heading text-xl text-white">
                          {item.title}
                        </h5>
                        <div className="font-body text-base text-gray-300">
                          <Markdown>{item.description}</Markdown>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
              </div>
            </div>
          </main>
        ) : (
          <CenterViewport
            logo={<img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />}
            mobilePanelOpen={mobilePanelOpen}
            isShortHeight={isShortHeight}
          >
            <CardCarousel
            items={carouselItems}
            activeId={activeItemId}
            onActiveChange={(id) => {
              const item = carouselItems.find(i => i.id === id);
              if (item?.kind === 'rule') selectRule(id);
              else                       selectCard(id);
            }}
            cardWidth={CARD_W}
            cardHeight={CARD_H}
            onNavigateStart={() => setKwFading(true)}
            layoutDeps={[appMode, playTab, cardListOpen, editorOpen, isMobile, isShortHeight, mobilePanelOpen]}
            initialZoom={isShortHeight ? 1.0 : 0.7}
            className={`w-full ${mobilePanelOpen ? 'flex-none' : 'flex-1 min-h-0'}`}
            bottomLeftSlot={
              appMode === 'play' && playTab === 'units' && !activeRule && tokenDefinitions.some(d => d.refresh_on_turn !== 0) ? (
                <Button
                  variant={allActivated ? 'filled' : 'outline'}
                  color="primary"
                  shape="pill"
                  size="sm"
                  onClick={handleNewTurn}
                  leftIcon={
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M21 4v5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  New Turn
                </Button>
              ) : null
            }
            bottomRightSlot={
              appMode === 'play' && playTab === 'units' && !activeRule && tokenDefinitions.length > 0 ? (
                <TokenMenu
                  tokenDefinitions={tokenDefinitions}
                  card={{
                    stats: { hp: activeCard.hp },
                    unitKeywords: activeCard.unitKeywords.map(k => ({
                      keywordName: k.keywordName,
                      paramValue: k.paramValue,
                    })),
                  }}
                  tokenState={activeCard.tokenState}
                  onTokenChange={handleTokenChange}
                />
              ) : null
            }
            renderItem={(item, role) => {
              if (item.kind === 'rule') {
                const rule = sortedRules.find(r => r.id === item.id);
                if (!rule) return null;
                return (
                  <HaloFlashpointRuleCard
                    title={rule.title || 'Rule Title'}
                    description={rule.description || ''}
                    {...(role === 'active' && appMode === 'edit' ? {
                      onTitleChange:       (v: string) => updateActiveRule({ title: v }),
                      onDescriptionChange: (v: string) => updateActiveRule({ description: v }),
                      constraints:         ruleConstraints,
                    } : {})}
                  />
                );
              }
              const card = cards.find(c => c.id === item.id);
              if (!card) return null;
              return (
                <HaloFlashpointCard
                  unitName={card.unitName || 'Unit Name'}
                  keywords={card.keywords || ''}
                  {...(role === 'active' ? {
                    keywordData: card.unitKeywords.map(k => ({
                      label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                      name:  k.keywordName,
                      description: k.description,
                    })),
                  } : {})}
                  ra={card.ra}
                  fi={card.fi}
                  sv={card.sv}
                  advanceValue={card.advance}
                  sprintValue={card.sprint}
                  ar={card.armour}
                  hp={card.hp}
                  portrait={card.portraitUrl ?? undefined}
                  portraitStyle={card.portraitStyle}
                  weapons={card.weapons.map(w => ({
                    type:     w.type,
                    name:     w.name,
                    range:    w.range,
                    ap:       w.ap,
                    keywords: w.keywords,
                    ...(role === 'active' ? {
                      keywordData: w.weaponKeywords.map(k => ({
                        label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                        name:  k.keywordName,
                        description: k.description,
                      })),
                    } : {}),
                  }))}
                  {...(role === 'active' && appMode === 'edit' ? {
                    onUnitNameChange:     (v: string) => updateActiveCard({ unitName: v }),
                    onKeywordsChange:     (v: string) => updateActiveCard({ keywords: v }),
                    onRaChange:           (v: number) => updateActiveCard({ ra:       v }),
                    onFiChange:           (v: number) => updateActiveCard({ fi:       v }),
                    onSvChange:           (v: number) => updateActiveCard({ sv:       v }),
                    onAdvanceValueChange: (v: number) => updateActiveCard({ advance:  v }),
                    onSprintValueChange:  (v: number) => updateActiveCard({ sprint:   v }),
                    onArChange:           (v: number) => updateActiveCard({ armour:   v }),
                    onHpChange:           (v: number) => updateActiveCard({ hp:       v }),
                    onEditKeyword:        (kw: { name: string; description: string }) => {
                      const unitKw = card.unitKeywords.find(k => k.keywordName === kw.name);
                      if (unitKw) { setEditingUnitKw(unitKw); return; }
                      for (const w of card.weapons) {
                        const weaponKw = w.weaponKeywords.find(k => k.keywordName === kw.name);
                        if (weaponKw) { setEditingWeaponKw(weaponKw); return; }
                      }
                    },
                    constraints: cardConstraints,
                  } : {})}
                  onWeaponClick={role === 'active' ? (hw) => {
                    const match = card.weapons.find(w => w.name === hw.name);
                    if (match) setViewingWeapon(match);
                  } : undefined}
                  tokenOverlay={buildTokenOverlayProp(card)}
                />
              );
            }}
          />


          {/* ── Play mode: keyword + weapon cards for the active unit ──── */}
          {appMode === 'play' && playTab === 'units' && (
            <div
              className="w-full overflow-y-auto px-5 pb-5 space-y-2.5"
              style={{
                height: '40vh',
                flexShrink: 0,
                opacity: kwFading ? 0 : 1,
                transition: 'opacity 120ms ease-out',
              }}
            >
              {!activeRule && (() => {
                // Use kwDisplayId to find the card whose keywords to show
                const displayCard = cards.find(c => c.id === kwDisplayId) ?? activeCard;

                // Gather unit keywords + weapon keywords (deduplicated), all sorted
                const unitKws = displayCard.unitKeywords
                  .slice()
                  .sort((a, b) => a.keywordName.localeCompare(b.keywordName))
                  .map(kw => ({ ...kw, key: `kw-${kw.keywordId}` }));

                const unitKwIds = new Set(displayCard.unitKeywords.map(k => k.keywordId));
                const seen = new Set<string>();
                const weaponKws: typeof unitKws = [];
                for (const w of displayCard.weapons) {
                  for (const k of w.weaponKeywords) {
                    if (!unitKwIds.has(k.keywordId) && !seen.has(k.keywordId)) {
                      seen.add(k.keywordId);
                      weaponKws.push({ ...k, key: `wkw-${k.keywordId}` });
                    }
                  }
                }
                weaponKws.sort((a, b) => a.keywordName.localeCompare(b.keywordName));

                return [...unitKws, ...weaponKws].map((kw, i) => (
                  <Card
                    key={kw.key}
                    className="!bg-gray-800 !border-gray-700"
                    style={!kwFading ? {
                      opacity: 0,
                      animation: `fadeInUp 150ms ease-out ${i * 40}ms forwards`,
                    } : undefined}
                  >
                    <CardBody className="p-5 space-y-3">
                      <h5 className="font-heading text-xl text-white">
                        {kw.paramValue != null ? `${kw.keywordName} (${kw.paramValue})` : kw.keywordName}
                      </h5>
                      <div className="font-body text-base text-gray-300">
                        <Markdown>{kw.description}</Markdown>
                      </div>
                    </CardBody>
                  </Card>
                ));
              })()}
            </div>
          )}
          </CenterViewport>
        )
      }
      rightPanelOpen={editorOpen}
      rightPanel={appMode === 'edit' ? (
        <EditorPanel title={activeRule ? 'Edit Rule' : 'Edit Card'}>
          {activeRule ? (
            /* ── Rule editor ────────────────────────────────────────── */
            <>
              <section className="space-y-3">
                <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Rule Details
                </p>
                <Input
                  label="Rule Title"
                  required
                  placeholder="e.g. Assault, Defensive Formation"
                  value={activeRule.title}
                  maxLength={getMaxLength(ruleConstraints, 'title')}
                  onChange={e => updateActiveRule({ title: e.target.value })}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex gap-0.5 items-center font-body text-sm font-medium text-gray-900 dark:text-white">
                    <span>Description</span>
                  </div>
                  <RichTextEditor
                    value={activeRule.description}
                    onChange={v => updateActiveRule({ description: v })}
                    placeholder="Write the rule description…"
                  />
                </div>
              </section>

              <HR />
              <section className="space-y-3">
                {/* "Save as Template" button intentionally omitted for now —
                    redundant with the Add Rule picker's existing-rule list.
                    Backend + SaveTemplateModal wiring kept below for future
                    re-enabling. */}
                <Button
                  variant="ghost"
                  color="danger"
                  size="sm"
                  leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
                  className="w-full"
                  onClick={() => removeRule(activeRule.id)}
                >
                  Remove from Deck
                </Button>
              </section>
            </>
          ) : (

          <>

            {/* ── Basic Details ──────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Basic Details
              </p>
              <Input
                label="Unit Name"
                required
                placeholder="e.g. Spartan CQB, Banished Elite"
                leftIcon={<UserRounded className="w-4 h-4" />}
                value={activeCard.unitName}
                maxLength={getMaxLength(cardConstraints, 'name')}
                onChange={e => updateActiveCard({ unitName: e.target.value })}
              />
              {/* Unit Keywords */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
                  Keywords
                </p>
                {activeCard.unitKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeCard.unitKeywords.map(k => (
                      <Badge
                        key={k.keywordId}
                        onDismiss={() => {
                          const updated = activeCard.unitKeywords.filter(x => x.keywordId !== k.keywordId);
                          updateActiveCard({
                            unitKeywords: updated,
                            keywords: buildKeywordsDisplayString(updated),
                          });
                        }}
                      >
                        <button
                          type="button"
                          className="underline text-blue-600 dark:text-blue-400 hover:text-blue-500"
                          onClick={() => setViewingUnitKeyword(k)}
                        >
                          {k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName}
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    disabled={isAtLimit(activeCard.unitKeywords.length, getMaxKeywords(cardConstraints))}
                    onClick={() => setUnitKeywordModalOpen(true)}
                  >
                    Add Keyword
                  </Button>
                </div>
              </div>

              <AddKeywordModal
                open={unitKeywordModalOpen}
                onClose={() => setUnitKeywordModalOpen(false)}
                gameSlug="halo-flashpoint"
                onKeywordSelected={(kw) => {
                  const updated = [...activeCard.unitKeywords, kw];
                  updateActiveCard({
                    unitKeywords: updated,
                    keywords: buildKeywordsDisplayString(updated),
                  });
                  setUnitKeywordModalOpen(false);
                }}
                excludeKeywordIds={activeCard.unitKeywords.map(k => k.keywordId)}
                constraints={keywordConstraints}
              />

              <KeywordInfoModal
                open={!!viewingUnitKeyword}
                onClose={() => setViewingUnitKeyword(null)}
                name={viewingUnitKeyword?.keywordName ?? ''}
                description={viewingUnitKeyword?.description ?? ''}
                onEdit={() => {
                  setEditingUnitKw(viewingUnitKeyword);
                  setViewingUnitKeyword(null);
                }}
              />

              <AddKeywordModal
                open={!!editingUnitKw}
                onClose={() => setEditingUnitKw(null)}
                gameSlug="halo-flashpoint"
                editingKeyword={editingUnitKw ? {
                  id: editingUnitKw.keywordId,
                  name: editingUnitKw.keywordName,
                  description: editingUnitKw.description,
                  hasParams: editingUnitKw.hasParams,
                } : null}
                onKeywordSelected={() => {}}
                onKeywordUpdated={(updated) => {
                  propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
                  setEditingUnitKw(null);
                }}
                constraints={keywordConstraints}
              />

              {/* Edit weapon keyword (opened from card's weapon table) */}
              <AddKeywordModal
                open={!!editingWeaponKw}
                onClose={() => setEditingWeaponKw(null)}
                gameSlug="halo-flashpoint"
                editingKeyword={editingWeaponKw ? {
                  id: editingWeaponKw.keywordId,
                  name: editingWeaponKw.keywordName,
                  description: editingWeaponKw.description,
                  hasParams: editingWeaponKw.hasParams,
                } : null}
                onKeywordSelected={() => {}}
                onKeywordUpdated={(updated) => {
                  propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
                  setEditingWeaponKw(null);
                }}
                constraints={keywordConstraints}
              />

              <Counter
                label="Points Cost"
                min={cardConstraints.fields?.['stats.pointsCost']?.min ?? 0}
                max={cardConstraints.fields?.['stats.pointsCost']?.max}
                value={activeCard.pointsCost}
                onChange={v => updateActiveCard({ pointsCost: v })}
              />
              <p className="font-body text-xs text-gray-400">
                Include the cost of weapons and upgrades (if any)
              </p>
            </section>

            {/* ── Images ────────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Images
              </p>

              {activeCard.portraitUrl ? (
                <div className="flex flex-wrap gap-1">
                  <Button
                    rightIcon={<AddCircle className="w-4 h-4" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      await ensureCardSaved();
                      setPhotoModalOpen(true);
                    }}
                  >
                    Change Portrait Image
                  </Button>
                  <Button
                    leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
                    variant="ghost"
                    color="danger"
                    size="sm"
                    onClick={() => setDeletePortraitConfirm(true)}
                  >
                    Remove Portrait
                  </Button>
                </div>
              ) : (
                <Button
                  rightIcon={<AddCircle className="w-4 h-4" />}
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await ensureCardSaved();
                    setPhotoModalOpen(true);
                  }}
                >
                  Upload Portrait Image
                </Button>
              )}
            </section>

            {/* ── Unit Stats ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Unit Stats
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Ranged"
                  required
                  min={0}
                  value={activeCard.ra}
                  onChange={v => updateActiveCard({ ra: v })}
                  className="w-full"
                />
                <Counter
                  label="Fight"
                  required
                  min={0}
                  value={activeCard.fi}
                  onChange={v => updateActiveCard({ fi: v })}
                  className="w-full"
                />
              </div>
              <Counter
                label="Survive"
                required
                min={0}
                value={activeCard.sv}
                onChange={v => updateActiveCard({ sv: v })}
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Advance"
                  required
                  min={0}
                  value={activeCard.advance}
                  onChange={v => updateActiveCard({ advance: v })}
                  className="w-full"
                />
                <Counter
                  label="Sprint"
                  required
                  min={0}
                  value={activeCard.sprint}
                  onChange={v => updateActiveCard({ sprint: v })}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Hit Points"
                  required
                  min={0}
                  value={activeCard.hp}
                  onChange={v => updateActiveCard({ hp: v })}
                  className="w-full"
                />
                <Counter
                  label="Armour"
                  min={0}
                  value={activeCard.armour}
                  onChange={v => updateActiveCard({ armour: v })}
                  className="w-full"
                />
              </div>
            </section>

            {/* ── Weapons ────────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Weapons
              </p>

              {/* Attached weapons */}
              {activeCard.weapons.map(w => (
                <AttachedAddonRow
                  key={w.addonId}
                  name={w.name}
                  subtitle={[w.type, w.range && `R${w.range}`, w.ap && `AP ${w.ap}`, w.keywords]
                    .filter(Boolean).join(', ')}
                  onClick={() => setViewingWeapon(w)}
                  onRemove={() => updateActiveCard({
                    weapons: activeCard.weapons.filter(x => x.addonId !== w.addonId),
                  })}
                />
              ))}

              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isAtLimit(activeCard.weapons.length, getMaxAddons(cardConstraints))}
                onClick={() => setWeaponModalOpen(true)}
              >
                Add Weapon
              </Button>
            </section>

            {/* ── Save as Template / Delete Card ─────────────────────── */}
            <HR />
            <section className="space-y-3">
              <Button
                variant="outline"
                color="primary"
                size="sm"
                leftIcon={<Diskette className="w-4 h-4" />}
                className="w-full"
                onClick={() => setTemplateModalOpen(true)}
              >
                Save as Template
              </Button>
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
                className="w-full"
                onClick={() => setConfirmDeleteCardId(activeCard.id)}
              >
                Delete Card
              </Button>
            </section>

          </>
          )}
        </EditorPanel>
      ) : undefined}
      modals={<>
      {/* ── Delete portrait confirmation modal ──────────────────────────── */}
      <Modal
        open={deletePortraitConfirm}
        onClose={() => !deletingPortrait && setDeletePortraitConfirm(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">
            Delete this image?
          </h3>
          <p className="font-body text-base text-gray-300">
            This can't be undone, but you can upload a different image.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingPortrait}
              onClick={() => setDeletePortraitConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingPortrait}
              onClick={handleDeletePortrait}
            >
              Yes, Delete this portrait image
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete card confirmation modal ─────────────────────────────── */}
      <Modal
        open={deleteCardConfirmOpen}
        onClose={() => !deletingCard && setDeleteCardConfirmOpen(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">
            Delete this unit?
          </h3>
          <p className="font-body text-base text-gray-300">
            This will permanently delete {cardPendingDelete?.unitName ? `“${cardPendingDelete.unitName}”` : 'this unit'}.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingCard}
              onClick={() => setDeleteCardConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingCard}
              onClick={handleConfirmDeleteCard}
            >
              Yes, Delete Unit
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Upload Photo modal ────────────────────────────────────────────── */}
      <UploadPhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        game="halo-flashpoint"
        cardDbId={activeCard.dbId}
        unitName={activeCard.unitName || undefined}
        onImageUploaded={(url, pStyle) => updateActiveCard({ portraitUrl: url, portraitStyle: pStyle })}
        onAvatarUploaded={url => updateActiveCard({ avatarUrl: url })}
      />

      {/* ── Save-as-template modal ────────────────────────────────────────── */}
      <SaveTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        defaultName={activeCard.unitName}
        onSave={saveAsTemplate}
      />

      {/* ── Save-rule-as-template modal ──────────────────────────────────── */}
      <SaveTemplateModal
        open={ruleTemplateModalOpen}
        onClose={() => setRuleTemplateModalOpen(false)}
        defaultName={activeRule?.title ?? ''}
        onSave={saveRuleAsTemplate}
        description="You’ll be able to use this template to create new rules in the future. Templates remember the title and description."
        namePlaceholder="This replaces the rule’s title."
      />

      {/* ── New Card modal (templates picker) ─────────────────────────────── */}
      <NewCardModal
        open={newCardModalOpen}
        onClose={() => setNewCardModalOpen(false)}
        templates={newCardTemplates}
        onNewBlank={() => { setNewCardModalOpen(false); addBlankCard(); }}
        onPickTemplate={createFromTemplate}
        onDeleteTemplate={deleteTemplate}
      />

      {/* ── New Rule modal (rule templates picker) ────────────────────────── */}
      <NewCardModal
        open={newRuleModalOpen}
        onClose={() => setNewRuleModalOpen(false)}
        templates={newRuleTemplates}
        onNewBlank={() => { setNewRuleModalOpen(false); addRuleCard(); }}
        onPickTemplate={createRuleFromTemplate}
        onDeleteTemplate={deleteRuleTemplate}
      />

      {/* ── Add Weapon modal ──────────────────────────────────────────────── */}
      <AddAddonModal
        open={weaponModalOpen}
        onClose={() => setWeaponModalOpen(false)}
        gameSlug="halo-flashpoint"
        addonTypeSlug="weapons"
        addonTypeName="Weapon"
        excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
        onAdd={handleWeaponAdded}
        onDeleted={handleWeaponDeleted}
        getSubtitle={haloWeaponSubtitle}
        CreateFormComponent={WeaponFormWithContext}
      />

      {/* ── Weapon detail modal ────────────────────────────────────────────── */}
      <WeaponInfoModal
        open={!!viewingWeapon}
        onClose={() => setViewingWeapon(null)}
        weapon={viewingWeapon}
        onKeywordClick={(kw) => {
          setViewingWeapon(null);
          setViewingUnitKeyword(kw as LocalKeywordAttachment);
        }}
        onEdit={appMode === 'edit' ? (() => {
          if (!viewingWeapon) return;
          const addonId = viewingWeapon.addonId;
          setViewingWeapon(null);
          supabase
            .from('addons')
            .select('*')
            .eq('id', addonId)
            .single()
            .then(({ data }) => {
              if (data) setEditingWeaponAddon(data as Addon);
            });
        }) : undefined}
      />

      {/* ── Edit Weapon modal (direct form, skips picker) ──────────────────── */}
      {editingWeaponAddon && (
        <Modal open onClose={() => setEditingWeaponAddon(null)} className="max-w-md">
          <WeaponFormWithContext
            editingAddon={editingWeaponAddon}
            onSave={async (name, description, stats) => {
              setSavingWeaponEdit(true);
              try {
                const { error } = await supabase
                  .from('addons')
                  .update({ name, description, stats })
                  .eq('id', editingWeaponAddon.id);
                if (error) throw error;

                // Refresh weapon data in all cards that use this addon
                const ws = stats as Record<string, unknown>;
                setCardState(s => ({
                  ...s,
                  cards: s.cards.map(c => ({
                    ...c,
                    weapons: c.weapons.map(w =>
                      w.addonId === editingWeaponAddon.id
                        ? {
                            ...w,
                            name,
                            type:       String(ws.type       ?? ''),
                            range:      String(ws.range      ?? ''),
                            ap:         String(ws.ap         ?? ''),
                            pointsCost: String(ws.pointsCost ?? ''),
                            keywords:   String(ws.keywords   ?? ''),
                          }
                        : w,
                    ),
                  })),
                }));

                setEditingWeaponAddon(null);
                return editingWeaponAddon.id;
              } catch (err) {
                console.error('[BattleCards] weapon edit error:', err);
                return '';
              } finally {
                setSavingWeaponEdit(false);
              }
            }}
            onCancel={() => setEditingWeaponAddon(null)}
            saving={savingWeaponEdit}
          />
        </Modal>
      )}

      {/* ── Delete card confirmation modal ──────────────────────────────── */}
      <Modal
        open={confirmDeleteCardId !== null}
        onClose={() => !deletingCard && setConfirmDeleteCardId(null)}
        className="max-w-xs"
      >
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="size-8 text-blue-400" />
          <h2 className="font-heading text-xl text-white">Delete this card?</h2>
          <p className="font-body text-base text-gray-300">This can't be undone.</p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              disabled={deletingCard}
              onClick={() => setConfirmDeleteCardId(null)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              loading={deletingCard}
              rightIcon={<ArrowRight className="size-4" />}
              onClick={handleDeleteCard}
            >
              Yes, Delete this card
            </Button>
          </div>
        </div>
      </Modal>
      </>}
    />
  );
};

export default CardBuilderHaloFlashpoint;
