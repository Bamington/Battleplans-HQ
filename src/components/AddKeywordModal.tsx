/**
 * AddKeywordModal.tsx — Multi-step modal for adding keywords to a weapon/addon
 *
 * STEP 1 (pick): Shows a "Create New Keyword" button and a paginated list of
 *   existing keywords for the current game. The user can select one and click
 *   "Add Keyword", or create a new keyword definition.
 *
 * STEP 2 (create): Simple form to define a new keyword: name, description,
 *   and a checkbox for whether it accepts a numeric parameter (X).
 *
 * STEP 3 (set-value): If the selected/created keyword has a parameter,
 *   prompts the user to enter the value via a Counter.
 *
 * USAGE:
 *   <AddKeywordModal
 *     open={keywordModalOpen}
 *     onClose={() => setKeywordModalOpen(false)}
 *     gameSlug="halo-flashpoint"
 *     onKeywordSelected={(kw) => {
 *       setAttachedKeywords(prev => [...prev, kw]);
 *       setKeywordModalOpen(false);
 *     }}
 *     excludeKeywordIds={attachedKeywords.map(k => k.keywordId)}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import Button from './Button';
import Input from './Input';
import Counter from './Counter';
import Checkbox from './Checkbox';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import Magnifer from '../icons/Magnifer';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import { supabase } from '../lib/supabase';
import { getMaxLength } from '../lib/constraints';
import type { Keyword, EntityConstraints } from '../lib/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface KeywordSelection {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

export interface AddKeywordModalProps {
  open: boolean;
  onClose: () => void;
  /** Slug of the game — used to scope keyword queries */
  gameSlug: string;
  /** Called when a keyword is fully selected (with param value if applicable) */
  onKeywordSelected: (kw: KeywordSelection) => void;
  /** Keyword IDs already attached — excluded from the picker list */
  excludeKeywordIds?: string[];
  /** When provided, opens directly to the edit form with prefilled values */
  editingKeyword?: { id: string; name: string; description: string; hasParams: boolean } | null;
  /** Called after a keyword definition is updated (name/description changed) */
  onKeywordUpdated?: (kw: KeywordSelection) => void;
  /** Display name for the entity type — defaults to "Keyword". Use "Skill" for Blood Bowl. */
  typeName?: string;
  /** Examples shown in the "has a value" checkbox label. Defaults to "Blast (X), Weight of Fire (X)". */
  valueExamples?: string;
  /** DB-driven constraints for keyword fields (name maxLength, description maxLength, etc.) */
  constraints?: EntityConstraints;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

type Step = 'loading' | 'pick' | 'create' | 'set-value';

// ── Component ────────────────────────────────────────────────────────────────

const AddKeywordModal = ({
  open,
  onClose,
  gameSlug,
  onKeywordSelected,
  excludeKeywordIds = [],
  editingKeyword = null,
  onKeywordUpdated,
  typeName = 'Keyword',
  valueExamples = 'Blast (X), Weight of Fire (X)',
  constraints = {},
}: AddKeywordModalProps) => {
  const [step, setStep]               = useState<Step>('loading');
  const [keywords, setKeywords]       = useState<Keyword[]>([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [page, setPage]               = useState(0);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unfilteredCount, setUnfilteredCount] = useState(0);

  // Create form state
  const [newName, setNewName]           = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newHasValue, setNewHasValue]   = useState(false);

  // Set-value step state
  const [pendingKeyword, setPendingKeyword] = useState<Keyword | null>(null);
  const [paramValue, setParamValue]         = useState(1);

  // Resolved IDs in refs (stable across renders)
  const gameIdRef        = useRef<string | null>(null);
  const userIdRef        = useRef<string | null>(null);
  const excludeRef       = useRef(excludeKeywordIds);
  const openRef          = useRef(open);
  const editingKwRef     = useRef(editingKeyword);

  useEffect(() => { excludeRef.current    = excludeKeywordIds; }, [excludeKeywordIds]);
  useEffect(() => { openRef.current       = open;              }, [open]);
  useEffect(() => { editingKwRef.current  = editingKeyword;    }, [editingKeyword]);

  // ── Fetch a page of keywords ──────────────────────────────────────────────

  const fetchPage = useCallback(async (p: number, search = '') => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    const excluded = excludeRef.current;

    // Build the filtered query
    let query = supabase
      .from('keywords')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .order('name')
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Also fetch unfiltered count (no search filter) to decide whether to show search bar
    let unfilteredQuery = supabase
      .from('keywords')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (excluded.length > 0) {
      unfilteredQuery = unfilteredQuery.not('id', 'in', `(${excluded.join(',')})`);
    }

    const [filtered, unfiltered] = await Promise.all([query, unfilteredQuery]);
    if (!openRef.current) return;
    if (filtered.error) { console.error('[AddKeywordModal] fetch error:', filtered.error); return; }

    setKeywords((filtered.data as Keyword[]) ?? []);
    setTotalCount(filtered.count ?? 0);
    setUnfilteredCount(unfiltered.count ?? 0);
    setStep('pick');
  }, []);

  // ── Initialise when modal opens ───────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      // Reset all state when closed
      setStep('loading');
      setKeywords([]);
      setTotalCount(0);
      setPage(0);
      setSelectedId(null);
      setSaving(false);
      setNewName('');
      setNewDescription('');
      setNewHasValue(false);
      setPendingKeyword(null);
      setParamValue(1);
      setSearchQuery('');
      setUnfilteredCount(0);
      gameIdRef.current = null;
      userIdRef.current = null;
      return;
    }

    // When editing, show the form immediately with prefilled values
    if (editingKeyword) {
      setNewName(editingKeyword.name);
      setNewDescription(editingKeyword.description);
      setNewHasValue(editingKeyword.hasParams);
      setStep('create');
    }

    let cancelled = false;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      userIdRef.current = session.user.id;

      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('slug', gameSlug)
        .single();
      if (cancelled || !game) return;

      gameIdRef.current = game.id;

      // For non-edit mode, show the picker after resolving IDs
      if (!editingKeyword) {
        await fetchPage(0);
      }
    };

    init();
    return () => { cancelled = true; };
    // editingKeyword is an object — stringify to stabilise the dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameSlug, fetchPage, editingKeyword?.id]);

  // ── Re-fetch when the page changes ────────────────────────────────────────

  useEffect(() => {
    if (step === 'pick') fetchPage(page, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddExisting = () => {
    const selected = keywords.find(k => k.id === selectedId);
    if (!selected) return;

    const hasParams = Array.isArray(selected.params_schema) && selected.params_schema.length > 0;
    if (hasParams) {
      setPendingKeyword(selected);
      setParamValue(1);
      setStep('set-value');
    } else {
      onKeywordSelected({
        keywordId: selected.id,
        keywordName: selected.name,
        description: selected.description ?? '',
        hasParams: false,
        paramValue: null,
      });
    }
  };

  const handleCreateSave = async () => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    setSaving(true);
    try {
      const paramsSchema = newHasValue
        ? [{ key: 'X', type: 'number' as const, label: 'Value' }]
        : [];

      if (editingKeyword) {
        // Update existing keyword definition
        const { data, error } = await supabase
          .from('keywords')
          .update({
            name: newName.trim(),
            description: newDescription.trim() || null,
            params_schema: paramsSchema,
          })
          .eq('id', editingKeyword.id)
          .select()
          .single();
        if (error) throw error;

        const updated = data as Keyword;
        onKeywordUpdated?.({
          keywordId: updated.id,
          keywordName: updated.name,
          description: updated.description ?? '',
          hasParams: Array.isArray(updated.params_schema) && updated.params_schema.length > 0,
          paramValue: null,
        });
        onClose();
      } else {
        // Create new keyword
        const { data, error } = await supabase
          .from('keywords')
          .insert({
            user_id: userId,
            game_id: gameId,
            name: newName.trim(),
            description: newDescription.trim() || null,
            params_schema: paramsSchema,
            extra: {},
          })
          .select()
          .single();
        if (error) throw error;

        const created = data as Keyword;

        if (newHasValue) {
          setPendingKeyword(created);
          setParamValue(1);
          setStep('set-value');
        } else {
          onKeywordSelected({
            keywordId: created.id,
            keywordName: created.name,
            description: created.description ?? '',
            hasParams: false,
            paramValue: null,
          });
        }
      }
    } catch (err) {
      console.error('[AddKeywordModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleValueSave = () => {
    if (!pendingKeyword) return;
    onKeywordSelected({
      keywordId: pendingKeyword.id,
      keywordName: pendingKeyword.name,
      description: pendingKeyword.description ?? '',
      hasParams: true,
      paramValue: paramValue,
    });
  };

  const handleCreateCancel = () => {
    if (editingKeyword) {
      // Editing mode — just close the modal
      onClose();
      return;
    }
    setNewName('');
    setNewDescription('');
    setNewHasValue(false);
    // Go back to pick — always, since the user might want to pick an existing one
    setStep('pick');
    // Re-fetch in case the list changed
    fetchPage(page, searchQuery);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canCreate  = newName.trim() !== '' && newDescription.trim() !== '' && !saving;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">

      {/* ── Step: loading ──────────────────────────────────────────────────── */}
      {step === 'loading' && (
        <div className="p-5 flex items-center justify-center min-h-[120px]">
          <p className="font-body text-sm text-gray-400">Loading…</p>
        </div>
      )}

      {/* ── Step: pick ─────────────────────────────────────────────────────── */}
      {step === 'pick' && (
        <div className="p-5 flex flex-col gap-3">

          {/* Create New button */}
          <h5 className="font-heading text-xl text-white">
            Create new {typeName}
          </h5>

          <Button
            variant="outline"
            color="primary"
            leftIcon={<AddCircle className="size-4" />}
            className="w-full justify-center"
            onClick={() => {
              setNewName('');
              setNewDescription('');
              setNewHasValue(false);
              setStep('create');
            }}
          >
            Create New {typeName}
          </Button>

          {/* OR divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="font-body text-sm font-medium text-gray-500">OR</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Existing heading */}
          <h5 className="font-heading text-xl text-white">
            Add Existing {typeName}
          </h5>

          {/* Search — shown only when there are more than 5 possible keywords */}
          {unfilteredCount > 5 && (
            <Input
              leftIcon={<Magnifer className="size-4" />}
              placeholder={`Search for a ${typeName}`}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          )}

          {/* List */}
          <div className="flex flex-col gap-1.5">
            {keywords.length === 0 && (
              <p className="font-body text-sm text-gray-400 py-4 text-center">
                No keywords yet. Create one above.
              </p>
            )}
            {keywords.map(kw => (
              <AddonListItem
                key={kw.id}
                name={kw.name}
                subtitle={kw.description ?? ''}
                selected={selectedId === kw.id}
                onSelect={() => setSelectedId(kw.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="size-9 flex items-center justify-center
                           bg-gray-900 border border-gray-700 rounded-l-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Previous page"
              >
                <AltArrowLeft className="size-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={[
                    'size-9 flex items-center justify-center font-body text-sm',
                    'border-y border-r border-gray-700 transition-colors',
                    i === page
                      ? 'bg-gray-800 text-gray-50'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white',
                  ].join(' ')}
                >
                  {i + 1}
                </button>
              ))}

              <button
                type="button"
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="size-9 flex items-center justify-center
                           bg-gray-900 border-y border-r border-gray-700 rounded-r-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Next page"
              >
                <AltArrowRight className="size-4" />
              </button>
            </div>
          )}

          {/* CTAs */}
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button variant="ghost" color="danger" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              rightIcon={<CheckCircle className="size-4" />}
              disabled={!selectedId}
              onClick={handleAddExisting}
            >
              Add {typeName}
            </Button>
          </div>

        </div>
      )}

      {/* ── Step: create ───────────────────────────────────────────────────── */}
      {step === 'create' && (
        <div className="p-5 flex flex-col gap-3">

          <h5 className="font-heading text-xl text-white">
            {editingKeyword ? `Edit ${typeName}` : `Create ${typeName}`}
          </h5>

          <Input
            label={`${typeName} Name`}
            required
            placeholder="eg. Ranged, Poison, etc"
            value={newName}
            maxLength={getMaxLength(constraints, 'name')}
            onChange={e => setNewName(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5 items-center font-body text-sm font-medium text-gray-900 dark:text-white">
              <span>{typeName} Description</span><span className="text-red-600">*</span>
            </div>
            <textarea
              rows={4}
              placeholder="The rules for this keyword"
              value={newDescription}
              maxLength={getMaxLength(constraints, 'description')}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto"
            />
          </div>

          <Checkbox
            label={`${typeName} has a value (eg. ${valueExamples}, etc.`}
            checked={newHasValue}
            onChange={e => setNewHasValue(e.target.checked)}
          />

          {/* CTAs */}
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button
              variant="ghost"
              color="danger"
              leftIcon={<CloseCircle className="size-4" />}
              onClick={handleCreateCancel}
            >
              Cancel
            </Button>
            <Button
              leftIcon={<CheckCircle className="size-4" />}
              disabled={!canCreate}
              loading={saving}
              onClick={handleCreateSave}
            >
              Save {typeName}
            </Button>
          </div>

        </div>
      )}

      {/* ── Step: set-value ────────────────────────────────────────────────── */}
      {step === 'set-value' && pendingKeyword && (
        <div className="p-5 flex flex-col gap-3">

          <h5 className="font-heading text-xl text-white">
            Add {pendingKeyword.name} {typeName}
          </h5>

          <div className="flex flex-col gap-2">
            <p className="font-body text-base font-bold text-gray-100">
              {typeName} Value
            </p>
            <p className="font-body text-sm text-gray-300">
              Use this for keywords like Weight of Fire or Energy Shield that have a number value.
            </p>

            <Counter
              label="Keyword Value"
              required
              min={0}
              value={paramValue}
              onChange={setParamValue}
            />
          </div>

          <hr className="border-gray-700" />

          {/* CTAs */}
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button
              variant="ghost"
              color="danger"
              leftIcon={<CloseCircle className="size-4" />}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              leftIcon={<CheckCircle className="size-4" />}
              onClick={handleValueSave}
            >
              Save {typeName}
            </Button>
          </div>

        </div>
      )}

    </Modal>
  );
};

export default AddKeywordModal;
