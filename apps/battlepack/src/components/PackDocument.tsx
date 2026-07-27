/**
 * PackDocument.tsx — the editor's centre column: the pack as a document.
 *
 * This is where BattlePack diverges from BattleCards. The shared
 * <BuilderShell> takes the centre as a plain slot precisely so the two can
 * differ — BattleCards mounts a logo strip over a card carousel, and this
 * mounts a scrolling document.
 *
 * Each visible category renders one <DocumentSection>, tagged with a DOM id so
 * the left nav can scroll to it. Sections register nothing and own no state:
 * the nav is the sole source of truth for what is selected (there is no
 * scroll-spy, deliberately — having the scroll position also drive the
 * selection creates a feedback loop where a programmatic scroll re-selects and
 * re-scrolls).
 */

import type { ReactNode } from 'react';
import { Card, CardBody, HR, MenuDots, Text } from '@battleplans/ui';

/** DOM id for a category's section, shared by the nav and the scroll target. */
export const sectionId = (key: string) => `pack-section-${key}`;

// ── Hero ─────────────────────────────────────────────────────────────────────

export interface PackHeroProps {
  name: string;
  gameName?: string | null;
  gameIcon?: string | null;
  /** Wide banner for the game, shown above the title. */
  gameImage?: string | null;
  /** Free-form line under the title, e.g. "2000 Points". */
  subtitle?: ReactNode;
  menu?: ReactNode;
}

export const PackHero = ({ name, gameName, gameIcon, gameImage, subtitle, menu }: PackHeroProps) => (
  <header className="w-full">
    {gameImage && (
      <div className="w-full h-[200px] overflow-hidden rounded-t-lg bg-gray-900">
        <img src={gameImage} alt="" className="w-full h-full object-cover" />
      </div>
    )}

    <div className="relative px-6 pt-6 pb-4 flex flex-col items-center gap-1">
      {menu && <div className="absolute right-4 top-4 text-gray-500">{menu}</div>}

      <h1 className="font-heading text-4xl text-white text-center">{name}</h1>

      <div className="flex items-center gap-2 font-body text-sm text-gray-300">
        {gameIcon && <img src={gameIcon} alt="" className="w-5 h-5 rounded object-cover" />}
        {gameName && <span>{gameName}</span>}
        {subtitle && <><span className="text-gray-600">-</span><span>{subtitle}</span></>}
      </div>
    </div>
  </header>
);

// ── Section ──────────────────────────────────────────────────────────────────

export interface DocumentSectionProps {
  /** Registry key — becomes the scroll anchor. */
  categoryKey: string;
  title: string;
  /** Highlights the section the left nav currently has selected. */
  active?: boolean;
  children?: ReactNode;
}

export const DocumentSection = ({ categoryKey, title, active, children }: DocumentSectionProps) => (
  <section
    id={sectionId(categoryKey)}
    /* scroll-mt keeps the heading clear of the sticky chrome when the nav
       scrolls to it, rather than jamming it against the top edge. */
    className={`scroll-mt-6 px-6 py-4 rounded-lg transition-colors ${active ? 'bg-gray-800/40' : ''}`}
  >
    <h2 className="font-heading text-xl text-white uppercase tracking-wide">{title}</h2>
    <div className="mt-2 font-body text-base text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

/** What a section shows before the organiser has filled it in. */
export const EmptySection = ({ hint }: { hint: string }) => (
  <p className="font-body text-sm text-gray-500 italic">{hint}</p>
);

// ── Key Info card ────────────────────────────────────────────────────────────

export interface KeyInfoRow {
  icon: ReactNode;
  text: ReactNode;
}

/** The boxed list of address / date / format facts beside the event blurb. */
export const KeyInfoCard = ({ rows }: { rows: KeyInfoRow[] }) => (
  <Card className="w-full">
    <CardBody className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="shrink-0 text-primary-500 mt-0.5">{row.icon}</span>
          <span className="font-body text-base text-white">{row.text}</span>
        </div>
      ))}
    </CardBody>
  </Card>
);

// ── Schedule table ───────────────────────────────────────────────────────────

export interface ScheduleRow {
  ordinal: number;
  kind: 'round' | 'break';
  label: string;
  time?: string | null;
}

/**
 * Rounds & Breaks as the document renders it: a numbered strip per item, with
 * rounds picked out in the accent and breaks left neutral so the shape of the
 * day is readable at a glance.
 */
export const ScheduleTable = ({ rows }: { rows: ScheduleRow[] }) => (
  <div className="w-full flex flex-col gap-0.5">
    {rows.map(row => (
      <div
        key={row.ordinal}
        className="flex items-center gap-3 px-3 py-2.5 bg-gray-950 rounded"
      >
        <span className="font-body font-bold text-sm text-gray-500 tabular-nums">
          {String(row.ordinal).padStart(2, '0')}
        </span>
        <span
          className={`flex-1 min-w-0 font-body text-base truncate ${
            row.kind === 'round' ? 'text-primary-400' : 'text-gray-400'
          }`}
        >
          {row.label}
        </span>
        {row.time && (
          <span className="shrink-0 font-body font-bold text-xs uppercase tracking-[1.2px] text-gray-300">
            {row.time}
          </span>
        )}
      </div>
    ))}
  </div>
);

// ── Kebab ────────────────────────────────────────────────────────────────────

/** The ⋯ affordance in the document header. */
export const DocumentMenuIcon = () => <MenuDots className="w-4 h-4" />;

export { HR, Text };
