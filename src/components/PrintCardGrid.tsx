/**
 * PrintCardGrid.tsx — Print layout engine
 *
 * Arranges cards into paper-sized pages for printing. Each printed card is
 * two layers:
 *   1. bg_print.svg — the bleed background, sized to bleed_size (mm)
 *   2. The card component — sized to print_size (mm), centered on top
 *
 * Cards are rendered read-only (no onChange callbacks, no Card3DWrapper).
 * Sizes come from the game's print_size / bleed_size DB columns.
 */

import BloodBowlCard from './BloodBowlCard';
import HaloFlashpointCard from './HaloFlashpointCard';
import HaloFlashpointRuleCard from './HaloFlashpointRuleCard';
import KillTeamCard, { type KillTeamWeapon, type KillTeamAbility } from './KillTeamCard';
import KillTeamRuleCard from './KillTeamRuleCard';
import type { HaloWeapon } from './HaloFlashpointCard';

// Print background assets — each is sized to the BLEED area (includes the
// 3mm margin on each edge that the trimmer cuts away).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import bgPrintBloodBowl       from '../assets/games/card assets/blood-bowl/bg_print.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bgPrintHalo            from '../assets/games/card assets/halo/bg_print.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bgPrintKillTeamUnit    from '../assets/games/card assets/kill-team/bg-print.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bgPrintKillTeamRule    from '../assets/games/card assets/kill-team/bg-portrait-print.svg';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrintableBloodBowlCard {
  id: string;
  teamName: string;
  unitName: string;
  playerRole: string;
  cost: string;
  skills: string;
  primaryAttribute: string;
  secondaryAttribute: string;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  portraitUrl: string | null;
  avatarUrl: string | null;
}

export interface PrintableHaloCard {
  id: string;
  unitName: string;
  keywords: string;
  ra: number;
  fi: number;
  sv: number;
  advanceValue: number;
  sprintValue: number;
  ar: number;
  hp: number;
  pointsCost: number;
  portraitUrl: string | null;
  portraitStyle: string | null;
  avatarUrl: string | null;
  weapons: HaloWeapon[];
}

export interface PrintableRule {
  id: string;
  title: string;
  description: string;
}

export interface PrintableKillTeamCard {
  id: string;
  operativeName: string;
  role: string;
  teamName: string;
  tags: string;
  actions: number;
  movement: number;
  save: number;
  wounds: number;
  baseSize: number;
  weapons: KillTeamWeapon[];
  abilities: KillTeamAbility[];
  portraitUrl: string | null;
  avatarUrl: string | null;
}

export interface PrintableKillTeamRule {
  id: string;
  title: string;
  description: string;
  ability: KillTeamAbility | null;
}

export type PaperSize = 'a4' | 'letter';

export type PrintGameSlug = 'blood-bowl' | 'halo-flashpoint' | 'kill-team';

export interface PrintCardGridProps {
  gameSlug: PrintGameSlug;
  paperSize: PaperSize;
  /** [width_mm, height_mm] — card dimensions without bleed */
  printSize: [number, number];
  /** [width_mm, height_mm] — card dimensions with bleed */
  bleedSize: [number, number];
  excludedIds: Set<string>;
  /** Show the dashed bleed boundary rectangle */
  showBleed?: boolean;
  /** Show crop/cut marks at each corner */
  showCutLines?: boolean;
  bloodBowlCards?: PrintableBloodBowlCard[];
  haloCards?: PrintableHaloCard[];
  rules?: PrintableRule[];
  killTeamCards?: PrintableKillTeamCard[];
  killTeamRules?: PrintableKillTeamRule[];
}

// ── Constants ────────────────────────────────────────────────────────────────

// Convert mm to CSS px at 96 DPI
const MM = 3.7795;

const PAPER: Record<PaperSize, { w: number; h: number }> = {
  a4:     { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

const MARGIN_MM = 10;

// ── Per-item print profile ──────────────────────────────────────────────────
//
// Every printed item has a profile that fully describes how it lays out:
//   • native — pixel dimensions of the card component (matches its SVG canvas)
//   • printMm — visible card area, in mm
//   • bleedMm — bleed area (slot size), in mm
//   • bg      — the bleed-area background SVG, sized to bleedMm
//
// The default profile for a game comes from the `print_size`/`bleed_size`
// columns on the game row (passed in as the `printSize` / `bleedSize` props).
// Specific item types — like Kill Team rule cards, which are physically
// smaller and portrait-oriented — override the defaults via the
// `ITEM_PROFILE_OVERRIDES` table below. Each profile-grouping prints on its
// own set of pages so the page-level grid never has to mix slot sizes.

type PrintItemType = 'blood-bowl' | 'halo-unit' | 'halo-rule' | 'kt-unit' | 'kt-rule';

interface PrintProfile {
  /** Native pixel dimensions of the card component (matches its SVG canvas). */
  native:  { w: number; h: number };
  /** Visible card area in mm (the part that survives trimming). */
  printMm: [number, number];
  /** Bleed area in mm — also the slot size on the page. */
  bleedMm: [number, number];
  /** Bleed background SVG (sized to bleedMm). */
  bg:      string;
  /** Stable grouping key — items sharing a key go on the same pages. */
  key:     string;
}

interface ProfileOverride {
  native:  { w: number; h: number };
  printMm: [number, number];
  bleedMm: [number, number];
  bg:      string;
}

const ITEM_PROFILE_OVERRIDES: Partial<Record<PrintItemType, ProfileOverride>> = {
  // Kill Team rule cards are 70×120 mm portrait (vs 127×89 mm landscape for
  // operatives). bg-portrait-print.svg is sized 760×1260 px = 76×126 mm,
  // which embeds the 3mm bleed.
  'kt-rule': {
    native:  { w: 700, h: 1200 },
    printMm: [70, 120],
    bleedMm: [76, 126],
    bg:      bgPrintKillTeamRule,
  },
};

/** Native pixel canvas for non-overridden item types. */
const DEFAULT_NATIVE: Record<PrintItemType, { w: number; h: number }> = {
  'blood-bowl': { w: 750,  h: 1100 },
  'halo-unit':  { w: 1270, h: 890 },
  'halo-rule':  { w: 1270, h: 890 },
  'kt-unit':    { w: 1270, h: 890 },
  'kt-rule':    { w: 700,  h: 1200 }, // only used if override is removed
};

const profileForItem = (
  type: PrintItemType,
  defaultBg: string,
  defaultPrintMm: [number, number],
  defaultBleedMm: [number, number],
): PrintProfile => {
  const override = ITEM_PROFILE_OVERRIDES[type];
  if (override) {
    return { ...override, key: `${type}` };
  }
  return {
    native:  DEFAULT_NATIVE[type],
    printMm: defaultPrintMm,
    bleedMm: defaultBleedMm,
    bg:      defaultBg,
    key:     `default-${defaultBleedMm[0]}x${defaultBleedMm[1]}`,
  };
};

// ── Layout helpers ───────────────────────────────────────────────────────────

function getLayout(bleedSize: [number, number], paperSize: PaperSize) {
  const paper = PAPER[paperSize];
  const printableW_mm = paper.w - MARGIN_MM * 2;
  const printableH_mm = paper.h - MARGIN_MM * 2;
  const [bleedW, bleedH] = bleedSize;

  // Try normal orientation (no gap — bleed areas overlap at edges)
  const normalCols = Math.max(1, Math.floor(printableW_mm / bleedW));
  const normalRows = Math.max(1, Math.floor(printableH_mm / bleedH));
  const normalTotal = normalCols * normalRows;

  // Try rotated 90 degrees
  const rotCols = Math.max(1, Math.floor(printableW_mm / bleedH));
  const rotRows = Math.max(1, Math.floor(printableH_mm / bleedW));
  const rotTotal = rotCols * rotRows;

  // Pick whichever orientation fits more cards
  if (rotTotal > normalTotal) {
    return { cols: rotCols, rows: rotRows, cardsPerPage: rotTotal, rotated: true };
  }
  return { cols: normalCols, rows: normalRows, cardsPerPage: normalTotal, rotated: false };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    pages.push(arr.slice(i, i + n));
  }
  return pages;
}

// ── Component ────────────────────────────────────────────────────────────────

const PrintCardGrid = ({
  gameSlug,
  paperSize,
  printSize,
  bleedSize,
  excludedIds,
  showBleed = true,
  showCutLines = true,
  bloodBowlCards = [],
  haloCards = [],
  rules = [],
  killTeamCards = [],
  killTeamRules = [],
}: PrintCardGridProps) => {
  const paper = PAPER[paperSize];
  const pageW = (paper.w - MARGIN_MM * 2) * MM;
  const pageH = (paper.h - MARGIN_MM * 2) * MM;

  // Default bleed background for this game — the operative/main bg. Rule
  // cards (kt-rule) override this via ITEM_PROFILE_OVERRIDES.
  const defaultBg =
    gameSlug === 'blood-bowl' ? bgPrintBloodBowl :
    gameSlug === 'kill-team'  ? bgPrintKillTeamUnit :
    bgPrintHalo;

  // ── Build typed items in deck order ──────────────────────────────────────
  type PrintItem = { id: string; type: PrintItemType; data: unknown };
  const items: PrintItem[] = [];

  if (gameSlug === 'blood-bowl') {
    for (const c of bloodBowlCards) {
      if (!excludedIds.has(c.id)) items.push({ id: c.id, type: 'blood-bowl', data: c });
    }
  } else if (gameSlug === 'kill-team') {
    for (const c of killTeamCards) {
      if (!excludedIds.has(c.id)) items.push({ id: c.id, type: 'kt-unit', data: c });
    }
    for (const r of killTeamRules) {
      if (!excludedIds.has(r.id)) items.push({ id: r.id, type: 'kt-rule', data: r });
    }
  } else {
    for (const c of haloCards) {
      if (!excludedIds.has(c.id)) items.push({ id: c.id, type: 'halo-unit', data: c });
    }
    for (const r of rules) {
      if (!excludedIds.has(r.id)) items.push({ id: r.id, type: 'halo-rule', data: r });
    }
  }

  // Total cards/rules loaded for this game (before exclusion filter). Used
  // to distinguish "deck is empty" from "user toggled everything off".
  const totalLoaded =
    gameSlug === 'blood-bowl' ? bloodBowlCards.length :
    gameSlug === 'kill-team'  ? killTeamCards.length + killTeamRules.length :
    haloCards.length + rules.length;

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 font-body text-sm py-12">
        {totalLoaded === 0
          ? 'This deck has no printable cards yet. Add some cards in the builder, then come back here to print.'
          : 'All cards are hidden. Toggle a card in the sidebar to include it on the print sheet.'}
      </p>
    );
  }

  // ── Group items by print profile ─────────────────────────────────────────
  // Items with the same profile.key share a set of pages. Operatives use the
  // default game profile; rule cards override to their own size (e.g. KT
  // rule cards are 70×120 mm portrait while operatives are 127×89 landscape).
  const groupsByKey = new Map<string, { profile: PrintProfile; items: PrintItem[] }>();
  for (const item of items) {
    const profile = profileForItem(item.type, defaultBg, printSize, bleedSize);
    let group = groupsByKey.get(profile.key);
    if (!group) {
      group = { profile, items: [] };
      groupsByKey.set(profile.key, group);
    }
    group.items.push(item);
  }
  const groups = [...groupsByKey.values()];

  // Crop mark length (extends outward from each corner of the print boundary)
  const CROP_LEN = 3 * MM; // 3mm
  const CROP_OFFSET = 1 * MM; // 1mm gap between card edge and crop mark start

  return (
    <>
      {groups.flatMap((group, gi) => {
        const { profile } = group;
        const layout = getLayout(profile.bleedMm, paperSize);
        const bleedW_px = profile.bleedMm[0] * MM;
        const bleedH_px = profile.bleedMm[1] * MM;
        const printW_px = profile.printMm[0] * MM;
        const printH_px = profile.printMm[1] * MM;

        // Scale the native card into the print box; centre within the bleed.
        const cardScale = Math.min(printW_px / profile.native.w, printH_px / profile.native.h);
        const offsetX   = (bleedW_px - profile.native.w * cardScale) / 2;
        const offsetY   = (bleedH_px - profile.native.h * cardScale) / 2;

        // When rotated, the slot on the page grid has swapped dimensions.
        // Floor to avoid sub-pixel rounding pushing items to the next flex row.
        const slotW = Math.floor(layout.rotated ? bleedH_px : bleedW_px);
        const slotH = Math.floor(layout.rotated ? bleedW_px : bleedH_px);

        const pages = chunk(group.items, layout.cardsPerPage);

        return pages.map((pageItems, pi) => (
          <div
            key={`${gi}-${pi}`}
            className="print-page mx-auto"
            style={{
              width: pageW,
              height: pageH,
              minHeight: pageH,
              flexShrink: 0,
              boxSizing: 'content-box',
              display: 'flex',
              flexWrap: 'wrap',
              alignContent: 'center',
              justifyContent: 'center',
              gap: 0,
              padding: 0,
              overflow: 'visible',
            }}
          >
            {pageItems.map((item) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  width: slotW,
                  height: slotH,
                }}
              >
                {/* Rotation wrapper — rotates all card layers 90° when needed */}
                <div
                  style={layout.rotated ? {
                    position: 'absolute',
                    width: bleedW_px,
                    height: bleedH_px,
                    transform: 'rotate(90deg)',
                    transformOrigin: 'top left',
                    left: slotW,
                    top: 0,
                  } : {
                    position: 'absolute',
                    width: bleedW_px,
                    height: bleedH_px,
                    inset: 0,
                  }}
                >
                  {/* Layer 1 — Bleed background (per-profile) */}
                  <img
                    src={profile.bg}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: bleedW_px,
                      height: bleedH_px,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Layer 2 — Card content, centred within the bleed area. */}
                  <div
                    style={{
                      position: 'absolute',
                      left: offsetX,
                      top: offsetY,
                      width: profile.native.w * cardScale,
                      height: profile.native.h * cardScale,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        transform: `scale(${cardScale})`,
                        transformOrigin: 'top left',
                        width: profile.native.w,
                        height: profile.native.h,
                      }}
                    >
                      {item.type === 'blood-bowl' && (() => {
                        const c = item.data as PrintableBloodBowlCard;
                        return (
                          <BloodBowlCard
                            teamName={c.teamName}
                            unitName={c.unitName}
                            playerRole={c.playerRole}
                            cost={c.cost}
                            skills={c.skills}
                            primaryAttribute={c.primaryAttribute}
                            secondaryAttribute={c.secondaryAttribute}
                            portrait={c.portraitUrl ?? undefined}
                            ma={c.ma}
                            st={c.st}
                            ag={c.ag}
                            pa={c.pa}
                            av={c.av}
                          />
                        );
                      })()}
                      {item.type === 'halo-unit' && (() => {
                        const c = item.data as PrintableHaloCard;
                        return (
                          <HaloFlashpointCard
                            unitName={c.unitName}
                            keywords={c.keywords}
                            ra={c.ra}
                            fi={c.fi}
                            sv={c.sv}
                            advanceValue={c.advanceValue}
                            sprintValue={c.sprintValue}
                            ar={c.ar}
                            hp={c.hp}
                            portrait={c.portraitUrl ?? undefined}
                            portraitStyle={c.portraitStyle}
                            weapons={c.weapons}
                          />
                        );
                      })()}
                      {item.type === 'halo-rule' && (() => {
                        const r = item.data as PrintableRule;
                        return (
                          <HaloFlashpointRuleCard
                            title={r.title}
                            description={r.description}
                          />
                        );
                      })()}
                      {item.type === 'kt-unit' && (() => {
                        const c = item.data as PrintableKillTeamCard;
                        return (
                          <KillTeamCard
                            operativeName={c.operativeName}
                            role={c.role}
                            teamName={c.teamName}
                            tags={c.tags}
                            actions={c.actions}
                            movement={c.movement}
                            save={c.save}
                            wounds={c.wounds}
                            baseSize={c.baseSize}
                            portrait={c.portraitUrl ?? undefined}
                            weapons={c.weapons}
                            abilities={c.abilities}
                          />
                        );
                      })()}
                      {item.type === 'kt-rule' && (() => {
                        const r = item.data as PrintableKillTeamRule;
                        return (
                          <KillTeamRuleCard
                            title={r.title}
                            description={r.description}
                            ability={r.ability}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Layer 3 — Bleed rectangle (dashed outline at print_size boundary) */}
                  {showBleed && (
                    <div
                      style={{
                        position: 'absolute',
                        left: offsetX,
                        top: offsetY,
                        width: printW_px,
                        height: printH_px,
                        border: '0.5px dashed rgba(0, 0, 0, 0.4)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Layer 4 — Crop marks at each corner of the print boundary */}
                  {showCutLines && <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: bleedW_px,
                      height: bleedH_px,
                      pointerEvents: 'none',
                      overflow: 'visible',
                    }}
                  >
                    {/* Top-left */}
                    <line x1={offsetX - CROP_OFFSET} y1={offsetY} x2={offsetX - CROP_OFFSET - CROP_LEN} y2={offsetY} stroke="black" strokeWidth="0.5" />
                    <line x1={offsetX} y1={offsetY - CROP_OFFSET} x2={offsetX} y2={offsetY - CROP_OFFSET - CROP_LEN} stroke="black" strokeWidth="0.5" />
                    {/* Top-right */}
                    <line x1={offsetX + printW_px + CROP_OFFSET} y1={offsetY} x2={offsetX + printW_px + CROP_OFFSET + CROP_LEN} y2={offsetY} stroke="black" strokeWidth="0.5" />
                    <line x1={offsetX + printW_px} y1={offsetY - CROP_OFFSET} x2={offsetX + printW_px} y2={offsetY - CROP_OFFSET - CROP_LEN} stroke="black" strokeWidth="0.5" />
                    {/* Bottom-left */}
                    <line x1={offsetX - CROP_OFFSET} y1={offsetY + printH_px} x2={offsetX - CROP_OFFSET - CROP_LEN} y2={offsetY + printH_px} stroke="black" strokeWidth="0.5" />
                    <line x1={offsetX} y1={offsetY + printH_px + CROP_OFFSET} x2={offsetX} y2={offsetY + printH_px + CROP_OFFSET + CROP_LEN} stroke="black" strokeWidth="0.5" />
                    {/* Bottom-right */}
                    <line x1={offsetX + printW_px + CROP_OFFSET} y1={offsetY + printH_px} x2={offsetX + printW_px + CROP_OFFSET + CROP_LEN} y2={offsetY + printH_px} stroke="black" strokeWidth="0.5" />
                    <line x1={offsetX + printW_px} y1={offsetY + printH_px + CROP_OFFSET} x2={offsetX + printW_px} y2={offsetY + printH_px + CROP_OFFSET + CROP_LEN} stroke="black" strokeWidth="0.5" />
                  </svg>}
                </div>{/* end rotation wrapper */}
              </div>
            ))}
          </div>
        ));
      })}
    </>
  );
};

export default PrintCardGrid;
