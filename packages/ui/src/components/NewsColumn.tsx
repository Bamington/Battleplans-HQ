/**
 * NewsColumn.tsx — the "News & Updates" home column: an app's published update
 * notes (Manage Updates → `updates`), newest first, paged to fit the column.
 * Each card previews the note; Read Update opens it in full in UpdateModal.
 *
 * Moved here from BattlePlan's home page so every app shows its news the same
 * way — used by BattlePlan, BattleBench and BattleCards.
 *
 *   <NewsColumn app="battlebox" appName="BattleBench" />
 */

import { useState } from 'react';
import { PaginatedColumn } from './Column';
import Button from './Button';
import MarkdownBody from './MarkdownBody';
import UpdateModal from './UpdateModal';
import { useUpdates } from '../hooks/useUpdates';
import type { AppUpdate, UpdateApp } from '../hooks/useUpdates';

/** A card's height, so PaginatedColumn can work out how many fit. */
const NEWS_ITEM_H = 230;

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

/** One update: title, a few lines of the note, and Read Update. */
export function NewsItem({ update, onRead }: { update: AppUpdate; onRead: () => void }) {
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

export interface NewsColumnProps {
  /** Whose updates to show (the `apps` an update was published for). */
  app: UpdateApp;
  /** For the description line: "Find out what's happening with <appName>." */
  appName: string;
  /** Extra classes on the column panel (e.g. a fixed height in the gallery). */
  className?: string;
}

export default function NewsColumn({ app, appName, className }: NewsColumnProps) {
  const { updates, loading } = useUpdates(app);
  const [selected, setSelected] = useState<AppUpdate | null>(null);

  return (
    <>
      <PaginatedColumn
        icon={<InfoCircleIcon />}
        title="News & Updates"
        tabLabel="News"
        description={`Find out what's happening with ${appName}.`}
        items={updates}
        itemHeight={NEWS_ITEM_H}
        loading={loading}
        empty="No updates yet. Check back soon."
        getKey={u => u.id}
        renderItem={u => <NewsItem update={u} onRead={() => setSelected(u)} />}
        className={className}
      />

      <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
    </>
  );
}
