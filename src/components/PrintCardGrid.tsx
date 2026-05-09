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
import type { HaloWeapon } from './HaloFlashpointCard';

// Print background assets
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import bgPrintBloodBowl from '../assets/games/card assets/blood-bowl/bg_print.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bgPrintHalo from '../assets/games/card assets/halo/bg_print.svg';

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

export type PaperSize = 'a4' | 'letter';

export interface PrintCardGridProps {
  gameSlug: 'blood-bowl' | 'halo-flashpoint';
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
}

// ── Constants ────────────────────────────────────────────────────────────────

// Convert mm to CSS px at 96 DPI
const MM = 3.7795;

// Native pixel dimensions of each card component
const NATIVE: Record<string, { w: number; h: number }> = {
  'blood-bowl':      { w: 750,  h: 1100 },
  'halo-flashpoint': { w: 1270, h: 890 },
};

const PAPER: Record<PaperSize, { w: number; h: number }> = {
  a4:     { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

const MARGIN_MM = 10;

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
}: PrintCardGridProps) => {
  const layout = getLayout(bleedSize, paperSize);
  const paper = PAPER[paperSize];
  const pageW = (paper.w - MARGIN_MM * 2) * MM;
  const pageH = (paper.h - MARGIN_MM * 2) * MM;

  const [bleedW_mm, bleedH_mm] = bleedSize;
  const [printW_mm, printH_mm] = printSize;
  const native = NATIVE[gameSlug] ?? NATIVE['halo-flashpoint'];

  // Bleed slot size in CSS px (unrotated)
  const bleedW_px = bleedW_mm * MM;
  const bleedH_px = bleedH_mm * MM;

  // Print area in CSS px
  const printW_px = printW_mm * MM;
  const printH_px = printH_mm * MM;

  // Scale factor to shrink the native-pixel card into the print_size box
  const cardScale = Math.min(printW_px / native.w, printH_px / native.h);

  // Offset to center the card (print_size) within the bleed slot
  const offsetX = (bleedW_px - native.w * cardScale) / 2;
  const offsetY = (bleedH_px - native.h * cardScale) / 2;

  // When rotated, the slot on the page grid has swapped dimensions.
  // Floor to avoid sub-pixel rounding pushing items to the next flex row.
  const slotW = Math.floor(layout.rotated ? bleedH_px : bleedW_px);
  const slotH = Math.floor(layout.rotated ? bleedW_px : bleedH_px);

  // Crop mark length (extends outward from each corner of the print boundary)
  const CROP_LEN = 3 * MM; // 3mm
  const CROP_OFFSET = 1 * MM; // 1mm gap between card edge and crop mark start

  // Pick the print background for this game
  const bgPrint = gameSlug === 'blood-bowl' ? bgPrintBloodBowl : bgPrintHalo;

  // Build unified item list
  type PrintItem = { id: string; type: 'blood-bowl' | 'halo-unit' | 'halo-rule'; data: unknown };
  const items: PrintItem[] = [];

  if (gameSlug === 'blood-bowl') {
    for (const c of bloodBowlCards) {
      if (!excludedIds.has(c.id)) items.push({ id: c.id, type: 'blood-bowl', data: c });
    }
  } else {
    for (const c of haloCards) {
      if (!excludedIds.has(c.id)) items.push({ id: c.id, type: 'halo-unit', data: c });
    }
    for (const r of rules) {
      if (!excludedIds.has(r.id)) items.push({ id: r.id, type: 'halo-rule', data: r });
    }
  }

  const pages = chunk(items, layout.cardsPerPage);

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 font-body text-sm py-12">
        No cards selected. Use the checkboxes above to include cards.
      </p>
    );
  }

  return (
    <>
      {pages.map((pageItems, pi) => (
        <div
          key={pi}
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
              {/* Layer 1 — Bleed background */}
              <img
                src={bgPrint}
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

              {/* Layer 2 — Card content, centered within bleed */}
              <div
                style={{
                  position: 'absolute',
                  left: offsetX,
                  top: offsetY,
                  width: native.w * cardScale,
                  height: native.h * cardScale,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    transform: `scale(${cardScale})`,
                    transformOrigin: 'top left',
                    width: native.w,
                    height: native.h,
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
      ))}
    </>
  );
};

export default PrintCardGrid;
