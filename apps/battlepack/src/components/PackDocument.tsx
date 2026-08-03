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
import type { ScheduleKind } from '../lib/packs';

/** DOM id for a category's section, shared by the nav and the scroll target. */
export const sectionId = (key: string) => `pack-section-${key}`;

// ── Hero ─────────────────────────────────────────────────────────────────────

/**
 * The TALLEST a custom banner may be, as width ÷ height.
 *
 * A banner otherwise keeps its own shape — this is only the floor past which
 * BannerPicker crops. Shared with the picker so the limit is stated once.
 */
export const BANNER_MIN_ASPECT = 3 / 2;

/**
 * What the hero falls back to when there is no custom banner.
 *
 * Game artwork is a fixed set of wide images, and 3:1 is the band they were
 * drawn for. It is also what banners uploaded before ratios were stored were
 * cropped to, which is why a null banner_aspect resolves here.
 */
export const GAME_BANNER_ASPECT = 3;

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
  /**
   * Width ÷ height of `bannerImage`. Reserving the right height before the
   * file arrives is the whole reason this is stored rather than measured —
   * without it the document below jumps as the image decodes. Null falls back
   * to the 3:1 that pre-ratio banners were cropped to.
   */
  bannerAspect?: number | null;
  /** Free-form line under the title, e.g. "2000 Points". */
  subtitle?: ReactNode;
  menu?: ReactNode;
}

export const PackHero = ({
  name, gameName, gameIcon, gameImage, gameLogo, bannerImage, bannerAspect, subtitle, menu,
}: PackHeroProps) => {
  const custom = !!bannerImage;
  const image  = bannerImage || gameImage;
  // A custom banner keeps its own shape; game artwork gets the band it was
  // drawn for.
  const ratio  = custom ? (bannerAspect || GAME_BANNER_ASPECT) : GAME_BANNER_ASPECT;

  return (
  <header className="w-full">
    {/* Game artwork is generic — the same picture for every event of that game —
        so it is darkened and carries the game's logo. A custom banner is
        specific to this event and is shown exactly as it was uploaded. */}
    {image && (
      <div
        className="relative w-full overflow-hidden bg-gray-900"
        style={{ aspectRatio: String(ratio) }}
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
  kind: ScheduleKind;
  label: string;
  time?: string | null;
  /** 16px leading icon. The design varies it per item, not just per kind. */
  icon?: ReactNode;
}

/**
 * How each kind of row is painted.
 *
 * One table keyed by kind rather than a chain of ternaries: there are three
 * kinds and five things that vary per kind, and fifteen inline conditionals is
 * how a row ends up half-styled as one thing and half as another.
 *
 * Rounds are play, and sit forward on gray-800 with a white label. Breaks
 * recede to gray-900 — one step down the palette, the same pairing the Key Info
 * card makes a few sections up, so the two blocks recede by the same amount.
 * Anything darker turned a break into a hole in the table rather than a quieter
 * row.
 *
 * Events are amber, and are the one row allowed to use colour. Prizegiving is
 * the thing people scan the timetable FOR, and it was previously typed in as a
 * break — dead time, in a row styled to be ignored. Amber rather than the
 * accent because green is what every button and link in this app uses, and a
 * green row invites a click that does nothing here.
 */
const ROW_STYLE: Record<ScheduleKind, {
  bg: string; icon: string; label: string; time: string;
}> = {
  round: {
    bg:    'bg-gray-800',
    icon:  'text-gray-300',
    label: 'font-medium text-white',
    time:  'text-neutral-50',
  },
  break: {
    bg:    'bg-gray-900',
    icon:  'text-gray-500',
    label: 'font-bold text-gray-400',
    time:  'text-gray-400',
  },
  event: {
    bg:    'bg-amber-950/40',
    icon:  'text-amber-400',
    label: 'font-bold text-amber-200',
    time:  'text-amber-300',
  },
};

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
      const style = ROW_STYLE[row.kind] ?? ROW_STYLE.break;
      return (
        <div
          key={row.ordinal}
          className={`w-full flex items-center gap-2 px-4 py-3 ${style.bg}`}
        >
          {row.icon && <span className={`shrink-0 ${style.icon}`}>{row.icon}</span>}

          <span className="shrink-0 w-6 text-center font-body font-bold text-base leading-6 text-gray-500 tabular-nums">
            {String(row.ordinal).padStart(2, '0')}
          </span>

          <span className={`flex-1 min-w-0 font-body text-base leading-6 truncate ${style.label}`}>
            {row.label}
          </span>

          {row.time && (
            <span
              className={`shrink-0 font-body font-bold text-xs leading-4 uppercase tracking-[1.2px] text-right ${style.time}`}
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
