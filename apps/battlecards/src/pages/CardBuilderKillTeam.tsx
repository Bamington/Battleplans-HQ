/**
 * CardBuilderKillTeam.tsx — Kill Team operative card builder screen
 *
 * Allows the user to edit a Kill Team operative card. The live card
 * (KillTeamCard) renders in the centre column, wired to the editor state
 * in the right panel. Two addon types are supported via AddAddonModal:
 *   • Weapons   — meleeOrRanged, attack, hit, damage, keywords[]
 *   • Abilities — description (top-level), apCost, keywords[]
 *
 * LAYOUT (desktop ≥ 768px):
 * ┌──────────┬──────────────────────────┬────────────────────┐
 * │  Unit    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * Route: /app/builder/kill-team?deckId=<uuid>
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ModeToggle, { type Mode } from '../components/ModeToggle';
import PlaySubnav, { type PlayTab } from '../components/PlaySubnav';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CenterViewport from '../components/CenterViewport';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import { useCardBuilder } from '../hooks/useCardBuilder';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import AltArrowDown from '../icons/AltArrowDown';
import Play from '../icons/Play';
import UnitListEntry from '../components/UnitListEntry';
import Input from '../components/Input';
import Counter from '../components/Counter';
import Button from '../components/Button';
import HR from '../components/HR';
import Markdown from 'react-markdown';
import KillTeamCard, {
  CARD_OUTER_W_WITH_BARS,
  CARD_W_MOBILE,
  CARD_H_MOBILE,
  CARD_OUTER_H_WITH_BARS_MOBILE,
} from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import Card, { CardBody } from '../components/Card';
import Magnifer from '../icons/Magnifer';
import CardCarousel from '../components/CardCarousel';
import TokenMenu from '../components/TokenMenu';
import Modal from '../components/Modal';
import AddAddonModal, { type AddonFormProps } from '../components/AddAddonModal';
import AddonInfoModal from '../components/AddonInfoModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import NewCardModal, { type NewCardModalTemplate } from '../components/NewCardModal';
import CustomTokenModal, { CustomTokenSaveError } from '../components/CustomTokenModal';
import AddKeywordModal, { type KeywordSelection } from '../components/AddKeywordModal';
import KillTeamWeaponForm from '../components/KillTeamWeaponForm';
import KillTeamAbilityForm from '../components/KillTeamAbilityForm';
import UploadPhotoModal from '../components/UploadPhotoModal';
import UserRounded from '../icons/UserRounded';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import ArrowRight from '../icons/ArrowRight';
import Pen2 from '../icons/Pen2';
import HamburgerMenu from '../icons/HamburgerMenu';
import Diskette from '../icons/Diskette';
import { supabase } from '../lib/supabase';
import type { Addon, KillTeamStats, TokenDefinition } from '../lib/database.types';
import { formatKeywordLabel } from '../lib/cardShape/util';
import logoKillTeam from '../assets/games/logo-kill-team.png';
import iconKillTeam from '../assets/games/card assets/kill-team/icon.png';

// ── Card native dimensions ────────────────────────────────────────────────────
// Operative cards are landscape (matches KillTeamCard); rule cards are
// taller and narrower (matches KillTeamRuleCard / Figma 848:4770).
//
// In play mode, operatives reserve extra room on the right of the slot
// for the wound bar (see CARD_OUTER_W_WITH_BARS in KillTeamCard.tsx).
// That makes operatives ~8% wider in play mode; the carousel reflows
// (everything shrinks slightly) so adjacent cards never overlap the bar.
const OPERATIVE_W            = 1270;
const OPERATIVE_W_WITH_BARS  = CARD_OUTER_W_WITH_BARS;  // 1370
const OPERATIVE_H            = 890;
const RULE_W                 = 700;
const RULE_H                 = 1200;

// Same shape as the keyword-selection contract exposed by AddKeywordModal /
// the Kill Team addon forms. Aliased so the rest of this file keeps its
// older name.
type LocalKeywordAttachment = KeywordSelection;

// Per-keyword "Name" / "Name (X)" formatting goes through the shared
// formatKeywordLabel — same primitive the pack editor's shapers use.
const buildKeywordsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws.map(k => formatKeywordLabel(k.keywordName, k.paramValue)).join(', ');

// ── Local addon shapes ────────────────────────────────────────────────────────

interface LocalWeapon {
  addonId:        string;
  name:           string;
  meleeOrRanged:  'melee' | 'ranged' | '';
  attack:         number;
  hit:            number;
  baseDamage:     number;
  critDamage:     number;
  keywords:       string;
  weaponKeywords: LocalKeywordAttachment[];
}

// parseHit / parseDamageParts / formatHit / formatDamage are now exported
// from the pack editor's Kill Team card shaper — same logic used in both
// contexts. Importing here so any future change to the parsing rules
// (e.g. a new legacy shape) only needs to happen in one place.
import {
  parseHit, parseDamageParts, formatHit, formatDamage,
} from '../lib/cardShape/killTeam';
import {
  killTeamWeaponSubtitle, killTeamAbilitySubtitle,
} from '../lib/addonSubtitles';

interface LocalAbility {
  addonId:         string;
  name:            string;
  description:     string;
  apCost:          number;
  keywords:        string;
  abilityKeywords: LocalKeywordAttachment[];
}

// ── Card data type ────────────────────────────────────────────────────────────

interface KillTeamCardData {
  id:            string;
  dbId:          string | null;
  /** Discriminator: 'operative' uses the full stat block; 'rule' uses the
   *  faction-rule layout (title + description + optional ability). */
  cardType:      'operative' | 'rule';
  // ── Operative-only fields ──
  operativeName: string;
  role:          string;
  teamName:      string;
  tags:          string;
  actions:       number;
  /** Movement in inches — UI appends `"` */
  movement:      number;
  /** Save value — UI appends `+` */
  save:          number;
  wounds:        number;
  /** Base size in millimetres (e.g. 25, 32, 40). Rendered bottom-right. */
  baseSize:      number;
  weapons:       LocalWeapon[];
  abilities:     LocalAbility[];
  // ── Rule-only fields ──
  ruleTitle:       string;
  ruleDescription: string;
  /** 0 or 1 ability attached to a rule card. */
  ruleAbility:     LocalAbility | null;
  // ── Common ──
  portraitUrl:   string | null;
  portraitStyle: string | null;
  avatarUrl:     string | null;
  /** Transient per-card token values keyed by `token_definitions.id`.
   *  In-memory only — Play mode resets it on reload (matches Halo). */
  tokenState:    Record<string, number>;
}

const defaultOperativeCard = (): KillTeamCardData => ({
  id:              crypto.randomUUID(),
  dbId:            null,
  cardType:        'operative',
  operativeName:   '',
  role:            '',
  teamName:        '',
  tags:            '',
  actions:         0,
  movement:        0,
  save:            0,
  wounds:          0,
  baseSize:        0,
  weapons:         [],
  abilities:       [],
  ruleTitle:       '',
  ruleDescription: '',
  ruleAbility:     null,
  portraitUrl:     null,
  portraitStyle:   null,
  avatarUrl:       null,
  tokenState:      {},
});

const defaultRuleCard = (): KillTeamCardData => ({
  id:              crypto.randomUUID(),
  dbId:            null,
  cardType:        'rule',
  operativeName:   '',
  role:            '',
  teamName:        '',
  tags:            '',
  actions:         0,
  movement:        0,
  save:            0,
  wounds:          0,
  baseSize:        0,
  weapons:         [],
  abilities:       [],
  ruleTitle:       '',
  ruleDescription: '',
  ruleAbility:     null,
  portraitUrl:     null,
  portraitStyle:   null,
  avatarUrl:       null,
  tokenState:      {},
});

// ── Persistence helpers ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T | undefined> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch { if (i < attempts - 1) await sleep(1000 * (i + 1)); }
  }
};

const isKillTeamCardBlank = (c: KillTeamCardData): boolean => {
  if (c.cardType === 'rule') {
    return !c.ruleTitle && !c.ruleDescription && c.ruleAbility === null;
  }
  return !c.operativeName && !c.role && !c.teamName && !c.tags &&
    c.actions === 0 && c.movement === 0 && c.save === 0 && c.wounds === 0 &&
    c.baseSize === 0 &&
    c.weapons.length === 0 && c.abilities.length === 0;
};

const toKillTeamStats = (c: KillTeamCardData): Record<string, unknown> => {
  if (c.cardType === 'rule') {
    return { description: c.ruleDescription };
  }
  return {
    role:     c.role,
    teamName: c.teamName,
    tags:     c.tags,
    actions:  c.actions,
    movement: c.movement,
    save:     c.save,
    wounds:   c.wounds,
    baseSize: c.baseSize,
  };
};

const cardDisplayName = (c: KillTeamCardData): string => {
  if (c.cardType === 'rule') return c.ruleTitle || 'Untitled Rule';
  return c.operativeName || 'Unnamed Operative';
};

// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderKillTeam = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deckId = searchParams.get('deckId');

  // ── App mode (Edit / Play) — matches the pattern used by Halo / Starcraft.
  // Play mode hides the editor + add controls. Per-card play state is stored
  // as a generic `tokenState: Record<string, number>` keyed by token-definition
  // ID — same shape Halo uses. In-memory only; no DB persistence yet. */
  const [appMode, setAppMode] = useState<Mode>('edit');
  const [playTab, setPlayTab] = useState<PlayTab>('units');

  // Search query for the play-mode Rules tab. Cleared whenever the user
  // leaves the Rules tab so the next visit starts fresh.
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');

  // ── Shared builder chrome (panel toggles, responsive, deck name) ────────
  // Universal hook used by every game's builder. Owns the mobile slide-in
  // panel state, the matchMedia listeners that drive responsive behaviour,
  // and the inline-rename plumbing for the deck name. The Halo / Blood Bowl
  // / Starcraft builders share the same surface so the EditSubnav toggle
  // buttons + carousel relayout work identically here.
  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isMobile, isShortHeight, mobilePanelOpen, layoutDeps,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  } = builder;

  // ── Edit mode (reorder + rename) ───────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Card list state ────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState(() => {
    const card = defaultOperativeCard();
    return { cards: [card] as KillTeamCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // ── Dirty tracking (cards that need saving) ────────────────────────────────
  const dirtyCardsRef = useRef<Set<string>>(new Set());

  const updateActiveCard = (patch: Partial<KillTeamCardData>) => {
    dirtyCardsRef.current.add(activeCardId);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === s.activeCardId ? { ...c, ...patch } : c),
    }));
  };

  // ── Token state (Play mode) — mirrors Halo's generic system ────────────
  // Token definitions come from the DB (token_definitions table). Per-card
  // tokenState is a Record<defId, number> on each LocalCard. Same handlers
  // and helpers as Halo so the carousel TokenMenu / TokenOverlay components
  // work without modification.
  //
  // The fetch combines two sets:
  //   • Game tokens (deck_id IS NULL, filtered by game_id) — seeded by
  //     migration_kill_team_tokens.sql.
  //   • Deck UCTs (deck_id = current deck) — user-created via the
  //     "Add Custom Token" flow.
  // Both share the same TokenDefinition shape, so TokenMenu / TokenOverlay
  // render them through a single pipeline.

  const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinition[]>([]);

  /** Pull both game tokens and this deck's UCTs in one go. Called on mount
   *  and after any UCT mutation so the menu/overlay reflect changes
   *  immediately. */
  const reloadTokenDefinitions = useCallback(async () => {
    const { data: game } = await supabase
      .from('games').select('id').eq('slug', 'kill-team').single();
    if (!game) return;

    // Game tokens.
    const { data: gameTokens } = await supabase
      .from('token_definitions').select('*')
      .eq('game_id', game.id)
      .is('deck_id', null)
      .order('sort_order');

    // Deck UCTs (if we're in a deck).
    let deckTokens: TokenDefinition[] = [];
    if (deckId) {
      const { data } = await supabase
        .from('token_definitions').select('*')
        .eq('deck_id', deckId)
        .order('created_at');
      if (data) deckTokens = data as TokenDefinition[];
    }

    setTokenDefinitions([...(gameTokens as TokenDefinition[] ?? []), ...deckTokens]);
  }, [deckId]);

  useEffect(() => { void reloadTokenDefinitions(); }, [reloadTokenDefinitions]);

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

  /** Update a token for a specific card (used by direct overlay clicks). */
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
  const buildTokenOverlayProp = (c: KillTeamCardData) => {
    if (appMode !== 'play' || tokenDefinitions.length === 0) return undefined;
    if (c.cardType !== 'operative') return undefined;
    return {
      definitions:  tokenDefinitions,
      unitKeywords: c.weapons.flatMap(w => w.weaponKeywords).map(k => ({
        keywordName: k.keywordName,
        paramValue:  k.paramValue,
      })),
      state:        c.tokenState,
      onChange:     (tokenDefId: string, newValue: number) =>
        handleTokenChangeForCard(c.id, tokenDefId, newValue),
    };
  };

  /** When switching to Play mode, seed `tokenState` from each definition's
   *  `starting_value` for any card that hasn't been touched yet. Also
   *  resets the Rules-tab search query so re-entering play starts fresh. */
  const handleModeChange = useCallback((next: Mode) => {
    if (next === 'play' && tokenDefinitions.length > 0) {
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
    setRuleSearchQuery('');
    setAppMode(next);
  }, [tokenDefinitions]);

  /** Tab switch handler — also resets the Rules-tab search when the user
   *  navigates away so a stale query never lingers on the next visit. */
  const handlePlayTabChange = (next: PlayTab) => {
    if (next !== 'rules') setRuleSearchQuery('');
    setPlayTab(next);
  };

  // ── Token turn helpers (New Turn button) ──────────────────────────────────
  /** Resolve effective max for a token on a given card — mirrors TokenOverlay's
   *  precedence: stat_role='max' or keyword_value_role='max' override max_value. */
  const resolveTokenMax = (def: TokenDefinition, card: KillTeamCardData): number | null => {
    let effMax: number | null = def.max_value ?? null;
    if (def.stat_key && def.stat_role === 'max') {
      // KT cards expose `wounds` to tokens. Add more stat mappings here if
      // other KT tokens need them later (e.g. movement-based caps).
      const statMap: Record<string, number> = { wounds: card.wounds };
      const v = statMap[def.stat_key];
      if (v != null) effMax = v;
    }
    return effMax;
  };

  /** "New Turn" handler: apply each token's refresh_on_turn delta to every
   *  card, clamped to [min_value ?? 0, effectiveMax]. */
  const handleNewTurn = () => {
    const turnDefs = tokenDefinitions.filter(d => d.refresh_on_turn !== 0);
    if (turnDefs.length === 0) return;
    setCardState(prev => ({
      ...prev,
      cards: prev.cards.map(card => {
        if (card.cardType !== 'operative') return card;
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
   *  effective max — i.e. the operative has been activated this turn.
   *  Drives the unit-list "filled in" treatment in play mode. Returns
   *  false for non-operative cards (rules) and for cards with no
   *  activation tokens at all. */
  const isCardActivated = (card: KillTeamCardData): boolean => {
    if (card.cardType !== 'operative') return false;
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    return actDefs.every(def => {
      const current = card.tokenState[def.id] ?? def.starting_value ?? 0;
      const effMax = resolveTokenMax(def, card);
      return effMax != null ? current >= effMax : current >= 1;
    });
  };

  /** Primary-styled when every operative has all activation tokens fully on. */
  const allActivated = (() => {
    const ops = cards.filter(c => c.cardType === 'operative');
    if (ops.length === 0) return false;
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    return ops.every(isCardActivated);
  })();

  // ── Carousel slot dimensions ──────────────────────────────────────────
  // Per-item width depends on appMode for operatives — in play mode each
  // operative reserves a wound-bar slot on the right. The bounding box
  // (used for the carousel's global fit-scale) follows the same rule.
  //
  // Mobile (≤ 767px): KillTeamCard renders its 890×1270 portrait layout in
  // place of the 1270×890 landscape one. Both the per-item dims and the
  // bounding box flip accordingly so the carousel's fit-scale uses the
  // portrait footprint rather than reserving landscape-shaped slots that
  // leave large dead bands around the card.
  //
  // Bar trackers: desktop grows slot WIDTH in play mode (bars sit to the
  // right of the card); mobile grows slot HEIGHT in play mode (horizontal
  // bars sit beneath the card).
  const operativeSlotW = isMobile
    ? CARD_W_MOBILE
    : (appMode === 'play' ? OPERATIVE_W_WITH_BARS : OPERATIVE_W);
  const operativeSlotH = isMobile
    ? (appMode === 'play' ? CARD_OUTER_H_WITH_BARS_MOBILE : CARD_H_MOBILE)
    : OPERATIVE_H;
  const dimsForCard = useCallback(
    (c: { cardType: 'operative' | 'rule' }) =>
      c.cardType === 'rule'
        ? { width: RULE_W, height: RULE_H }
        : { width: operativeSlotW, height: operativeSlotH },
    [operativeSlotW, operativeSlotH],
  );
  const carouselBboxW = Math.max(operativeSlotW, RULE_W);
  const carouselBboxH = Math.max(operativeSlotH, RULE_H);

  /** Play-mode Rules tab: all rule cards in the deck, plus a deduplicated
   *  list of every keyword that appears on any weapon, ability, or
   *  rule-card ability. Rules are sorted alphabetically and shown first;
   *  keywords follow, also alphabetised. Mirrors Halo's pattern. */
  const playRulesAndKeywords = (() => {
    type Item = { key: string; title: string; description: string };

    // Rule cards (alphabetical by title).
    const ruleItems: Item[] = cards
      .filter(c => c.cardType === 'rule')
      .map(c => ({
        key:         `rule-${c.id}`,
        title:       c.ruleTitle || 'Untitled Rule',
        description: c.ruleDescription || '',
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    // Keywords across weapons, abilities, and rule abilities (dedupe by
    // keywordId so the same keyword from multiple cards only shows once).
    const kwMap = new Map<string, { name: string; description: string }>();
    const collect = (kws: LocalKeywordAttachment[]) => {
      for (const k of kws) {
        if (!kwMap.has(k.keywordId)) {
          kwMap.set(k.keywordId, { name: k.keywordName, description: k.description });
        }
      }
    };
    for (const c of cards) {
      for (const w of c.weapons)   collect(w.weaponKeywords);
      for (const a of c.abilities) collect(a.abilityKeywords);
      if (c.ruleAbility) collect(c.ruleAbility.abilityKeywords);
    }
    const kwItems: Item[] = [...kwMap.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(k => ({ key: `kw-${k.name}`, title: k.name, description: k.description }));

    return [...ruleItems, ...kwItems];
  })();

  // ── Operative templates (Save-as-Template + NewCardModal picker) ───────
  // Operative cards (not rule cards) can be saved as user templates, then
  // reused when adding a new operative. Mirrors Halo's pattern exactly:
  // backed by `cards.is_template = true`, copies `card_addons` from the
  // source card. Rule cards intentionally stay one-offs (matches Halo).
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newCardModalOpen,  setNewCardModalOpen]  = useState(false);
  const [newCardTemplates,  setNewCardTemplates]  = useState<NewCardModalTemplate[]>([]);
  const [newRuleModalOpen,  setNewRuleModalOpen]  = useState(false);
  const [newRuleTemplates,  setNewRuleTemplates]  = useState<NewCardModalTemplate[]>([]);

  /** Local fallback when there are no templates (or the lookup fails). */
  const addBlankOperativeCard = () => {
    const card = defaultOperativeCard();
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
  };

  /** Add operative — if the user has operative templates for this game,
   *  open the NewCardModal picker; otherwise create a blank operative. */
  const addOperativeCard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addBlankOperativeCard(); return; }

      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'kill-team').single();
      if (!game) { addBlankOperativeCard(); return; }

      const [libRes, packsRes] = await Promise.all([
        supabase
          .from('cards')
          .select('id, name, card_addons(sort_order, addons(name)), card_keywords(sort_order, keywords(name))')
          .eq('user_id', user.id)
          .eq('game_id', game.id)
          .eq('is_template', true)
          .eq('card_type', 'operative')
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
          .eq('card_type', 'operative')
          .order('name');
        packTemplates = ((packCards ?? []) as unknown as (TemplateRow & { pack_id: string })[]).map(t => ({
          id: t.id, name: t.name, source: 'pack' as const, packName: packsMap.get(t.pack_id), addonSummary: addonSummaryFor(t),
        }));
      }

      const allTemplates = [...packTemplates, ...libTemplates];
      if (allTemplates.length === 0) { addBlankOperativeCard(); return; }

      setNewCardTemplates(allTemplates);
      setNewCardModalOpen(true);
    } catch (err) {
      console.error('[BattleCards] Failed to load templates:', err);
      addBlankOperativeCard();
    }
  };

  /** Save the active operative card as a reusable template. */
  const saveAsTemplate = async (templateName: string) => {
    if (activeCard.cardType !== 'operative') return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: game, error: gameErr } = await supabase
        .from('games').select('id').eq('slug', 'kill-team').single();
      if (gameErr || !game) throw gameErr ?? new Error('Game lookup failed');

      // Make sure the source card has a dbId so we can read its addons.
      const sourceDbId = await ensureCardSaved();

      const { data: tmpl, error: insertErr } = await supabase
        .from('cards')
        .insert({
          user_id:     user.id,
          game_id:     game.id,
          is_template: true,
          card_type:   'operative',
          name:        templateName,
          stats:       toKillTeamStats(activeCard),
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Copy card_addons (weapons + abilities) from the source card.
      if (sourceDbId) {
        const { data: srcAddons } = await supabase
          .from('card_addons')
          .select('addon_id, sort_order')
          .eq('card_id', sourceDbId);

        if (srcAddons && srcAddons.length > 0) {
          await supabase.from('card_addons').insert(
            srcAddons.map(a => ({
              card_id:    tmpl.id,
              addon_id:   a.addon_id,
              sort_order: a.sort_order,
            })),
          );
        }
      }

      setTemplateModalOpen(false);
    } catch (err) {
      console.error('[BattleCards] Failed to save template:', err);
    }
  };

  /** Create a new deck operative from a saved template — inserts the row,
   *  duplicates card_addons, then hydrates the local in-memory state so
   *  the carousel shows the new card with its weapons/abilities populated. */
  const createOperativeFromTemplate = async (templateId: string) => {
    if (!deckId) return;

    type AddonKeywordRow = {
      keyword_id: string;
      params: Record<string, unknown>;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
    };
    type TemplateRow = {
      name: string;
      stats: KillTeamStats;
      card_addons: {
        addon_id:   string;
        sort_order: number | null;
        addons: {
          name: string;
          description: string | null;
          stats: Record<string, unknown>;
          addon_type_id: string;
          addon_keywords: AddonKeywordRow[];
        } | null;
      }[];
    };

    const { data: tmpl, error } = await supabase
      .from('cards')
      .select('name, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))))')
      .eq('id', templateId)
      .single();
    if (error || !tmpl) { console.error('[BattleCards] Template fetch failed:', error); return; }

    const src = tmpl as unknown as TemplateRow;

    // Insert the new deck card.
    const { data: newRow, error: insertErr } = await supabase
      .from('cards')
      .insert({
        deck_id:    deckId,
        name:       src.name,
        card_type:  'operative',
        stats:      src.stats,
        sort_order: cards.length,
      })
      .select('id')
      .single();
    if (insertErr || !newRow) { console.error('[BattleCards] Card insert failed:', insertErr); return; }

    // Copy card_addons.
    const addons = src.card_addons ?? [];
    if (addons.length > 0) {
      await supabase.from('card_addons').insert(
        addons.map(a => ({ card_id: newRow.id, addon_id: a.addon_id, sort_order: a.sort_order })),
      );
    }

    // Resolve addon-type-id → slug so we can split addons into weapons vs
    // abilities the same way the loader does.
    const typeIdToSlug: Record<string, string> = {};
    {
      const { data: addonTypes } = await supabase
        .from('addon_types')
        .select('id, slug, games!inner(slug)')
        .eq('games.slug', 'kill-team');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });
    }

    // Hydrate the local in-memory state with weapons + abilities.
    const sortedAddons = [...addons]
      .filter(ca => ca.addons != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const weapons:   LocalWeapon[]   = [];
    const abilities: LocalAbility[]  = [];

    for (const ca of sortedAddons) {
      const addon = ca.addons!;
      const slug  = typeIdToSlug[addon.addon_type_id];
      const ws    = addon.stats;
      const addonKws = [...(addon.addon_keywords ?? [])]
        .filter(ak => ak.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const kws: LocalKeywordAttachment[] = addonKws.map(ak => ({
        keywordId:   ak.keyword_id,
        keywordName: ak.keywords!.name,
        description: ak.keywords!.description ?? '',
        hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
        paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
      }));

      if (slug === 'weapons') {
        const mr = ws.meleeOrRanged === 'melee' || ws.meleeOrRanged === 'ranged' ? ws.meleeOrRanged : '';
        weapons.push({
          addonId:        ca.addon_id,
          name:           addon.name,
          meleeOrRanged:  mr as 'melee' | 'ranged' | '',
          attack:         Number(ws.attack) || 0,
          hit:            Number(ws.hit) || 0,
          baseDamage:     Number(ws.baseDamage) || 0,
          critDamage:     Number(ws.critDamage) || 0,
          keywords:       buildKeywordsDisplayString(kws),
          weaponKeywords: kws,
        });
      } else if (slug === 'abilities') {
        abilities.push({
          addonId:         ca.addon_id,
          name:            addon.name,
          description:     addon.description ?? '',
          apCost:          Number(ws.apCost) || 0,
          keywords:        buildKeywordsDisplayString(kws),
          abilityKeywords: kws,
        });
      }
    }

    const s = (src.stats ?? {}) as KillTeamStats;
    const localCard: KillTeamCardData = {
      id:              crypto.randomUUID(),
      dbId:            newRow.id,
      cardType:        'operative',
      operativeName:   src.name,
      role:            s.role     ?? '',
      teamName:        s.teamName ?? '',
      tags:            s.tags     ?? '',
      actions:         Number(s.actions)  || 0,
      movement:        Number(s.movement) || 0,
      save:            Number(s.save)     || 0,
      wounds:          Number(s.wounds)   || 0,
      baseSize:        Number(s.baseSize) || 0,
      weapons,
      abilities,
      ruleTitle:       '',
      ruleDescription: '',
      ruleAbility:     null,
      portraitUrl:     null,
      portraitStyle:   null,
      avatarUrl:       null,
      tokenState:      {},
    };

    setCardState(s2 => ({ cards: [...s2.cards, localCard], activeCardId: localCard.id }));
    setNewCardModalOpen(false);
  };

  /** Delete a template row (called from the NewCardModal item ⋯ menu). */
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

  const addRuleCard = () => {
    const card = defaultRuleCard();
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
  };

  // ── Rule template picker (mirrors addOperativeCard / createOperativeFromTemplate) ──

  const addRuleCardWithModal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addRuleCard(); return; }

      const { data: game } = await supabase
        .from('games').select('id').eq('slug', 'kill-team').single();
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

    type AddonKeywordRow = {
      keyword_id: string;
      params: Record<string, unknown>;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
    };
    type RuleTemplateRow = {
      name: string;
      stats: KillTeamStats;
      card_addons: {
        addon_id:   string;
        sort_order: number | null;
        addons: {
          name: string;
          description: string | null;
          stats: Record<string, unknown>;
          addon_type_id: string;
          addon_keywords: AddonKeywordRow[];
        } | null;
      }[];
    };

    const { data: tmpl, error } = await supabase
      .from('cards')
      .select('name, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))))')
      .eq('id', templateId)
      .single();
    if (error || !tmpl) { console.error('[BattleCards] Rule template fetch failed:', error); return; }

    const src = tmpl as unknown as RuleTemplateRow;

    const { data: newRow, error: insertErr } = await supabase
      .from('cards')
      .insert({
        deck_id:    deckId,
        name:       src.name,
        card_type:  'rule',
        stats:      src.stats,
        sort_order: cards.length,
      })
      .select('id')
      .single();
    if (insertErr || !newRow) { console.error('[BattleCards] Rule card insert failed:', insertErr); return; }

    const addons = src.card_addons ?? [];
    if (addons.length > 0) {
      await supabase.from('card_addons').insert(
        addons.map(a => ({ card_id: newRow.id, addon_id: a.addon_id, sort_order: a.sort_order })),
      );
    }

    const typeIdToSlug: Record<string, string> = {};
    {
      const { data: addonTypes } = await supabase
        .from('addon_types')
        .select('id, slug, games!inner(slug)')
        .eq('games.slug', 'kill-team');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });
    }

    const sortedAddons = [...addons]
      .filter(ca => ca.addons != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    let ruleAbility: LocalAbility | null = null;
    for (const ca of sortedAddons) {
      const addon = ca.addons!;
      if (typeIdToSlug[addon.addon_type_id] !== 'abilities') continue;
      const ws = addon.stats;
      const addonKws = [...(addon.addon_keywords ?? [])]
        .filter(ak => ak.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const kws: LocalKeywordAttachment[] = addonKws.map(ak => ({
        keywordId:   ak.keyword_id,
        keywordName: ak.keywords!.name,
        description: ak.keywords!.description ?? '',
        hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
        paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
      }));
      ruleAbility = {
        addonId:         ca.addon_id,
        name:            addon.name,
        description:     addon.description ?? '',
        apCost:          Number(ws.apCost) || 0,
        keywords:        buildKeywordsDisplayString(kws),
        abilityKeywords: kws,
      };
      break;
    }

    const localCard: KillTeamCardData = {
      id:              crypto.randomUUID(),
      dbId:            newRow.id,
      cardType:        'rule',
      operativeName:   '',
      role:            '',
      teamName:        '',
      tags:            '',
      actions:         0,
      movement:        0,
      save:            0,
      wounds:          0,
      baseSize:        0,
      weapons:         [],
      abilities:       [],
      ruleTitle:       src.name,
      ruleDescription: String((src.stats as Record<string, unknown>)?.description ?? ''),
      ruleAbility,
      portraitUrl:     null,
      portraitStyle:   null,
      avatarUrl:       null,
      tokenState:      {},
    };

    setCardState(s2 => ({ cards: [...s2.cards, localCard], activeCardId: localCard.id }));
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
      return { cards: nextCards, activeCardId: nextActiveCardId };
    });

    dirtyCardsRef.current.delete(cardId);

    if (cardToDelete?.dbId) {
      const { error } = await supabase.from('cards').delete().eq('id', cardToDelete.dbId);
      if (error) console.error('[BattleCards] Failed to delete card:', error);
    }
  };

  const [deleteCardConfirmOpen, setDeleteCardConfirmOpen] = useState(false);
  const [cardPendingDelete, setCardPendingDelete] = useState<KillTeamCardData | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

  const requestDeleteCard = (card: KillTeamCardData) => {
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

  /** Propagate a keyword definition update across ALL cards (weapons + abilities). */
  const propagateKeywordUpdate = useCallback((keywordId: string, newName: string, newDescription: string, newHasParams: boolean) => {
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        let changed = false;

        const newWeapons = c.weapons.map(w => {
          const newWkws = w.weaponKeywords.map(k => {
            if (k.keywordId !== keywordId) return k;
            changed = true;
            return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
          });
          if (newWkws === w.weaponKeywords) return w;
          return { ...w, weaponKeywords: newWkws, keywords: buildKeywordsDisplayString(newWkws) };
        });

        const newAbilities = c.abilities.map(a => {
          const newAkws = a.abilityKeywords.map(k => {
            if (k.keywordId !== keywordId) return k;
            changed = true;
            return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
          });
          if (newAkws === a.abilityKeywords) return a;
          return { ...a, abilityKeywords: newAkws, keywords: buildKeywordsDisplayString(newAkws) };
        });

        // Also propagate into a rule card's attached ability, if any.
        let newRuleAbility = c.ruleAbility;
        if (newRuleAbility) {
          const newRkws = newRuleAbility.abilityKeywords.map(k => {
            if (k.keywordId !== keywordId) return k;
            changed = true;
            return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
          });
          if (newRkws !== newRuleAbility.abilityKeywords) {
            newRuleAbility = { ...newRuleAbility, abilityKeywords: newRkws, keywords: buildKeywordsDisplayString(newRkws) };
          }
        }

        if (!changed) return c;
        dirtyCardsRef.current.add(c.id);
        return { ...c, weapons: newWeapons, abilities: newAbilities, ruleAbility: newRuleAbility };
      }),
    }));
  }, []);

  /** Called by the addon forms after they sync addon_keywords to the DB —
   *  refresh every LocalWeapon / LocalAbility / ruleAbility that uses this
   *  addonId so keyword edits land on the card without a reload. */
  const handleAddonKeywordsSaved = useCallback((addonId: string, kws: LocalKeywordAttachment[]) => {
    const display = buildKeywordsDisplayString(kws);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        let changed = false;
        const newWeapons = c.weapons.map(w => {
          if (w.addonId !== addonId) return w;
          changed = true;
          return { ...w, weaponKeywords: kws, keywords: display };
        });
        const newAbilities = c.abilities.map(a => {
          if (a.addonId !== addonId) return a;
          changed = true;
          return { ...a, abilityKeywords: kws, keywords: display };
        });
        let newRuleAbility = c.ruleAbility;
        if (newRuleAbility && newRuleAbility.addonId === addonId) {
          changed = true;
          newRuleAbility = { ...newRuleAbility, abilityKeywords: kws, keywords: display };
        }
        if (!changed) return c;
        dirtyCardsRef.current.add(c.id);
        return { ...c, weapons: newWeapons, abilities: newAbilities, ruleAbility: newRuleAbility };
      }),
    }));
  }, []);

  // Snapshot of a create-form's keyword selection at save-time. The forms
  // hand these over via `onPendingKeywords` right before their onSave fires
  // (and clear with [] after the save settles); handleWeaponAdded /
  // handleAbilityAdded — which run mid-onSave, before the addon_keywords
  // sync lands — read them here to seed the new in-memory addon's keywords.
  const pendingNewAddonKeywordsRef = useRef<LocalKeywordAttachment[]>([]);

  // Bind the extracted forms to this builder's context (the pending-keywords
  // side-channel, the post-sync broadcast, and the cross-card propagation
  // hook) so AddAddonModal — which only knows the bare AddonFormProps
  // contract — can render them without each call-site re-supplying these.
  // Stable identity via useCallback so AddAddonModal doesn't re-mount the
  // form on every render.
  const WeaponFormWithContext = useCallback(
    (props: AddonFormProps) => (
      <KillTeamWeaponForm
        {...props}
        onPendingKeywords={kws => { pendingNewAddonKeywordsRef.current = kws; }}
        onKeywordsSaved={handleAddonKeywordsSaved}
        onPropagateKeywordUpdate={propagateKeywordUpdate}
      />
    ),
    [handleAddonKeywordsSaved, propagateKeywordUpdate],
  );

  const AbilityFormWithContext = useCallback(
    (props: AddonFormProps) => (
      <KillTeamAbilityForm
        {...props}
        onPendingKeywords={kws => { pendingNewAddonKeywordsRef.current = kws; }}
        onKeywordsSaved={handleAddonKeywordsSaved}
        onPropagateKeywordUpdate={propagateKeywordUpdate}
      />
    ),
    [handleAddonKeywordsSaved, propagateKeywordUpdate],
  );

  // Deck-name inline rename is owned by useCardBuilder (above). The hook's
  // commitDeckName persists by default; we pass `{ persist: !editMode }` at
  // the call site so the "Done" button keeps batching saves itself.

  // ── Drag reorder handlers ──────────────────────────────────────────────────
  const handleDragStart = useCallback((index: number) => { dragItemRef.current = index; }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverRef.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
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

  // ── Done editing — persist order + deck name ───────────────────────────────
  const handleDoneEditing = useCallback(async () => {
    if (!deckId) { setEditMode(false); return; }
    setSavingEdits(true);
    try {
      await supabase.from('decks').update({ name: deckName || 'Untitled' }).eq('id', deckId);
      await Promise.all(
        cards.map((card, i) => {
          if (!card.dbId) return Promise.resolve();
          return supabase.from('cards').update({ sort_order: i }).eq('id', card.dbId);
        }),
      );
    } catch (err) {
      console.error('[BattleCards] Failed to save edit mode changes:', err);
    } finally {
      setSavingEdits(false);
      setEditMode(false);
    }
  }, [deckId, deckName, cards]);

  // ── Load deck + cards on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;

    supabase.from('decks').select('name').eq('id', deckId).single()
      .then(({ data }) => { if (data) setDeckName(data.name); });

    type AddonKeywordRow = {
      keyword_id: string;
      params: Record<string, unknown>;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
    };
    type CardRow = {
      id: string; name: string; card_type: 'operative' | 'rule' | null;
      stats: KillTeamStats & { description?: string };
      portrait_style: string | null;
      card_addons: {
        addon_id: string;
        sort_order: number | null;
        addons: {
          name: string;
          description: string | null;
          stats: Record<string, unknown>;
          addon_type_id: string;
          addon_keywords: AddonKeywordRow[];
        } | null;
      }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
    };

    // Resolve addon_type IDs for the kill-team game so we can split addons by type
    supabase
      .from('addon_types')
      .select('id, slug, games!inner(slug)')
      .eq('games.slug', 'kill-team')
      .then(({ data: addonTypes }) => {
        const typeIdToSlug: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });

        supabase
          .from('cards')
          .select('id, name, card_type, stats, portrait_style, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type)')
          .eq('deck_id', deckId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .then(({ data, error }) => {
            if (error) { console.error('[BattleCards] Failed to load cards:', error); return; }
            if (!data || data.length === 0) return;

            const loaded = (data as unknown as CardRow[]).map(row => {
              const s = row.stats ?? {};

              const sortedAddons = [...(row.card_addons ?? [])]
                .filter(ca => ca.addons != null)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

              const allImages = row.card_images ?? [];
              const portraitImg = allImages.find(i => i.image_type === 'portrait');
              const avatarImg   = allImages.find(i => i.image_type === 'avatar');

              let portraitUrl: string | null = null;
              if (portraitImg) {
                const { data: urlData } = supabase.storage.from('card-images').getPublicUrl(portraitImg.file_path);
                portraitUrl = urlData.publicUrl;
              }
              let avatarUrl: string | null = null;
              if (avatarImg) {
                const { data: urlData } = supabase.storage.from('card-images').getPublicUrl(avatarImg.file_path);
                avatarUrl = urlData.publicUrl;
              }

              const weapons: LocalWeapon[] = [];
              const abilities: LocalAbility[] = [];

              for (const ca of sortedAddons) {
                const addon = ca.addons!;
                const addonKws = [...(addon.addon_keywords ?? [])]
                  .filter(ak => ak.keywords != null)
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                const localKws: LocalKeywordAttachment[] = addonKws.map(ak => ({
                  keywordId:   ak.keyword_id,
                  keywordName: ak.keywords!.name,
                  description: ak.keywords!.description ?? '',
                  hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
                  paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
                }));

                const slug = typeIdToSlug[addon.addon_type_id];
                const ws = addon.stats;

                if (slug === 'weapons') {
                  const mr = ws.meleeOrRanged === 'melee' || ws.meleeOrRanged === 'ranged' ? ws.meleeOrRanged : '';
                  const dmg = parseDamageParts(ws);
                  weapons.push({
                    addonId:       ca.addon_id,
                    name:          addon.name,
                    meleeOrRanged: mr as 'melee' | 'ranged' | '',
                    attack:        Number(ws.attack) || 0,
                    hit:           parseHit(ws.hit),
                    baseDamage:    dmg.base,
                    critDamage:    dmg.crit,
                    keywords:      buildKeywordsDisplayString(localKws),
                    weaponKeywords: localKws,
                  });
                } else if (slug === 'abilities') {
                  abilities.push({
                    addonId:         ca.addon_id,
                    name:            addon.name,
                    description:     addon.description ?? '',
                    apCost:          Number(ws.apCost) || 0,
                    keywords:        buildKeywordsDisplayString(localKws),
                    abilityKeywords: localKws,
                  });
                }
              }

              // Coerce stat values to ints. JSONB preserves whatever was
              // originally stored, so cards saved before the int migration
              // (when movement/save were strings like '6"' / '3+') still
              // round-trip cleanly — parseInt strips the trailing suffix.
              const num = (v: unknown): number => {
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                const n = parseInt(String(v ?? ''), 10);
                return Number.isFinite(n) ? n : 0;
              };

              const cardType: 'operative' | 'rule' = row.card_type === 'rule' ? 'rule' : 'operative';

              if (cardType === 'rule') {
                return {
                  id:              row.id,
                  dbId:            row.id,
                  cardType:        'rule',
                  operativeName:   '',
                  role:            '',
                  teamName:        '',
                  tags:            '',
                  actions:         0,
                  movement:        0,
                  save:            0,
                  wounds:          0,
                  baseSize:        0,
                  weapons:         [],
                  abilities:       [],
                  ruleTitle:       row.name,
                  ruleDescription: s.description ?? '',
                  ruleAbility:     abilities[0] ?? null,
                  portraitUrl,
                  portraitStyle:   row.portrait_style ?? null,
                  avatarUrl,
                  tokenState:      {},
                } as KillTeamCardData;
              }

              return {
                id:              row.id,
                dbId:            row.id,
                cardType:        'operative',
                operativeName:   row.name,
                role:            s.role     ?? '',
                teamName:        s.teamName ?? '',
                tags:            s.tags     ?? '',
                actions:         num(s.actions),
                movement:        num(s.movement),
                save:            num(s.save),
                wounds:          num(s.wounds),
                baseSize:        num(s.baseSize),
                weapons,
                abilities,
                ruleTitle:       '',
                ruleDescription: '',
                ruleAbility:     null,
                portraitUrl,
                portraitStyle:   row.portrait_style ?? null,
                avatarUrl,
                tokenState:      {},
              } as KillTeamCardData;
            });
            setCardState({ cards: loaded, activeCardId: loaded[0].id });
          });
      });
  }, [deckId]);

  // ── Auto-save (debounced 1s) ───────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || dirtyCardsRef.current.size === 0) return;

    const dirty = new Set(dirtyCardsRef.current);
    const timer = setTimeout(async () => {
      dirtyCardsRef.current.clear();

      for (let ci = 0; ci < cards.length; ci++) {
        const card = cards[ci];
        if (!dirty.has(card.id) || isKillTeamCardBlank(card)) continue;

        await withRetry(async () => {
          let dbId = card.dbId;

          if (!dbId) {
            const { data, error } = await supabase
              .from('cards')
              .insert({
                deck_id: deckId,
                name: cardDisplayName(card),
                card_type: card.cardType,
                stats: toKillTeamStats(card),
                portrait_style: card.portraitStyle,
                sort_order: ci,
              })
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
              .update({
                name: cardDisplayName(card),
                card_type: card.cardType,
                stats: toKillTeamStats(card),
                portrait_style: card.portraitStyle,
                sort_order: ci,
              })
              .eq('id', dbId);
            if (error) throw error;
          }

          // Sync card_addons. Operatives get all weapons + abilities; rules
          // get the optional single attached ability.
          await supabase.from('card_addons').delete().eq('card_id', dbId);
          const allAddons = card.cardType === 'rule'
            ? (card.ruleAbility ? [card.ruleAbility.addonId] : [])
            : [
                ...card.weapons.map(w => w.addonId),
                ...card.abilities.map(a => a.addonId),
              ];
          if (allAddons.length > 0) {
            const { error } = await supabase.from('card_addons').insert(
              allAddons.map((addonId, i) => ({ card_id: dbId!, addon_id: addonId, sort_order: i })),
            );
            if (error) throw error;
          }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [cards, deckId]);

  // ── Ensure card is saved (needed before image upload) ──────────────────────
  const ensureCardSaved = async (): Promise<string | null> => {
    if (activeCard.dbId) return activeCard.dbId;
    if (!deckId) return null;
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          deck_id: deckId,
          name: cardDisplayName(activeCard),
          card_type: activeCard.cardType,
          stats: toKillTeamStats(activeCard),
          portrait_style: activeCard.portraitStyle,
        })
        .select('id')
        .single();
      if (error) throw error;
      setCardState(s => ({
        ...s,
        cards: s.cards.map(c => c.id === activeCard.id ? { ...c, dbId: data.id } : c),
      }));
      return data.id;
    } catch {
      return null;
    }
  };

  // ── Modal state ────────────────────────────────────────────────────────────
  const [weaponModalOpen,   setWeaponModalOpen]   = useState(false);
  const [abilityModalOpen,  setAbilityModalOpen]  = useState(false);
  const [photoModalOpen,    setPhotoModalOpen]    = useState(false);
  const [deletePortraitConfirm, setDeletePortraitConfirm] = useState(false);
  const [deletingPortrait,  setDeletingPortrait]  = useState(false);

  // ── Addon info / edit modal state ──────────────────────────────────────────
  const [viewingWeapon,        setViewingWeapon]        = useState<LocalWeapon | null>(null);
  const [viewingAbility,       setViewingAbility]       = useState<LocalAbility | null>(null);
  const [editingWeaponAddon,   setEditingWeaponAddon]   = useState<Addon | null>(null);
  const [editingAbilityAddon,  setEditingAbilityAddon]  = useState<Addon | null>(null);
  const [savingWeaponEdit,     setSavingWeaponEdit]     = useState(false);
  const [savingAbilityEdit,    setSavingAbilityEdit]    = useState(false);

  /** Keyword being edited via the card's KeywordInfoModal "Edit Keyword"
   *  button. Resolved from the active card's weapons / abilities by name
   *  and fed to a builder-level <AddKeywordModal>. Edits propagate to
   *  every card via propagateKeywordUpdate (already wired). */
  const [editingCardKeyword, setEditingCardKeyword] = useState<LocalKeywordAttachment | null>(null);

  // ── Custom token (UCT) modal state ─────────────────────────────────────
  // null = create flow, TokenDefinition = edit flow. Opening the modal
  // either way uses the same component (`CustomTokenModal`).
  const [customTokenModalOpen, setCustomTokenModalOpen] = useState(false);
  const [editingCustomToken, setEditingCustomToken]     = useState<TokenDefinition | null>(null);

  /** Open the create flow — clean slate. */
  const openCreateCustomToken = () => {
    setEditingCustomToken(null);
    setCustomTokenModalOpen(true);
  };

  /** Open the edit flow pre-filled with an existing UCT. */
  const openEditCustomToken = (def: TokenDefinition) => {
    setEditingCustomToken(def);
    setCustomTokenModalOpen(true);
  };

  /** Save (insert or update) a UCT and refresh the definitions list.
   *
   *  Throws a `CustomTokenSaveError` on validation failures so the modal
   *  can surface them inline (matches the existing form-error pattern via
   *  Input's `state="error"` + `helperText`). Postgres unique-violations
   *  (code 23505) on the (deck_id, name) index get translated to a "name
   *  already in use" message; everything else falls through with a
   *  generic message. */
  const saveCustomToken = async (value: {
    name: string; description: string; color: string; glyph: string;
  }) => {
    if (!deckId) return;
    const { data: game } = await supabase
      .from('games').select('id').eq('slug', 'kill-team').single();
    if (!game) throw new CustomTokenSaveError('Game lookup failed.');

    let dbErr: { code?: string; message?: string } | null = null;
    if (editingCustomToken) {
      const { error } = await supabase
        .from('token_definitions')
        .update({
          name:          value.name,
          description:   value.description || null,
          display_color: value.color,
          display_glyph: value.glyph,
        })
        .eq('id', editingCustomToken.id);
      dbErr = error;
    } else {
      const { error } = await supabase
        .from('token_definitions')
        .insert({
          game_id:        game.id,
          deck_id:        deckId,
          name:           value.name,
          description:    value.description || null,
          // UCTs are always stacking counters in v1 — leave the toggle /
          // stat-link / refresh-on-turn fields at their defaults.
          is_toggle:      false,
          starting_value: 0,
          min_value:      0,
          display_color:  value.color,
          display_glyph:  value.glyph,
          // Explicit display style so the renderer routes off this
          // column alone (vs inferring from display_color presence).
          display_style:  'badge',
        });
      dbErr = error;
    }

    if (dbErr) {
      console.error('[BattleCards] Failed to save custom token:', dbErr);
      if (dbErr.code === '23505') {
        // The partial unique index on (deck_id, name) fires when the user
        // tries to create or rename a UCT to a name that already exists
        // in this deck. Surface it under the Name field.
        throw new CustomTokenSaveError(
          'A token with this name already exists in this deck.',
          'name',
        );
      }
      throw new CustomTokenSaveError(dbErr.message || 'Failed to save token.');
    }

    await reloadTokenDefinitions();
    setCustomTokenModalOpen(false);
    setEditingCustomToken(null);
  };

  /** Delete a UCT — also clears its per-card state so orphaned values
   *  don't linger in tokenState records. */
  const deleteCustomToken = async () => {
    if (!editingCustomToken) return;
    try {
      const tokenId = editingCustomToken.id;
      const { error } = await supabase
        .from('token_definitions').delete().eq('id', tokenId);
      if (error) throw error;

      // Strip the now-orphaned state from every card.
      setCardState(s => ({
        ...s,
        cards: s.cards.map(c => {
          if (!(tokenId in c.tokenState)) return c;
          const next = { ...c.tokenState };
          delete next[tokenId];
          return { ...c, tokenState: next };
        }),
      }));

      await reloadTokenDefinitions();
      setCustomTokenModalOpen(false);
      setEditingCustomToken(null);
    } catch (err) {
      console.error('[BattleCards] Failed to delete custom token:', err);
    }
  };

  const handleWeaponAdded = (addon: Addon) => {
    const s = addon.stats as Record<string, unknown>;
    const mr = s.meleeOrRanged === 'melee' || s.meleeOrRanged === 'ranged' ? s.meleeOrRanged : '';
    const dmg = parseDamageParts(s);
    // Pull the form's freshly-attached keywords from the pending ref
    // (see pendingNewAddonKeywordsRef). For an existing addon picked from
    // the library this will be empty — see TODO below to load those eagerly.
    const initialKws = pendingNewAddonKeywordsRef.current;
    const weapon: LocalWeapon = {
      addonId:       addon.id,
      name:          addon.name,
      meleeOrRanged: mr as 'melee' | 'ranged' | '',
      attack:        Number(s.attack) || 0,
      hit:           parseHit(s.hit),
      baseDamage:    dmg.base,
      critDamage:    dmg.crit,
      keywords:      buildKeywordsDisplayString(initialKws),
      weaponKeywords: [...initialKws],
    };
    updateActiveCard({ weapons: [...activeCard.weapons, weapon] });
  };

  const handleWeaponDeleted = (addonId: string) => {
    cards.forEach(c => {
      if (c.weapons.some(w => w.addonId === addonId)) dirtyCardsRef.current.add(c.id);
    });
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => ({ ...c, weapons: c.weapons.filter(w => w.addonId !== addonId) })),
    }));
  };

  const handleAbilityAdded = (addon: Addon) => {
    const s = addon.stats as Record<string, unknown>;
    // Same keyword hand-off pattern as handleWeaponAdded.
    const initialKws = pendingNewAddonKeywordsRef.current;
    const ability: LocalAbility = {
      addonId:         addon.id,
      name:            addon.name,
      description:     addon.description ?? '',
      apCost:          Number(s.apCost) || 0,
      keywords:        buildKeywordsDisplayString(initialKws),
      abilityKeywords: [...initialKws],
    };
    if (activeCard.cardType === 'rule') {
      // Rule cards take exactly one ability — replace any existing.
      updateActiveCard({ ruleAbility: ability });
    } else {
      updateActiveCard({ abilities: [...activeCard.abilities, ability] });
    }
  };

  const handleAbilityDeleted = (addonId: string) => {
    cards.forEach(c => {
      if (c.abilities.some(a => a.addonId === addonId)) dirtyCardsRef.current.add(c.id);
      if (c.ruleAbility?.addonId === addonId) dirtyCardsRef.current.add(c.id);
    });
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => ({
        ...c,
        abilities:   c.abilities.filter(a => a.addonId !== addonId),
        ruleAbility: c.ruleAbility?.addonId === addonId ? null : c.ruleAbility,
      })),
    }));
  };

  // ── Remove portrait handler ────────────────────────────────────────────────
  const handleDeletePortrait = async () => {
    if (!activeCard.dbId) return;
    setDeletingPortrait(true);
    try {
      const { data: images } = await supabase
        .from('card_images')
        .select('id, file_path')
        .eq('card_id', activeCard.dbId);

      if (images && images.length > 0) {
        const paths = images.map(img => img.file_path);
        await supabase.storage.from('card-images').remove(paths);
        await supabase.from('card_images').delete().eq('card_id', activeCard.dbId);
      }

      await supabase.from('cards').update({ portrait_style: null }).eq('id', activeCard.dbId);
      updateActiveCard({ portraitUrl: null, portraitStyle: null });
      setDeletePortraitConfirm(false);
    } catch (err) {
      console.error('[BattleCards] Failed to delete portrait:', err);
    } finally {
      setDeletingPortrait(false);
    }
  };

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
        // Play mode → Units/Rules tabs. Edit mode → mobile-only panel
        // toggles (Open Card List / Open Editor). Both feed the universal
        // responsive collapse behaviour from useCardBuilder.
        appMode === 'play' ? (
          <PlaySubnav tab={playTab} onTabChange={handlePlayTabChange} />
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
        <CardListPanel
          deckName={deckName}
          editingDeckName={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={(n) => commitDeckName(n, { persist: !editMode })}
          onCancelEdit={() => setEditingDeckName(false)}
          headerAction={
            appMode === 'edit' ? (
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
            ) : undefined
          }
          footer={
            appMode === 'edit' ? (
              editMode ? (
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
                <div className="flex flex-col gap-2">
                  <Button
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addOperativeCard}
                  >
                    Add Operative
                  </Button>
                  <Button
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addRuleCardWithModal}
                  >
                    Add Rule Card
                  </Button>
                </div>
              )
            ) : undefined
          }
        >
          <nav className="flex flex-col gap-1">
            {(() => {
              // Render a single card row. `dragIndex` is the card's index
              // in the full `cards` array (used by edit-mode drag handlers);
              // pass -1 in play mode where drag handlers don't fire anyway.
              const renderRow = (card: KillTeamCardData, dragIndex: number) => (
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
                      unitName={
                        card.cardType === 'rule'
                          ? (card.ruleTitle || undefined)
                          : (card.operativeName || undefined)
                      }
                      unitType={
                        card.cardType === 'rule'
                          ? 'Faction Rule'
                          : (card.role || undefined)
                      }
                      addonSummary={card.cardType !== 'rule'
                        ? ([...card.weapons.map(w => w.name), ...card.abilities.map(a => a.name)].filter(Boolean).join(', ') || undefined)
                        : undefined}
                      avatarSrc={card.avatarUrl ?? iconKillTeam}
                      active={card.id === activeCardId}
                      activated={appMode === 'play' && isCardActivated(card)}
                      onClick={() => setCardState(s => ({ ...s, activeCardId: card.id }))}
                    />
                  </div>
                  {editMode && (
                    <button
                      type="button"
                      aria-label={`Delete ${cardDisplayName(card)}`}
                      onClick={e => {
                        e.stopPropagation();
                        requestDeleteCard(card);
                      }}
                      disabled={cards.length <= 1}
                      className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={cards.length <= 1 ? 'At least one card is required' : 'Delete card'}
                    >
                      <TrashBinMinimalistic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );

              // Edit mode (and any non-play state): flat deck order so drag
              // reordering tracks the user's intended position.
              if (appMode !== 'play') {
                return cards.map((card, i) => renderRow(card, i));
              }

              // Play mode: three groups — non-activated operatives, then an
              // Activated sub-section (only when populated), then rule
              // cards pinned to the very bottom of the list.
              const nonActivatedOps: KillTeamCardData[] = [];
              const activatedOps:    KillTeamCardData[] = [];
              const ruleCards:       KillTeamCardData[] = [];
              for (const c of cards) {
                if (c.cardType === 'rule') ruleCards.push(c);
                else if (isCardActivated(c)) activatedOps.push(c);
                else nonActivatedOps.push(c);
              }

              return (
                <>
                  {nonActivatedOps.map(card => renderRow(card, -1))}

                  {activatedOps.length > 0 && (
                    <>
                      <h3
                        key="activated-header"
                        className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]"
                      >
                        <span>Activated</span>
                        <span className="flex-1 h-px bg-gray-700" />
                      </h3>
                      {activatedOps.map(card => renderRow(card, -1))}
                    </>
                  )}

                  {ruleCards.length > 0 && (
                    <>
                      <h3
                        key="rules-header"
                        className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]"
                      >
                        <span>Rules</span>
                        <span className="flex-1 h-px bg-gray-700" />
                      </h3>
                      {ruleCards.map(card => renderRow(card, -1))}
                    </>
                  )}
                </>
              );
            })()}
          </nav>
        </CardListPanel>
      }
      center={
        /* ── Center: card display ──────────────────────────────────────────
            • Play mode + Rules tab → replace the carousel with a searchable
              list of every rule card + deduplicated keyword in the deck.
            • Everything else (edit, play+units) → the universal
              `CardCarousel` (3D tilt + zoom + swipe + fit). */
        appMode === 'play' && playTab === 'rules' ? (
          <main className="order-1 md:order-2 flex-1 flex flex-col overflow-hidden bg-gray-950">
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
          logo={<img src={logoKillTeam} alt="Kill Team" className="h-10 w-auto" />}
          mobilePanelOpen={mobilePanelOpen}
          isShortHeight={isShortHeight}
          isMobile={isMobile}
        >
          <CardCarousel
            items={cards}
            activeId={activeCardId}
            onActiveChange={(id) => setCardState(s => ({ ...s, activeCardId: id }))}
            cardWidth={carouselBboxW}
            cardHeight={carouselBboxH}
            getItemDimensions={dimsForCard}
            // Mobile: fill the available viewport — the portrait layout already
            // sits within a tight column with no adjacent-slot competition.
            // Desktop keeps 0.85 to leave breathing room for the adjacent
            // prev/next slots and the hover-tilt shadow.
            initialZoom={isMobile ? 1.0 : 0.85}
            // Mobile: drop the "Zoom In/Out" labels (icons only); in play
            // mode also slot the zoom buttons into the bottom overlay strip
            // between New Turn (left) and Token menu (right) instead of a
            // dedicated row below the carousel.
            compactZoomControls={isMobile}
            zoomControlsInline={isMobile && appMode === 'play'}
            bottomLeftSlot={
              appMode === 'play' && playTab === 'units' && tokenDefinitions.some(d => d.refresh_on_turn !== 0) ? (
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
              // Show the menu whenever we have a deck (so the user can
              // create UCTs) AND the active card is an operative. The
              // menu hides itself if there's nothing to do.
              appMode === 'play' && playTab === 'units' &&
              activeCard.cardType === 'operative' ? (
                <TokenMenu
                  tokenDefinitions={tokenDefinitions}
                  card={{
                    stats: { wounds: activeCard.wounds },
                    unitKeywords: activeCard.weapons.flatMap(w => w.weaponKeywords).map(k => ({
                      keywordName: k.keywordName,
                      paramValue:  k.paramValue,
                    })),
                  }}
                  tokenState={activeCard.tokenState}
                  onTokenChange={handleTokenChange}
                  onAddCustomToken={deckId ? openCreateCustomToken : undefined}
                  onEditCustomToken={openEditCustomToken}
                />
              ) : null
            }
            renderItem={(card, role) => {
              const isActive = role === 'active';

              if (card.cardType === 'rule') {
                return (
                  <KillTeamRuleCard
                    title={card.ruleTitle || 'Rule Title'}
                    description={card.ruleDescription}
                    ability={card.ruleAbility ? {
                      name:        card.ruleAbility.name,
                      description: card.ruleAbility.description,
                      apCost:      card.ruleAbility.apCost,
                      keywords:    card.ruleAbility.keywords,
                    } : null}
                    {...(isActive ? {
                      onTitleChange:       (v: string) => updateActiveCard({ ruleTitle: v }),
                      onDescriptionChange: (v: string) => updateActiveCard({ ruleDescription: v }),
                      onAbilityClick: () => {
                        if (card.ruleAbility) setViewingAbility(card.ruleAbility);
                      },
                    } : {})}
                  />
                );
              }

              return (
                <KillTeamCard
                  operativeName={card.operativeName || 'Operative Name'}
                  role={card.role}
                  teamName={card.teamName || 'Team Name'}
                  tags={card.tags}
                  actions={card.actions}
                  movement={card.movement}
                  save={card.save}
                  wounds={card.wounds}
                  baseSize={card.baseSize}
                  portrait={card.portraitUrl ?? undefined}
                  weapons={card.weapons.map(w => ({
                    name:          w.name,
                    meleeOrRanged: w.meleeOrRanged,
                    attack:        w.attack,
                    hit:           formatHit(w.hit),
                    damage:        formatDamage(w.baseDamage, w.critDamage),
                    keywords:      w.keywords,
                    keywordData:   w.weaponKeywords.map(k => ({
                      label:       k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                      name:        k.keywordName,
                      description: k.description,
                    })),
                  }))}
                  abilities={card.abilities.map(a => ({
                    name:        a.name,
                    description: a.description,
                    apCost:      a.apCost,
                    keywords:    a.keywords,
                  }))}
                  // Inline-edit + click handlers only on the active slot
                  {...(isActive ? {
                    onOperativeNameChange: (v: string) => updateActiveCard({ operativeName: v }),
                    onRoleChange:          (v: string) => updateActiveCard({ role: v }),
                    onTagsChange:          (v: string) => updateActiveCard({ tags: v }),
                    onActionsChange:       (v: number) => updateActiveCard({ actions: v }),
                    onMovementChange:      (v: number) => updateActiveCard({ movement: v }),
                    onSaveChange:          (v: number) => updateActiveCard({ save: v }),
                    onWoundsChange:        (v: number) => updateActiveCard({ wounds: v }),
                    onWeaponClick: (w: { name: string }) => {
                      const match = card.weapons.find(x => x.name === w.name);
                      if (match) setViewingWeapon(match);
                    },
                    onAbilityClick: (a: { name: string }) => {
                      const match = card.abilities.find(x => x.name === a.name);
                      if (match) setViewingAbility(match);
                    },
                    onEditKeyword: (kw: { name: string; description: string }) => {
                      // Look for the keyword across weapons + abilities of
                      // the active card. First match wins — propagation
                      // covers the rest of the deck.
                      for (const w of card.weapons) {
                        const found = w.weaponKeywords.find(k => k.keywordName === kw.name);
                        if (found) { setEditingCardKeyword(found); return; }
                      }
                      for (const a of card.abilities) {
                        const found = a.abilityKeywords.find(k => k.keywordName === kw.name);
                        if (found) { setEditingCardKeyword(found); return; }
                      }
                    },
                  } : {})}
                  tokenOverlay={buildTokenOverlayProp(card)}
                />
              );
            }}
            className="w-full flex-1 min-h-0"
            layoutDeps={[...layoutDeps, appMode, playTab]}
          />
        </CenterViewport>
        )
      }
      rightPanelOpen={editorOpen}
      rightPanel={appMode === 'edit' ? (
        <EditorPanel title="Edit Card">

            {activeCard.cardType === 'rule' ? (
              <>
                {/* ── Rule card editor ──────────────────────────────────── */}
                <section className="space-y-3">
                  <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Faction Rule
                  </p>
                  <Input
                    label="Title"
                    required
                    placeholder="e.g. Hypersensory Hunter"
                    value={activeCard.ruleTitle}
                    onChange={e => updateActiveCard({ ruleTitle: e.target.value })}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium font-body text-white">Description</label>
                    <textarea
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                                 font-body text-white placeholder:text-gray-500
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                 min-h-[110px] resize-y"
                      placeholder="What does this rule do?"
                      value={activeCard.ruleDescription}
                      onChange={e => updateActiveCard({ ruleDescription: e.target.value })}
                    />
                  </div>
                </section>

                {/* ── Attached ability ─────────────────────────────────── */}
                <section className="space-y-3">
                  <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Attached Ability
                  </p>

                  {activeCard.ruleAbility ? (
                    <div
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
                      onClick={() => activeCard.ruleAbility && setViewingAbility(activeCard.ruleAbility)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-gray-200 truncate">
                          {activeCard.ruleAbility.name}
                        </p>
                        <p className="font-body text-xs text-gray-500 truncate">
                          {activeCard.ruleAbility.apCost > 0 ? `${activeCard.ruleAbility.apCost} AP` : 'Free'}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Detach ${activeCard.ruleAbility.name}`}
                        onClick={e => {
                          e.stopPropagation();
                          updateActiveCard({ ruleAbility: null });
                        }}
                        className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <CloseCircle className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      leftIcon={<AddCircle className="w-4 h-4" />}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setAbilityModalOpen(true)}
                    >
                      Attach Ability
                    </Button>
                  )}
                </section>
              </>
            ) : (
              <>
            {/* Basic Details */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Basic Details
              </p>
              <Input
                label="Operative Name"
                required
                placeholder="e.g. Space Marine Captain"
                leftIcon={<UserRounded className="w-4 h-4" />}
                value={activeCard.operativeName}
                onChange={e => updateActiveCard({ operativeName: e.target.value })}
              />
              <Input
                label="Operative Type"
                placeholder="e.g. Intercessor Sergeant, Sniper, Warrior"
                value={activeCard.role}
                onChange={e => updateActiveCard({ role: e.target.value })}
              />
              <Input
                label="Team Name"
                placeholder="e.g. Angels of Death"
                value={activeCard.teamName}
                onChange={e => updateActiveCard({ teamName: e.target.value })}
              />
              <Input
                label="Tags"
                placeholder="e.g. Imperium, Adeptus Astartes"
                value={activeCard.tags}
                onChange={e => updateActiveCard({ tags: e.target.value })}
              />
            </section>

            {/* Images */}
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

            {/* Stats */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Stats
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Actions"
                  required
                  min={0}
                  value={activeCard.actions}
                  onChange={v => updateActiveCard({ actions: v })}
                  className="w-full"
                />
                <Counter
                  label="Movement"
                  required
                  min={0}
                  value={activeCard.movement}
                  onChange={v => updateActiveCard({ movement: v })}
                  className="w-full"
                />
                <Counter
                  label="Save"
                  required
                  min={0}
                  value={activeCard.save}
                  onChange={v => updateActiveCard({ save: v })}
                  className="w-full"
                />
                <Counter
                  label="Wounds"
                  required
                  min={0}
                  value={activeCard.wounds}
                  onChange={v => updateActiveCard({ wounds: v })}
                  className="w-full"
                />
                <Counter
                  label="Base Size"
                  min={0}
                  value={activeCard.baseSize}
                  onChange={v => updateActiveCard({ baseSize: v })}
                  className="w-full"
                />
              </div>
            </section>

            {/* Weapons */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Weapons
              </p>

              {activeCard.weapons.map(w => (
                <div
                  key={w.addonId}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
                  onClick={() => setViewingWeapon(w)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-gray-200 truncate">{w.name}</p>
                    <p className="font-body text-xs text-gray-500 truncate">
                      {[
                        w.meleeOrRanged === 'melee' ? 'Melee' : w.meleeOrRanged === 'ranged' ? 'Ranged' : '',
                        w.attack ? `A${w.attack}` : '',
                        w.hit ? `Hit ${formatHit(w.hit)}` : '',
                        (w.baseDamage || w.critDamage) ? `Dmg ${formatDamage(w.baseDamage, w.critDamage)}` : '',
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${w.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      updateActiveCard({
                        weapons: activeCard.weapons.filter(x => x.addonId !== w.addonId),
                      });
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

            {/* Abilities */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Abilities
              </p>

              {activeCard.abilities.map(a => (
                <div
                  key={a.addonId}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
                  onClick={() => setViewingAbility(a)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-gray-200 truncate">{a.name}</p>
                    <p className="font-body text-xs text-gray-500 truncate">
                      {a.apCost > 0 ? `${a.apCost} AP` : 'Free'}
                      {a.description && ` · ${a.description.slice(0, 40)}${a.description.length > 40 ? '…' : ''}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      updateActiveCard({
                        abilities: activeCard.abilities.filter(x => x.addonId !== a.addonId),
                      });
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
                onClick={() => setAbilityModalOpen(true)}
              >
                Add Ability
              </Button>
            </section>

            {/* ── Save as Template (operative cards only) ─────────────────
                Persists the active operative — stats + weapons + abilities
                — as a reusable template that appears in the Add Operative
                picker. Delete is reachable from the unit-list edit mode, so
                no extra Delete button here. */}
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
            </section>
              </>
            )}

        </EditorPanel>
      ) : undefined}
      modals={<>

      {/* ── Delete portrait confirmation modal ─────────────────────────────── */}
      <Modal
        open={deletePortraitConfirm}
        onClose={() => !deletingPortrait && setDeletePortraitConfirm(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this image?</h3>
          <p className="font-body text-base text-gray-300">
            This can't be undone, but you can upload a different image.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingPortrait} onClick={() => setDeletePortraitConfirm(false)}>
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

      {/* ── Delete card confirmation modal ─────────────────────────────────── */}
      <Modal
        open={deleteCardConfirmOpen}
        onClose={() => !deletingCard && setDeleteCardConfirmOpen(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this operative?</h3>
          <p className="font-body text-base text-gray-300">
            This will permanently delete {cardPendingDelete?.operativeName ? `“${cardPendingDelete.operativeName}”` : 'this operative'}.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingCard} onClick={() => setDeleteCardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingCard}
              onClick={handleConfirmDeleteCard}
            >
              Yes, Delete Operative
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Upload Photo modal ──────────────────────────────────────────────── */}
      <UploadPhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        game="kill-team"
        cardDbId={activeCard.dbId}
        unitName={activeCard.operativeName || undefined}
        onImageUploaded={(url, pStyle) => updateActiveCard({ portraitUrl: url, portraitStyle: pStyle })}
        onAvatarUploaded={url => updateActiveCard({ avatarUrl: url })}
      />

      {/* ── Add Weapon modal ────────────────────────────────────────────────── */}
      <AddAddonModal
        open={weaponModalOpen}
        onClose={() => setWeaponModalOpen(false)}
        gameSlug="kill-team"
        addonTypeSlug="weapons"
        addonTypeName="Weapon"
        excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
        onAdd={handleWeaponAdded}
        onDeleted={handleWeaponDeleted}
        getSubtitle={killTeamWeaponSubtitle}
        CreateFormComponent={WeaponFormWithContext}
      />

      {/* ── Add Ability modal ───────────────────────────────────────────────── */}
      <AddAddonModal
        open={abilityModalOpen}
        onClose={() => setAbilityModalOpen(false)}
        gameSlug="kill-team"
        addonTypeSlug="abilities"
        addonTypeName="Ability"
        excludeAddonIds={activeCard.abilities.map(a => a.addonId)}
        onAdd={handleAbilityAdded}
        onDeleted={handleAbilityDeleted}
        getSubtitle={killTeamAbilitySubtitle}
        CreateFormComponent={AbilityFormWithContext}
      />

      {/* ── Edit Keyword modal (opened from a keyword chip on the card) ────
          The card's KeywordInfoModal shows an "Edit Keyword" button when
          the builder supplies `onEditKeyword`; clicking it resolves the
          attachment and lands here. Saving propagates via
          propagateKeywordUpdate so every card refreshes. */}
      <AddKeywordModal
        open={!!editingCardKeyword}
        onClose={() => setEditingCardKeyword(null)}
        gameSlug="kill-team"
        editingKeyword={editingCardKeyword ? {
          id:          editingCardKeyword.keywordId,
          name:        editingCardKeyword.keywordName,
          description: editingCardKeyword.description,
          hasParams:   editingCardKeyword.hasParams,
        } : null}
        onKeywordSelected={() => {}}
        onKeywordUpdated={(updated) => {
          propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
          setEditingCardKeyword(null);
        }}
      />

      {/* ── Save-as-Template modal (operative cards) ──────────────────────── */}
      <SaveTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        defaultName={activeCard.cardType === 'operative' ? activeCard.operativeName : ''}
        onSave={saveAsTemplate}
        description="You'll be able to use this template to create new operatives in the future. Templates remember the stats, weapons, abilities, and keywords."
        namePlaceholder="This replaces the operative's name."
      />

      {/* ── New Card modal (operative templates picker) ───────────────────── */}
      <NewCardModal
        open={newCardModalOpen}
        onClose={() => setNewCardModalOpen(false)}
        templates={newCardTemplates}
        onNewBlank={() => { setNewCardModalOpen(false); addBlankOperativeCard(); }}
        onPickTemplate={createOperativeFromTemplate}
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

      {/* ── Custom Token modal (create / edit a deck-scoped UCT) ──────────── */}
      <CustomTokenModal
        open={customTokenModalOpen}
        onClose={() => { setCustomTokenModalOpen(false); setEditingCustomToken(null); }}
        editing={editingCustomToken ? {
          name:        editingCustomToken.name,
          description: editingCustomToken.description ?? '',
          color:       editingCustomToken.display_color ?? '#f85908',
          glyph:       editingCustomToken.display_glyph ?? '',
        } : null}
        onSave={saveCustomToken}
        onDelete={editingCustomToken ? deleteCustomToken : undefined}
      />

      {/* ── Weapon detail modal ──────────────────────────────────────────────
          Click a weapon row → see its stats + keywords; "Edit Weapon" opens
          the form modal below. */}
      <AddonInfoModal
        open={!!viewingWeapon}
        onClose={() => setViewingWeapon(null)}
        name={viewingWeapon?.name ?? ''}
        addonTypeName="Weapon"
        statRows={viewingWeapon ? [
          { label: 'Type',   value: viewingWeapon.meleeOrRanged === 'melee' ? 'Melee'
                                  : viewingWeapon.meleeOrRanged === 'ranged' ? 'Ranged'
                                  : '—' },
          { label: 'Attack', value: viewingWeapon.attack || '—' },
          { label: 'Hit',    value: formatHit(viewingWeapon.hit) },
          { label: 'Damage', value: formatDamage(viewingWeapon.baseDamage, viewingWeapon.critDamage) },
        ] : []}
        keywords={viewingWeapon?.weaponKeywords ?? []}
        onEdit={() => {
          if (!viewingWeapon) return;
          const addonId = viewingWeapon.addonId;
          setViewingWeapon(null);
          supabase.from('addons').select('*').eq('id', addonId).single()
            .then(({ data }) => { if (data) setEditingWeaponAddon(data as Addon); });
        }}
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
                const mr = ws.meleeOrRanged === 'melee' || ws.meleeOrRanged === 'ranged' ? ws.meleeOrRanged : '';
                const dmg = parseDamageParts(ws);
                setCardState(s => ({
                  ...s,
                  cards: s.cards.map(c => ({
                    ...c,
                    weapons: c.weapons.map(w =>
                      w.addonId === editingWeaponAddon.id
                        ? {
                            ...w,
                            name,
                            meleeOrRanged: mr as 'melee' | 'ranged' | '',
                            attack: Number(ws.attack) || 0,
                            hit:    parseHit(ws.hit),
                            baseDamage: dmg.base,
                            critDamage: dmg.crit,
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

      {/* ── Ability detail modal ────────────────────────────────────────────── */}
      <AddonInfoModal
        open={!!viewingAbility}
        onClose={() => setViewingAbility(null)}
        name={viewingAbility?.name ?? ''}
        description={viewingAbility?.description}
        addonTypeName="Ability"
        statRows={viewingAbility ? [
          { label: 'AP Cost', value: viewingAbility.apCost > 0 ? `${viewingAbility.apCost} AP` : 'Free' },
        ] : []}
        keywords={viewingAbility?.abilityKeywords ?? []}
        onEdit={() => {
          if (!viewingAbility) return;
          const addonId = viewingAbility.addonId;
          setViewingAbility(null);
          supabase.from('addons').select('*').eq('id', addonId).single()
            .then(({ data }) => { if (data) setEditingAbilityAddon(data as Addon); });
        }}
      />

      {/* ── Edit Ability modal (direct form, skips picker) ──────────────────── */}
      {editingAbilityAddon && (
        <Modal open onClose={() => setEditingAbilityAddon(null)} className="max-w-md">
          <AbilityFormWithContext
            editingAddon={editingAbilityAddon}
            onSave={async (name, description, stats) => {
              setSavingAbilityEdit(true);
              try {
                const { error } = await supabase
                  .from('addons')
                  .update({ name, description, stats })
                  .eq('id', editingAbilityAddon.id);
                if (error) throw error;

                // Refresh ability data in all cards that use this addon
                const as = stats as Record<string, unknown>;
                const apply = (a: LocalAbility): LocalAbility =>
                  a.addonId === editingAbilityAddon.id
                    ? { ...a, name, description: description ?? '', apCost: Number(as.apCost) || 0 }
                    : a;
                setCardState(s => ({
                  ...s,
                  cards: s.cards.map(c => ({
                    ...c,
                    abilities:   c.abilities.map(apply),
                    ruleAbility: c.ruleAbility ? apply(c.ruleAbility) : null,
                  })),
                }));

                setEditingAbilityAddon(null);
                return editingAbilityAddon.id;
              } catch (err) {
                console.error('[BattleCards] ability edit error:', err);
                return '';
              } finally {
                setSavingAbilityEdit(false);
              }
            }}
            onCancel={() => setEditingAbilityAddon(null)}
            saving={savingAbilityEdit}
          />
        </Modal>
      )}

      </>}
    />
  );
};

export default CardBuilderKillTeam;
