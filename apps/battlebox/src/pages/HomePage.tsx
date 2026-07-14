import { useState, useEffect } from 'react';
import {
  supabase, AppFooter, Button, Input, useUpdates, UpdateModal, MarkdownBody,
  PaginatedColumn, ScrollColumn, Select, AddCircle, Magnifer, UserRounded, Filter, ListCheck, Gallery,
} from '@battleplans/ui';
import type { AppUpdate, ColumnHeaderToggle } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { ModelItem, ModelGridItem } from '../components/ModelItem';
import { BoxItem, BoxGridItem } from '../components/BoxItem';
import { useModels, useBoxes } from '../hooks/useCollection';
import type { CollectionModel, CollectionBox, CollectionFilter } from '../hooks/useCollection';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// News rows are a fixed height so PaginatedColumn can decide how many fit.
const NEWS_ITEM_H = 230;
const NEWS_GAP    = 6;

type View = 'list' | 'gallery';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ModelsHeaderIcon = () => <UserRounded className="w-12 h-12 text-primary-500" />;

const BoxHeaderIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6 40 14v20L24 42 8 34V14L24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 14l16 8 16-8M24 22v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoCircleIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M24 22v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BattleBoxLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBox</span>
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

/** The filter dropdown + search field shown above each list. */
function ListControls({ filter, onFilter, allLabel, paintedLabel, search, onSearch, searchPlaceholder }: {
  filter: CollectionFilter;
  onFilter: (v: CollectionFilter) => void;
  allLabel: string;
  paintedLabel: string;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
}) {
  return (
    <div className="flex flex-col gap-2 w-full shrink-0">
      <Select
        size="sm"
        className="w-full"
        value={filter}
        onChange={e => onFilter(e.target.value as CollectionFilter)}
        leftIcon={<Filter className="w-4 h-4" />}
        options={[
          { value: 'all',     label: allLabel },
          { value: 'painted', label: paintedLabel },
        ]}
      />
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
function AddButton({ label }: { label: string }) {
  return (
    <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} className="w-full justify-center shrink-0">
      {label}
    </Button>
  );
}

const GRID_LIST = 'grid grid-cols-1 lg:grid-cols-2 gap-2.5';
const ROW_LIST  = 'flex flex-col gap-1.5';

// ── Your Models ───────────────────────────────────────────────────────────────

function ModelsColumn({ userId, isDesktop }: { userId: string | null; isDesktop: boolean }) {
  const [view,   setView]   = useState<View>('gallery');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);

  const { models, loading, loadingMore, hasMore, loadMore } = useModels(userId, filter, query);
  // Gallery is a desktop-only view; mobile & tablet always show the list.
  const gallery = isDesktop && view === 'gallery';

  return (
    <ScrollColumn<CollectionModel>
      icon={<ModelsHeaderIcon />}
      title="Your Models"
      description="Miniatures you've added to your collection."
      toggle={isDesktop ? viewToggle(view, setView) : undefined}
      wide={gallery}
      beforeList={
        <ListControls
          filter={filter} onFilter={setFilter} allLabel="All Models" paintedLabel="Painted Models"
          search={search} onSearch={setSearch} searchPlaceholder="Search models…"
        />
      }
      items={models}
      loading={loading}
      empty={query ? 'No models match your search.' : (filter === 'painted' ? 'No painted models.' : 'No models yet.')}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? GRID_LIST : ROW_LIST}
      getKey={m => m.id}
      renderItem={m => (gallery ? <ModelGridItem model={m} /> : <ModelItem model={m} />)}
      footer={<AddButton label="Add Model" />}
    />
  );
}

// ── Your Collections ──────────────────────────────────────────────────────────

function CollectionsColumn({ userId, isDesktop }: { userId: string | null; isDesktop: boolean }) {
  const [view,   setView]   = useState<View>('list');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);

  const { boxes, loading, loadingMore, hasMore, loadMore } = useBoxes(userId, query);
  const gallery = isDesktop && view === 'gallery';

  // "Painted" collections are filtered client-side over the loaded pages
  // (a fully-painted collection = every model painted).
  const items = filter === 'painted' ? boxes.filter(b => b.allPainted) : boxes;

  return (
    <ScrollColumn<CollectionBox>
      icon={<BoxHeaderIcon />}
      title="Your Collections"
      description="Boxes and collections you've uploaded."
      toggle={isDesktop ? viewToggle(view, setView) : undefined}
      wide={gallery}
      beforeList={
        <ListControls
          filter={filter} onFilter={setFilter} allLabel="All Collections" paintedLabel="Painted Collections"
          search={search} onSearch={setSearch} searchPlaceholder="Search collections…"
        />
      }
      items={items}
      loading={loading}
      empty={query ? 'No collections match your search.' : (filter === 'painted' ? 'No fully-painted collections.' : 'No collections yet.')}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? GRID_LIST : ROW_LIST}
      getKey={b => b.id}
      renderItem={b => (gallery ? <BoxGridItem box={b} /> : <BoxItem box={b} />)}
      footer={<AddButton label="Add Collection" />}
    />
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsItem({ update, onRead }: { update: AppUpdate; onRead: () => void }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex flex-col gap-1.5 shadow-md w-full">
      <h3 className="font-heading text-lg text-white leading-6">{update.title}</h3>
      <hr className="border-neutral-700" />
      <MarkdownBody className="text-sm leading-5 text-white line-clamp-5 overflow-hidden">
        {update.body ?? ''}
      </MarkdownBody>
      <div className="flex justify-end">
        <Button variant="ghost" color="primary" size="sm" rightIcon={<ArrowRightIcon />} onClick={onRead}>
          Read Update
        </Button>
      </div>
    </div>
  );
}

function NewsCard() {
  const { updates, loading } = useUpdates('battlebox');
  const [selected, setSelected] = useState<AppUpdate | null>(null);

  return (
    <>
      <PaginatedColumn
        icon={<InfoCircleIcon />}
        title="News & Updates"
        description="Find out what's happening with BattleBox."
        items={updates}
        itemHeight={NEWS_ITEM_H}
        gap={NEWS_GAP}
        loading={loading}
        empty="No updates yet. Check back soon."
        getKey={u => u.id}
        renderItem={u => <NewsItem update={u} onRead={() => setSelected(u)} />}
      />

      <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
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

        <AppNavbar fixed={false} logo={<BattleBoxLogo />} />

        <main className="flex flex-1 min-h-0 items-stretch pt-2.5 lg:px-9 w-full">
          <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 pb-2 scroll-px-3 md:scroll-px-9 lg:px-0 lg:pb-0">
            <ModelsColumn userId={userId} isDesktop={isDesktop} />
            <CollectionsColumn userId={userId} isDesktop={isDesktop} />
            <NewsCard />
          </div>
        </main>

      </div>

      <AppFooter className="shrink-0" appName="BattleBox" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
