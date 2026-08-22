/**
 * PrintDeck.tsx — Print layout page
 *
 * Fetches all cards in a deck and renders them in a WYSIWYG print preview.
 * The user can select paper size, exclude individual cards/rules, and hit
 * Print to invoke the browser's native print dialog.
 *
 * Route: /app/print?deckId=<uuid>
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@battleplans/ui';
import { Button } from '@battleplans/ui';
import { Select } from '@battleplans/ui';
import { Checkbox } from '@battleplans/ui';
import PrintCardGrid from '../components/PrintCardGrid';
import { Eye } from '@battleplans/ui';
import { EyeClosed } from '@battleplans/ui';
import type {
  PaperSize,
  PrintableBloodBowlCard,
  PrintableHaloCard,
  PrintableKillTeamCard,
  PrintableKillTeamRule,
  PrintableRule,
  PrintableRygCard,
  PrintableRygSept,
  PrintableRygGod,
} from '../components/PrintCardGrid';
import { loadPrintableDeck } from '../lib/loadPrintableDeck';

// ── Component ────────────────────────────────────────────────────────────────

const PrintDeck = () => {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId');

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDeckName] = useState('');
  const [gameSlug, setGameSlug] = useState<'blood-bowl' | 'halo-flashpoint' | 'kill-team' | 'ryg' | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showBleed, setShowBleed] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);

  // Print dimensions from game
  const [printSize, setPrintSize] = useState<[number, number]>([0, 0]);
  const [bleedSize, setBleedSize] = useState<[number, number]>([0, 0]);

  // Card data
  const [bloodBowlCards, setBloodBowlCards] = useState<PrintableBloodBowlCard[]>([]);
  const [haloCards, setHaloCards] = useState<PrintableHaloCard[]>([]);
  const [rules, setRules] = useState<PrintableRule[]>([]);
  const [killTeamCards, setKillTeamCards] = useState<PrintableKillTeamCard[]>([]);
  const [killTeamRules, setKillTeamRules] = useState<PrintableKillTeamRule[]>([]);
  const [rygCards, setRygCards] = useState<PrintableRygCard[]>([]);
  const [rygSeptCard, setRygSeptCard] = useState<PrintableRygSept | null>(null);
  const [rygGodCard, setRygGodCard] = useState<PrintableRygGod | null>(null);

  // ── Dynamic @page size injection ─────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${paperSize === 'a4' ? 'A4' : 'letter'}; margin: 10mm; }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [paperSize]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  // The per-game loading lives in loadPrintableDeck, shared with the read-only
  // view of a deck someone opened from a share link. This spreads the result
  // into the page's state; nothing about the queries themselves changed.
  useEffect(() => {
    if (!deckId) { setError('No deck ID provided.'); setLoading(false); return; }

    const load = async () => {
      const result = await loadPrintableDeck(supabase, deckId);

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const d = result.deck;
      setDeckName(d.deckName);
      setGameSlug(d.gameSlug);
      setPrintSize(d.printSize);
      setBleedSize(d.bleedSize);
      setBloodBowlCards(d.bloodBowlCards);
      setHaloCards(d.haloCards);
      setRules(d.rules);
      setKillTeamCards(d.killTeamCards);
      setKillTeamRules(d.killTeamRules);
      setRygCards(d.rygCards);
      setRygSeptCard(d.rygSeptCard);
      setRygGodCard(d.rygGodCard);
      setLoading(false);
    };

    load();
  }, [deckId]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleExclude = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Determine builder back-link ──────────────────────────────────────────
  const builderPath =
    gameSlug === 'blood-bowl'      ? `/app/builder/blood-bowl?deckId=${deckId}`      :
    gameSlug === 'kill-team'       ? `/app/builder/kill-team?deckId=${deckId}`       :
    gameSlug === 'ryg'             ? `/app/builder/ryg?deckId=${deckId}`             :
    `/app/builder/halo-flashpoint?deckId=${deckId}`;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!deckId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">No deck ID provided.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading deck...</p>
      </div>
    );
  }

  if (error || !gameSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-red-400">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  // ── Build sidebar card list data ───────────────────────────────────────
  type SidebarItem = { id: string; name: string; subtitle: string; avatarUrl: string | null };
  const sidebarUnits: SidebarItem[] =
    gameSlug === 'blood-bowl' ? bloodBowlCards.map(c => ({ id: c.id, name: c.unitName || 'New Unit', subtitle: c.playerRole || c.teamName || '', avatarUrl: c.avatarUrl })) :
    gameSlug === 'kill-team'  ? killTeamCards.map(c => ({ id: c.id, name: c.operativeName || 'New Operative', subtitle: c.role || c.teamName || '', avatarUrl: c.avatarUrl })) :
    gameSlug === 'ryg'        ? [
      ...rygCards.map(c => ({ id: c.id, name: c.warriorName || 'New Warrior', subtitle: c.type || c.sept || '', avatarUrl: c.avatarUrl })),
      ...(rygSeptCard ? [{ id: rygSeptCard.id, name: rygSeptCard.septName || 'Sept', subtitle: 'Sept Card', avatarUrl: null }] : []),
      ...(rygGodCard  ? [{ id: rygGodCard.id,  name: rygGodCard.godName   || 'God',  subtitle: 'God Card',  avatarUrl: null }] : []),
    ] :
    haloCards.map(c => ({ id: c.id, name: c.unitName || 'New Unit', subtitle: c.keywords || '', avatarUrl: c.avatarUrl }));

  const sidebarRules: SidebarItem[] =
    gameSlug === 'kill-team'
      ? killTeamRules.map(r => ({ id: r.id, name: r.title || 'New Rule', subtitle: 'Faction Rule', avatarUrl: null }))
      : gameSlug === 'ryg' ? []
      : rules.map(r => ({ id: r.id, name: r.title || 'New Rule', subtitle: 'Rule', avatarUrl: null }));

  return (
    <div className="h-screen flex bg-gray-950 overflow-hidden">

      {/* ── Sidebar (hidden on print) ──────────────────────────────────────── */}
      <div className="print-toolbar w-[280px] shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden">

        {/* Back button */}
        <div className="p-3">
          <Link to={builderPath}>
            <Button variant="outline" color="secondary" size="sm" className="w-full">
              &larr; Back
            </Button>
          </Link>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1">
          {sidebarUnits.map(item => {
            const included = !excludedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleExclude(item.id)}
                className={[
                  'w-full flex items-center gap-[9px] pr-2 rounded overflow-hidden border transition-colors text-left cursor-pointer',
                  included ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50',
                ].join(' ')}
              >
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt="" className="size-[42px] shrink-0 object-contain bg-gradient-to-b from-[#252525] to-[#181d24]" />
                ) : (
                  <div className="size-[42px] shrink-0 flex items-center justify-center bg-gradient-to-b from-[#252525] to-[#181d24]">
                    <span className="text-xs font-body font-medium text-gray-500">{item.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-base font-medium font-body leading-6 truncate text-gray-100">{item.name}</p>
                  {item.subtitle && (
                    <p className="text-xs font-bold font-body uppercase tracking-[1.2px] leading-4 truncate text-gray-500">{item.subtitle}</p>
                  )}
                </div>
                {included
                  ? <Eye className="size-4 shrink-0 text-green-400" />
                  : <EyeClosed className="size-4 shrink-0 text-gray-600" />
                }
              </button>
            );
          })}

          {sidebarRules.map(item => {
            const included = !excludedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleExclude(item.id)}
                className={[
                  'w-full flex items-center gap-[9px] px-2 py-1.5 rounded overflow-hidden border transition-colors text-left cursor-pointer',
                  included ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-base font-medium font-body leading-6 truncate text-gray-100">{item.name}</p>
                  <p className="text-xs font-bold font-body uppercase tracking-[1.2px] leading-4 truncate text-gray-500">Rule</p>
                </div>
                {included
                  ? <Eye className="size-4 shrink-0 text-green-400" />
                  : <EyeClosed className="size-4 shrink-0 text-gray-600" />
                }
              </button>
            );
          })}
        </div>

        {/* Bottom controls */}
        <div className="p-3 border-t border-gray-700 flex flex-col gap-3">
          <Checkbox
            label="Show Bleed Markers"
            checked={showBleed}
            onChange={() => setShowBleed(v => !v)}
          />
          <Checkbox
            label="Show Cutting Lines"
            checked={showCutLines}
            onChange={() => setShowCutLines(v => !v)}
          />

          <p className="font-body text-sm font-semibold text-gray-100">Paper Size</p>
          <Select
            size="sm"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            options={[
              { value: 'a4',     label: 'A4 (210 x 297mm)' },
              { value: 'letter', label: 'US Letter (8.5 x 11in)' },
            ]}
          />

          <Button
            size="base"
            color="primary"
            className="w-full"
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>
      </div>

      {/* ── Print preview area ─────────────────────────────────────────────── */}
      <div className="print-preview-area flex-1 flex flex-col items-center gap-8 p-8 bg-gray-800 overflow-auto">
        <PrintCardGrid
          gameSlug={gameSlug}
          paperSize={paperSize}
          printSize={printSize}
          bleedSize={bleedSize}
          excludedIds={excludedIds}
          showBleed={showBleed}
          showCutLines={showCutLines}
          bloodBowlCards={bloodBowlCards}
          haloCards={haloCards}
          rules={rules}
          killTeamCards={killTeamCards}
          killTeamRules={killTeamRules}
          rygCards={rygCards}
          rygSeptCard={rygSeptCard ?? undefined}
          rygGodCard={rygGodCard ?? undefined}
        />
      </div>
    </div>
  );
};

export default PrintDeck;
