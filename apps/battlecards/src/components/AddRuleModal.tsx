/**
 * AddRuleModal.tsx — Multi-step modal for adding rules to a deck
 *
 * STEP 1 (pick): Shows a "Create New Rule" button and a paginated list of
 *   existing rules for the current game. The user can select one and click
 *   "Add Rule", or create a new rule definition.
 *
 * STEP 2 (create): Form to define a new rule: title + markdown description.
 *
 * Rules are simpler than keywords — no parameter step.
 *
 * USAGE:
 *   <AddRuleModal
 *     open={ruleModalOpen}
 *     onClose={() => setRuleModalOpen(false)}
 *     gameSlug="halo-flashpoint"
 *     onRuleSelected={(rule) => {
 *       setAttachedRules(prev => [...prev, rule]);
 *       setRuleModalOpen(false);
 *     }}
 *     excludeRuleIds={attachedRules.map(r => r.ruleId)}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import Button from './Button';
import Input from './Input';
import RichTextEditor from './RichTextEditor';
import Dropdown, { DropdownItem } from './Dropdown';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import Magnifer from '../icons/Magnifer';
import MenuDots from '../icons/MenuDots';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import { supabase } from '../lib/supabase';
import { getMaxLength } from '../lib/constraints';
import type { Rule, EntityConstraints } from '../lib/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RuleSelection {
  ruleId:      string;
  title:       string;
  description: string;
}

export interface AddRuleModalProps {
  open:    boolean;
  onClose: () => void;
  /** Slug of the game — used to scope rule queries */
  gameSlug: string;
  /** Called when a rule is fully selected */
  onRuleSelected: (rule: RuleSelection) => void;
  /** Rule IDs already attached — excluded from the picker list */
  excludeRuleIds?: string[];
  /** When provided, opens directly to the edit form with prefilled values */
  editingRule?: { id: string; title: string; description: string } | null;
  /** Called after a rule definition is updated (title/description changed) */
  onRuleUpdated?: (rule: RuleSelection) => void;
  /** DB-driven constraints for rule fields */
  constraints?: EntityConstraints;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

type Step = 'loading' | 'pick' | 'create';

// ── Component ────────────────────────────────────────────────────────────────

const AddRuleModal = ({
  open,
  onClose,
  gameSlug,
  onRuleSelected,
  excludeRuleIds = [],
  editingRule = null,
  onRuleUpdated,
  constraints = {},
}: AddRuleModalProps) => {
  const [step, setStep]               = useState<Step>('loading');
  const [rules, setRules]             = useState<Rule[]>([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [page, setPage]               = useState(0);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [templates, setTemplates]     = useState<Rule[]>([]);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle]             = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Reset step list state whenever modal closes

  // Resolved IDs in refs
  const gameIdRef    = useRef<string | null>(null);
  const userIdRef    = useRef<string | null>(null);
  const excludeRef   = useRef(excludeRuleIds);
  const openRef      = useRef(open);
  const editingRef   = useRef(editingRule);

  useEffect(() => { excludeRef.current  = excludeRuleIds; }, [excludeRuleIds]);
  useEffect(() => { openRef.current     = open;           }, [open]);
  useEffect(() => { editingRef.current  = editingRule;    }, [editingRule]);

  // ── Fetch a page of rules ────────────────────────────────────────────────

  const fetchPage = useCallback(async (p: number, search = '') => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    const excluded = excludeRef.current;

    let query = supabase
      .from('rules')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('is_template', false)
      .order('title')
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }
    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    let unfilteredQuery = supabase
      .from('rules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('is_template', false);
    if (excluded.length > 0) {
      unfilteredQuery = unfilteredQuery.not('id', 'in', `(${excluded.join(',')})`);
    }

    const templatesQuery = supabase
      .from('rules')
      .select('*')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('is_template', true)
      .order('title');

    const [filtered, unfiltered, tmpls] = await Promise.all([query, unfilteredQuery, templatesQuery]);
    if (!openRef.current) return;
    if (filtered.error) { console.error('[AddRuleModal] fetch error:', filtered.error); return; }

    setRules((filtered.data as Rule[]) ?? []);
    setTotalCount(filtered.count ?? 0);
    setUnfilteredCount(unfiltered.count ?? 0);
    setTemplates((tmpls.data as Rule[]) ?? []);
    setStep('pick');
  }, []);

  // ── Initialise when modal opens ──────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setStep('loading');
      setRules([]);
      setTotalCount(0);
      setPage(0);
      setSelectedId(null);
      setSaving(false);
      setNewTitle('');
      setNewDescription('');
      setSearchQuery('');
      setUnfilteredCount(0);
      setTemplates([]);
      setPickingTemplate(false);
      gameIdRef.current = null;
      userIdRef.current = null;
      return;
    }

    if (editingRule) {
      setNewTitle(editingRule.title);
      setNewDescription(editingRule.description);
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

      if (!editingRule) {
        await fetchPage(0);
      }
    };

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameSlug, fetchPage, editingRule?.id]);

  // ── Re-fetch when page/search changes ─────────────────────────────────────

  useEffect(() => {
    if (step === 'pick') fetchPage(page, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddExisting = () => {
    const selected = rules.find(r => r.id === selectedId);
    if (!selected) return;
    onRuleSelected({
      ruleId:      selected.id,
      title:       selected.title,
      description: selected.description ?? '',
    });
  };

  // Create a fresh (non-template) rule from a template's title + description,
  // then attach to the deck via the normal onRuleSelected flow.
  const handlePickTemplate = async (template: Rule) => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId || pickingTemplate) return;

    setPickingTemplate(true);
    try {
      const { data, error } = await supabase
        .from('rules')
        .insert({
          user_id:     userId,
          game_id:     gameId,
          title:       template.title,
          description: template.description ?? null,
          is_template: false,
        })
        .select()
        .single();
      if (error) throw error;

      const created = data as Rule;
      onRuleSelected({
        ruleId:      created.id,
        title:       created.title,
        description: created.description ?? '',
      });
    } catch (err) {
      console.error('[AddRuleModal] create-from-template error:', err);
    } finally {
      setPickingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase.from('rules').delete().eq('id', templateId);
      if (error) throw error;
      setTemplates(list => list.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('[AddRuleModal] delete-template error:', err);
    }
  };

  const handleCreateSave = async () => {
    const gameId = gameIdRef.current;
    const userId = userIdRef.current;
    if (!gameId || !userId) return;

    setSaving(true);
    try {
      if (editingRule) {
        const { data, error } = await supabase
          .from('rules')
          .update({
            title:       newTitle.trim(),
            description: newDescription.trim() || null,
          })
          .eq('id', editingRule.id)
          .select()
          .single();
        if (error) throw error;

        const updated = data as Rule;
        onRuleUpdated?.({
          ruleId:      updated.id,
          title:       updated.title,
          description: updated.description ?? '',
        });
        onClose();
      } else {
        const { data, error } = await supabase
          .from('rules')
          .insert({
            user_id:     userId,
            game_id:     gameId,
            title:       newTitle.trim(),
            description: newDescription.trim() || null,
          })
          .select()
          .single();
        if (error) throw error;

        const created = data as Rule;
        onRuleSelected({
          ruleId:      created.id,
          title:       created.title,
          description: created.description ?? '',
        });
      }
    } catch (err) {
      console.error('[AddRuleModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCancel = () => {
    if (editingRule) {
      onClose();
      return;
    }
    setNewTitle('');
    setNewDescription('');
    setStep('pick');
    fetchPage(page, searchQuery);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canCreate  = newTitle.trim() !== '' && !saving;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">

      {/* ── Step: loading ─────────────────────────────────────────────────── */}
      {step === 'loading' && (
        <div className="p-5 flex items-center justify-center min-h-[120px]">
          <p className="font-body text-sm text-gray-400">Loading…</p>
        </div>
      )}

      {/* ── Step: pick ────────────────────────────────────────────────────── */}
      {step === 'pick' && (
        <div className="p-5 flex flex-col gap-3">

          <h5 className="font-heading text-xl text-white">Create new Rule</h5>

          <Button
            variant="outline"
            color="primary"
            leftIcon={<AddCircle className="size-4" />}
            className="w-full justify-center"
            onClick={() => {
              setNewTitle('');
              setNewDescription('');
              setStep('create');
            }}
          >
            Create New Rule
          </Button>

          {templates.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="font-body text-sm font-medium text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              <h5 className="font-heading text-xl text-white">Create from Template</h5>

              <div className="flex flex-col gap-2">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className={[
                      'group flex items-center gap-1.5 w-full px-[7px]',
                      'bg-gray-800 rounded-lg shadow-sm border border-blue-500',
                      'hover:border-blue-400 transition-colors',
                      pickingTemplate ? 'opacity-50' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <button
                      type="button"
                      disabled={pickingTemplate}
                      onClick={() => handlePickTemplate(t)}
                      className="flex-1 min-w-0 py-[13px] text-left disabled:cursor-not-allowed"
                    >
                      <p className="font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
                        {t.title}
                      </p>
                    </button>

                    <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Dropdown
                        align="right"
                        menuClassName="w-40"
                        trigger={
                          <button
                            type="button"
                            aria-label="Template options"
                            disabled={pickingTemplate}
                            className="p-1 flex items-center justify-center text-gray-300 hover:text-white disabled:cursor-not-allowed"
                          >
                            <MenuDots className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem
                          icon={<TrashBinMinimalistic className="size-4" />}
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
                        >
                          Delete Template
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="font-body text-sm font-medium text-gray-500">OR</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <h5 className="font-heading text-xl text-white">Add Existing Rule</h5>

          {unfilteredCount > 5 && (
            <Input
              leftIcon={<Magnifer className="size-4" />}
              placeholder="Search for a Rule"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          )}

          <div className="flex flex-col gap-1.5">
            {rules.length === 0 && (
              <p className="font-body text-sm text-gray-400 py-4 text-center">
                No rules yet. Create one above.
              </p>
            )}
            {rules.map(rule => (
              <AddonListItem
                key={rule.id}
                name={rule.title}
                subtitle={rule.description ?? ''}
                selected={selectedId === rule.id}
                onSelect={() => setSelectedId(rule.id)}
              />
            ))}
          </div>

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
              Add Rule
            </Button>
          </div>

        </div>
      )}

      {/* ── Step: create ──────────────────────────────────────────────────── */}
      {step === 'create' && (
        <div className="p-5 flex flex-col gap-3">

          <h5 className="font-heading text-xl text-white">
            {editingRule ? 'Edit Rule' : 'Create Rule'}
          </h5>

          <Input
            label="Rule Title"
            required
            placeholder="e.g. Assault, Defensive Formation"
            value={newTitle}
            maxLength={getMaxLength(constraints, 'title')}
            onChange={e => setNewTitle(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5 items-center font-body text-sm font-medium text-gray-900 dark:text-white">
              <span>Rule Description</span>
            </div>
            <RichTextEditor
              value={newDescription}
              onChange={setNewDescription}
              placeholder="Write the rule description…"
            />
          </div>

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
              Save Rule
            </Button>
          </div>

        </div>
      )}

    </Modal>
  );
};

export default AddRuleModal;
