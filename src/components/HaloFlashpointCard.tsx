/**
 * HaloFlashpointCard.tsx — Halo Flashpoint unit card
 *
 * Architecture:
 *   Layer 1 — BG.svg            : all static chrome (card shape, coloured
 *             backgrounds, stat header labels RA/FI/SV, HP text, chevron shapes,
 *             side-slot labels, weapon-table row backgrounds)
 *   Layer 2 — Portrait image    : unit photo, positioned over the left image area;
 *             the BG.svg draws over the top-right corner creating the angled cut
 *   Layer 3 — Dynamic text      : all values that change per unit, positioned to
 *             match the Figma "Stats + HP Text", "Weapon Table Text", and
 *             "Heading and Keywords Text" groups exactly (nodes 11:4529, 11:4532,
 *             11:4533)
 *
 * The card renders at its native 1270 × 890 px. Wrap and CSS-transform the outer
 * container to scale it for display (see CardBuilderHaloFlashpoint for an example).
 *
 * All positions and sizes are taken directly from Figma — do not adjust by eye.
 *
 * Inline editing:
 *   Pass an onChange callback to enable double-click editing on that field.
 *   Omit the callback to keep the field read-only.
 *   Edits commit on blur or Enter; Escape cancels without saving.
 *   The Speed value (SP adv/spr) is split into two separately double-clickable areas.
 */

import { useState, useRef } from 'react';
import { createPortal }    from 'react-dom';
import KeywordInfoModal    from './KeywordInfoModal';
import TokenOverlay        from './TokenOverlay';
import { clampNumber, getMaxLength } from '../lib/constraints';
import type { EntityConstraints, TokenDefinition } from '../lib/database.types';
import bgSvg               from '../assets/games/card assets/halo/BG.svg';
import portraitPlaceholder from '../assets/games/card assets/halo/example-image.png';
import portraitFrameSvg    from '../assets/games/card assets/halo/portrait-frame.svg';
import cardLsSlotSvg      from '../assets/games/card assets/halo/card-ls-slot.svg';

// ── Font shorthands ───────────────────────────────────────────────────────────
const ALLER    = { fontFamily: "'Aller', sans-serif", fontWeight: 400 } as const;
const ALLER_BD = { fontFamily: "'Aller', sans-serif", fontWeight: 700 } as const;
const INDUSTRY = { fontFamily: "'Industry Test', sans-serif", fontWeight: 900 } as const;

// ── Shared inline-input base styles ──────────────────────────────────────────
const INPUT_BASE: React.CSSProperties = {
  background:  'transparent',
  border:      'none',
  outline:     'none',
  padding:     0,
  margin:      0,
};

// ── Weapon table column layout ────────────────────────────────────────────────
// Container: left 62, width 1103.  Fixed cols: Range 112 + AP 63 + Endcap 34 = 209.
// Remaining 894 px split across 3 flex-1 columns → 298 px each.
const COL_TYPE    = { left: 62,  width: 298 } as const;
const COL_WEAPON  = { left: 360, width: 298 } as const;
const COL_RANGE   = { left: 658, width: 112 } as const;
const COL_AP      = { left: 770, width: 63  } as const;
const COL_KEYWORDS = { left: 833, width: 298 } as const;

const TABLE_LEFT      = 62;
const TABLE_WIDTH     = 1103;
const WEAPON_ROW_H_BASE = 86;   // default row height when keywords fit one line
const WEAPON_HEADER_H = 58;
const TABLE_BOTTOM    = 838;  // bottom of last row (above bottom inserts)
const MAX_WEAPON_ROWS = 3;
const ROW_BG_COLORS   = ['white', '#B4CDCD', 'white'] as const; // alternating

/**
 * Estimate how tall a weapon row needs to be based on its keywords text.
 * At font-size 30 with ~298 px column width minus padding, roughly 18 chars
 * fit per line. Each extra line adds ~36 px (font-size 30 × 1.2 line-height).
 */
const estimateRowHeight = (keywordsText: string): number => {
  if (!keywordsText) return WEAPON_ROW_H_BASE;
  const charsPerLine = 18;
  const lines = Math.ceil(keywordsText.length / charsPerLine);
  if (lines <= 2) return WEAPON_ROW_H_BASE; // two lines fit in the default height
  return WEAPON_ROW_H_BASE + (lines - 2) * 36;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

interface CellProps {
  col:    { left: number; width: number };
  top:    number;
  height: number;
  text:   string;
  bold?:  boolean;
}

/** Absolutely-positioned weapon table cell with centered text. */
const WeaponCell = ({ col, top, height, text, bold = false }: CellProps) => (
  <div
    style={{
      position:       'absolute',
      left:           col.left,
      top,
      width:          col.width,
      height,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '10px 13px',
      boxSizing:      'border-box',
    }}
  >
    <span
      style={{
        ...(bold ? ALLER_BD : ALLER),
        fontSize:   30,
        lineHeight: 'normal',
        color:      bold ? 'white' : 'black',
        textAlign:  'center',
        overflow:   'hidden',
      }}
    >
      {text}
    </span>
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HaloWeapon {
  type:     string;
  name:     string;
  range:    string;
  ap:       string;
  keywords: string;
  /** When provided, weapon keywords render as clickable links. */
  keywordData?: CardKeywordInfo[];
}

/** Structured keyword data for clickable keyword links on the card. */
export interface CardKeywordInfo {
  /** Display label, e.g. "Optics" or "ESD (1)" */
  label: string;
  name:  string;
  description: string;
}

export interface HaloFlashpointCardProps {
  unitName?:     string;
  keywords?:     string;
  /** When provided, keywords render as individually clickable links instead of flat text. */
  keywordData?:  CardKeywordInfo[];
  /** Ranged Attack stat — displayed as "{ra}+" */
  ra?:           number;
  /** Fight stat — displayed as "{fi}+" */
  fi?:           number;
  /** Save stat — displayed as "{sv}+" */
  sv?:           number;
  /** Speed advance value — displayed as "SP {advance}/{sprint}" */
  advanceValue?: number;
  /** Speed sprint value */
  sprintValue?:  number;
  /** Armour value — displayed as "AR {ar}" */
  ar?:           number;
  /** Hit Points */
  hp?:           number;
  /** Up to 2 weapon rows. Missing rows show dashes. */
  weapons?:      HaloWeapon[];
  /** Portrait image src. Defaults to the placeholder Spartan figure. */
  portrait?:     string;
  /** null/undefined = no frame; 'portraitFramed' = decorative frame overlay */
  portraitStyle?: string | null;
  className?:    string;
  // ── Inline edit callbacks — omit a callback to keep that field read-only ──
  onUnitNameChange?:    (v: string) => void;
  onKeywordsChange?:    (v: string) => void;
  /** Single digit 0–9 */
  onRaChange?:          (v: number) => void;
  onFiChange?:          (v: number) => void;
  onSvChange?:          (v: number) => void;
  onAdvanceValueChange?:(v: number) => void;
  onSprintValueChange?: (v: number) => void;
  onArChange?:          (v: number) => void;
  onHpChange?:          (v: number) => void;
  /** Called when user clicks "Edit Keyword" from a keyword info modal on the card */
  onEditKeyword?:       (kw: CardKeywordInfo) => void;
  /** Called when user clicks a weapon name in the weapon table */
  onWeaponClick?:       (weapon: HaloWeapon) => void;
  /** DB-driven validation constraints — when omitted, falls back to 0–9 for numbers. */
  constraints?:         EntityConstraints;
  // ── Token overlay (play mode) ─────────────────────────────────────────
  /** When provided, renders the play-mode token overlay over the card. */
  tokenOverlay?: {
    definitions: TokenDefinition[];
    unitKeywords: { keywordName: string; paramValue: number | null }[];
    state: Record<string, number>;
    onChange?: (tokenDefId: string, newValue: number) => void;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const HaloFlashpointCard = ({
  unitName     = 'Unit Name',
  keywords     = '',
  keywordData,
  ra           = 0,
  fi           = 0,
  sv           = 0,
  advanceValue = 0,
  sprintValue  = 0,
  ar           = 0,
  hp           = 0,
  weapons      = [],
  portrait     = portraitPlaceholder,
  portraitStyle,
  className    = '',
  onUnitNameChange,
  onKeywordsChange,
  onRaChange,
  onFiChange,
  onSvChange,
  onAdvanceValueChange,
  onSprintValueChange,
  onArChange,
  onHpChange,
  onEditKeyword,
  onWeaponClick,
  constraints = {},
  tokenOverlay,
}: HaloFlashpointCardProps) => {
  // Dynamic weapon table: always at least 1 row, max 3
  const rowCount = Math.max(1, Math.min(weapons.length, MAX_WEAPON_ROWS));

  // Compute per-row heights so rows with many keywords grow taller
  const rowHeights = Array.from({ length: rowCount }, (_, i) => {
    const w = weapons[i];
    return estimateRowHeight(w?.keywords ?? '');
  });
  const totalRowsH  = rowHeights.reduce((sum, h) => sum + h, 0);
  const tableTopY   = TABLE_BOTTOM - totalRowsH - WEAPON_HEADER_H;
  const headerTopY  = tableTopY;
  const firstRowTopY = headerTopY + WEAPON_HEADER_H;

  // Cumulative top offsets for each row
  const rowTopOffsets = rowHeights.reduce<number[]>((acc, _h, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + rowHeights[i - 1]);
    return acc;
  }, []);

  // ── Keyword info modal state ─────────────────────────────────────────────────
  const [viewingCardKeyword, setViewingCardKeyword] = useState<CardKeywordInfo | null>(null);

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue,    setEditValue]    = useState('');
  const cancellingRef = useRef(false);

  const startEdit = (field: string, value: string | number, editable: boolean) => {
    if (!editable) return;
    setEditingField(field);
    setEditValue(String(value));
  };

  const commitText = (onChange?: (v: string) => void) => {
    if (!cancellingRef.current) onChange?.(editValue);
    cancellingRef.current = false;
    setEditingField(null);
  };

  const commitNumber = (statKey: string, onChange?: (v: number) => void) => {
    if (!cancellingRef.current) {
      const n = parseInt(editValue, 10);
      onChange?.(isNaN(n) ? 0 : clampNumber(n, constraints, statKey));
    }
    cancellingRef.current = false;
    setEditingField(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  e.currentTarget.blur();
    if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
  };

  const onDigitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9]/g, '').slice(-1);
    setEditValue(v);
  };

  const editCursor = (editable: boolean): React.CSSProperties =>
    editable ? { cursor: 'text', userSelect: 'none' as const } : { userSelect: 'none' as const };

  // ── Shared style for RA / FI / SV stat values ─────────────────────────────
  const statValueStyle: React.CSSProperties = {
    ...ALLER,
    fontSize:        38,
    lineHeight:      'normal',
    color:           'black',
    letterSpacing:   '1.14px',
    textTransform:   'uppercase',
    whiteSpace:      'nowrap',
  };

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: 1270, height: 890 }}
    >
    <div
      className="relative overflow-clip"
      style={{ width: 1270, height: 890 }}
    >

      {/* ── Layer 1: Static background ──────────────────────────────────── */}
      <img
        src={bgSvg}
        alt=""
        style={{
          position:      'absolute',
          inset:         0,
          width:         '100%',
          height:        '100%',
          display:       'block',
          userSelect:    'none',
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 2: Portrait ───────────────────────────────────────────── */}
      {/* Image container shrinks when the portrait frame is active
          (468 × 608) vs the default full-bleed size (543 × 608). */}
      <div
        style={{
          position: 'absolute',
          left:     portraitStyle === 'portraitFramed' ? 0 : -1,
          top:      0,
          width:    portraitStyle === 'portraitFramed' ? 450 : 543,
          height:   portraitStyle === 'portraitFramed' ? 609 : 608,
          overflow: 'hidden',
        }}
      >
        <img
          src={portrait}
          alt=""
          style={{
            position:       'absolute',
            inset:          0,
            width:          '100%',
            height:         '100%',
            objectFit:      'contain',
            display:        'block',
            pointerEvents:  'none',
            userSelect:     'none',
          }}
        />
      </div>

      {/* ── Layer 2b: Portrait Frame overlay (optional) ────────────────── */}
      {/* Figma: "Portrait Frame" (386:5857) — decorative border overlay
          left: 0, top: 0, width: 467, height: 608.
          Rendered on top of the portrait when portraitStyle === 'portraitFramed'. */}
      {portraitStyle === 'portraitFramed' && (
        <img
          src={portraitFrameSvg}
          alt=""
          style={{
            position:      'absolute',
            left:          0,
            top:           0,
            width:         470,
            height:        619,
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        />
      )}

      {/* ── Layer 2c: Left-hand side slot ──────────────────────────────── */}
      {/* Sits above the portrait image, against the left edge of the card,
          198px from the top. */}
      <img
        src={cardLsSlotSvg}
        alt=""
        style={{
          position:      'absolute',
          left:          0,
          top:           198,
          pointerEvents: 'none',
          userSelect:    'none',
        }}
      />

      {/* ── Layer 3a: Unit Name ─────────────────────────────────────────── */}
      {/* Sits inside the dark teal header bar (top:0, height:120).
          After the 49 px corner shape + 10 px padding → left:478.
          Incuts decorative element in BG occupies top:5–25; text starts at ~35. */}
      <div
        style={{
          position: 'absolute',
          left:     478,
          top:      35,
          width:    792,
          overflow: 'hidden',
        }}
      >
        {editingField === 'unitName' ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            maxLength={getMaxLength(constraints, 'name')}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitText(onUnitNameChange)}
            onKeyDown={onKeyDown}
            style={{
              ...INPUT_BASE,
              ...INDUSTRY,
              fontSize:      66,
              lineHeight:    '80px',
              color:         'white',
              letterSpacing: '1.98px',
              borderBottom:  '2px solid rgba(255,255,255,0.5)',
              display:       'block',
              width:         760,
              whiteSpace:    'nowrap',
            }}
          />
        ) : (
          <p
            style={{
              ...INDUSTRY,
              fontSize:      66,
              lineHeight:    '80px',
              color:         'white',
              letterSpacing: '1.98px',
              whiteSpace:    'nowrap',
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              margin:        0,
              ...editCursor(!!onUnitNameChange),
            }}
            onDoubleClick={e => { e.stopPropagation(); startEdit('unitName', unitName, !!onUnitNameChange); }}
          >
            {unitName}
          </p>
        )}
      </div>

      {/* ── Layer 3b: Keywords ──────────────────────────────────────────── */}
      {/* Below the header bar (top:129 = 120 header + 9 gap).
          pl-72 from the heading group's left (419) → absolute left:491. */}
      {(keywords || onKeywordsChange) && (
        <div
          style={{
            position:  'absolute',
            left:      491,
            top:       139,
            maxWidth:  740,
            overflow:  'hidden',
          }}
        >
          {editingField === 'keywords' ? (
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitText(onKeywordsChange)}
              onKeyDown={onKeyDown}
              style={{
                ...INPUT_BASE,
                ...ALLER,
                fontSize:    32,
                lineHeight:  'normal',
                color:       'black',
                borderBottom:'1.5px solid rgba(0,0,0,0.3)',
                display:     'block',
                width:       700,
                whiteSpace:  'nowrap',
              }}
            />
          ) : keywordData && keywordData.length > 0 ? (
            <p
              style={{
                ...ALLER,
                fontSize:     32,
                lineHeight:   'normal',
                color:        'black',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                margin:       0,
              }}
            >
              {keywordData.map((kw, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => { e.stopPropagation(); setViewingCardKeyword(kw); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setViewingCardKeyword(kw); } }}
                    style={{
                      textDecoration: 'underline',
                      color:          '#2563eb',
                      cursor:         'pointer',
                    }}
                  >
                    {kw.label}
                  </span>
                </span>
              ))}
            </p>
          ) : (
            <p
              style={{
                ...ALLER,
                fontSize:     32,
                lineHeight:   'normal',
                color:        'black',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                margin:       0,
                ...editCursor(!!onKeywordsChange),
              }}
              onDoubleClick={e => { e.stopPropagation(); startEdit('keywords', keywords, !!onKeywordsChange); }}
            >
              {keywords}
            </p>
          )}
        </div>
      )}

      {/* ── Layer 3c: RA / FI / SV stat values ─────────────────────────── */}

      {/* RA */}
      <div style={{ position: 'absolute', left: 495, top: 270, width: 106, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{ ...statValueStyle, display: 'flex', alignItems: 'baseline', gap: 0 }}
          onDoubleClick={e => { e.stopPropagation(); startEdit('ra', ra, !!onRaChange); }}
        >
          {editingField === 'ra' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('ra', onRaChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 38, letterSpacing: '1.14px', color: 'black', borderBottom: '1.5px solid rgba(0,0,0,0.3)', width: 40, textAlign: 'center' }}
            />
          ) : (
            <span style={editCursor(!!onRaChange)}>{ra}</span>
          )}
          <span>+</span>
        </span>
      </div>

      {/* FI */}
      <div style={{ position: 'absolute', left: 609, top: 270, width: 106, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{ ...statValueStyle, display: 'flex', alignItems: 'baseline', gap: 0 }}
          onDoubleClick={e => { e.stopPropagation(); startEdit('fi', fi, !!onFiChange); }}
        >
          {editingField === 'fi' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('fi', onFiChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 38, letterSpacing: '1.14px', color: 'black', borderBottom: '1.5px solid rgba(0,0,0,0.3)', width: 40, textAlign: 'center' }}
            />
          ) : (
            <span style={editCursor(!!onFiChange)}>{fi}</span>
          )}
          <span>+</span>
        </span>
      </div>

      {/* SV */}
      <div style={{ position: 'absolute', left: 723, top: 270, width: 106, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{ ...statValueStyle, display: 'flex', alignItems: 'baseline', gap: 0 }}
          onDoubleClick={e => { e.stopPropagation(); startEdit('sv', sv, !!onSvChange); }}
        >
          {editingField === 'sv' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('sv', onSvChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 38, letterSpacing: '1.14px', color: 'black', borderBottom: '1.5px solid rgba(0,0,0,0.3)', width: 40, textAlign: 'center' }}
            />
          ) : (
            <span style={editCursor(!!onSvChange)}>{sv}</span>
          )}
          <span>+</span>
        </span>
      </div>

      {/* ── Layer 3d: Speed value ────────────────────────────────────────── */}
      {/* Speed chevron (Union1 in BG) starts at left:495, top:422.
          The text content area is 82 px wide, starting after the left chevron
          (36 px) + tail (24 px) − overlap (12.54 px) ≈ left:542.
          The SP label and "/" separator are static; advance and sprint are
          split into two separate double-clickable hit areas. */}
      <div
        style={{
          position:       'absolute',
          left:           542,
          top:            372,
          width:          82,
          height:         120,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            ...ALLER,
            fontSize:      30,
            lineHeight:    'normal',
            color:         'white',
            textTransform: 'uppercase',
            whiteSpace:    'nowrap',
            display:       'flex',
            alignItems:    'baseline',
            gap:           0,
          }}
        >
          <span>SP&nbsp;</span>

          {/* Advance */}
          {editingField === 'advance' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('advanceValue', onAdvanceValueChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 30, color: 'white', borderBottom: '1.5px solid rgba(255,255,255,0.5)', width: 22, textAlign: 'center' }}
            />
          ) : (
            <span
              style={editCursor(!!onAdvanceValueChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('advance', advanceValue, !!onAdvanceValueChange); }}
            >
              {advanceValue}
            </span>
          )}

          <span>/</span>

          {/* Sprint */}
          {editingField === 'sprint' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('sprintValue', onSprintValueChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 30, color: 'white', borderBottom: '1.5px solid rgba(255,255,255,0.5)', width: 22, textAlign: 'center' }}
            />
          ) : (
            <span
              style={editCursor(!!onSprintValueChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('sprint', sprintValue, !!onSprintValueChange); }}
            >
              {sprintValue}
            </span>
          )}
        </span>
      </div>

      {/* ── Layer 3e: Armour value ───────────────────────────────────────── */}
      {/* Armour chevron (Rectangle11 in BG) at left:704, top:423, 120×118.
          Content area: centre chevron row, 70 px tall, 120 px wide.
          Upper/lower chevron arrows are 24 px each → content at top:446. */}
      <div
        style={{
          position:       'absolute',
          left:           704,
          top:            396,
          width:          120,
          height:         70,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            ...ALLER,
            fontSize:      30,
            lineHeight:    'normal',
            color:         'white',
            textTransform: 'uppercase',
            whiteSpace:    'nowrap',
            display:       'flex',
            alignItems:    'baseline',
            gap:           0,
          }}
        >
          <span>AR&nbsp;</span>
          {editingField === 'ar' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('ar', onArChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...ALLER, fontSize: 30, color: 'white', borderBottom: '1.5px solid rgba(255,255,255,0.5)', width: 22, textAlign: 'center' }}
            />
          ) : (
            <span
              style={editCursor(!!onArChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('ar', ar, !!onArChange); }}
            >
              {ar}
            </span>
          )}
        </span>
      </div>

      {/* ── Layer 3f: HP value ───────────────────────────────────────────── */}
      {/* HP bottom container: left:941, top:472, 152 × 70.
          The "HP" label is a vector path in BG.svg (inside the octagon above). */}
      <div
        style={{
          position:       'absolute',
          left:           941,
          top:            422,
          width:          152,
          height:         70,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        {editingField === 'hp' ? (
          <input
            autoFocus type="text" value={editValue}
            onChange={onDigitChange}
            onBlur={() => commitNumber('hp', onHpChange)}
            onKeyDown={onKeyDown}
            style={{
              ...INPUT_BASE,
              ...ALLER_BD,
              fontSize:      50,
              letterSpacing: '1.5px',
              color:         'black',
              borderBottom:  '1.5px solid rgba(0,0,0,0.3)',
              width:         55,
              textAlign:     'center',
            }}
          />
        ) : (
          <span
            style={{
              ...ALLER_BD,
              fontSize:      50,
              lineHeight:    'normal',
              color:         'black',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              ...editCursor(!!onHpChange),
            }}
            onDoubleClick={e => { e.stopPropagation(); startEdit('hp', hp, !!onHpChange); }}
          >
            {hp}
          </span>
        )}
      </div>

      {/* ── Layer 3g: Weapon table (dynamic rows) ─────────────────────────── */}
      {/* Row backgrounds — drawn on top of BG.svg's static backgrounds */}
      {Array.from({ length: rowCount }, (_, i) => (
        <div
          key={`row-bg-${i}`}
          style={{
            position:   'absolute',
            left:       TABLE_LEFT,
            top:        firstRowTopY + rowTopOffsets[i],
            width:      TABLE_WIDTH,
            height:     rowHeights[i],
            background: ROW_BG_COLORS[i] ?? 'white',
          }}
        />
      ))}

      {/* Header background */}
      <div
        style={{
          position:   'absolute',
          left:       TABLE_LEFT,
          top:        headerTopY,
          width:      TABLE_WIDTH,
          height:     WEAPON_HEADER_H,
          background: '#0d5e5e',
        }}
      />

      {/* Header labels */}
      <WeaponCell col={COL_TYPE}     top={headerTopY} height={WEAPON_HEADER_H} text="Weapon Type" bold />
      <WeaponCell col={COL_WEAPON}   top={headerTopY} height={WEAPON_HEADER_H} text="Weapon"      bold />
      <WeaponCell col={COL_RANGE}    top={headerTopY} height={WEAPON_HEADER_H} text="Range"       bold />
      <WeaponCell col={COL_AP}       top={headerTopY} height={WEAPON_HEADER_H} text="AP"          bold />
      <WeaponCell col={COL_KEYWORDS} top={headerTopY} height={WEAPON_HEADER_H} text="Keywords"    bold />

      {/* Weapon data rows */}
      {Array.from({ length: rowCount }, (_, i) => {
        const w = weapons[i];
        const rowTop = firstRowTopY + rowTopOffsets[i];
        const rowH   = rowHeights[i];
        return (
          <div key={`row-${i}`}>
            <WeaponCell col={COL_TYPE}     top={rowTop} height={rowH} text={w?.type     ?? '—'} />
            {w && onWeaponClick ? (
              <div
                style={{
                  position: 'absolute',
                  left:     COL_WEAPON.left,
                  top:      rowTop,
                  width:    COL_WEAPON.width,
                  height:   rowH,
                  display:  'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 13px',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onWeaponClick(w); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onWeaponClick(w); } }}
                  style={{
                    ...ALLER,
                    fontSize: 30,
                    lineHeight: 'normal',
                    textDecoration: 'underline',
                    color: '#2563eb',
                    cursor: 'pointer',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {w.name}
                </span>
              </div>
            ) : (
              <WeaponCell col={COL_WEAPON}   top={rowTop} height={rowH} text={w?.name     ?? '—'} />
            )}
            <WeaponCell col={COL_RANGE}    top={rowTop} height={rowH} text={w?.range    ?? '—'} />
            <WeaponCell col={COL_AP}       top={rowTop} height={rowH} text={w?.ap       ?? '—'} />
            {w?.keywordData && w.keywordData.length > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left:     COL_KEYWORDS.left,
                  top:      rowTop,
                  width:    COL_KEYWORDS.width,
                  height:   rowH,
                  display:  'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 13px',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    ...ALLER,
                    fontSize: 30,
                    lineHeight: 'normal',
                    color: 'black',
                    textAlign: 'center',
                  }}
                >
                  {w.keywordData.map((kw, ki) => (
                    <span key={ki}>
                      {ki > 0 && ', '}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); setViewingCardKeyword(kw); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setViewingCardKeyword(kw); } }}
                        style={{ textDecoration: 'underline', color: '#2563eb', cursor: 'pointer' }}
                      >
                        {kw.label}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            ) : (
              <WeaponCell col={COL_KEYWORDS} top={rowTop} height={rowH} text={w?.keywords ?? '—'} />
            )}
          </div>
        );
      })}

      {/* ── Keyword info modal (portaled to body to escape card scaling) ── */}
      {viewingCardKeyword && createPortal(
        <KeywordInfoModal
          open
          onClose={() => setViewingCardKeyword(null)}
          name={viewingCardKeyword.name}
          description={viewingCardKeyword.description}
          onEdit={onEditKeyword ? () => {
            const kw = viewingCardKeyword;
            setViewingCardKeyword(null);
            onEditKeyword(kw);
          } : undefined}
        />,
        document.body,
      )}

    </div>
    {/* ── Token overlay (play mode) — outside overflow-clip so tokens can extend past card bounds ── */}
    {tokenOverlay && tokenOverlay.definitions.length > 0 && (
      <TokenOverlay
        gameSlug="halo-flashpoint"
        tokenDefinitions={tokenOverlay.definitions}
        card={{ stats: { hp }, unitKeywords: tokenOverlay.unitKeywords }}
        tokenState={tokenOverlay.state}
        onTokenChange={tokenOverlay.onChange}
      />
    )}
    </div>
  );
};

export default HaloFlashpointCard;
