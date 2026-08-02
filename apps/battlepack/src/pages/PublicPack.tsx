/**
 * PublicPack.tsx — a published pack, for anyone. Route: /:slug
 *
 * The page the whole publish flow has been reserving a URL for. It renders the
 * SAME document the editor's centre column does, from packBody, because an
 * attendee and an organiser should be looking at the same thing.
 *
 * NO SESSION REQUIRED, and no session used. It reads through
 * `battlepack_by_slug`, a SECURITY DEFINER function that only ever returns
 * published packs — the battlepack tables remain unreadable to anon. See
 * 20260802000000.
 *
 * THE ROUTE IS A CATCH-ALL AT THE ROOT, so every path this app defines is
 * permanently reserved against slugs: `app`, `login`, `auth`, `gallery`. React
 * Router matches the more specific route first, so those keep working — but a
 * new top-level route silently makes that slug unreachable, which is why the
 * list is written down here and in CLAUDE.md.
 *
 * A slug that does not resolve says WHY. battlepack_slugs outlives its packs
 * precisely so "this event was taken down" can be told apart from "no such
 * address", and a single 404 would throw that away.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppFooter, GAME_BANNERS, GAME_ICONS, Notebook, Tabs } from '@battleplans/ui';
import { PackHero, DocumentSection, DocumentRow, KeyInfoCard, sectionId } from '../components/PackDocument';
import { categoryBody, groupIntoRows, keyInfoRows } from '../components/packBody';
import { CATEGORY_TABS, visibleCategories } from '../registry/categories';
import { bannerUrl, getPublicPack } from '../lib/packs';
import type { PublicPack as PublicPackData } from '../lib/packs';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

/** What an unresolvable slug says, by why it did not resolve. */
const MISSING_COPY: Record<string, { heading: string; body: string }> = {
  withdrawn: {
    heading: 'This event is not available',
    body: 'The organiser has taken this pack down. It may come back — the address still belongs to it.',
  },
  gone: {
    heading: 'This event has been deleted',
    body: 'The organiser removed it. This address is retired and will never point anywhere else.',
  },
  unknown: {
    heading: 'No event here',
    body: 'Check the address for a typo. Nothing has ever been published at this one.',
  },
};

export default function PublicPack() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicPackData | null>(null);

  useEffect(() => {
    let stale = false;
    setData(null);
    getPublicPack(slug).then(d => { if (!stale) setData(d); });
    return () => { stale = true; };
  }, [slug]);

  // Deliberately blank rather than a spinner. The lookup is one round trip and
  // a spinner that shows for 200ms is a flash, not information.
  if (!data) return <div className="min-h-dvh bg-gray-950" />;

  if (data.state !== 'published' || !data.pack) {
    const copy = MISSING_COPY[data.state] ?? MISSING_COPY.unknown;
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Notebook className="w-10 h-10 text-gray-700" />
        <h1 className="font-heading text-3xl leading-9 text-white">{copy.heading}</h1>
        <p className="font-body text-base leading-6 text-gray-400 max-w-md">{copy.body}</p>
      </div>
    );
  }

  const { pack, game, venue, categories: rowList = [], schedule = [] } = data;
  const rows = Object.fromEntries(rowList.map(r => [r.category_key, r]));
  const categories = visibleCategories(pack.game_id, rows);

  // Shared artwork map first — games.icon / games.image are empty for most of
  // the catalogue, which is why reading the columns alone left rows blank.
  const art = {
    icon:   game ? GAME_ICONS[game.slug]   ?? game.icon  : null,
    banner: game ? GAME_BANNERS[game.slug] ?? game.image : null,
  };

  const tabs = CATEGORY_TABS.filter(t => categories.some(c => c.tab === t.id));
  const info = keyInfoRows(pack, venue);

  /** One tab's sections, paired exactly as the editor pairs them. */
  const sectionsFor = (tabId: string) =>
    groupIntoRows(categories.filter(c => c.tab === tabId)).map(group => {
      const sections = group.map(c => (
        <div key={c.key} className={group.length > 1 ? 'flex-1 min-w-0' : ''}>
          <DocumentSection categoryKey={c.key} title={c.documentLabel ?? c.label}>
            {categoryBody({ category: c, pack, rows, schedule })}
          </DocumentSection>
        </div>
      ));

      // About pairs with the derived Key Info panel rather than another
      // category — Key Info is a read-back and has no registry entry.
      if (group.length === 1 && group[0].key === 'event-basics') {
        return (
          <DocumentRow key="about+key-info">
            <div className="flex-1 min-w-0">{sections}</div>
            <div className="flex-1 min-w-0">
              <DocumentSection categoryKey="key-info" title="Key Info">
                {info.length > 0 && <KeyInfoCard rows={info} />}
              </DocumentSection>
            </div>
          </DocumentRow>
        );
      }
      return <DocumentRow key={group.map(c => c.key).join('+')}>{sections}</DocumentRow>;
    });

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      <main className="flex-1 p-4">
        <div className="mx-auto w-full max-w-4xl bg-gray-800 border border-gray-700 rounded-lg shadow-md overflow-hidden">
          <PackHero
            name={pack.name}
            gameName={game?.name}
            gameIcon={art.icon}
            gameImage={art.banner}
            gameLogo={art.banner}
            bannerImage={bannerUrl(pack.banner_path)}
            bannerAspect={pack.banner_aspect}
            subtitle={pack.format}
          />

          <div className="px-5 pt-5 pb-5">
            {/* Same rule as the editor: one tab is not a choice, so the bar is
                dropped rather than rendered as a control that does nothing. */}
            {tabs.length > 1 ? (
              <Tabs
                variant="segmented"
                mobileDropdown
                defaultTab={tabs[0].id}
                panelClassName="border-0 rounded-none p-0 pt-5"
                tabs={tabs.map(t => ({
                  id: t.id,
                  label: t.label,
                  icon: t.icon,
                  content: <div className="flex flex-col gap-10">{sectionsFor(t.id)}</div>,
                }))}
              />
            ) : (
              <div className="flex flex-col gap-10">{sectionsFor(tabs[0]?.id ?? 'format')}</div>
            )}
          </div>
        </div>
      </main>

      <AppFooter appName="BattlePack" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />
    </div>
  );
}

/** Anchors, so the editor and this page agree on section ids. */
export { sectionId };
