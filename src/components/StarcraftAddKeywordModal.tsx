/**
 * StarcraftAddKeywordModal.tsx — Multi-step modal for attaching keywords to
 * a StarCraft weapon (or ability) inside its Create/Edit form.
 *
 * STEP 1 (pick)       — Shows existing keywords for the StarCraft game (paged)
 *                       plus a "Create New Keyword" button. Empty library
 *                       skips straight to step 2.
 * STEP 2 (create)     — Form: Keyword Name, Keyword Description, "has a value"
 *                       checkbox. Saves to public.keywords.
 * STEP 3 (set-value)  — Shown when the picked / created keyword declares a
 *                       value parameter. Asks the user for a free-text value
 *                       (e.g. "Ground", "18", "All").
 *
 * Differs from Halo's AddKeywordModal in two key ways:
 *   • Keyword values are STRINGS, not numbers — set via <Input>, stored as
 *     `{ value: "Ground" }` in addon_keywords.params.
 *   • The keyword definition's params_schema is `[{ key: "value", type: "text",
 *     label: "Value" }]` when the "has a value" checkbox is on, or `[]`
 *     otherwise.
 *
 * USAGE:
 *   <StarcraftAddKeywordModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onKeywordSelected={kw => setAttached([...attached, kw])}
 *     excludeKeywordIds={attached.map(k => k.keywordId)}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import Button from './Button';
import Input from './Input';
import Checkbox from './Checkbox';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import Magnifer from '../icons/Magnifer';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import { supabase } from '../lib/supabase';
import type { Keyword } from '../lib/database.types';
import type { StarcraftKeywordAttachment } from './StarcraftCard';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;
const STARCRAFT_SLUG = 'starcraft';

type Step = 'loading' | 'pick' | 'create' | 'set-value';

// ── Props ────────────────────────────────────────────────────────────────────

export interface StarcraftAddKeywordModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once a keyword is fully selected (with value if applicable). */
  onKeywordSelected: (kw: StarcraftKeywordAttachment) => void;
  /** Keyword IDs already attached to this addon — excluded from the picker. */
  excludeKeywordIds?: string[];
  /** When provided, opens straight to the edit form prefilled. */
  editingKeyword?: { id: string; name: string; description: string; hasValue: boolean } | null;
  onKeywordUpdated?: (kw: StarcraftKeywordAttachment) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const StarcraftAddKeywordModal = ({
  open,
  onClose,
  onKeywordSelected,
  excludeKeywordIds = [],
  editingKeyword = null,
  onKeywordUpdated,
}: StarcraftAddKeywordModalProps) => {
  const [step, setStep]               = useState<Step>('loading');
  const [keywords, setKeywords]       = useState<Keyword[]>([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [page, setPage]               = useState(0);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unfilteredCount, setUnfilteredCount] = useState(0);

  // Create-step state
  const [newName, setNewName]               = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newHasValue, setNewHasValue]       = useState(false);

  // Set-value step state
  const [pendingKeyword, setPendingKeyword] = useState<Keyword | null>(null);
  const [paramValue, setParamValue]         = useState('');

  const gameIdRef    = useRef<string | null>(null);
  const userIdRef    = useRef<string | null>(null);
  const excludeRef   = useRef(excludeKeywordIds);
  const openRef      = useRef(open);
  const editingKwRef = useRef(editingKeyword);

  useEffect(() => { excludeRef.current   = excludeKeywordIds; }, [excludeKeywordIds]);
  useEffect(() => { openRef.current      = open;              }, [open]);
  useEffect(() => { editingKwRef.current = editingKeyword;    }, [editingKeyword]);

  // ── Fetch a page of keywords ──────────────────────────────────────────────

  const fetchPage = useCallback(async (p: number, search = '') => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    const excluded = excludeRef.current;

    let query = supabase
      .from('keywords')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .order('name')
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    if (excluded.length > 0) query = query.not('id', 'in', `(${excluded.join(',')})`);
    if (search.trim())       query = query.ilike('name', `%${search.trim()}%`);

    let unfilteredQuery = supabase
      .from('keywords')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (excluded.length > 0) unfilteredQuery = unfilteredQuery.not('id', 'in', `(${excluded.join(',')})`);

    const [filtered, unfiltered] = await Promise.all([query, unfilteredQuery]);
    if (!openRef.current) return;
    if (filtered.error) { console.error('[StarcraftAddKeywordModal] fetch error:', filtered.error); return; }

    const total = filtered.count ?? 0;
    setKeywords((filtered.data as Keyword[]) ?? []);
    setTotalCount(total);
    setUnfilteredCount(unfiltered.count ?? 0);
    setStep(total === 0 && !search.trim() ? 'create' : 'pick');
  }, []);

  // ── Initialise when modal opens ───────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      // Reset state when closed
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
      setParamValue('');
      setSearchQuery('');
      setUnfilteredCount(0);
      gameIdRef.current = null;
      userIdRef.current = null;
      return;
    }

    if (editingKeyword) {
      setNewName(editingKeyword.name);
      setNewDescription(editingKeyword.description);
      setNewHasValue(editingKeyword.hasValue);
      setStep('create');
    }

    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      userIdRef.current = session.user.id;

      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('slug', STARCRAFT_SLUG)
        .single();
      if (cancelled || !game) return;
      gameIdRef.current = game.id;

      if (!editingKeyword) await fetchPage(0);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchPage, editingKeyword?.id]);

  useEffect(() => {
    if (step === 'pick') fetchPage(page, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const keywordHasValue = (kw: Keyword) =>
    Array.isArray(kw.params_schema) && kw.params_schema.length > 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddExisting = () => {
    const selected = keywords.find(k => k.id === selectedId);
    if (!selected) return;

    if (keywordHasValue(selected)) {
      setPendingKeyword(selected);
      setParamValue('');
      setStep('set-value');
    } else {
      onKeywordSelected({
        keywordId:   selected.id,
        name:        selected.name,
        description: selected.description ?? '',
        hasValue:    false,
        value:       null,
      });
    }
  };

  const handleCreateSave = async () => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    const trimmedName = newName.trim();
    const trimmedDesc = newDescription.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const paramsSchema = newHasValue
        ? [{ key: 'value', type: 'text' as const, label: 'Value' }]
        : [];

      if (editingKeyword) {
        const { data, error } = await supabase
          .from('keywords')
          .update({
            name: trimmedName,
            description: trimmedDesc || null,
            params_schema: paramsSchema,
          })
          .eq('id', editingKeyword.id)
          .select()
          .single();
        if (error) throw error;

        const updated = data as Keyword;
        onKeywordUpdated?.({
          keywordId:   updated.id,
          name:        updated.name,
          description: updated.description ?? '',
          hasValue:    keywordHasValue(updated),
          value:       null,
        });
        onClose();
        return;
      }

      // Create new
      const { data, error } = await supabase
        .from('keywords')
        .insert({
          user_id: userId,
          game_id: gameId,
          name: trimmedName,
          description: trimmedDesc || null,
          params_schema: paramsSchema,
          extra: {},
        })
        .select()
        .single();
      if (error) throw error;

      const created = data as Keyword;

      if (newHasValue) {
        setPendingKeyword(created);
        setParamValue('');
        setStep('set-value');
      } else {
        onKeywordSelected({
          keywordId:   created.id,
          name:        created.name,
          description: created.description ?? '',
          hasValue:    false,
          value:       null,
        });
        onClose();
      }
    } catch (err) {
      console.error('[StarcraftAddKeywordModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCancel = () => {
    if (editingKeyword) { onClose(); return; }
    if (totalCount > 0) setStep('pick');
    else                onClose();
  };

  const handleAttachWithValue = () => {
    if (!pendingKeyword) return;
    onKeywordSelected({
      keywordId:   pendingKeyword.id,
      name:        pendingKeyword.name,
      description: pendingKeyword.description ?? '',
      hasValue:    true,
      value:       paramValue.trim(),
    });
    onClose();
  };

  const handleDelete = async (keywordId: string) => {
    const { error } = await supabase.from('keywords').delete().eq('id', keywordId);
    if (error) { console.error('[StarcraftAddKeywordModal] delete error:', error); return; }

    if (selectedId === keywordId) setSelectedId(null);

    const remaining = totalCount - 1;
    const newPage = page > 0 && keywords.length === 1 ? page - 1 : page;
    setPage(newPage);

    if (remaining === 0) {
      setKeywords([]);
      setTotalCount(0);
      setStep('create');
    } else {
      await fetchPage(newPage, searchQuery);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canSaveNew = newName.trim().length > 0 && newDescription.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">

      {/* Loading */}
      {step === 'loading' && (
        <div className="p-5 flex items-center justify-center min-h-[120px]">
          <p className="font-body text-sm text-gray-400">Loading…</p>
        </div>
      )}

      {/* Pick */}
      {step === 'pick' && (
        <div className="p-5 flex flex-col gap-3">
          <h5 className="font-heading text-xl text-white">Create new Keyword</h5>

          <Button
            variant="outline"
            color="primary"
            leftIcon={<AddCircle className="size-4" />}
            className="w-full justify-center"
            onClick={() => { setNewName(''); setNewDescription(''); setNewHasValue(false); setStep('create'); }}
          >
            Create New Keyword
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="font-body text-sm font-medium text-gray-500">OR</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <h5 className="font-heading text-xl text-white">Add Existing Keyword</h5>

          {unfilteredCount > 5 && (
            <Input
              leftIcon={<Magnifer className="size-4" />}
              placeholder="Search for a Keyword"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            />
          )}

          <div className="flex flex-col gap-1.5">
            {keywords.map(k => (
              <AddonListItem
                key={k.id}
                name={k.name}
                subtitle={k.description ?? ''}
                selected={selectedId === k.id}
                onSelect={() => setSelectedId(k.id)}
                onDelete={() => handleDelete(k.id)}
                addonTypeName="Keyword"
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="size-9 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-l-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className="size-9 flex items-center justify-center bg-gray-900 border-y border-r border-gray-700 rounded-r-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <AltArrowRight className="size-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button variant="ghost" color="danger" onClick={onClose}>Cancel</Button>
            <Button
              color="primary"
              rightIcon={<CheckCircle className="size-4" />}
              disabled={!selectedId}
              onClick={handleAddExisting}
            >
              Add Keyword
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit */}
      {step === 'create' && (
        <div className="p-5 flex flex-col gap-3">
          <h5 className="font-heading text-xl text-white">
            {editingKeyword ? 'Edit Keyword' : 'Create Keyword'}
          </h5>

          <Input
            label="Keyword Name"
            required
            placeholder="Eg. Specialist, Sidearm, Long Range, etc."
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Input
            label="Keyword Description"
            required
            placeholder="The rules of the keyword."
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
          />

          <Checkbox
            label="Keyword has a value (eg. Target (X), Range (X), etc.)"
            checked={newHasValue}
            onChange={e => setNewHasValue(e.target.checked)}
          />

          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={handleCreateCancel}>
              Cancel
            </Button>
            <Button
              color="primary"
              leftIcon={<CheckCircle className="size-4" />}
              disabled={!canSaveNew || saving}
              loading={saving}
              onClick={handleCreateSave}
            >
              Save Keyword
            </Button>
          </div>
        </div>
      )}

      {/* Set-value */}
      {step === 'set-value' && pendingKeyword && (
        <div className="p-5 flex flex-col gap-3">
          <h5 className="font-heading text-xl text-white">
            Add {pendingKeyword.name} Keyword
          </h5>
          <p className="font-body text-sm text-gray-300">
            This keyword requires a value. For example, the &lsquo;Target&rsquo; keyword
            defines a unit tag (&lsquo;Ground&rsquo;, &lsquo;Air&rsquo;, &lsquo;All&rsquo;, etc.).
          </p>

          <Input
            label="Keyword Value"
            required
            placeholder="eg. 'Ground', '18&quot;', etc."
            value={paramValue}
            onChange={e => setParamValue(e.target.value)}
          />

          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              leftIcon={<CheckCircle className="size-4" />}
              disabled={paramValue.trim().length === 0}
              onClick={handleAttachWithValue}
            >
              Add Keyword
            </Button>
          </div>
        </div>
      )}

    </Modal>
  );
};

export default StarcraftAddKeywordModal;
