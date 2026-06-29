/**
 * CardBuilderGod.tsx — RYG God card builder
 *
 * One card per deck (min 1, max 1).
 * The user picks a God addon from their pack.
 *
 * Route: /app/builder/ryg-god?deckId=<uuid>
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CenterViewport from '../components/CenterViewport';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import { useCardBuilder } from '../hooks/useCardBuilder';
import UnitListEntry from '../components/UnitListEntry';
import Button from '../components/Button';
import CardCarousel from '../components/CardCarousel';
import AddAddonModal from '../components/AddAddonModal';
import GodCard, { CARD_W, CARD_H } from '../components/GodCard';
import RygGodForm from '../components/RygGodForm';
import AddCircle from '../icons/AddCircle';
import CloseCircle from '../icons/CloseCircle';
// @ts-ignore
import logoRyg from '../assets/games/card assets/ryg/icon.svg';
import logoRygLarge from '../assets/games/logo-ryg.png';
import { supabase } from '../lib/supabase';
import type { RygGodStats } from '../lib/database.types';

// ── Local types ───────────────────────────────────────────────────────────────

interface LocalGod {
  addonId:        string;
  name:           string;
  specialAbility: string;
  minions:        string;
  servants:       string;
  lieutenants:    string;
  champions:      string;
}

interface GodCardData {
  id:    string;
  dbId?: string;
  god:   LocalGod | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCard(): GodCardData {
  return { id: crypto.randomUUID(), god: null };
}

function cardStats(card: GodCardData): Record<string, unknown> {
  return { godAddonId: card.god?.addonId ?? null };
}

function isBlank(card: GodCardData) {
  return !card.god;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { if (i === attempts - 1) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
  throw new Error('unreachable');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardBuilderGod() {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId') ?? null;

  const [cardState, setCardState] = useState<{ card: GodCardData }>(() => ({ card: defaultCard() }));
  const card = cardState.card;
  const dirtyRef = useRef(false);

  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  } = useCardBuilder({ deckId });

  const updateCard = useCallback((patch: Partial<GodCardData>) => {
    dirtyRef.current = true;
    setCardState(s => ({ card: { ...s.card, ...patch } }));
  }, []);

  // ── Load from DB ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;
    supabase.from('decks').select('name').eq('id', deckId).single().then(({ data }) => {
      if (data) setDeckName(data.name);
    });
    (async () => {
      const { data: addonTypes } = await supabase
        .from('addon_types')
        .select('id, slug, games!inner(slug)')
        .eq('games.slug', 'ryg');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typeSlug: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (addonTypes as any[] | null)?.forEach(t => { typeSlug[t.id] = t.slug; });

      const { data } = await supabase
        .from('cards')
        .select('id, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id))')
        .eq('deck_id', deckId)
        .eq('card_type', 'god')
        .maybeSingle();

      if (!data) return;
      type ARow = { addon_id: string; sort_order: number; addons: { name: string; description: string | null; stats: unknown; addon_type_id: string } | null };
      const cas = (data.card_addons as unknown as ARow[]) ?? [];

      for (const ca of cas) {
        const addon = ca.addons;
        if (!addon) continue;
        if (typeSlug[addon.addon_type_id] === 'gods') {
          const s = (addon.stats ?? {}) as RygGodStats;
          const god: LocalGod = {
            addonId:        ca.addon_id,
            name:           addon.name,
            specialAbility: s.specialAbility ?? '',
            minions:        s.minions        ?? '',
            servants:       s.servants       ?? '',
            lieutenants:    s.lieutenants    ?? '',
            champions:      s.champions      ?? '',
          };
          setCardState({ card: { id: crypto.randomUUID(), dbId: data.id, god } });
          return;
        }
      }

      setCardState({ card: { id: crypto.randomUUID(), dbId: data.id, god: null } });
    })();
  }, [deckId]);

  // ── Auto-save ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || !dirtyRef.current) return;
    dirtyRef.current = false;
    const timer = setTimeout(async () => {
      if (isBlank(card)) return;
      await withRetry(async () => {
        let dbId = card.dbId;
        const godName = card.god?.name ?? 'Unnamed God';
        if (!dbId) {
          const { data, error } = await supabase
            .from('cards')
            .insert({ deck_id: deckId, name: godName, stats: cardStats(card), card_type: 'god', sort_order: 0 })
            .select('id').single();
          if (error) throw error;
          dbId = data.id;
          setCardState(s => ({ card: { ...s.card, dbId: data.id } }));
        } else {
          await supabase.from('cards').update({ name: godName, stats: cardStats(card) }).eq('id', dbId);
        }

        await supabase.from('card_addons').delete().eq('card_id', dbId);
        if (card.god) {
          await supabase.from('card_addons').insert([{ card_id: dbId!, addon_id: card.god.addonId, sort_order: 0, params: {} }]);
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [card, deckId]);

  // ── Modal ───────────────────────────────────────────────────────────────────
  const [godModalOpen, setGodModalOpen] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const GodFormComponent = useCallback((props: Parameters<typeof RygGodForm>[0]) => <RygGodForm {...props} />, []);

  const cardPreviewProps = {
    godName:        card.god?.name           ?? '',
    specialAbility: card.god?.specialAbility ?? '',
    minions:        card.god?.minions        ?? '',
    servants:       card.god?.servants       ?? '',
    lieutenants:    card.god?.lieutenants    ?? '',
    champions:      card.god?.champions      ?? '',
  };

  return (
    <>
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
          >
            <UnitListEntry
              unitName={card.god?.name ?? 'God Card'}
              avatarSrc={logoRyg}
              status={isBlank(card) ? 'blank' : 'complete'}
              active
              activated={false}
              editMode={false}
              onClick={() => {}}
              onDuplicate={undefined}
              onDelete={undefined}
            />
            <p className="font-body text-xs text-gray-500 text-center px-2 pb-2">
              1 God card per deck
            </p>
          </CardListPanel>
        }
        center={
          <CenterViewport
            logo={<img src={logoRygLarge} alt="Repent Ye Foolish Gods" className="h-12 object-contain opacity-80" />}
            mobilePanelOpen={mobilePanelOpen}
            isShortHeight={isShortHeight}
          >
            <CardCarousel
              items={[card]}
              activeId={card.id}
              onActiveChange={() => {}}
              cardWidth={CARD_W}
              cardHeight={CARD_H}
              renderItem={() => <GodCard {...cardPreviewProps} />}
              className="w-full flex-1 min-h-0"
            />
          </CenterViewport>
        }
        rightPanelOpen={editorOpen}
        rightPanel={
          <EditorPanel title="God Card">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">God</p>
                {card.god ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{card.god.name}</p>
                    <button type="button" aria-label="Remove god" onClick={() => updateCard({ god: null })} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors">
                      <CloseCircle className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setGodModalOpen(true)}>
                    Add God
                  </Button>
                )}
              </div>
            </div>
          </EditorPanel>
        }
      />

      {/* God picker */}
      {godModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="gods"
          addonTypeName="God"
          excludeAddonIds={card.god ? [card.god.addonId] : []}
          onClose={() => setGodModalOpen(false)}
          onAdd={addon => {
            const s = (addon.stats ?? {}) as RygGodStats;
            updateCard({
              god: {
                addonId:        addon.id,
                name:           addon.name,
                specialAbility: s.specialAbility ?? '',
                minions:        s.minions        ?? '',
                servants:       s.servants       ?? '',
                lieutenants:    s.lieutenants    ?? '',
                champions:      s.champions      ?? '',
              },
            });
            setGodModalOpen(false);
          }}
          onDeleted={() => updateCard({ god: null })}
          getSubtitle={a => a.description ?? '—'}
          CreateFormComponent={GodFormComponent}
        />
      )}
    </>
  );
}
