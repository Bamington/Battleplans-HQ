/**
 * CardBuilderSept.tsx — RYG Sept card builder
 *
 * One card per deck (min 1, max 1).
 * The user picks: a Sept addon, a Destiny addon, any number of Benefit addons.
 *
 * Route: /app/builder/ryg-sept?deckId=<uuid>
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
import SeptCard, { CARD_W, CARD_H } from '../components/SeptCard';
import RygSeptForm from '../components/RygSeptForm';
import RygDestinyForm from '../components/RygDestinyForm';
import RygSeptBenefitForm from '../components/RygSeptBenefitForm';
import AddCircle from '../icons/AddCircle';
import CloseCircle from '../icons/CloseCircle';
// @ts-ignore
import logoRyg from '../assets/games/card assets/ryg/icon.svg';
import logoRygLarge from '../assets/games/logo-ryg.png';
import { supabase } from '../lib/supabase';
import type { RygSeptStats, RygDestinyStats } from '../lib/database.types';

// ── Local types ───────────────────────────────────────────────────────────────

interface LocalSept {
  addonId:    string;
  name:       string;
  prohibited: string;
  required:   string;
  restricted: string;
}

interface LocalDestiny {
  addonId:     string;
  name:        string;
  description: string;
  curse:       string;
}

interface LocalBenefit {
  addonId:     string;
  name:        string;
  description: string;
}

interface SeptCardData {
  id:       string;
  dbId?:    string;
  sept:     LocalSept | null;
  destiny:  LocalDestiny | null;
  benefits: LocalBenefit[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCard(): SeptCardData {
  return { id: crypto.randomUUID(), sept: null, destiny: null, benefits: [] };
}

function cardStats(card: SeptCardData): Record<string, unknown> {
  return {
    septAddonId:    card.sept?.addonId    ?? null,
    destinyAddonId: card.destiny?.addonId ?? null,
    benefits:       card.benefits.map(b => ({ addonId: b.addonId, name: b.name, description: b.description })),
  };
}

function isBlank(card: SeptCardData) {
  return !card.sept && !card.destiny && card.benefits.length === 0;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { if (i === attempts - 1) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
  throw new Error('unreachable');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardBuilderSept() {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId') ?? null;

  const [cardState, setCardState] = useState<{ card: SeptCardData }>(() => ({ card: defaultCard() }));
  const card = cardState.card;
  const dirtyRef = useRef(false);

  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  } = useCardBuilder({ deckId });

  const updateCard = useCallback((patch: Partial<SeptCardData>) => {
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
        .eq('card_type', 'sept')
        .maybeSingle();

      if (!data) return;
      type ARow = { addon_id: string; sort_order: number; addons: { name: string; description: string | null; stats: unknown; addon_type_id: string } | null };
      const cas = (data.card_addons as unknown as ARow[]) ?? [];
      let sept: LocalSept | null = null;
      let destiny: LocalDestiny | null = null;
      const benefits: LocalBenefit[] = [];

      for (const ca of [...cas].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
        const addon = ca.addons;
        if (!addon) continue;
        const slug = typeSlug[addon.addon_type_id];
        if (slug === 'septs') {
          const s = (addon.stats ?? {}) as RygSeptStats;
          sept = { addonId: ca.addon_id, name: addon.name, prohibited: s.prohibited ?? '', required: s.required ?? '', restricted: s.restricted ?? '' };
        } else if (slug === 'destinies') {
          const s = (addon.stats ?? {}) as RygDestinyStats;
          destiny = { addonId: ca.addon_id, name: addon.name, description: s.description ?? '', curse: s.curse ?? '' };
        } else if (slug === 'sept-benefits') {
          benefits.push({ addonId: ca.addon_id, name: addon.name, description: addon.description ?? '' });
        }
      }

      setCardState({ card: { id: crypto.randomUUID(), dbId: data.id, sept, destiny, benefits } });
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
        const septName = card.sept?.name ?? 'Unnamed Sept';
        if (!dbId) {
          const { data, error } = await supabase
            .from('cards')
            .insert({ deck_id: deckId, name: septName, stats: cardStats(card), card_type: 'sept', sort_order: 0 })
            .select('id').single();
          if (error) throw error;
          dbId = data.id;
          setCardState(s => ({ card: { ...s.card, dbId: data.id } }));
        } else {
          await supabase.from('cards').update({ name: septName, stats: cardStats(card) }).eq('id', dbId);
        }

        await supabase.from('card_addons').delete().eq('card_id', dbId);
        const rows: { card_id: string; addon_id: string; sort_order: number; params: object }[] = [];
        let idx = 0;
        if (card.sept)    rows.push({ card_id: dbId!, addon_id: card.sept.addonId,    sort_order: idx++, params: {} });
        if (card.destiny) rows.push({ card_id: dbId!, addon_id: card.destiny.addonId, sort_order: idx++, params: {} });
        for (const b of card.benefits) rows.push({ card_id: dbId!, addon_id: b.addonId, sort_order: idx++, params: {} });
        if (rows.length > 0) await supabase.from('card_addons').insert(rows);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [card, deckId]);

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [septModalOpen,    setSeptModalOpen]    = useState(false);
  const [destinyModalOpen, setDestinyModalOpen] = useState(false);
  const [benefitModalOpen, setBenefitModalOpen] = useState(false);

  // Stable form components
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const SeptFormComponent    = useCallback((props: Parameters<typeof RygSeptForm>[0])        => <RygSeptForm {...props} />,        []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const DestinyFormComponent = useCallback((props: Parameters<typeof RygDestinyForm>[0])     => <RygDestinyForm {...props} />,     []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const BenefitFormComponent = useCallback((props: Parameters<typeof RygSeptBenefitForm>[0]) => <RygSeptBenefitForm {...props} />, []);

  const cardPreviewProps = {
    septName:    card.sept?.name    ?? '',
    prohibited:  card.sept?.prohibited,
    required:    card.sept?.required,
    restricted:  card.sept?.restricted,
    benefits:    card.benefits.map(b => ({ name: b.name, description: b.description })),
    destinyName:  card.destiny?.name,
    destinyDesc:  card.destiny?.description,
    destinyCurse: card.destiny?.curse,
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
              unitName={card.sept?.name ?? 'Sept Card'}
              unitType={card.destiny?.name ? `Destiny: ${card.destiny.name}` : undefined}
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
              1 Sept card per deck
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
              renderItem={() => <SeptCard {...cardPreviewProps} />}
              className="w-full flex-1 min-h-0"
            />
          </CenterViewport>
        }
        rightPanelOpen={editorOpen}
        rightPanel={
          <EditorPanel title="Sept Card">
            <div className="flex flex-col gap-4 p-4">

              {/* Sept */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Sept</p>
                {card.sept ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{card.sept.name}</p>
                    <button type="button" aria-label="Remove sept" onClick={() => updateCard({ sept: null })} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors">
                      <CloseCircle className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setSeptModalOpen(true)}>
                    Add Sept
                  </Button>
                )}
              </div>

              {/* Destiny */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Destiny</p>
                {card.destiny ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{card.destiny.name}</p>
                    <button type="button" aria-label="Remove destiny" onClick={() => updateCard({ destiny: null })} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors">
                      <CloseCircle className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setDestinyModalOpen(true)}>
                    Add Destiny
                  </Button>
                )}
              </div>

              {/* Benefits */}
              <div className="flex flex-col gap-2">
                <p className="font-body text-sm font-bold text-gray-100">Benefits</p>
                {card.benefits.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {card.benefits.map(b => (
                      <div key={b.addonId} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                        <p className="font-body text-sm text-gray-200 flex-1 min-w-0 truncate">{b.name}</p>
                        <button type="button" aria-label={`Remove ${b.name}`} onClick={() => updateCard({ benefits: card.benefits.filter(x => x.addonId !== b.addonId) })} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors">
                          <CloseCircle className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={() => setBenefitModalOpen(true)}>
                  Add Benefit
                </Button>
              </div>

            </div>
          </EditorPanel>
        }
      />

      {/* Sept picker */}
      {septModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="septs"
          addonTypeName="Sept"
          excludeAddonIds={card.sept ? [card.sept.addonId] : []}
          onClose={() => setSeptModalOpen(false)}
          onAdd={async addon => {
            const s = (addon.stats ?? {}) as RygSeptStats;
            setSeptModalOpen(false);
            const patch: Partial<SeptCardData> = {
              sept: { addonId: addon.id, name: addon.name, prohibited: s.prohibited ?? '', required: s.required ?? '', restricted: s.restricted ?? '' },
            };
            const benefitIds = s.benefitIds ?? [];
            if (benefitIds.length > 0) {
              const { data } = await supabase.from('addons').select('id, name, description').in('id', benefitIds);
              if (data) {
                const byId = new Map(data.map(a => [a.id, a]));
                patch.benefits = benefitIds
                  .filter(id => byId.has(id))
                  .map(id => { const a = byId.get(id)!; return { addonId: a.id, name: a.name, description: a.description ?? '' }; });
              }
            }
            updateCard(patch);
          }}
          onDeleted={() => updateCard({ sept: null })}
          getSubtitle={a => a.description ?? '—'}
          CreateFormComponent={SeptFormComponent}
        />
      )}

      {/* Destiny picker */}
      {destinyModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="destinies"
          addonTypeName="Destiny"
          excludeAddonIds={card.destiny ? [card.destiny.addonId] : []}
          onClose={() => setDestinyModalOpen(false)}
          onAdd={addon => {
            const s = (addon.stats ?? {}) as RygDestinyStats;
            updateCard({ destiny: { addonId: addon.id, name: addon.name, description: s.description ?? '', curse: s.curse ?? '' } });
            setDestinyModalOpen(false);
          }}
          onDeleted={() => updateCard({ destiny: null })}
          getSubtitle={a => a.description ?? '—'}
          CreateFormComponent={DestinyFormComponent}
        />
      )}

      {/* Benefit picker */}
      {benefitModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="sept-benefits"
          addonTypeName="Sept Benefit"
          excludeAddonIds={card.benefits.map(b => b.addonId)}
          onClose={() => setBenefitModalOpen(false)}
          onAdd={addon => {
            updateCard({ benefits: [...card.benefits, { addonId: addon.id, name: addon.name, description: addon.description ?? '' }] });
            setBenefitModalOpen(false);
          }}
          onDeleted={id => updateCard({ benefits: card.benefits.filter(b => b.addonId !== id) })}
          getSubtitle={a => a.description ? a.description.slice(0, 60) + (a.description.length > 60 ? '…' : '') : '—'}
          CreateFormComponent={BenefitFormComponent}
        />
      )}
    </>
  );
}
