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
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import HR from '../components/HR';
import CardCarousel from '../components/CardCarousel';
import Modal from '../components/Modal';
import AddAddonModal from '../components/AddAddonModal';
import AddonInfoModal from '../components/AddonInfoModal';
import UploadPhotoModal from '../components/UploadPhotoModal';
import AddKeywordModal, { type KeywordSelection } from '../components/AddKeywordModal';
import RygCard, { CARD_W, CARD_H } from '../components/RygCard';
import RygWeaponForm, { type RygWeaponFormProps } from '../components/RygWeaponForm';
import RygSimpleAddonForm from '../components/RygSimpleAddonForm';
import UserRounded from '../icons/UserRounded';
import AddCircle from '../icons/AddCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Pen2 from '../icons/Pen2';
import { supabase } from '../lib/supabase';
import type { Addon } from '../lib/database.types';
import { formatKeywordLabel } from '../lib/cardShape/util';
// @ts-ignore
import logoRyg from '../assets/games/card assets/ryg/icon.svg';

// ── Card-local data shapes ────────────────────────────────────────────────────

type LocalKeyword = KeywordSelection;

interface LocalWeapon {
  addonId:        string;
  name:           string;
  damage:         string;
  range:          number;
  keywords:       string;
  weaponKeywords: LocalKeyword[];
}

interface LocalArmor {
  addonId:     string;
  name:        string;
  description: string;
}

interface LocalItem {
  addonId:     string;
  name:        string;
  description: string;
}

interface LocalAbility {
  addonId:     string;
  name:        string;
  description: string;
}

interface RygCardData {
  id:           string;
  dbId:         string | null;
  warriorName:  string;
  type:         string;
  sept:         string;
  offense:      number;
  defense:      number;
  life:         number;
  tactics:      number;
  fate:         number;
  talents:      string;              // comma-separated display string
  talentKws:    LocalKeyword[];      // structured list
  ability:      LocalAbility | null;
  weapons:      LocalWeapon[];
  armor:        LocalArmor[];
  items:        LocalItem[];
  portraitUrl:  string | null;
}

const defaultCard = (): RygCardData => ({
  id:          crypto.randomUUID(),
  dbId:        null,
  warriorName: '',
  type:        '',
  sept:        '',
  offense:     0,
  defense:     0,
  life:        0,
  tactics:     0,
  fate:        0,
  talents:     '',
  talentKws:   [],
  ability:     null,
  weapons:     [],
  armor:       [],
  items:       [],
  portraitUrl: null,
});

const cardStats = (c: RygCardData) => ({
  type:    c.type,
  sept:    c.sept,
  offense: c.offense,
  defense: c.defense,
  life:    c.life,
  tactics: c.tactics,
  fate:    c.fate,
});

const isBlank = (c: RygCardData) =>
  !c.warriorName && !c.type && !c.sept &&
  c.offense === 0 && c.defense === 0 && c.life === 0 && c.tactics === 0 && c.fate === 0 &&
  c.ability === null && c.weapons.length === 0 && c.armor.length === 0 && c.items.length === 0;

const buildKeywordsStr = (kws: LocalKeyword[]) =>
  kws.map(k => formatKeywordLabel(k.keywordName, k.paramValue)).join(', ');

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
  return parts.join(' · ') || 'No stats';
};

const simpleSubtitle = (addon: Addon): string =>
  addon.description ? addon.description.slice(0, 60) + (addon.description.length > 60 ? '…' : '') : '—';

// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderRyg = () => {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
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

  const dirtyRef = useRef<Set<string>>(new Set());

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
          .select('id, name, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)), card_images(file_path, image_type)')
          .eq('deck_id', deckId)
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

              let ability: LocalAbility | null = null;
              const weapons: LocalWeapon[] = [];
              const armor:   LocalArmor[]  = [];
              const items:   LocalItem[]   = [];

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

                if (slug === 'special-ability') {
                  ability = { addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' };
                } else if (slug === 'weapons') {
                  const ws = addon.stats;
                  weapons.push({
                    addonId:        ca.addon_id,
                    name:           addon.name,
                    damage:         typeof ws.damage === 'string' ? ws.damage : '',
                    range:          num(ws.range),
                    keywords:       buildKeywordsStr(localKws),
                    weaponKeywords: localKws,
                  });
                } else if (slug === 'armor') {
                  armor.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
                } else if (slug === 'items') {
                  items.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
                }
              }

              const sortedKws = [...(row.card_keywords ?? [])]
                .filter(r => r.keywords != null)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const talentKws: LocalKeyword[] = sortedKws.map(r => ({
                keywordId:   r.keyword_id,
                keywordName: r.keywords!.name,
                description: r.keywords!.description ?? '',
                hasParams:   Array.isArray(r.keywords!.params_schema) && r.keywords!.params_schema.length > 0,
                paramValue:  r.params?.X != null ? Number(r.params.X) : null,
              }));

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
                type:        typeof s.type === 'string' ? s.type : '',
                sept:        typeof s.sept === 'string' ? s.sept : '',
                offense:     num(s.offense),
                defense:     num(s.defense),
                life:        num(s.life),
                tactics:     num(s.tactics),
                fate:        num(s.fate),
                talents:     buildKeywordsStr(talentKws),
                talentKws,
                ability,
                weapons,
                armor,
                items,
                portraitUrl,
              } as RygCardData;
            });

            setCardState({ cards: loaded, activeCardId: loaded[0].id });
          });
      });
  }, [deckId]);

  // ── Auto-save (debounced 1s) ──────────────────────────────────────────────
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

          // Sync card_addons
          await supabase.from('card_addons').delete().eq('card_id', dbId);
          const addonIds = [
            ...(card.ability  ? [card.ability.addonId]  : []),
            ...card.weapons.map(w => w.addonId),
            ...card.armor.map(a => a.addonId),
            ...card.items.map(i => i.addonId),
          ];
          if (addonIds.length > 0) {
            await supabase.from('card_addons').insert(
              addonIds.map((addonId, i) => ({ card_id: dbId!, addon_id: addonId, sort_order: i })),
            );
          }

          // Sync card_keywords (talents)
          await supabase.from('card_keywords').delete().eq('card_id', dbId);
          if (card.talentKws.length > 0) {
            await supabase.from('card_keywords').insert(
              card.talentKws.map((k, i) => ({
                card_id:    dbId!,
                keyword_id: k.keywordId,
                params:     k.paramValue != null ? { X: k.paramValue } : null,
                sort_order: i,
              })),
            );
          }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [cards, deckId]);

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
    const card = defaultCard();
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
  };

  const removeCard = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card?.dbId) await supabase.from('cards').delete().eq('id', card.dbId);
    setCardState(s => {
      const remaining = s.cards.filter(c => c.id !== id);
      const nextActive = remaining.length > 0 ? remaining[Math.min(remaining.findIndex(c => c.id === id), remaining.length - 1)].id : '';
      return { cards: remaining.length > 0 ? remaining : [defaultCard()], activeCardId: nextActive || remaining[0]?.id || '' };
    });
  };

  // ── Modal state ───────────────────────────────────────────────────────────
  const [weaponModalOpen,  setWeaponModalOpen]  = useState(false);
  const [armorModalOpen,   setArmorModalOpen]   = useState(false);
  const [itemModalOpen,    setItemModalOpen]     = useState(false);
  const [abilityModalOpen, setAbilityModalOpen] = useState(false);
  const [photoModalOpen,   setPhotoModalOpen]   = useState(false);
  const [talentModalOpen,  setTalentModalOpen]  = useState(false);

  // Pending keywords set by RygWeaponForm so onAdd can seed the weapon
  const pendingWeaponKws = useRef<LocalKeyword[]>([]);

  // Addon being viewed for info/edit
  const [viewingAddon, setViewingAddon] = useState<(LocalWeapon | LocalArmor | LocalItem | LocalAbility) & { addonType: string } | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [savingEdit,   setSavingEdit]   = useState(false);

  // ── Portrait upload / delete ──────────────────────────────────────────────
  const handlePortraitUploaded = async (filePath: string) => {
    const { data: u } = supabase.storage.from('card-images').getPublicUrl(filePath);
    updateActive({ portraitUrl: u.publicUrl });

    const dbId = await ensureCardSaved();
    if (!dbId) return;
    await supabase.from('card_images').delete().eq('card_id', dbId).eq('image_type', 'portrait');
    await supabase.from('card_images').insert({ card_id: dbId, file_path: filePath, image_type: 'portrait', sort_order: 0 });
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

  const AbilityForm = useCallback((props: Parameters<typeof RygSimpleAddonForm>[0]) => (
    <RygSimpleAddonForm
      {...props}
      namePlaceholder="Ability Name"
      descPlaceholder="Describe the special ability…"
      saveLabel="Save Ability"
    />
  ), []);

  const ArmorForm = useCallback((props: Parameters<typeof RygSimpleAddonForm>[0]) => (
    <RygSimpleAddonForm
      {...props}
      namePlaceholder="Armor Name"
      descPlaceholder="Describe the armor's effect…"
      saveLabel="Save Armor"
    />
  ), []);

  const ItemForm = useCallback((props: Parameters<typeof RygSimpleAddonForm>[0]) => (
    <RygSimpleAddonForm
      {...props}
      namePlaceholder="Item Name"
      descPlaceholder="Describe the item's effect…"
      saveLabel="Save Item"
    />
  ), []);

  // ── Render ────────────────────────────────────────────────────────────────

  const cardToProps = (card: RygCardData) => ({
    warriorName:        card.warriorName,
    type:               card.type,
    sept:               card.sept,
    offense:            card.offense,
    defense:            card.defense,
    life:               card.life,
    tactics:            card.tactics,
    fate:               card.fate,
    talents:            card.talents,
    specialAbilityName: card.ability?.name,
    specialAbilityDesc: card.ability?.description,
    weapons:            card.weapons.map(w => ({ id: w.addonId, name: w.name, damage: w.damage, range: w.range, keywords: w.keywords })),
    armor:              card.armor.map(a => ({ id: a.addonId, name: a.name, description: a.description })),
    items:              card.items.map(i => ({ id: i.addonId, name: i.name, description: i.description })),
    portrait:           card.portraitUrl ?? undefined,
  });

  return (
    <>
      <Navbar
        deckName={deckName}
        editingDeckName={editingDeckName}
        deckNameInputRef={deckNameInputRef}
        onDeckNameClick={startDeckNameEdit}
        onDeckNameChange={e => setDeckName(e.target.value)}
        onDeckNameBlur={commitDeckName}
        onDeckNameKeyDown={e => { if (e.key === 'Enter') commitDeckName(); if (e.key === 'Escape') setEditingDeckName(false); }}
        onBack={() => navigate('/app')}
        logoSrc={logoRyg}
      />

      <EditSubnav
        cardListOpen={cardListOpen}
        editorOpen={editorOpen}
        onToggleCardList={toggleCardList}
        onToggleEditor={toggleEditor}
      />

      <BuilderShell
        cardListOpen={cardListOpen}
        editorOpen={editorOpen}
        isMobile={isMobile}
        isShortHeight={isShortHeight}
        mobilePanelOpen={mobilePanelOpen}
        layoutDeps={layoutDeps}
        CardListPanel={
          <CardListPanel>
            {cards.map(card => (
              <UnitListEntry
                key={card.id}
                name={card.warriorName || 'Unnamed Warrior'}
                subtitle={[card.type, card.sept].filter(Boolean).join(' · ')}
                active={card.id === activeCardId}
                onClick={() => setCardState(s => ({ ...s, activeCardId: card.id }))}
                onDelete={cards.length > 1 ? () => removeCard(card.id) : undefined}
              />
            ))}
            <Button variant="secondary" onClick={addCard} style={{ marginTop: 8 }}>
              <AddCircle /> Add Warrior
            </Button>
          </CardListPanel>
        }
        CenterViewport={
          <CenterViewport>
            <CardCarousel
              cards={cards.map(card => ({
                id:     card.id,
                width:  CARD_W,
                height: CARD_H,
                node:   (
                  <RygCard
                    {...cardToProps(card)}
                    {...(card.id === activeCardId ? {
                      onChangeName:        v => updateActive({ warriorName: v }),
                      onChangeType:        v => updateActive({ type: v }),
                      onChangeSept:        v => updateActive({ sept: v }),
                      onChangeTalents:     v => updateActive({ talents: v }),
                      onChangeAbilityName: v => activeCard.ability && updateActive({ ability: { ...activeCard.ability, name: v } }),
                      onChangeAbilityDesc: v => activeCard.ability && updateActive({ ability: { ...activeCard.ability, description: v } }),
                    } : {})}
                  />
                ),
              }))}
              activeCardId={activeCardId}
              onCardClick={id => setCardState(s => ({ ...s, activeCardId: id }))}
            />
          </CenterViewport>
        }
        EditorPanel={
          <EditorPanel>
            {/* Portrait */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Portrait</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {activeCard.portraitUrl && (
                    <Button size="sm" variant="danger-ghost" onClick={handleDeletePortrait}>
                      <TrashBinMinimalistic />
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setPhotoModalOpen(true)}>
                    <UserRounded /> {activeCard.portraitUrl ? 'Replace' : 'Upload'}
                  </Button>
                </div>
              </div>
              {activeCard.portraitUrl && (
                <img
                  src={activeCard.portraitUrl}
                  alt="Portrait"
                  style={{ width: '100%', borderRadius: 4, objectFit: 'cover', maxHeight: 120 }}
                />
              )}
            </section>

            <HR />

            {/* Identity */}
            <section>
              <Input
                label="Warrior Name"
                value={activeCard.warriorName}
                onChange={e => updateActive({ warriorName: e.target.value })}
                placeholder="Gary the Stabber"
              />
              <Input
                label="Type"
                value={activeCard.type}
                onChange={e => updateActive({ type: e.target.value })}
                placeholder="Bastard"
                style={{ marginTop: 8 }}
              />
              <Input
                label="Sept"
                value={activeCard.sept}
                onChange={e => updateActive({ sept: e.target.value })}
                placeholder="Sept of the Star"
                style={{ marginTop: 8 }}
              />
            </section>

            <HR />

            {/* Stats */}
            <section>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Stats</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['offense', 'defense', 'life', 'tactics', 'fate'] as const).map(key => (
                  <Counter
                    key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    value={activeCard[key]}
                    onChange={v => updateActive({ [key]: v })}
                    min={0}
                    max={99}
                  />
                ))}
              </div>
            </section>

            <HR />

            {/* Talents (card-level keywords) */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Talents</span>
                <Button size="sm" variant="secondary" onClick={() => setTalentModalOpen(true)}>
                  <AddCircle /> Add
                </Button>
              </div>
              {activeCard.talentKws.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No talents yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeCard.talentKws.map(k => (
                    <div key={k.keywordId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f3f4f6', borderRadius: 4, padding: '3px 8px', fontSize: 13 }}>
                      {formatKeywordLabel(k.keywordName, k.paramValue)}
                      <button
                        onClick={() => {
                          const next = activeCard.talentKws.filter(t => t.keywordId !== k.keywordId);
                          updateActive({ talentKws: next, talents: buildKeywordsStr(next) });
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <HR />

            {/* Special Ability */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Special Ability</span>
                {!activeCard.ability && (
                  <Button size="sm" variant="secondary" onClick={() => setAbilityModalOpen(true)}>
                    <AddCircle /> Add
                  </Button>
                )}
              </div>
              {activeCard.ability ? (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{activeCard.ability.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!activeCard.ability) return;
                        const { data } = await supabase.from('addons').select('*').eq('id', activeCard.ability.addonId).single();
                        if (data) setEditingAddon(data as Addon);
                        setAbilityModalOpen(true);
                      }}>
                        <Pen2 />
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => updateActive({ ability: null })}>
                        <TrashBinMinimalistic />
                      </Button>
                    </div>
                  </div>
                  {activeCard.ability.description && (
                    <p style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{activeCard.ability.description}</p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No special ability yet.</p>
              )}
            </section>

            <HR />

            {/* Weapons */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Weapons</span>
                <Button size="sm" variant="secondary" onClick={() => setWeaponModalOpen(true)}>
                  <AddCircle /> Add
                </Button>
              </div>
              {activeCard.weapons.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No weapons yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeCard.weapons.map(w => (
                    <div key={w.addonId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{w.name}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                          {w.damage}{w.range > 0 ? ` · ${w.range}"` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          const { data } = await supabase.from('addons').select('*').eq('id', w.addonId).single();
                          if (data) setEditingAddon(data as Addon);
                          setWeaponModalOpen(true);
                        }}>
                          <Pen2 />
                        </Button>
                        <Button size="sm" variant="danger-ghost" onClick={() => {
                          dirtyRef.current.add(activeCardId);
                          updateActive({ weapons: activeCard.weapons.filter(x => x.addonId !== w.addonId) });
                        }}>
                          <TrashBinMinimalistic />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <HR />

            {/* Armor */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Armor</span>
                <Button size="sm" variant="secondary" onClick={() => setArmorModalOpen(true)}>
                  <AddCircle /> Add
                </Button>
              </div>
              {activeCard.armor.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No armor yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeCard.armor.map(a => (
                    <div key={a.addonId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="danger-ghost" onClick={() => updateActive({ armor: activeCard.armor.filter(x => x.addonId !== a.addonId) })}>
                          <TrashBinMinimalistic />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <HR />

            {/* Items */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Items</span>
                <Button size="sm" variant="secondary" onClick={() => setItemModalOpen(true)}>
                  <AddCircle /> Add
                </Button>
              </div>
              {activeCard.items.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No items yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeCard.items.map(i => (
                    <div key={i.addonId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="danger-ghost" onClick={() => updateActive({ items: activeCard.items.filter(x => x.addonId !== i.addonId) })}>
                          <TrashBinMinimalistic />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </EditorPanel>
        }
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Portrait upload */}
      {photoModalOpen && (
        <UploadPhotoModal
          open
          cardId={activeCard.dbId}
          onEnsureCardSaved={ensureCardSaved}
          onClose={() => setPhotoModalOpen(false)}
          onUploaded={handlePortraitUploaded}
        />
      )}

      {/* Talent keywords */}
      {talentModalOpen && (
        <AddKeywordModal
          open
          gameSlug="ryg"
          onClose={() => setTalentModalOpen(false)}
          onSelect={sel => {
            const next = activeCard.talentKws.some(k => k.keywordId === sel.keywordId)
              ? activeCard.talentKws
              : [...activeCard.talentKws, sel];
            updateActive({ talentKws: next, talents: buildKeywordsStr(next) });
            setTalentModalOpen(false);
          }}
          excludeKeywordIds={activeCard.talentKws.map(k => k.keywordId)}
        />
      )}

      {/* Special Ability */}
      {abilityModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="special-ability"
          addonTypeName="Special Ability"
          excludeAddonIds={activeCard.ability ? [activeCard.ability.addonId] : []}
          onClose={() => { setAbilityModalOpen(false); setEditingAddon(null); }}
          onAdd={addon => {
            updateActive({
              ability: { addonId: addon.id, name: addon.name, description: addon.description ?? '' },
            });
            setAbilityModalOpen(false);
          }}
          onDeleted={id => {
            if (activeCard.ability?.addonId === id) updateActive({ ability: null });
          }}
          getSubtitle={simpleSubtitle}
          CreateFormComponent={AbilityForm}
        />
      )}

      {/* Weapons */}
      {weaponModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="weapons"
          addonTypeName="Weapon"
          excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
          onClose={() => { setWeaponModalOpen(false); setEditingAddon(null); pendingWeaponKws.current = []; }}
          onAdd={addon => {
            const ws = (addon.stats ?? {}) as Record<string, unknown>;
            const kws = pendingWeaponKws.current;
            pendingWeaponKws.current = [];
            updateActive({
              weapons: [...activeCard.weapons, {
                addonId:        addon.id,
                name:           addon.name,
                damage:         typeof ws.damage === 'string' ? ws.damage : '',
                range:          typeof ws.range === 'number' ? ws.range : 0,
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

      {/* Armor */}
      {armorModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="armor"
          addonTypeName="Armor"
          excludeAddonIds={activeCard.armor.map(a => a.addonId)}
          onClose={() => setArmorModalOpen(false)}
          onAdd={addon => {
            updateActive({
              armor: [...activeCard.armor, { addonId: addon.id, name: addon.name, description: addon.description ?? '' }],
            });
            setArmorModalOpen(false);
          }}
          onDeleted={id => updateActive({ armor: activeCard.armor.filter(a => a.addonId !== id) })}
          getSubtitle={simpleSubtitle}
          CreateFormComponent={ArmorForm}
        />
      )}

      {/* Items */}
      {itemModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="items"
          addonTypeName="Item"
          excludeAddonIds={activeCard.items.map(i => i.addonId)}
          onClose={() => setItemModalOpen(false)}
          onAdd={addon => {
            updateActive({
              items: [...activeCard.items, { addonId: addon.id, name: addon.name, description: addon.description ?? '' }],
            });
            setItemModalOpen(false);
          }}
          onDeleted={id => updateActive({ items: activeCard.items.filter(i => i.addonId !== id) })}
          getSubtitle={simpleSubtitle}
          CreateFormComponent={ItemForm}
        />
      )}

      {viewingAddon && (
        <AddonInfoModal
          open
          name={viewingAddon.addonType + ': ' + viewingAddon.name}
          description={'description' in viewingAddon ? viewingAddon.description : ''}
          onClose={() => setViewingAddon(null)}
        />
      )}
    </>
  );
};

export default CardBuilderRyg;
