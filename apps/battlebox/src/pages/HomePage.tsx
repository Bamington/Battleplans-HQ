import { useState, useEffect, useRef } from 'react';
import {
  supabase, AppFooter, Button, ButtonPair, Pagination, useAutoPageSize, useUpdates,
  UpdateModal, MarkdownBody, Box, UserRounded, AddCircle, Magnifer, ColumnHeader,
} from '@battleplans/ui';
import type { AppUpdate } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { ModelItem } from '../components/ModelItem';
import { BoxItem } from '../components/BoxItem';
import { useModels, useBoxes } from '../hooks/useCollection';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// Row heights, in px, used by useAutoPageSize to decide how many rows fit before
// paginating. Each must match the rendered row height — change the design, change
// the constant. Collection rows are a 108px image + 2px card border. News rows
// carry over BattlePlan's calibrated value.
const COLLECTION_ITEM_H = 110;
const COLLECTION_GAP    = 12;
const NEWS_ITEM_H       = 230;
const NEWS_GAP          = 6;

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

// ── Shared column card shell ──────────────────────────────────────────────────

const COLUMN_CLASS =
  'bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always ' +
  'w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm ' +
  'flex flex-col min-h-0 shadow-md overflow-hidden';

// ── Collection card ───────────────────────────────────────────────────────────

type Tab = 'models' | 'boxes';

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
  const [tab, setTab]   = useState<Tab>('models');
  const [page, setPage] = useState(0);

  const { models, loading: modelsLoading } = useModels(userId);
  const { boxes,  loading: boxesLoading }  = useBoxes(userId);

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, COLLECTION_ITEM_H, COLLECTION_GAP);

  const loading = tab === 'models' ? modelsLoading : boxesLoading;
  const count   = tab === 'models' ? models.length : boxes.length;

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = safePage * pageSize;

  // Reset to the first page when switching tabs or when the list shrinks under us.
  useEffect(() => { setPage(0); }, [tab]);
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  const emptyLabel = tab === 'models' ? 'No models yet.' : 'No boxes or collections yet.';

  return (
    <div className={COLUMN_CLASS}>
      <div className="flex flex-col gap-4 items-center px-5 py-2.5 flex-1 min-h-0">

        <ColumnHeader
          icon={<BoxHeaderIcon />}
          title="Your Collection"
          description="Models and collections that you've uploaded."
        />

        <SegmentedToggle tab={tab} onChange={setTab} />

        <div ref={listRef} className="flex flex-col gap-3 w-full flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : count === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">{emptyLabel}</p>
          ) : tab === 'models' ? (
            models.slice(start, start + pageSize).map(m => <ModelItem key={m.id} model={m} />)
          ) : (
            boxes.slice(start, start + pageSize).map(b => <BoxItem key={b.id} box={b} />)
          )}
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

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

      </div>
    </div>
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
  const [page,     setPage]     = useState(0);

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, NEWS_ITEM_H, NEWS_GAP);

  const totalPages = Math.max(1, Math.ceil(updates.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = updates.slice(safePage * pageSize, (safePage + 1) * pageSize);

  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  return (
    <div className={COLUMN_CLASS}>
      <div className="flex flex-col gap-4 items-center px-5 py-2.5 flex-1 min-h-0">

        <ColumnHeader
          icon={<InfoCircleIcon />}
          title="News & Updates"
          description="Find out what's happening with BattleBox."
        />

        <div ref={listRef} className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : updates.length === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">
              No updates yet. Check back soon.
            </p>
          ) : paginated.map(u => (
            <NewsItem key={u.id} update={u} onRead={() => setSelected(u)} />
          ))}
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

      </div>

      <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
    </div>
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
