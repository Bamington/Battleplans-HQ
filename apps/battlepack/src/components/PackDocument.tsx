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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { HR, MenuDots, Text } from '@battleplans/ui';

/** DOM id for a category's section, shared by the nav and the scroll target. */
export const sectionId = (key: string) => `pack-section-${key}`;

// ── Hero ─────────────────────────────────────────────────────────────────────

/**
 * Width ÷ height of the hero banner, and the ratio BannerPicker crops to.
 *
 * The two have to agree — the picker promises "what you framed is what you
 * get", and it can only keep that promise if this is the shape it framed for.
 */
export const BANNER_ASPECT = 3;

export interface PackHeroProps {
  name: string;
  gameName?: string | null;
  gameIcon?: string | null;
  /** Wide banner artwork for the game, shown above the title. */
  gameImage?: string | null;
  /** The game's logo, centred over the banner. */
  gameLogo?: string | null;
  /**
   * The organiser's own artwork. When set it takes the hero outright: no
   * darkening overlay and no game logo, because a poster made for this event
   * carries its own title and branding and does not want ours on top of it.
   */
  bannerImage?: string | null;
  /** Free-form line under the title, e.g. "2000 Points". */
  subtitle?: ReactNode;
  menu?: ReactNode;
}

export const PackHero = ({
  name, gameName, gameIcon, gameImage, gameLogo, bannerImage, subtitle, menu,
}: PackHeroProps) => {
  const custom = !!bannerImage;
  const image  = bannerImage || gameImage;

  return (
  <header className="w-full">
    {/* Game artwork is generic — the same picture for every event of that game —
        so it is darkened and carries the game's logo. A custom banner is
        specific to this event and is shown exactly as it was cropped. */}
    {image && (
      <div
        className="relative w-full overflow-hidden bg-gray-900"
        style={{ aspectRatio: String(BANNER_ASPECT) }}
      >
        <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!custom && <div className="absolute inset-0 bg-black/50" />}
        {!custom && gameLogo && (
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
};

// ── Row ──────────────────────────────────────────────────────────────────────

/**
 * How much taller one half may be before the pair is abandoned, in pixels.
 * Roughly six lines of body copy — enough that the short side is clearly
 * leaving a hole rather than just being a little uneven.
 */
const IMBALANCE_LIMIT_PX = 160;

export interface DocumentRowProps {
  /** One section, or two that want to sit side by side. */
  children: ReactNode;
}

/**
 * A row of one or two sections, which gives up on the pair when the two are
 * wildly different heights.
 *
 * Side by side reads well when the halves are comparable. A long About beside a
 * three-row Key Info leaves a column of nothing, and the pack looks broken
 * rather than airy — so past a threshold the row stacks and both take the full
 * width instead.
 *
 * THE HARD PART IS NOT MEASURING, IT IS NOT OSCILLATING. Stacking makes the tall
 * side wider and therefore shorter, which would satisfy the un-stack condition,
 * which would make it tall again. So the decision is only ever taken from a
 * PAIRED measurement: any time the inputs change the row returns to paired,
 * measures once, and then decides. It never measures its own stacked state.
 *
 * The two things that count as inputs are the row's WIDTH — height is ignored,
 * precisely because stacking changes it — and the content, watched for text and
 * child changes but not attribute changes, since the stack toggle is itself a
 * className change and would otherwise re-trigger the very cycle it ended.
 */
export const DocumentRow = ({ children }: DocumentRowProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  // Bumped when something that could change the balance changes.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let lastWidth = el.getBoundingClientRect().width;
    const resize = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      // Width only. Reacting to height would close the loop this exists to keep open.
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      setRevision(r => r + 1);
    });
    resize.observe(el);

    // Text and children, never attributes — the stack toggle is a class change.
    const mutate = new MutationObserver(() => setRevision(r => r + 1));
    mutate.observe(el, { childList: true, characterData: true, subtree: true });

    return () => { resize.disconnect(); mutate.disconnect(); };
  }, []);

  // Step one: whatever changed, go back to paired so the next measurement is
  // taken from a layout we are willing to trust.
  useLayoutEffect(() => { setStacked(false); }, [revision]);

  // Step two: measure that paired layout, once, and decide.
  useLayoutEffect(() => {
    if (stacked) return;
    const el = ref.current;
    if (!el) return;

    const halves = Array.from(el.children) as HTMLElement[];
    if (halves.length < 2) return;

    // Below md the CSS has already stacked them, and their heights say nothing
    // about how a pair would look. Same offsetTop means genuinely side by side.
    const sideBySide = halves.every(h => Math.abs(h.offsetTop - halves[0].offsetTop) < 2);
    if (!sideBySide) return;

    // The halves are flex children, so they stretch to the row and BOTH report
    // its full height — measuring them says every pair is perfectly balanced.
    // The section inside each one is what actually has a height of its own.
    const heights = halves.map(h => (h.firstElementChild as HTMLElement | null)?.offsetHeight ?? h.offsetHeight);
    if (Math.max(...heights) - Math.min(...heights) > IMBALANCE_LIMIT_PX) setStacked(true);
  }, [stacked, revision]);

  return (
    <div
      ref={ref}
      className={stacked ? 'flex flex-col gap-10' : 'flex flex-col md:flex-row gap-10 md:gap-6'}
    >
      {children}
    </div>
  );
};

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
       it, rather than jamming it against the top edge.

       Selection is a dashed accent outline rather than a filled panel — the
       blueprint reading, marking out the area being worked on instead of
       shading it in. The border is always present and merely transparent when
       inactive, so selecting a section cannot shift the layout by 2px. */
    className={`scroll-mt-6 rounded-lg transition-colors -mx-2 px-2 py-1 border border-dashed ${
      active ? 'border-primary-500' : 'border-transparent'
    }`}
  >
    {/* Tanker 24/32 in gray-300, sentence case — not the uppercase treatment
        the left nav and panel headers use. mb-1 is the 4px the headings were
        missing; without it the first line of body sat right under the cap. */}
    <h2 className="font-heading text-2xl leading-8 text-gray-300 mb-1">{title}</h2>
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
        <span className="shrink-0 text-primary-500">{row.icon}</span>
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
 * Rows are flush inside one rounded, clipped container, and the background
 * carries the KIND rather than alternating by position — so the playing parts
 * of the day stand forward and the gaps recede however they are ordered.
 *
 * Rounds sit on gray-800 and breaks on gray-900 — one step down the palette,
 * and the same pairing the Key Info card already makes a few sections up, so
 * the two blocks recede by the same amount rather than each inventing a shade.
 * Anything darker turned the break into a hole in the table instead of a
 * quieter row. The container keeps its own border so it still reads as a table
 * against the card, which is also gray-800.
 *
 * Round labels are white, not the accent. Green is what every button and link
 * in the app uses, and a green row invites a click that does nothing here.
 */
export const ScheduleTable = ({ rows }: { rows: ScheduleRow[] }) => (
  <div className="w-full flex flex-col rounded-xl overflow-hidden border border-gray-700">
    {rows.map(row => {
      const isRound = row.kind === 'round';
      return (
        <div
          key={row.ordinal}
          className={`w-full flex items-center gap-2 px-4 py-3 ${isRound ? 'bg-gray-800' : 'bg-gray-900'}`}
        >
          {row.icon && (
            <span className={`shrink-0 ${isRound ? 'text-gray-300' : 'text-gray-500'}`}>{row.icon}</span>
          )}

          <span className="shrink-0 w-6 text-center font-body font-bold text-base leading-6 text-gray-500 tabular-nums">
            {String(row.ordinal).padStart(2, '0')}
          </span>

          <span
            className={`flex-1 min-w-0 font-body text-base leading-6 truncate ${
              isRound ? 'font-medium text-white' : 'font-bold text-gray-400'
            }`}
          >
            {row.label}
          </span>

          {row.time && (
            <span
              className={`shrink-0 font-body font-bold text-xs leading-4 uppercase tracking-[1.2px] text-right ${
                isRound ? 'text-neutral-50' : 'text-gray-400'
              }`}
            >
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
