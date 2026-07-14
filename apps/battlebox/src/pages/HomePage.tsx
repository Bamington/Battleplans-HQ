import { useState, useEffect } from 'react';
import {
  supabase, AppFooter, Button, ButtonPair, useUpdates, UpdateModal, MarkdownBody,
  PaginatedColumn, ScrollColumn, AddCircle, Magnifer, UserRounded, Box, ListCheck, Gallery,
} from '@battleplans/ui';
import type { AppUpdate } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { ModelItem, ModelGridItem } from '../components/ModelItem';
import { BoxItem, BoxGridItem } from '../components/BoxItem';
import { useModels, useBoxes } from '../hooks/useCollection';
import type { CollectionModel, CollectionBox } from '../hooks/useCollection';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// News rows are a fixed height so PaginatedColumn can decide how many fit.
// Carried over from BattlePlan's calibrated value.
const NEWS_ITEM_H = 230;
const NEWS_GAP    = 6;

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Logo ──────────────────────────────────────────────────────────────────────

const BattleBoxLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBox</span>
);

// ── Collection card ───────────────────────────────────────────────────────────

type Tab  = 'models' | 'boxes';
type View = 'list'   | 'gallery';

/** The Models / Boxes tab switch shown above the collection list. */
function SegmentedToggle({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const base = 'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-body font-medium text-sm transition-colors';
  const active   = 'bg-primary-600 text-white';
  const inactive = 'border border-primary-500 text-primary-500 hover:bg-primary-950';
  return (
    <div className="flex w-full">
      <button
        type="button"
        onClick={() => onChange('models')}
        className={`${base} rounded-l-lg ${tab === 'models' ? active : inactive}`}
      >
        <UserRounded className="w-4 h-4" /> Models
      </button>
      <button
        type="button"
        onClick={() => onChange('boxes')}
        className={`${base} rounded-r-lg -ml-px ${tab === 'boxes' ? active : inactive}`}
      >
        <Box className="w-4 h-4" />
        <span className="md:hidden">Collections</span>
        <span className="hidden md:inline">Boxes &amp; Collections</span>
      </button>
    </div>
  );
}

function CollectionCard({ userId }: { userId: string | null }) {
  const [tab,  setTab]  = useState<Tab>('models');
  const [view, setView] = useState<View>('list');

  const m = useModels(userId);
  const b = useBoxes(userId);

  const gallery = view === 'gallery';
  const isModels = tab === 'models';

  // Whichever tab is active drives the column's items + infinite scroll.
  const items:       (CollectionModel | CollectionBox)[] = isModels ? m.models : b.boxes;
  const loading      = isModels ? m.loading     : b.loading;
  const loadingMore  = isModels ? m.loadingMore : b.loadingMore;
  const hasMore      = isModels ? m.hasMore     : b.hasMore;
  const loadMore     = isModels ? m.loadMore    : b.loadMore;

  return (
    <ScrollColumn<CollectionModel | CollectionBox>
      icon={<BoxHeaderIcon />}
      title="Your Collection"
      description="Models and collections that you've uploaded."
      toggle={{
        value: view,
        onChange: (v) => setView(v as View),
        options: [
          { id: 'list',    icon: <ListCheck className="w-4 h-4" />, label: 'List view' },
          { id: 'gallery', icon: <Gallery   className="w-4 h-4" />, label: 'Gallery view' },
        ],
      }}
      wide={gallery}
      beforeList={<SegmentedToggle tab={tab} onChange={setTab} />}
      items={items}
      loading={loading}
      empty={isModels ? 'No models yet.' : 'No boxes or collections yet.'}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      listClassName={gallery ? 'grid grid-cols-1 lg:grid-cols-2 gap-2.5' : 'flex flex-col gap-1.5'}
      getKey={item => item.id}
      renderItem={item =>
        isModels
          ? (gallery ? <ModelGridItem model={item as CollectionModel} /> : <ModelItem model={item as CollectionModel} />)
          : (gallery ? <BoxGridItem   box={item as CollectionBox} />     : <BoxItem   box={item as CollectionBox} />)
      }
      footer={
        <ButtonPair className="shrink-0">
          <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} className="justify-center">
            <span className="md:hidden">Add</span>
            <span className="hidden md:inline">Add to Collection</span>
          </Button>
          <Button variant="outline" color="primary" leftIcon={<Magnifer className="w-4 h-4" />} className="justify-center">
            <span className="md:hidden">Search</span>
            <span className="hidden md:inline">Search Collection</span>
          </Button>
        </ButtonPair>
      }
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);

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
            <CollectionCard userId={userId} />
            <NewsCard />
          </div>
        </main>

      </div>

      <AppFooter className="shrink-0" appName="BattleBox" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
