import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  supabase, AppFooter, Button, Input,
  ScrollColumn, AddCircle, Magnifer, UserRounded, Filter, ListCheck, Gallery,
  COLUMN_ROW,
} from '@battleplans/ui';
import type { ColumnHeaderToggle } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { ModelItem, ModelGridItem } from '../components/ModelItem';
import { BoxItem, BoxGridItem } from '../components/BoxItem';
import { ModelDetailModal } from '../components/ModelDetailModal';
import { CollectionDetailModal } from '../components/CollectionDetailModal';
import { ModelFilterSheet } from '../components/ModelFilterSheet';
import { AddModelModal } from '../components/AddModelModal';
import { AddCollectionModal } from '../components/AddCollectionModal';
import { AddModelsToCollectionModal } from '../components/AddModelsToCollectionModal';
import { CollectionFilterSheet } from '../components/CollectionFilterSheet';
import { RecipeItem, RecipeGridItem } from '../components/RecipeItem';
import { ShoppingListItem } from '../components/ShoppingListItem';
import { ShoppingItemModal } from '../components/ShoppingItemModal';
import { Chip } from '../components/filterControls';
import { useShoppingList, addShoppingItem, deleteShoppingItem, sortShoppingItems, SHOPPING_CATEGORIES } from '../hooks/useShoppingList';
import type { ShoppingItem, ShoppingCategory } from '../hooks/useShoppingList';
import { EditRecipeModal } from '../components/EditRecipeModal';
import { RecipeFilterSheet } from '../components/RecipeFilterSheet';
import { PaintPackItem } from '../components/PaintPackItem';
import { PaintPackDetailModal } from '../components/PaintPackDetailModal';
import { PaintPackFilterSheet } from '../components/PaintPackFilterSheet';
import { usePaintPacks, addPaintPack, removePaintPack } from '../hooks/usePaintPacks';
import type { PaintPack } from '../hooks/usePaintPacks';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import {
  useModels, useBoxes, useMatchingGameIds,
  EMPTY_MODEL_FILTERS, activeModelFilterCount,
  EMPTY_COLLECTION_FILTERS, activeCollectionFilterCount, matchesCollectionPaint,
  useRecipes, useRecipeDetail, createRecipe, deleteRecipe,
  useDeskModels, updateModel, removeFromDesk,
  EMPTY_RECIPE_FILTERS, activeRecipeFilterCount,
} from '../hooks/useCollection';
import type { CollectionModel, CollectionBox, ModelFilters, CollectionFilters, RecipeSummary, RecipeFilters, ModelStatus } from '../hooks/useCollection';
import { DeskItem } from '../components/DeskItem';
import { AddToDeskModal } from '../components/AddToDeskModal';
import { MarkPaintedModal } from '../components/MarkPaintedModal';
import { ShareModal } from '../components/ShareModal';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

type View = 'list' | 'gallery';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ModelsHeaderIcon = () => <UserRounded className="w-12 h-12 text-primary-500" />;

const BoxHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6 40 14v20L24 42 8 34V14L24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 14l16 8 16-8M24 22v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PaintsHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6C14 6 6 13 6 22c0 6 5 9 9 9h3a4 4 0 0 1 4 4c0 1-.5 2-.5 3 0 2 2 4 4 4 10 0 18-8 18-18C42.5 13 34 6 24 6Z"
      stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <circle cx="15" cy="20" r="2.2" fill="currentColor"/>
    <circle cx="24" cy="15" r="2.2" fill="currentColor"/>
    <circle cx="33" cy="20" r="2.2" fill="currentColor"/>
  </svg>
);

/** A brush over a swatch card — a recipe is paints in an order. */
const RecipesHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="9" width="24" height="31" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="14" cy="17" r="2.2" fill="currentColor" />
    <path d="M19 17h6M12 25h13M12 32h9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M41 10 30 30l-2.5 5 4.5-3.5L43 12a1.4 1.4 0 0 0-2-2Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

/** A brush over a paint pot — the painting desk. */
const DeskHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 30h22v8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3v-8Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M6 30h26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M42 7 27 25l-3 5 5-2.5L44 9a1.4 1.4 0 0 0-2-2Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

/** A shopping basket. */
const ShoppingHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 18h36l-4 20a3 3 0 0 1-3 2.4H13A3 3 0 0 1 10 38L6 18Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M16 18l6-10M32 18l-6-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M18 25v8M24 25v8M30 25v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

const ChartIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M2.5 13.5V2.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M5.5 13.5V9M8.5 13.5V6M11.5 13.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// ── Shared column bits ────────────────────────────────────────────────────────

/** The list ↔ gallery view switch shown in the column header (desktop only). */
function viewToggle(view: View, setView: (v: View) => void): ColumnHeaderToggle {
  return {
    value: view,
    onChange: (v: string) => setView(v as View),
    options: [
      { id: 'list',    icon: <ListCheck className="w-4 h-4" />, label: 'List view' },
      { id: 'gallery', icon: <Gallery   className="w-4 h-4" />, label: 'Gallery view' },
    ],
  };
}

/** A Filters button (opens the filter sheet, shows the active count) above the
 *  search field. Shared by both columns; replaces the old all/painted dropdown. */
function FilterControls({ count, onOpen, search, onSearch, searchPlaceholder }: {
  count: number;
  onOpen: () => void;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
}) {
  return (
    <div className="flex flex-col gap-2 w-full shrink-0">
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white hover:border-neutral-500 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          Filters
        </span>
        {count > 0 && (
          <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs font-medium flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      <Input
        size="sm"
        type="search"
        className="w-full"
        placeholder={searchPlaceholder}
        leftIcon={<Magnifer className="w-4 h-4" />}
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
    </div>
  );
}

/** The single Add action pinned below a collection list. */
function AddButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} className="w-full justify-center shrink-0" onClick={onClick}>
      {label}
    </Button>
  );
}

const GRID_LIST = 'grid grid-cols-1 lg:grid-cols-2 gap-2.5';
const ROW_LIST  = 'flex flex-col gap-1.5';

// ── Painting Desk ─────────────────────────────────────────────────────────────
// Models being painted right now (models.on_desk). Furthest along first, then
// most recently started. Finishing one (Mark Painted) takes it off the desk.

function DeskColumn({ userId, onOpenModel, tick, onChanged }: {
  userId: string | null;
  onOpenModel: (id: string) => void;
  /** Bumped when models change elsewhere — refetch. */
  tick: number;
  /** Tell the other columns a model changed here. */
  onChanged: () => void;
}) {
  const { models, loading, refetch } = useDeskModels(userId);
  useRefetchOnTick(tick, refetch);
  const [addOpen, setAddOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  /** The model being finished in the Mark Painted dialog. */
  const [finishing, setFinishing] = useState<CollectionModel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The desk model in the Share dialog. */
  const [sharingModel, setSharingModel] = useState<CollectionModel | null>(null);

  const changed = () => { refetch(); onChanged(); };

  const nextStep = async (m: CollectionModel, next: ModelStatus) => {
    setBusyId(m.id);
    await updateModel(m.id, { status: next });
    setBusyId(null);
    changed();
  };
  const remove = async (m: CollectionModel) => {
    setBusyId(m.id);
    await removeFromDesk(m.id);
    setBusyId(null);
    changed();
  };

  return (
    <>
    <ScrollColumn<CollectionModel>
      icon={<DeskHeaderIcon />}
      title="Painting Desk"
      description="What you're painting right now."
      items={models}
      loading={loading}
      empty="Nothing on the desk yet."
      listClassName={ROW_LIST}
      getKey={m => m.id}
      renderItem={m => (
        <DeskItem
          model={m}
          busy={busyId === m.id}
          onClick={() => onOpenModel(m.id)}
          onNextStep={next => nextStep(m, next)}
          onMarkPainted={() => setFinishing(m)}
          onRemove={() => remove(m)}
          onShare={() => setSharingModel(m)}
        />
      )}
      footer={<AddButton label="Add to Desk" onClick={() => setAddOpen(true)} />}
    />
    <AddToDeskModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      userId={userId}
      onAdded={changed}
      onNewModel={() => setNewOpen(true)}
    />
    <AddModelModal
      open={newOpen}
      onClose={() => setNewOpen(false)}
      userId={userId}
      onCreated={changed}
      forDesk
    />
    <MarkPaintedModal
      model={finishing ? { id: finishing.id, name: finishing.name } : null}
      userId={userId}
      onClose={() => setFinishing(null)}
      onDone={changed}
    />
    <ShareModal
      kind="model"
      itemId={sharingModel?.id ?? null}
      itemName={sharingModel?.name ?? ''}
      onClose={() => setSharingModel(null)}
    />
    </>
  );
}

// ── Your Models ───────────────────────────────────────────────────────────────

function ModelsColumn({ userId, isDesktop, modelId, onOpenModel, onCloseModel, onOpenBox, tick, onChanged }: {
  userId: string | null;
  isDesktop: boolean;
  modelId: string | null;
  onOpenModel: (id: string) => void;
  onCloseModel: () => void;
  onOpenBox: (id: string) => void;
  /** Bumped when models change elsewhere (the desk) — refetch. */
  tick: number;
  /** Tell the other columns a model changed here. */
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [view,    setView]    = useState<View>('gallery');
  const [filters, setFilters] = useLocalStorageState<ModelFilters>('battlebench:models-filters', EMPTY_MODEL_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search,  setSearch]  = useState('');
  const query = useDebouncedValue(search.trim(), 300);

  const { models, loading, loadingMore, hasMore, loadMore, refetch } = useModels(userId, filters, query);
  useRefetchOnTick(tick, refetch);
  // Gallery is a desktop-only view; mobile & tablet always show the list.
  const gallery = isDesktop && view === 'gallery';
  const filterCount = activeModelFilterCount(filters);

  return (
    <>
    <ScrollColumn<CollectionModel>
      icon={<ModelsHeaderIcon />}
      title="Your Models"
      description="Miniatures you've added to your collection."
      toggle={isDesktop ? viewToggle(view, setView) : undefined}
      wide={gallery}
      beforeList={
        <FilterControls count={filterCount} onOpen={() => setFilterOpen(true)} search={search} onSearch={setSearch} searchPlaceholder="Search models…" />
      }
      items={models}
      loading={loading}
      empty={query || filterCount ? 'No models match your filters.' : 'No models yet.'}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? GRID_LIST : ROW_LIST}
      getKey={m => m.id}
      renderItem={m => (gallery
        ? <ModelGridItem model={m} onClick={() => onOpenModel(m.id)} />
        : <ModelItem     model={m} onClick={() => onOpenModel(m.id)} />)}
      footer={
        <div className="flex gap-2 w-full shrink-0">
          <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} className="flex-1 justify-center" onClick={() => setAddOpen(true)}>
            Add Model
          </Button>
          <Button variant="outline" color="primary" leftIcon={<ChartIcon />} className="flex-1 justify-center" onClick={() => navigate('/app/stats')}>
            Stats
          </Button>
        </div>
      }
    />
    <AddModelModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      userId={userId}
      onCreated={id => { refetch(); onOpenModel(id); }}
    />
    <ModelDetailModal modelId={modelId} onClose={onCloseModel} onChanged={() => { refetch(); onChanged(); }} onOpenBox={onOpenBox} />
    <ModelFilterSheet
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      userId={userId}
      value={filters}
      onApply={f => { setFilters(f); setFilterOpen(false); }}
    />
    </>
  );
}

// ── Your Collections ──────────────────────────────────────────────────────────

function CollectionsColumn({ userId, isDesktop, boxId, onOpenBox, onCloseBox, onOpenModel, tick, onChanged }: {
  userId: string | null;
  isDesktop: boolean;
  boxId: string | null;
  onOpenBox: (id: string) => void;
  onCloseBox: () => void;
  onOpenModel: (id: string) => void;
  /** Bumped when models change elsewhere — member statuses may have moved. */
  tick: number;
  onChanged: () => void;
}) {
  const [view,    setView]    = useState<View>('list');
  const [filters, setFilters] = useLocalStorageState<CollectionFilters>('battlebench:collections-filters', EMPTY_COLLECTION_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** Set to a new collection's id when the user chose "Create and Add Models". */
  const [addModelsBoxId, setAddModelsBoxId] = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const query = useDebouncedValue(search.trim(), 300);
  const searchGameIds = useMatchingGameIds(query);

  const { boxes, loading, loadingMore, hasMore, loadMore, refetch } = useBoxes(userId, filters, query, searchGameIds);
  useRefetchOnTick(tick, refetch);
  const gallery = isDesktop && view === 'gallery';
  const filterCount = activeCollectionFilterCount(filters);

  // Paint state is filtered client-side over the loaded pages (it reads each
  // collection's member statuses); everything else is server-side.
  const items = boxes.filter(b => matchesCollectionPaint(b, filters.paint));

  return (
    <>
    <ScrollColumn<CollectionBox>
      icon={<BoxHeaderIcon />}
      title="Your Collections"
      description="Boxes and collections you've uploaded."
      toggle={isDesktop ? viewToggle(view, setView) : undefined}
      wide={gallery}
      beforeList={
        <FilterControls count={filterCount} onOpen={() => setFilterOpen(true)} search={search} onSearch={setSearch} searchPlaceholder="Search collections…" />
      }
      items={items}
      loading={loading}
      empty={query || filterCount ? 'No collections match your filters.' : 'No collections yet.'}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? GRID_LIST : ROW_LIST}
      getKey={b => b.id}
      renderItem={b => (gallery
        ? <BoxGridItem box={b} onClick={() => onOpenBox(b.id)} />
        : <BoxItem     box={b} onClick={() => onOpenBox(b.id)} />)}
      footer={<AddButton label="Add Collection" onClick={() => setAddOpen(true)} />}
    />
    <AddCollectionModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      userId={userId}
      onCreated={(id, addModels) => {
        refetch();
        // "Create and Add Models" goes to the picker first; the plain CTA
        // opens the new collection straight away.
        if (addModels) setAddModelsBoxId(id);
        else onOpenBox(id);
      }}
    />
    <AddModelsToCollectionModal
      boxId={addModelsBoxId}
      userId={userId}
      onClose={() => setAddModelsBoxId(null)}
      onAdded={() => { refetch(); if (addModelsBoxId) onOpenBox(addModelsBoxId); }}
    />
    <CollectionDetailModal boxId={boxId} onClose={onCloseBox} onOpenModel={onOpenModel} onChanged={() => { refetch(); onChanged(); }} />
    <CollectionFilterSheet
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      userId={userId}
      value={filters}
      onApply={f => { setFilters(f); setFilterOpen(false); }}
    />
    </>
  );
}

// ── Shopping List ─────────────────────────────────────────────────────────────

function ShoppingListColumn({ userId }: { userId: string | null }) {
  const { items, loading, refetch, setBought, setItems } = useShoppingList(userId);
  const [draft, setDraft] = useState('');
  /** Picked before the name. Kept after adding, so several paints in a row
   *  don't each need Paint choosing again. */
  const [category, setCategory] = useState<ShoppingCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = items.find(i => i.id === editingId) ?? null;

  // The first bought item gets a "Bought" heading above it — but only when
  // there's something still to buy above it to separate it from.
  const firstBoughtId = items.some(i => !i.bought) ? items.find(i => i.bought)?.id : undefined;

  /** Quick add: pick a type, type a name, press Enter. Details come later,
   *  from the item. */
  const add = async () => {
    const title = draft.trim();
    if (!title || !category || !userId || adding) return;
    setAdding(true); setAddError(null);
    const item = await addShoppingItem(userId, title, category);
    setAdding(false);
    if (!item) { setAddError('Could not add that. Please try again.'); return; }
    setDraft('');
    setItems(prev => sortShoppingItems([item, ...prev]));
  };

  return (
    <>
    <ScrollColumn<ShoppingItem>
      icon={<ShoppingHeaderIcon />}
      title="Shopping List"
      description="Things you're planning to buy."
      beforeList={
        <form className="flex flex-col gap-2 w-full shrink-0" onSubmit={e => { e.preventDefault(); add(); }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-xs text-neutral-400">Type</span>
            {SHOPPING_CATEGORIES.map(c => (
              <Chip key={c.value} label={c.label} selected={category === c.value} onClick={() => setCategory(c.value)} />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              size="sm" className="flex-1 min-w-0"
              placeholder={category ? 'Add an item…' : 'Choose a type first'}
              aria-label="New shopping list item"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <Button type="submit" size="sm" color="primary" leftIcon={<AddCircle className="w-4 h-4" />}
              disabled={!draft.trim() || !category || adding || !userId} loading={adding}>
              Add
            </Button>
          </div>
          {addError && <span className="font-body text-xs text-red-400">{addError}</span>}
        </form>
      }
      items={items}
      loading={loading}
      empty="Your shopping list is empty."
      listClassName={ROW_LIST}
      getKey={i => i.id}
      renderItem={i => (
        <>
          {i.id === firstBoughtId && (
            <span className="block pt-2 pb-0.5 font-body text-xs font-medium uppercase tracking-wide text-neutral-500">Bought</span>
          )}
          <ShoppingListItem item={i} onToggle={b => setBought(i.id, b)} onClick={() => setEditingId(i.id)} />
        </>
      )}
    />
    <ShoppingItemModal
      item={editing}
      onClose={() => setEditingId(null)}
      onChanged={refetch}
      onDelete={async item => {
        await deleteShoppingItem(item.id);
        setEditingId(null);
        setItems(prev => prev.filter(i => i.id !== item.id));
      }}
    />
    </>
  );
}

// ── Your Recipes ──────────────────────────────────────────────────────────────

function RecipesColumn({ userId, isDesktop, onOpenModel }: {
  userId: string | null;
  isDesktop: boolean;
  onOpenModel: (id: string) => void;
}) {
  const [view,     setView]     = useState<View>('list');
  const [search,   setSearch]   = useState('');
  const [recipeId, setRecipeId] = useState<string | null>(null);
  /** The Add Recipe form is open (and stays "creating" until the new row loads). */
  const [creating, setCreating] = useState(false);
  const query = useDebouncedValue(search.trim(), 300);
  const [filters, setFilters] = useLocalStorageState<RecipeFilters>('battlebench:recipes-filters', EMPTY_RECIPE_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = activeRecipeFilterCount(filters);

  const { recipes, brands, loading, loadingMore, hasMore, loadMore, refetch } = useRecipes(userId, query, filters);
  const detail = useRecipeDetail(recipeId);
  // Ignore the previous recipe while the next one loads.
  const current = detail.recipe?.id === recipeId ? detail.recipe : null;
  const gallery = isDesktop && view === 'gallery';

  useEffect(() => { if (current) setCreating(false); }, [current]);

  const close = () => { setRecipeId(null); setCreating(false); };
  const changed = () => { detail.refetch(); refetch(); };

  return (
    <>
    <ScrollColumn<RecipeSummary>
      icon={<RecipesHeaderIcon />}
      title="Your Recipes"
      description="Paint recipes you've saved."
      toggle={isDesktop ? viewToggle(view, setView) : undefined}
      wide={gallery}
      beforeList={
        <FilterControls count={filterCount} onOpen={() => setFilterOpen(true)} search={search} onSearch={setSearch} searchPlaceholder="Search recipes…" />
      }
      items={recipes}
      loading={loading}
      empty={query || filterCount ? 'No recipes match your filters.' : 'No recipes yet.'}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? GRID_LIST : ROW_LIST}
      getKey={r => r.id}
      renderItem={r => (gallery
        ? <RecipeGridItem recipe={r} onClick={() => setRecipeId(r.id)} />
        : <RecipeItem     recipe={r} onClick={() => setRecipeId(r.id)} />)}
      footer={<AddButton label="Add Recipe" onClick={() => { setRecipeId(null); setCreating(true); }} />}
    />
    <EditRecipeModal
      open={creating || recipeId !== null}
      recipe={current}
      models={detail.models}
      onClose={close}
      onChanged={changed}
      onOpenModel={id => { close(); onOpenModel(id); }}
      onDelete={async () => {
        if (!recipeId) return;
        await deleteRecipe(recipeId);
        close();
        refetch();
      }}
      onCreate={creating ? async fields => {
        const id = await createRecipe(fields);
        if (!id) return false;
        setRecipeId(id);
        refetch();
        return true;
      } : undefined}
    />
    <RecipeFilterSheet
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      brands={brands}
      value={filters}
      onApply={f => { setFilters(f); setFilterOpen(false); }}
    />
    </>
  );
}

// ── Paints (packs) ────────────────────────────────────────────────────────────

function PaintsColumn({ userId }: { userId: string | null }) {
  const { packs, loading, error, refetch } = usePaintPacks(userId);
  const [search, setSearch] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const query = search.trim().toLowerCase();

  const allBrands = [...new Set(packs.map(p => p.brand).filter((b): b is string => !!b))].sort();

  // Filter by search + brand, then float added packs to the bottom (stable sort
  // keeps each group in name order).
  const filtered = packs
    .filter(p => !query || `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(query))
    .filter(p => brands.length === 0 || (p.brand !== null && brands.includes(p.brand)))
    .sort((a, b) => Number(a.added) - Number(b.added));
  const viewing = packs.find(p => p.id === viewingId) ?? null;

  const handleAdd = async (pack: PaintPack) => {
    if (!userId || busyId) return;
    setBusyId(pack.id);
    await addPaintPack(userId, pack.id);
    setBusyId(null);
    refetch();
  };
  const handleRemove = async (pack: PaintPack) => {
    if (!userId || busyId) return;
    setBusyId(pack.id);
    await removePaintPack(userId, pack.id);
    setBusyId(null);
    refetch();
  };

  return (
    <>
    <ScrollColumn<PaintPack>
      icon={<PaintsHeaderIcon />}
      title="Paint Packs"
      description="Add sets of paints to your collection."
      beforeList={
        <FilterControls count={brands.length} onOpen={() => setFilterOpen(true)} search={search} onSearch={setSearch} searchPlaceholder="Search packs…" />
      }
      items={filtered}
      loading={loading}
      empty={error ?? (query || brands.length ? 'No packs match your filters.' : 'No packs available yet.')}
      listClassName={ROW_LIST}
      getKey={p => p.id}
      renderItem={p => <PaintPackItem pack={p} onClick={() => setViewingId(p.id)} />}
    />
    <PaintPackDetailModal
      pack={viewing}
      busy={busyId === viewingId}
      onClose={() => setViewingId(null)}
      onAdd={() => viewing && handleAdd(viewing)}
      onRemove={() => viewing && handleRemove(viewing)}
    />
    <PaintPackFilterSheet
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      brands={allBrands}
      value={brands}
      onApply={b => { setBrands(b); setFilterOpen(false); }}
    />
    </>
  );
}

// ── Responsive helper ─────────────────────────────────────────────────────────

/** Debounce a fast-changing value (e.g. a search field) so downstream queries
 *  don't fire on every keystroke. */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Refetch whenever `tick` moves on (not on mount — the list loads itself). */
function useRefetchOnTick(tick: number, refetch: () => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

/** True from the `lg` breakpoint up (desktop). Gallery view is desktop-only. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  // A model modal and a collection modal, opened one at a time — opening either
  // clears the other, so tapping a sub-item swaps between them.
  const [modelId, setModelId] = useState<string | null>(null);
  const [boxId,   setBoxId]   = useState<string | null>(null);
  const openModel = (id: string) => { setBoxId(null);   setModelId(id); };
  const openBox   = (id: string) => { setModelId(null); setBoxId(id); };

  // The desk, Models and Collections all show the same models; a change in
  // one bumps this and the others refetch.
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-950">

      {/* Navbar + columns fill exactly one viewport, so the footer is pushed
          just below the fold and the columns reclaim its height. */}
      <div className="h-dvh flex flex-col min-h-0">

        <AppNavbar fixed={false} logo={<BattleBenchLogo />} />

        <main className="flex flex-1 min-h-0 items-stretch pt-2.5 w-full">
          <div className={`${COLUMN_ROW} pb-2 lg:pb-0`}>
            <ShoppingListColumn userId={userId} />
            <DeskColumn userId={userId} onOpenModel={openModel} tick={tick} onChanged={bump} />
            <ModelsColumn
              userId={userId} isDesktop={isDesktop}
              modelId={modelId} onOpenModel={openModel} onCloseModel={() => setModelId(null)} onOpenBox={openBox}
              tick={tick} onChanged={bump}
            />
            <CollectionsColumn
              userId={userId} isDesktop={isDesktop}
              boxId={boxId} onOpenBox={openBox} onCloseBox={() => setBoxId(null)} onOpenModel={openModel}
              tick={tick} onChanged={bump}
            />
            <RecipesColumn userId={userId} isDesktop={isDesktop} onOpenModel={openModel} />
            <PaintsColumn userId={userId} />
          </div>
        </main>

      </div>

      <AppFooter className="shrink-0" appName="BattleBench" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
