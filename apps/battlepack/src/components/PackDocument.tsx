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
import { HR, MenuDots, Text } from '@battleplans/ui';

/** DOM id for a category's section, shared by the nav and the scroll target. */
export const sectionId = (key: string) => `pack-section-${key}`;

// ── Hero ─────────────────────────────────────────────────────────────────────

export interface PackHeroProps {
  name: string;
  gameName?: string | null;
  gameIcon?: string | null;
  /** Wide banner artwork for the game, shown above the title. */
  gameImage?: string | null;
  /** The game's logo, centred over the banner. */
  gameLogo?: string | null;
  /** Free-form line under the title, e.g. "2000 Points". */
  subtitle?: ReactNode;
  menu?: ReactNode;
}

export const PackHero = ({ name, gameName, gameIcon, gameImage, gameLogo, subtitle, menu }: PackHeroProps) => (
  <header className="w-full">
    {/* Banner: the game's artwork darkened by half, with its logo centred on
        top. The overlay is what keeps a bright banner from swallowing the logo. */}
    {gameImage && (
      <div className="relative w-full h-[218px] overflow-hidden bg-gray-900">
        <img src={gameImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        {gameLogo && (
          <img
            src={gameLogo}
            alt={gameName ?? ''}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[60%] max-w-[40%] object-contain"
          />
        )}
      </div>
    )}

    {/* pb-6 keeps the game line clear of whatever follows — in the editor that
        is the tab selector, which sat right against it otherwise. */}
    <div className="relative px-5 pt-5 pb-6 flex flex-col items-center gap-1">
      {menu && <div className="absolute right-5 top-5 text-gray-400 opacity-50">{menu}</div>}

      <h1 className="font-heading text-5xl leading-[56px] text-white text-center">{name}</h1>

      {/* One muted strip: icon + game, then any extra facts separated by dashes. */}
      <div className="flex items-center justify-center gap-2.5 font-body font-bold text-sm leading-5 text-gray-300 opacity-50">
        <span className="flex items-center gap-1">
          {gameIcon && <img src={gameIcon} alt="" className="w-[22px] h-[22px] rounded object-cover" />}
          {gameName}
        </span>
        {subtitle && <><span>-</span><span>{subtitle}</span></>}
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
    /* scroll-mt keeps the heading clear of the chrome when the nav scrolls to
       it, rather than jamming it against the top edge. */
    className={`scroll-mt-6 rounded-lg transition-colors ${active ? 'bg-gray-900/40 -mx-2 px-2 py-1' : ''}`}
  >
    {/* Tanker 24/32 in gray-300, sentence case — not the uppercase treatment
        the left nav and panel headers use. */}
    <h2 className="font-heading text-2xl leading-8 text-gray-300">{title}</h2>
    <div className="font-body text-base leading-6 text-gray-300 space-y-1.5">
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

/**
 * The boxed list of address / date / format facts beside the event blurb.
 *
 * Flush gray-900 rows in a rounded, clipped container — no gaps and no card
 * border, so the block reads as one table rather than a stack of cards.
 */
export const KeyInfoCard = ({ rows }: { rows: KeyInfoRow[] }) => (
  <div className="w-full flex flex-col rounded-xl overflow-hidden">
    {rows.map((row, i) => (
      <div key={i} className="w-full flex items-center gap-2 bg-gray-900 px-4 py-3">
        <span className="shrink-0 text-gray-50">{row.icon}</span>
        <p className="flex-1 min-w-0 font-body font-medium text-base leading-6 text-gray-50">
          {row.text}
        </p>
      </div>
    ))}
  </div>
);

// ── Schedule table ───────────────────────────────────────────────────────────

export interface ScheduleRow {
  ordinal: number;
  kind: 'round' | 'break';
  label: string;
  time?: string | null;
  /** 16px leading icon. The design varies it per item, not just per kind. */
  icon?: ReactNode;
}

/**
 * Rounds & Breaks as the document renders it.
 *
 * Rows are flush inside one rounded, clipped container. The background carries
 * the kind rather than alternating by position — rounds sit on gray-900 and
 * breaks drop back to gray-950 — so the playing parts of the day stand
 * forward and the gaps recede, however they happen to be ordered.
 */
export const ScheduleTable = ({ rows }: { rows: ScheduleRow[] }) => (
  <div className="w-full flex flex-col rounded-xl overflow-hidden">
    {rows.map(row => {
      const isRound = row.kind === 'round';
      return (
        <div
          key={row.ordinal}
          className={`w-full flex items-center gap-2 px-4 py-3 ${isRound ? 'bg-gray-900' : 'bg-gray-950'}`}
        >
          {row.icon && <span className="shrink-0 text-gray-50">{row.icon}</span>}

          <span className="shrink-0 w-6 text-center font-body font-bold text-base leading-6 text-gray-500 tabular-nums">
            {String(row.ordinal).padStart(2, '0')}
          </span>

          <span
            className={`flex-1 min-w-0 font-body text-base leading-6 truncate ${
              isRound ? 'font-medium text-primary-500' : 'font-bold text-gray-600'
            }`}
          >
            {row.label}
          </span>

          {row.time && (
            <span className="shrink-0 font-body font-bold text-xs leading-4 uppercase tracking-[1.2px] text-neutral-50 text-right">
              {row.time}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

// ── Kebab ────────────────────────────────────────────────────────────────────

/** The ⋯ affordance in the document header. */
export const DocumentMenuIcon = () => <MenuDots className="w-4 h-4" />;

export { HR, Text };
