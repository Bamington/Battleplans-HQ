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
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Select from '../components/Select';
import Checkbox from '../components/Checkbox';
import PrintCardGrid from '../components/PrintCardGrid';
import Eye from '../icons/Eye';
import EyeClosed from '../icons/EyeClosed';
import type {
  PaperSize,
  PrintableBloodBowlCard,
  PrintableHaloCard,
  PrintableRule,
} from '../components/PrintCardGrid';
import type { BloodBowlStats, HaloFlashpointStats } from '../lib/database.types';

// ── Keyword display helper (duplicated from builders — small pure fn) ────────

interface LocalKeywordAttachment {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

const buildKeywordsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws
    .map(k => k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName)
    .join(', ');

// ── Component ────────────────────────────────────────────────────────────────

const PrintDeck = () => {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId');

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDeckName] = useState('');
  const [gameSlug, setGameSlug] = useState<'blood-bowl' | 'halo-flashpoint' | null>(null);
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

  // ── Dynamic @page size injection ─────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${paperSize === 'a4' ? 'A4' : 'letter'}; margin: 10mm; }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [paperSize]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) { setError('No deck ID provided.'); setLoading(false); return; }

    const load = async () => {
      // 1. Fetch deck with game info
      const { data: deck, error: deckErr } = await supabase
        .from('decks')
        .select('name, game_id, games(slug, print_size, bleed_size)')
        .eq('id', deckId)
        .single();

      if (deckErr || !deck) { setError('Failed to load deck.'); setLoading(false); return; }

      const game = (deck as any).games;
      const slug = game?.slug as string;
      setDeckName(deck.name);

      // Store print dimensions from game
      if (Array.isArray(game?.print_size) && game.print_size.length === 2) {
        setPrintSize(game.print_size as [number, number]);
      }
      if (Array.isArray(game?.bleed_size) && game.bleed_size.length === 2) {
        setBleedSize(game.bleed_size as [number, number]);
      }

      if (slug !== 'blood-bowl' && slug !== 'halo-flashpoint') {
        setError(`Unsupported game: ${slug}`);
        setLoading(false);
        return;
      }
      setGameSlug(slug);

      // 2. Fetch cards based on game
      if (slug === 'blood-bowl') {
        await loadBloodBowlCards(deckId);
      } else {
        await Promise.all([
          loadHaloCards(deckId),
          loadHaloRules(deckId),
        ]);
      }

      setLoading(false);
    };

    load();
  }, [deckId]);

  // ── Blood Bowl loader ────────────────────────────────────────────────────
  const loadBloodBowlCards = async (deckId: string) => {
    type CardKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: BloodBowlStats;
      card_keywords: CardKeywordRow[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
    };

    const { data, error } = await supabase
      .from('cards')
      .select('id, name, stats, card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)), card_images(file_path, sort_order, image_type)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return;

    const cards = (data as unknown as CardRow[]).map(row => {
      const s = row.stats ?? {};
      const sortedKws = [...(row.card_keywords ?? [])]
        .filter(ck => ck.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const kws: LocalKeywordAttachment[] = sortedKws.map(ck => ({
        keywordId: ck.keyword_id,
        keywordName: ck.keywords!.name,
        description: ck.keywords!.description ?? '',
        hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
        paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
      }));

      const allImages = row.card_images ?? [];
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg = allImages.find(i => i.image_type === 'avatar');
      let portraitUrl: string | null = null;
      if (portraitImg) {
        portraitUrl = supabase.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl;
      }
      let avatarUrl: string | null = null;
      if (avatarImg) {
        avatarUrl = supabase.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl;
      }

      return {
        id: row.id,
        teamName: s.teamName ?? '',
        unitName: row.name,
        playerRole: s.playerRole ?? '',
        cost: s.cost ?? '',
        skills: buildKeywordsDisplayString(kws),
        primaryAttribute: s.primaryAttribute ?? '',
        secondaryAttribute: s.secondaryAttribute ?? '',
        ma: s.ma ?? 0,
        st: s.st ?? 0,
        ag: s.ag ?? 0,
        pa: s.pa ?? 0,
        av: s.av ?? 0,
        portraitUrl,
        avatarUrl,
      } as PrintableBloodBowlCard;
    });

    setBloodBowlCards(cards);
  };

  // ── Halo Flashpoint card loader ──────────────────────────────────────────
  const loadHaloCards = async (deckId: string) => {
    type AddonKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: HaloFlashpointStats; portrait_style: string | null;
      card_addons: { addon_id: string; sort_order: number | null; addons: { name: string; stats: Record<string, unknown>; addon_keywords: AddonKeywordRow[] } | null }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
      card_keywords: AddonKeywordRow[];
    };

    const { data, error } = await supabase
      .from('cards')
      .select('id, name, stats, portrait_style, card_addons(addon_id, sort_order, addons(name, stats, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return;

    const cards = (data as unknown as CardRow[]).map(row => {
      const s = row.stats ?? {};
      const sortedAddons = [...(row.card_addons ?? [])]
        .filter(ca => ca.addons != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const allImages = (row.card_images ?? []);
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg = allImages.find(i => i.image_type === 'avatar');
      let portraitUrl: string | null = null;
      if (portraitImg) {
        portraitUrl = supabase.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl;
      }
      let avatarUrl: string | null = null;
      if (avatarImg) {
        avatarUrl = supabase.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl;
      }

      const sortedCardKeywords = [...(row.card_keywords ?? [])]
        .filter(ck => ck.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const unitKws: LocalKeywordAttachment[] = sortedCardKeywords.map(ck => ({
        keywordId: ck.keyword_id,
        keywordName: ck.keywords!.name,
        description: ck.keywords!.description ?? '',
        hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
        paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
      }));

      return {
        id: row.id,
        unitName: row.name,
        keywords: buildKeywordsDisplayString(unitKws) || (s.keywords ?? ''),
        ra: s.ra ?? 0,
        fi: s.fi ?? 0,
        sv: s.sv ?? 0,
        advanceValue: s.advanceValue ?? 0,
        sprintValue: s.sprintValue ?? 0,
        ar: s.ar ?? 0,
        hp: s.hp ?? 0,
        pointsCost: s.pointsCost ?? 0,
        portraitUrl,
        portraitStyle: row.portrait_style ?? null,
        avatarUrl,
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
            name: ca.addons!.name,
            type: String(ws.type ?? ''),
            range: String(ws.range ?? ''),
            ap: String(ws.ap ?? ''),
            keywords: buildKeywordsDisplayString(wkws) || String(ws.keywords ?? ''),
          };
        }),
      } as PrintableHaloCard;
    });

    setHaloCards(cards);
  };

  // ── Halo rules loader ────────────────────────────────────────────────────
  const loadHaloRules = async (deckId: string) => {
    const { data, error } = await supabase
      .from('deck_rules')
      .select('id, rule_id, sort_order, rules(id, title, description)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true });

    if (error || !data) return;

    const loaded: PrintableRule[] = (data as any[])
      .filter(dr => dr.rules != null)
      .map(dr => ({
        id: dr.rules.id,
        title: dr.rules.title,
        description: dr.rules.description ?? '',
      }));

    setRules(loaded);
  };

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
  const builderPath = gameSlug === 'blood-bowl'
    ? `/app/builder/blood-bowl?deckId=${deckId}`
    : `/app/builder/halo-flashpoint?deckId=${deckId}`;

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
  const sidebarUnits: SidebarItem[] = gameSlug === 'blood-bowl'
    ? bloodBowlCards.map(c => ({ id: c.id, name: c.unitName || 'New Unit', subtitle: c.playerRole || c.teamName || '', avatarUrl: c.avatarUrl }))
    : haloCards.map(c => ({ id: c.id, name: c.unitName || 'New Unit', subtitle: c.keywords || '', avatarUrl: c.avatarUrl }));

  const sidebarRules: SidebarItem[] = rules.map(r => ({
    id: r.id, name: r.title || 'New Rule', subtitle: 'Rule', avatarUrl: null,
  }));

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
        />
      </div>
    </div>
  );
};

export default PrintDeck;
