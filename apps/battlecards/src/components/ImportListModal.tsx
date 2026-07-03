/**
 * ImportListModal.tsx — Import an army list and create a new deck
 *
 * Three-step flow:
 *   1. SETUP   — enter a deck name + pick a game
 *   2. IMPORT  — toggle between "PDF Import" and "Text Import" modes;
 *                PDF shows a file upload dropzone, Text shows a textarea
 *   3. PREVIEW — shows parsed units + weapons, confirm to import
 *
 * On import:
 *   - Creates a new deck for the chosen game
 *   - Creates cards for each unit (stats default to 0)
 *   - For each weapon: reuses an existing addon if the user owns one with a
 *     matching name (case-insensitive), otherwise creates a new stub addon
 *   - Links weapons to cards via card_addons
 *
 * USAGE:
 *   <ImportListModal
 *     open={showImport}
 *     onClose={() => setShowImport(false)}
 *     onImported={(deckId, gameSlug) => navigate(`/app/builder/${gameSlug}?deckId=${deckId}`)}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import GamePickerItem from './GamePickerItem';
import HR from './HR';
import UploadMinimalistic from '../icons/UploadMinimalistic';
import CheckCircle from '../icons/CheckCircle';
import AddCircle from '../icons/AddCircle';
import AltArrowRight from '../icons/AltArrowRight';
import DangerCircle from '../icons/DangerCircle';
import FileText from '../icons/FileText';
import Clipboard from '../icons/Clipboard';
import Magnifer from '../icons/Magnifer';
import { supabase } from '../lib/supabase';
import { parseHaloList, parseKeywordRef, splitKeywords } from '../lib/parseHaloList';
import type { ParsedList, ParsedWeapon } from '../lib/parseHaloList';

import logoHaloFlashpoint from '../assets/games/logo-halo-flashpoint.png';
import logoBloodBowl from '../assets/games/logo-blood-bowl.png';
// Placeholder SVG for now — swap to logo-starcraft.png once branded art lands.
import logoStarcraft from '../assets/games/logo-starcraft.svg';

// ── Props ────────────────────────────────────────────────────────────────────

export interface ImportListModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful import with the new deck's ID and game slug */
  onImported: (deckId: string, gameSlug: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GAMES = [
  {
    slug: 'halo-flashpoint',
    name: 'Halo: Flashpoint',
    logoSrc: logoHaloFlashpoint,
    supported: true,
  },
  {
    slug: 'blood-bowl',
    name: 'Blood Bowl',
    logoSrc: logoBloodBowl,
    supported: false,
  },
  {
    slug: 'starcraft',
    name: 'StarCraft',
    logoSrc: logoStarcraft,
    supported: false,
  },
] as const;

type GameSlug = typeof GAMES[number]['slug'];

type Step = 'setup' | 'import' | 'preview';
type ImportMode = 'pdf' | 'text';

// ── Component ────────────────────────────────────────────────────────────────

const ImportListModal = ({ open, onClose, onImported }: ImportListModalProps) => {
  const [step, setStep]               = useState<Step>('setup');
  const [deckName, setDeckName]       = useState('');
  const [selectedGame, setSelectedGame] = useState<GameSlug | null>(null);
  const [importMode, setImportMode]   = useState<ImportMode>('pdf');
  const [rawText, setRawText]         = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsed, setParsed]           = useState<ParsedList | null>(null);
  const [parseError, setParseError]   = useState<string | null>(null);
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const trimmedName = deckName.trim();
  const gameInfo    = GAMES.find(g => g.slug === selectedGame);
  const canProceed  = trimmedName.length >= 1 && selectedGame !== null && (gameInfo?.supported ?? false);

  // Can continue from the import step?
  const canContinue = importMode === 'text'
    ? rawText.trim().length > 0
    : uploadedFile !== null;

  // ── Reset on close ──────────────────────────────────────────────────────

  const handleClose = () => {
    if (importing) return;
    setStep('setup');
    setDeckName('');
    setSelectedGame(null);
    setImportMode('pdf');
    setRawText('');
    setUploadedFile(null);
    setParsed(null);
    setParseError(null);
    setImportError(null);
    setDragOver(false);
    onClose();
  };

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      setParseError('File exceeds the 30 MB size limit');
      return;
    }
    setUploadedFile(file);
    setParseError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // ── Continue (parse text or PDF) ────────────────────────────────────────

  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStage, setParseStage] = useState('');
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Progress bar animation ──────────────────────────────────────────
  // Stages with approximate timing (total ~18s for Gemini round-trip)
  const PARSE_STAGES = [
    { at: 0,  label: 'Uploading PDF...',       pct: 5 },
    { at: 1,  label: 'Sending to AI...',       pct: 15 },
    { at: 3,  label: 'Analyzing document...',  pct: 30 },
    { at: 6,  label: 'Reading unit cards...',  pct: 50 },
    { at: 10, label: 'Extracting weapons...',  pct: 70 },
    { at: 14, label: 'Extracting keywords...', pct: 85 },
  ];

  const startProgress = useCallback(() => {
    setParseProgress(0);
    setParseStage(PARSE_STAGES[0].label);
    const startTime = Date.now();

    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Find the latest stage we've passed
      let currentStage = PARSE_STAGES[0];
      for (const stage of PARSE_STAGES) {
        if (elapsed >= stage.at) currentStage = stage;
      }
      setParseStage(currentStage.label);

      // Ease towards the target percentage, never reaching 100%
      setParseProgress(prev => {
        const target = currentStage.pct;
        // Asymptotic approach: close the gap by 10% each tick
        return prev + (target - prev) * 0.1;
      });
    }, 200);
  }, []);

  const stopProgress = useCallback((success: boolean) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (success) {
      setParseStage('Done!');
      setParseProgress(100);
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const handleContinue = async () => {
    setParseError(null);
    if (importMode === 'text') {
      try {
        const result = parseHaloList(rawText);
        setParsed(result);
        setStep('preview');
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse the list');
      }
    } else {
      if (!uploadedFile) return;
      setParsing(true);
      startProgress();
      try {
        // Convert file to base64 for the Edge Function
        const buffer = await uploadedFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        // Call Edge Function directly via fetch so we can read error bodies
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const { data: { session } } = await supabase.auth.getSession();

        const resp = await fetch(`${supabaseUrl}/functions/v1/parse-list-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: uploadedFile.name,
            mimeType: uploadedFile.type || 'application/pdf',
          }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data?.error || `Edge Function returned ${resp.status}`);
        }
        if (!data || !data.units || data.units.length === 0) {
          throw new Error('No units could be extracted from the PDF');
        }

        stopProgress(true);
        setParsed(data as ParsedList);
        setStep('preview');
      } catch (err) {
        stopProgress(false);
        console.error('[ImportListModal] PDF parse error:', err);
        setParseError(err instanceof Error ? err.message : 'Failed to parse the PDF');
      } finally {
        setParsing(false);
      }
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────

  /** Helper: get weapon name from a string or ParsedWeapon */
  const getWeaponName = (w: string | ParsedWeapon): string =>
    typeof w === 'string' ? w : w.name;

  /** Infer weapon type from range and name */
  const inferWeaponType = (name: string, range?: string): string => {
    if (name.toLowerCase().includes('grenade')) return 'Grenade';
    if (!range || range === 'CC') return 'Close Combat';
    return 'Ranged';
  };

  /** Helper: get weapon stats for addon creation. Blank values become '-'. */
  const getWeaponStats = (w: string | ParsedWeapon) => {
    if (typeof w === 'string') {
      return { type: inferWeaponType(w), range: '-', ap: '-', keywords: '-', pointsCost: '-' };
    }
    return {
      type: inferWeaponType(w.name, w.range),
      range: w.range || '-',
      ap: w.ap || '-',
      keywords: w.keywords || '-',
      pointsCost: '-',
    };
  };

  const handleImport = async () => {
    if (!parsed || !selectedGame) return;

    setImporting(true);
    setImportError(null);

    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const userId = session.user.id;

      // Resolve game ID
      const { data: game, error: gameErr } = await supabase
        .from('games')
        .select('id')
        .eq('slug', selectedGame)
        .single();
      if (gameErr || !game) throw new Error('Could not find game');

      // Resolve weapon addon type ID
      const { data: addonType, error: atErr } = await supabase
        .from('addon_types')
        .select('id')
        .eq('game_id', game.id)
        .eq('slug', 'weapons')
        .single();
      if (atErr || !addonType) throw new Error('Could not find weapon addon type');

      // ── Fetch existing user data for reuse ────────────────────────────

      // Existing weapon addons
      const { data: existingAddons } = await supabase
        .from('addons')
        .select('id, name')
        .eq('user_id', userId)
        .eq('addon_type_id', addonType.id);

      const addonsByName = new Map<string, string>();
      (existingAddons ?? []).forEach(a => {
        addonsByName.set(a.name.toLowerCase(), a.id);
      });

      // Existing keywords
      const { data: existingKeywords } = await supabase
        .from('keywords')
        .select('*')
        .eq('user_id', userId)
        .eq('game_id', game.id);

      const keywordsByName = new Map<string, { id: string; hasParams: boolean }>();
      (existingKeywords ?? []).forEach(k => {
        const hasParams = Array.isArray(k.params_schema) && k.params_schema.length > 0;
        keywordsByName.set(k.name.toLowerCase(), { id: k.id, hasParams });
      });

      // Build keyword definition lookup from PDF (for creating new keywords)
      const kwDefsByName = new Map<string, { description: string; hasParam: boolean }>();
      (parsed.keywordDefs ?? []).forEach(d => {
        kwDefsByName.set(d.name.toLowerCase(), { description: d.description, hasParam: d.hasParam });
      });

      /** Resolve or create a keyword by name. Returns the keyword ID. */
      const resolveKeyword = async (kwName: string): Promise<string> => {
        const key = kwName.toLowerCase();
        const existing = keywordsByName.get(key);
        if (existing) return existing.id;

        // Create new keyword
        const def = kwDefsByName.get(key);
        const hasParam = def?.hasParam ?? false;
        const paramsSchema = hasParam
          ? [{ key: 'X', type: 'number' as const, label: 'Value' }]
          : [];

        const { data, error } = await supabase
          .from('keywords')
          .insert({
            user_id: userId,
            game_id: game.id,
            name: kwName,
            description: def?.description ?? null,
            params_schema: paramsSchema,
            extra: {},
          })
          .select('id')
          .single();
        if (error || !data) throw new Error(`Failed to create keyword: ${kwName}`);

        keywordsByName.set(key, { id: data.id, hasParams: hasParam });
        return data.id;
      };

      // ── 1. Create the deck ────────────────────────────────────────────

      const { data: deck, error: deckErr } = await supabase
        .from('decks')
        .insert({ name: trimmedName, game_id: game.id, user_id: userId })
        .select('id')
        .single();
      if (deckErr || !deck) throw new Error('Failed to create deck');

      // ── 2. For each unit, create card + weapons + keywords ────────────

      for (let i = 0; i < parsed.units.length; i++) {
        const unit = parsed.units[i];

        // Build card stats — use parsed values if available, else defaults
        const cardStats = {
          ra: unit.ra ?? 0,
          fi: unit.fi ?? 0,
          sv: unit.sv ?? 0,
          advanceValue: unit.advance ?? 0,
          sprintValue: unit.sprint ?? 0,
          ar: unit.ar ?? 0,
          hp: unit.hp ?? 0,
          pointsCost: unit.pointsCost,
          keywords: unit.keywords ?? '',
        };

        const { data: card, error: cardErr } = await supabase
          .from('cards')
          .insert({
            deck_id: deck.id,
            name: unit.name,
            stats: cardStats,
            sort_order: i,
          })
          .select('id')
          .single();
        if (cardErr || !card) throw new Error(`Failed to create card: ${unit.name}`);

        // ── Attach unit keywords to card ────────────────────────────────
        if (unit.keywords) {
          const unitKwRefs = splitKeywords(unit.keywords);
          const cardKeywordRows: { card_id: string; keyword_id: string; params: Record<string, unknown>; sort_order: number }[] = [];

          for (let k = 0; k < unitKwRefs.length; k++) {
            const { name: kwName, paramValue } = parseKeywordRef(unitKwRefs[k]);
            const kwId = await resolveKeyword(kwName);
            cardKeywordRows.push({
              card_id: card.id,
              keyword_id: kwId,
              params: paramValue != null ? { X: paramValue } : {},
              sort_order: k,
            });
          }

          if (cardKeywordRows.length > 0) {
            await supabase.from('card_keywords').insert(cardKeywordRows);
          }
        }

        // ── Resolve or create weapons + attach to card ──────────────────
        const cardAddonRows: { card_id: string; addon_id: string; sort_order: number }[] = [];

        for (let w = 0; w < unit.weapons.length; w++) {
          const weapon = unit.weapons[w];
          const weaponName = getWeaponName(weapon);
          const existingId = addonsByName.get(weaponName.toLowerCase());
          let addonId: string;

          if (existingId) {
            addonId = existingId;
          } else {
            const stats = getWeaponStats(weapon);
            const { data: newAddon, error: addonErr } = await supabase
              .from('addons')
              .insert({
                user_id: userId,
                addon_type_id: addonType.id,
                name: weaponName,
                stats,
              })
              .select('id')
              .single();
            if (addonErr || !newAddon) throw new Error(`Failed to create weapon: ${weaponName}`);

            addonsByName.set(weaponName.toLowerCase(), newAddon.id);
            addonId = newAddon.id;

            // ── Attach weapon keywords to the new addon ─────────────────
            if (typeof weapon !== 'string' && weapon.keywords) {
              const wkRefs = splitKeywords(weapon.keywords);
              const addonKwRows: { addon_id: string; keyword_id: string; params: Record<string, unknown>; sort_order: number }[] = [];

              for (let k = 0; k < wkRefs.length; k++) {
                const { name: kwName, paramValue } = parseKeywordRef(wkRefs[k]);
                const kwId = await resolveKeyword(kwName);
                addonKwRows.push({
                  addon_id: newAddon.id,
                  keyword_id: kwId,
                  params: paramValue != null ? { X: paramValue } : {},
                  sort_order: k,
                });
              }

              if (addonKwRows.length > 0) {
                await supabase.from('addon_keywords').insert(addonKwRows);
              }
            }
          }

          cardAddonRows.push({ card_id: card.id, addon_id: addonId, sort_order: w });
        }

        if (cardAddonRows.length > 0) {
          const { error: linkErr } = await supabase
            .from('card_addons')
            .insert(cardAddonRows);
          if (linkErr) throw new Error(`Failed to link weapons to ${unit.name}`);
        }
      }

      // Done!
      onImported(deck.id, selectedGame);
    } catch (err) {
      console.error('[ImportListModal] import error:', err);
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">

      {/* ── Step: setup ──────────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="p-5 flex flex-col gap-3">

          <h5 className="font-heading text-xl text-white">Import List</h5>

          <p className="font-body text-base text-gray-300">
            We can import your list from another tool and use it to create a deck!
          </p>

          <Input
            label="Deck Name"
            required
            placeholder="Enter your deck name"
            value={deckName}
            onChange={e => setDeckName(e.target.value)}
            maxLength={99}
            autoFocus
          />

          <HR />

          <p className="font-body text-sm text-gray-300">
            Choose which game this deck will belong to.
          </p>

          <div className="flex flex-col gap-1.5">
            {GAMES.map(game => (
              <div key={game.slug} className="relative">
                <GamePickerItem
                  logoSrc={game.logoSrc}
                  logoAlt={game.name}
                  selected={selectedGame === game.slug}
                  onClick={() => setSelectedGame(game.slug)}
                />
                {!game.supported && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs text-gray-500">
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button variant="ghost" color="danger" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              disabled={!canProceed}
              rightIcon={<AddCircle className="size-4" />}
              onClick={() => setStep('import')}
            >
              Create New Deck
            </Button>
          </div>

        </div>
      )}

      {/* ── Step: import ─────────────────────────────────────────────────── */}
      {step === 'import' && (
        <div className="p-5 flex flex-col gap-3">

          {/* ── Parsing progress overlay ─────────────────────────────────── */}
          {parsing ? (
            <>
              <UploadMinimalistic className="size-8 text-blue-400" />

              <h5 className="font-heading text-xl text-white">Scanning List...</h5>

              <p className="font-body text-sm text-gray-400">
                {parseStage}
              </p>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.round(parseProgress)}%` }}
                />
              </div>

              <p className="font-body text-xs text-gray-500 text-center">
                This usually takes 10–20 seconds
              </p>
            </>
          ) : (
            <>
              <UploadMinimalistic className="size-8 text-blue-400" />

              <h5 className="font-heading text-xl text-white">Import List</h5>

              <p className="font-body text-base text-gray-300">
                Use this tool to import your {gameInfo?.name} list from the official
                list-builder.
                {'\n\n'}
                For best results, export your list as a PDF and import it here.
              </p>

              {/* ── Import mode toggle ──────────────────────────────────────── */}
              <div className="flex w-full">
                <button
                  type="button"
                  onClick={() => setImportMode('pdf')}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-l-lg',
                    'font-body text-sm font-medium transition-colors',
                    importMode === 'pdf'
                      ? 'bg-blue-600 text-white'
                      : 'border border-blue-500 text-blue-500 hover:bg-blue-500/10',
                  ].join(' ')}
                >
                  <FileText className="size-4" />
                  PDF Import
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('text')}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-r-lg',
                    'font-body text-sm font-medium transition-colors',
                    importMode === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'border border-blue-500 text-blue-500 hover:bg-blue-500/10',
                  ].join(' ')}
                >
                  <Clipboard className="size-4" />
                  Text Import
                </button>
              </div>

              {/* ── PDF upload dropzone ─────────────────────────────────────── */}
              {importMode === 'pdf' && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    'flex flex-col items-center justify-center gap-4',
                    'h-[228px] w-full rounded-xl cursor-pointer',
                    'border border-dashed transition-colors',
                    dragOver
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 bg-gray-700',
                  ].join(' ')}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />

                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="size-6 text-blue-400" />
                      <span className="font-body text-sm text-gray-50">{uploadedFile.name}</span>
                      <span className="font-body text-xs text-gray-400">
                        {(uploadedFile.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-2">
                        <UploadMinimalistic className="size-6 text-gray-50" />
                        <span className="font-body text-sm text-gray-50">
                          Click to upload or drag and drop your PDF.
                        </span>
                        <span className="font-body text-xs font-medium text-gray-50">
                          Max. File Size: 30MB
                        </span>
                      </div>
                      <Button size="sm" leftIcon={<Magnifer className="size-4" />}>
                        Browse Files
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* ── Text paste area ─────────────────────────────────────────── */}
              {importMode === 'text' && (
                <textarea
                  rows={10}
                  placeholder="Copy your list into this text box to continue."
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  className="w-full px-4 py-3 h-[228px] rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto"
                />
              )}

              {parseError && (
                <div className="flex items-start gap-2 text-red-400">
                  <DangerCircle className="size-4 mt-0.5 shrink-0" />
                  <p className="font-body text-sm">{parseError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" color="danger" onClick={() => { setStep('setup'); setParseError(null); }}>
                  Cancel
                </Button>
                <Button
                  disabled={!canContinue}
                  rightIcon={<AltArrowRight className="size-4" />}
                  onClick={handleContinue}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── Step: preview ────────────────────────────────────────────────── */}
      {step === 'preview' && parsed && (
        <div className="p-5 flex flex-col gap-3">

          <UploadMinimalistic className="size-8 text-blue-400" />

          <h5 className="font-heading text-xl text-white">{parsed.name}</h5>

          <p className="font-body text-sm text-gray-400">
            {parsed.pointsUsed} / {parsed.pointsMax} pts
            &nbsp;&middot;&nbsp;
            {parsed.units.length} unit{parsed.units.length !== 1 ? 's' : ''}
          </p>

          <HR />

          {/* Unit list */}
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {parsed.units.map((unit, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-sm text-white">{unit.name}</span>
                  <span className="font-body text-xs text-gray-400">+{unit.pointsCost} pts</span>
                </div>
                {/* Stats row (PDF import only) */}
                {unit.ra != null && (
                  <div className="flex gap-2 pl-3 font-body text-xs text-gray-400">
                    <span>RA {unit.ra}+</span>
                    <span>FI {unit.fi}+</span>
                    <span>SV {unit.sv}+</span>
                    <span>SP {unit.advance}/{unit.sprint}</span>
                    <span>AR{unit.ar}</span>
                    <span>HP{unit.hp}</span>
                  </div>
                )}
                {unit.weapons.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-3">
                    {unit.weapons.map((w, j) => {
                      const wName = typeof w === 'string' ? w : w.name;
                      const wDetail = typeof w !== 'string' && w.range
                        ? ` (${w.range}${w.ap && w.ap !== '-' ? `, ${w.ap}` : ''})`
                        : '';
                      return (
                        <span
                          key={j}
                          className="font-body text-xs text-gray-300 bg-gray-700 px-2 py-0.5 rounded"
                        >
                          {wName}{wDetail}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {parsed.specialOrders.length > 0 && (
            <>
              <HR />
              <p className="font-body text-xs text-gray-500">
                {parsed.specialOrders.length} special order{parsed.specialOrders.length !== 1 ? 's' : ''} detected (not yet imported)
              </p>
            </>
          )}

          {importError && (
            <div className="flex items-start gap-2 text-red-400">
              <DangerCircle className="size-4 mt-0.5 shrink-0" />
              <p className="font-body text-sm">{importError}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button
              variant="ghost"
              color="danger"
              disabled={importing}
              onClick={() => { setStep('import'); setImportError(null); }}
            >
              Back
            </Button>
            <Button
              loading={importing}
              leftIcon={<CheckCircle className="size-4" />}
              onClick={handleImport}
            >
              Import Deck
            </Button>
          </div>

        </div>
      )}

    </Modal>
  );
};

export default ImportListModal;
