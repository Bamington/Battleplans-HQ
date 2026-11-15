/**
 * ListBuilder.tsx — Generic deck page for games without a custom builder
 *
 * List Builder games (e.g. Gundam Assemble) use official cards as static
 * images. There is no design step: the user picks cards from their available
 * templates (their own library + cards auto-imported from official packs) and
 * plays with them. Any game without an entry in GAME_PAGES (see
 * pages/DeckPage.tsx) lands here via /app/deck/:slug?deckId=… .
 *
 * Layout reuses the builder chrome (BuilderShell, ListPanel,
 * CenterViewport, CardCarousel). Cards render with <StaticCard>; cards without
 * a face_path show its placeholder.
 *
 * Play mode is the same token system as the custom builders: token
 * definitions for the game, numeric card.stats resolve stat-linked limits
 * (e.g. HP), and token state is ephemeral (per page session).
 *
 * Card native size comes from the game's print size for that card type
 * (games.card_type_sizes override games.print_size), at 5 px per mm.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import AppNavbar from '../components/AppNavbar';
import EditSubnav from '../components/EditSubnav';
import CenterViewport from '../components/CenterViewport';
import CardCarousel from '../components/CardCarousel';
import UnitListEntry from '../components/UnitListEntry';
import {
  BuilderShell, ListPanel, ModeToggle, type Mode, Dropdown, DropdownItem, Button, Badge, HR, Modal, Text, Tabs,
  AddCircle, CheckCircle, Pen2, Play, AltArrowDown, supabase,
} from '@battleplans/ui';
import StaticCard, { cardFaceUrl } from '../components/StaticCard';
import { nativeDimsFor } from '../lib/cardSizes';
import TokenOverlay from '../components/TokenOverlay';
import TokenMenu from '../components/TokenMenu';
import { useCardBuilder } from '../hooks/useCardBuilder';
import type { CardType, CardTypeSizes, Json, TokenDefinition } from '../lib/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ListCard {
  id:         string;
  name:       string;
  card_type:  CardType;
  stats:      Record<string, Json>;
  face_path:  string | null;
  sort_order: number | null;
}

interface GameInfo {
  id:         string;
  name:       string;
  slug:       string;
  print_size: [number, number] | null;
  card_type_sizes: CardTypeSizes | null;
}

const PICKER_W = 150;

/** Human label for a card_type in this generic page. */
const TYPE_LABEL: Record<string, string> = {
  operative: 'Units',
  rule:      'Tactics',
};
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

/** Keep only numeric stats — TokenOverlay resolves stat_key limits from these. */
const numericStats = (stats: Record<string, Json>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats ?? {})) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
};

const CARD_COLUMNS = 'id, name, card_type, stats, face_path, sort_order';

// ── Page ─────────────────────────────────────────────────────────────────────

const ListBuilder = () => {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deckId = searchParams.get('deckId');

  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, toggleCardList, isMobile, isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName, deckNameInputRef,
    startDeckNameEdit, commitDeckName,
  } = builder;

  const [appMode, setAppMode] = useState<Mode>('edit');
  const [editMode, setEditMode] = useState(false);

  const [game, setGame] = useState<GameInfo | null>(null);
  const [cards, setCards] = useState<ListCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinition[]>([]);
  /** Ephemeral play state: card id → token def id → value. */
  const [tokenState, setTokenState] = useState<Record<string, Record<string, number>>>({});

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [available, setAvailable] = useState<ListCard[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  /** Native px size of a card, by its type. */
  const dimsOf = useCallback((c: { card_type: string }) => nativeDimsFor(game, c.card_type), [game]);
  const unitDims = useMemo(() => nativeDimsFor(game, 'operative'), [game]);

  // ── Load deck, game, cards, tokens ─────────────────────────────────────────
  useEffect(() => {
    if (!deckId) { setLoadError('No deck selected.'); setLoading(false); return; }
    (async () => {
      const { data: deck, error } = await supabase
        .from('decks')
        .select('id, name, game:games(id, name, slug, print_size, card_type_sizes)')
        .eq('id', deckId)
        .single();
      if (error || !deck) { setLoadError('Deck not found.'); setLoading(false); return; }
      const g = (deck as unknown as { game: GameInfo }).game;
      if (g.slug !== slug) { navigate(`/app/deck/${g.slug}?deckId=${deckId}`, { replace: true }); return; }
      setGame(g);
      setDeckName((deck as unknown as { name: string }).name);

      const [cardsRes, tokensRes] = await Promise.all([
        supabase.from('cards').select(CARD_COLUMNS)
          .eq('deck_id', deckId)
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase.from('token_definitions').select('*')
          .eq('game_id', g.id).order('sort_order'),
      ]);
      const loaded = (cardsRes.data ?? []) as ListCard[];
      setCards(loaded);
      setActiveCardId(loaded[0]?.id ?? '');
      setTokenDefinitions((tokensRes.data ?? []) as TokenDefinition[]);
      setLoading(false);
    })();
  }, [deckId, slug, navigate, setDeckName]);

  // ── Picker data: own library templates + cards in packs the user owns ─────
  const loadAvailable = useCallback(async () => {
    if (!game) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [libRes, packsRes] = await Promise.all([
      supabase.from('cards').select(CARD_COLUMNS)
        .eq('user_id', user.id).eq('game_id', game.id)
        .eq('is_template', true).is('pack_id', null).order('name'),
      supabase.from('packs').select('id')
        .eq('owner_user_id', user.id).eq('game_id', game.id),
    ]);
    let packCards: ListCard[] = [];
    const packIds = ((packsRes.data ?? []) as { id: string }[]).map(p => p.id);
    if (packIds.length > 0) {
      const { data } = await supabase.from('cards').select(CARD_COLUMNS)
        .in('pack_id', packIds).eq('is_template', true).order('name');
      packCards = (data ?? []) as ListCard[];
    }
    const all = [...packCards, ...((libRes.data ?? []) as ListCard[])];
    setAvailable(all);
  }, [game]);

  const openPicker = () => {
    setPickerError(null);
    setPickerOpen(true);
    loadAvailable();
  };

  const countInDeck = (name: string, type: string) =>
    cards.filter(c => c.name === name && c.card_type === type).length;

  const addCard = async (source: ListCard) => {
    if (!deckId || adding) return;
    setAdding(source.id);
    setPickerError(null);
    const { data: newIds, error } = await supabase.rpc('add_cards_to_deck', {
      p_deck_id: deckId, p_source_ids: [source.id],
    });
    if (error || !newIds?.length) {
      console.error('[ListBuilder] add_cards_to_deck failed:', error);
      setPickerError('Could not add that card. Please try again.');
      setAdding(null);
      return;
    }
    const { data: added } = await supabase.from('cards').select(CARD_COLUMNS).in('id', newIds as string[]);
    const addedCards = (added ?? []) as ListCard[];
    setCards(prev => [...prev, ...addedCards]);
    if (addedCards[0]) setActiveCardId(addedCards[0].id);
    setAdding(null);
  };

  const removeCard = async (id: string) => {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) { console.error('[ListBuilder] delete failed:', error); return; }
    setCards(prev => {
      const next = prev.filter(c => c.id !== id);
      if (id === activeCardId) setActiveCardId(next[0]?.id ?? '');
      return next;
    });
  };

  // ── Play mode ──────────────────────────────────────────────────────────────
  const startingState = (): Record<string, number> => {
    const ts: Record<string, number> = {};
    for (const def of tokenDefinitions) if (def.starting_value != null) ts[def.id] = def.starting_value;
    return ts;
  };

  const handleModeChange = (mode: Mode) => {
    if (mode === 'play') {
      setEditMode(false);
      setTokenState(prev => {
        const next = { ...prev };
        for (const c of cards) if (!next[c.id]) next[c.id] = startingState();
        return next;
      });
    }
    setAppMode(mode);
  };

  const setToken = (cardId: string, defId: string, value: number) =>
    setTokenState(prev => ({ ...prev, [cardId]: { ...(prev[cardId] ?? {}), [defId]: value } }));

  const resolveTokenMax = (def: TokenDefinition, card: ListCard): number | null => {
    if (def.stat_key && def.stat_role === 'max') {
      const v = numericStats(card.stats)[def.stat_key];
      if (v != null) return v;
    }
    return def.max_value ?? null;
  };

  const handleNewTurn = () => {
    const turnDefs = tokenDefinitions.filter(d => d.refresh_on_turn !== 0);
    setTokenState(prev => {
      const next = { ...prev };
      for (const card of cards) {
        const ts = { ...(next[card.id] ?? startingState()) };
        for (const def of turnDefs) {
          const current = ts[def.id] ?? def.starting_value ?? 0;
          const hi = resolveTokenMax(def, card) ?? Number.POSITIVE_INFINITY;
          ts[def.id] = Math.max(def.min_value ?? 0, Math.min(hi, current + def.refresh_on_turn));
        }
        next[card.id] = ts;
      }
      return next;
    });
  };

  const isActivated = (card: ListCard): boolean => {
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    const ts = tokenState[card.id] ?? {};
    return actDefs.every(def => {
      const current = ts[def.id] ?? def.starting_value ?? 0;
      const max = resolveTokenMax(def, card);
      return max != null ? current >= max : current >= 1;
    });
  };

  const isPlay = appMode === 'play';
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];
  const playTokens = isPlay && tokenDefinitions.length > 0;

  // Group deck cards by type for the list (units first, then others).
  const typeOrder = (t: string) => (t === 'operative' ? 0 : t === 'rule' ? 1 : 2);
  const grouped = useMemo(() => {
    const m = new Map<string, ListCard[]>();
    for (const c of cards) m.set(c.card_type, [...(m.get(c.card_type) ?? []), c]);
    return [...m.entries()].sort((a, b) => typeOrder(a[0]) - typeOrder(b[0]));
  }, [cards]);

  const pickerTypes = useMemo(
    () => [...new Set(available.map(c => c.card_type))].sort((a, b) => typeOrder(a) - typeOrder(b)),
    [available],
  );

  // ── Render helpers ─────────────────────────────────────────────────────────
  const sectionHeader = (label: string, count: number) => (
    <h3 className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]">
      <span>{label} ({count})</span>
      <span className="flex-1 h-px bg-gray-700" />
    </h3>
  );

  const renderCard = (card: ListCard, interactive: boolean) => (
    <StaticCard faceUrl={cardFaceUrl(card.face_path)} name={card.name} width={dimsOf(card).w} height={dimsOf(card).h}>
      {/* Tokens track units only — tactics/rule cards are reference cards. */}
      {interactive && playTokens && card.card_type === 'operative' && (
        <TokenOverlay
          gameSlug={slug}
          tokenDefinitions={tokenDefinitions}
          card={{ stats: numericStats(card.stats), unitKeywords: [] }}
          tokenState={tokenState[card.id] ?? {}}
          onTokenChange={(defId, v) => setToken(card.id, defId, v)}
        />
      )}
    </StaticCard>
  );

  /** Grid of available cards for the picker; null type = all. */
  const pickerGrid = (type: string | null) => (
    <div className="flex flex-wrap gap-4 pt-2">
      {available.filter(c => type == null || c.card_type === type).map(c => {
        const count = countInDeck(c.name, c.card_type);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => addCard(c)}
            disabled={adding !== null}
            className="flex flex-col items-center gap-2 rounded-lg p-1 hover:bg-gray-800 transition-colors disabled:cursor-wait"
            title={`Add ${c.name}`}
          >
            <div className="relative overflow-hidden shrink-0" style={{ width: PICKER_W, height: Math.round(dimsOf(c).h * (PICKER_W / dimsOf(c).w)) }}>
              <div style={{ transform: `scale(${PICKER_W / dimsOf(c).w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StaticCard faceUrl={cardFaceUrl(c.face_path)} name={c.name} width={dimsOf(c).w} height={dimsOf(c).h} dimmed={adding === c.id} />
              </div>
              {count > 0 && (
                <div className="absolute top-1 right-1">
                  <Badge color="primary">×{count}</Badge>
                </div>
              )}
            </div>
            <span className="font-body text-xs text-gray-300 max-w-[150px] truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );

  const centerMessage = (body: React.ReactNode) => (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-950 p-6 text-center">
      {body}
    </main>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BuilderShell
      navbar={
        <AppNavbar fixed={false}>
          <div className="hidden lg:flex items-center gap-3">
            {deckId && (
              <Link to={`/app/print?deckId=${deckId}`}>
                <Button variant="ghost" color="secondary" size="xs">Print</Button>
              </Link>
            )}
            <ModeToggle mode={appMode} onModeChange={handleModeChange} />
          </div>
          <Dropdown
            align="right"
            className="lg:hidden"
            menuClassName="w-32"
            trigger={
              <Button color="primary" size="xs" rightIcon={<AltArrowDown className="w-4 h-4" />}>
                {isPlay ? 'Play' : 'Edit'}
              </Button>
            }
          >
            {isPlay
              ? <DropdownItem icon={<Pen2 className="w-4 h-4" />} onClick={() => handleModeChange('edit')}>Edit</DropdownItem>
              : <DropdownItem icon={<Play className="w-4 h-4" />} onClick={() => handleModeChange('play')}>Play</DropdownItem>}
            {deckId && (
              <DropdownItem onClick={() => navigate(`/app/print?deckId=${deckId}`)}>Print</DropdownItem>
            )}
          </Dropdown>
        </AppNavbar>
      }
      topBar={
        <EditSubnav
          className="lg:hidden"
          cardListOpen={cardListOpen}
          onToggleCardList={toggleCardList}
          editorOpen={false}
          onToggleEditor={() => {}}
        />
      }
      leftPanelOpen={cardListOpen}
      leftPanel={
        <ListPanel
          title={deckName}
          editingTitle={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={commitDeckName}
          onCancelEdit={() => setEditingDeckName(false)}
          headerSubtitle={game ? <span className="text-xs text-gray-500">{game.name} · {cards.length} cards</span> : undefined}
          headerAction={!isPlay && cards.length > 0 ? (
            <button
              type="button"
              onClick={() => setEditMode(m => !m)}
              className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title={editMode ? 'Done editing' : 'Edit deck'}
            >
              {editMode ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Pen2 className="w-4 h-4" />}
            </button>
          ) : undefined}
          footer={!isPlay ? (
            <>
              <HR className="!my-0" />
              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                onClick={openPicker}
                disabled={!game}
              >
                Add Cards
              </Button>
            </>
          ) : undefined}
        >
          {grouped.map(([type, list]) => (
            <div key={type}>
              {sectionHeader(typeLabel(type), list.length)}
              {list.map(card => (
                <UnitListEntry
                  key={card.id}
                  status="complete"
                  unitName={card.name}
                  unitType={typeLabel(type)}
                  avatarSrc={cardFaceUrl(card.face_path) ?? undefined}
                  active={card.id === activeCard?.id}
                  activated={isPlay && isActivated(card)}
                  editMode={editMode}
                  onDelete={() => removeCard(card.id)}
                  onClick={() => setActiveCardId(card.id)}
                />
              ))}
            </div>
          ))}
        </ListPanel>
      }
      center={
        loading ? centerMessage(<Text color="secondary">Loading…</Text>)
        : loadError ? centerMessage(<Text color="danger">{loadError}</Text>)
        : cards.length === 0 ? centerMessage(
            <>
              <Text variant="h5">This deck is empty</Text>
              <Text color="secondary">Add cards from your packs to build your list.</Text>
              <Button leftIcon={<AddCircle className="w-4 h-4" />} onClick={openPicker}>Add Cards</Button>
            </>
          )
        : (
          <CenterViewport mobilePanelOpen={mobilePanelOpen} isShortHeight={isShortHeight} isMobile={isMobile}>
            <CardCarousel
              items={cards}
              activeId={activeCard?.id ?? ''}
              onActiveChange={setActiveCardId}
              cardWidth={unitDims.w}
              cardHeight={unitDims.h}
              getItemDimensions={c => ({ width: dimsOf(c).w, height: dimsOf(c).h })}
              layoutDeps={[appMode, cardListOpen, isMobile, isShortHeight, mobilePanelOpen, unitDims.w, unitDims.h]}
              initialZoom={isShortHeight ? 1.0 : 0.7}
              className={`w-full ${mobilePanelOpen ? 'flex-none' : 'flex-1 min-h-0'}`}
              bottomLeftSlot={
                playTokens && tokenDefinitions.some(d => d.refresh_on_turn !== 0) ? (
                  <Button
                    variant={cards.every(isActivated) ? 'filled' : 'outline'}
                    color="primary"
                    shape="pill"
                    size="sm"
                    onClick={handleNewTurn}
                  >
                    New Turn
                  </Button>
                ) : null
              }
              bottomRightSlot={
                playTokens && activeCard?.card_type === 'operative' ? (
                  <TokenMenu
                    tokenDefinitions={tokenDefinitions}
                    card={{ stats: numericStats(activeCard.stats), unitKeywords: [] }}
                    tokenState={tokenState[activeCard.id] ?? {}}
                    onTokenChange={(defId, v) => setToken(activeCard.id, defId, v)}
                  />
                ) : null
              }
              renderItem={(card, role) => renderCard(card, role === 'active')}
            />
          </CenterViewport>
        )
      }
      modals={
        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} className="max-w-4xl w-full">
          <div className="p-5 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between gap-4">
              <Text variant="h5">Add Cards</Text>
              <Button variant="ghost" color="secondary" size="xs" onClick={() => setPickerOpen(false)}>Done</Button>
            </div>
            {pickerError && <Text color="danger" size="sm">{pickerError}</Text>}
            <div className="overflow-y-auto">
              {available.length === 0 ? (
                <Text color="secondary">
                  No cards available yet. Cards come from your packs — official packs for this game are added automatically when you create a deck.
                </Text>
              ) : pickerTypes.length > 1 ? (
                <Tabs
                  defaultTab={pickerTypes[0]}
                  tabs={pickerTypes.map(t => ({ id: t, label: typeLabel(t), content: pickerGrid(t) }))}
                />
              ) : pickerGrid(null)}
            </div>
          </div>
        </Modal>
      }
    />
  );
};

export default ListBuilder;
