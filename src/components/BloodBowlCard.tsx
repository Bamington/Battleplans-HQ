/**
 * BloodBowlCard.tsx — Blood Bowl unit card
 *
 * Architecture:
 *   Layer 1 — card-background.svg  : all static chrome (card shape, stat column,
 *             GP shield, section backgrounds, decorative elements)
 *   Layer 2 — Player image          : portrait clipped to a parallelogram using
 *             a CSS mask (image-mask.png from Figma's Image Mask Shape vector)
 *   Layer 3 — Interactive           : dynamically-bound text nodes, positioned to
 *             match the Figma "Interactive" group exactly (node 226:3515)
 *
 * The card renders at its native 750 × 1100 px. Scale the outer wrapper with a
 * CSS transform for smaller display sizes.
 *
 * All positions and styles are taken directly from Figma — do not adjust by eye.
 *
 * Inline editing:
 *   Pass an onChange callback (e.g. onTeamNameChange) to enable double-click
 *   editing on that field. Omit the callback to keep the field read-only.
 *   Edits commit on blur or Enter; Escape cancels without saving.
 */

import { useState, useRef } from 'react';
import { createPortal }    from 'react-dom';
import KeywordInfoModal    from './KeywordInfoModal';
import { clampNumber, getMaxLength } from '../lib/constraints';
import type { EntityConstraints }    from '../lib/database.types';
import cardBackground      from '../assets/games/card assets/blood-bowl/bg.svg';
import portraitPlaceholder from '../assets/games/card assets/blood-bowl/example-image.jpg';

// ── Font shorthands ───────────────────────────────────────────────────────────
const BROTHERS = { fontFamily: "'Brothers', serif" } as const;
const NOTO     = { fontFamily: "'Noto Sans', sans-serif", fontVariationSettings: "'CTGR' 0, 'wdth' 100" } as const;
const NOTO_MED = { ...NOTO, fontWeight: 500 } as const;

// Stat numbers: Brothers, dark blue, white stroke behind fill (Figma spec)
const STAT_STYLE = {
  ...BROTHERS,
  color:            '#0e457d',
  WebkitTextStroke: '3px white',
  paintOrder:       'stroke fill',
} as const;

// Heading skew/rotate transform — matches Figma: -skew-x-15 rotate-[-6.46deg] scale-y-97
const HEADING_TRANSFORM = 'rotate(-6.46deg) skewX(-15deg) scaleY(0.97)';

// ── Shared inline-input base styles ──────────────────────────────────────────
const INPUT_BASE: React.CSSProperties = {
  background:  'transparent',
  border:      'none',
  outline:     'none',
  padding:     0,
  margin:      0,
  display:     'block',
};

// ── Props ─────────────────────────────────────────────────────────────────────

/** Structured skill data for clickable skill links on the card. */
export interface CardSkillInfo {
  label: string;
  name:  string;
  description: string;
}

export interface BloodBowlCardProps {
  teamName?:           string;
  unitName?:           string;
  playerRole?:         string;
  /** GP cost displayed in the banner — e.g. "75,000" */
  cost?:               string | number;
  /** Comma-separated skills & traits */
  skills?:             string;
  /** When provided, skills render as individually clickable links instead of flat text. */
  skillData?:          CardSkillInfo[];
  primaryAttribute?:   string;
  secondaryAttribute?: string;
  /** Portrait image src — defaults to placeholder */
  portrait?:           string;
  ma?: number;
  st?: number;
  ag?: number;
  pa?: number;
  av?: number;
  className?: string;
  // ── Inline edit callbacks — omit a callback to keep that field read-only ──
  onTeamNameChange?:   (v: string) => void;
  onUnitNameChange?:   (v: string) => void;
  onPlayerRoleChange?: (v: string) => void;
  onCostChange?:       (v: string) => void;
  onSkillsChange?:     (v: string) => void;
  /** Single digit 0–9 */
  onMaChange?: (v: number) => void;
  onStChange?: (v: number) => void;
  onAgChange?: (v: number) => void;
  onPaChange?: (v: number) => void;
  onAvChange?: (v: number) => void;
  /** Called when user clicks "Edit Skill" from a skill info modal on the card */
  onEditSkill?:        (skill: CardSkillInfo) => void;
  /** DB-driven validation constraints — when omitted, falls back to 0–9 for numbers. */
  constraints?:        EntityConstraints;
}

// ── Component ─────────────────────────────────────────────────────────────────

const BloodBowlCard = ({
  teamName           = 'Team Name',
  unitName           = 'Unit Name',
  playerRole         = 'Player Role',
  cost               = '0',
  skills             = '—',
  skillData,
  primaryAttribute   = '—',
  secondaryAttribute = '—',
  portrait           = portraitPlaceholder,
  ma = 0,
  st = 0,
  ag = 0,
  pa = 0,
  av = 0,
  className = '',
  onTeamNameChange,
  onUnitNameChange,
  onPlayerRoleChange,
  onCostChange,
  onSkillsChange,
  onMaChange,
  onStChange,
  onAgChange,
  onPaChange,
  onAvChange,
  onEditSkill,
  constraints = {},
}: BloodBowlCardProps) => {

  // ── Skill info modal state ──────────────────────────────────────────────────
  const [viewingCardSkill, setViewingCardSkill] = useState<CardSkillInfo | null>(null);

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue,    setEditValue]    = useState('');
  // Ref flag so Escape-triggered blur doesn't commit the value
  const cancellingRef = useRef(false);

  const startEdit = (field: string, value: string | number, editable: boolean) => {
    if (!editable) return;
    setEditingField(field);
    setEditValue(String(value));
  };

  // Commits a string field and resets edit state
  const commitText = (onChange?: (v: string) => void) => {
    if (!cancellingRef.current) onChange?.(editValue);
    cancellingRef.current = false;
    setEditingField(null);
  };

  // Commits a number field, clamped by DB-driven constraints
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

  // Cursor for editable fields — text cursor on hover to hint interactivity
  const editCursor = (editable: boolean): React.CSSProperties =>
    editable ? { cursor: 'text', userSelect: 'none' as const } : { userSelect: 'none' as const };

  // ── Renders ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative overflow-clip rounded-[30px] shrink-0 ${className}`}
      style={{ width: 750, height: 1100 }}
    >

      {/* ── Layer 1: static SVG background ─────────────────────────────── */}
      <img
        src={cardBackground}
        alt=""
        className="absolute inset-0 w-full h-full"
        draggable={false}
      />

      {/* ── Layer 2: player portrait, clipped to parallelogram ───────────
          Node: 240:4619 "Player Image" — x:163 y:50 w:393 h:407
          clip-path polygon derived from Figma's "Image Mask Shape" vector:
            M 0 38 L 393 0 L 393 369 L 0 407 Z */}
      <div
        className="absolute"
        style={{
          left:     169,
          top:      22,
          width:    593,
          height:   614,
          clipPath: 'polygon(0px 57px, 593px 0px, 593px 557px, 0px 614px)',
        }}
      >
        <img
          src={portrait}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* ── Layer 3: interactive elements ──────────────────────────────── */}

      {/* ── Card Headings (node 31:11190) ─────────────────────────────── */}

      <div
        className="absolute flex flex-col items-start"
        style={{ left: '22.85px', top: '15px' }}
      >
        {/* Team name — 40px Brothers, white, drop shadow */}
        <div className="flex h-[80px] pt-[10px] items-start justify-start">
          <div className="flex-none" style={{ transform: HEADING_TRANSFORM }}>
            <div
              className="flex flex-col justify-center leading-[0] not-italic relative text-[40px] text-white whitespace-nowrap"
              style={{ ...BROTHERS, textShadow: '2px 3px 0px black' }}
            >
              {editingField === 'teamName' ? (
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  maxLength={getMaxLength(constraints, 'stats.teamName')}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitText(onTeamNameChange)}
                  onKeyDown={onKeyDown}
                  style={{
                    ...INPUT_BASE,
                    ...BROTHERS,
                    fontSize:    40,
                    color:       'white',
                    textShadow:  '2px 3px 0px black',
                    borderBottom:'1.5px solid rgba(255,255,255,0.5)',
                    lineHeight:  'normal',
                    width:       310,
                  }}
                />
              ) : (
                <p
                  className="leading-[normal]"
                  style={editCursor(!!onTeamNameChange)}
                  onDoubleClick={e => { e.stopPropagation(); startEdit('teamName', teamName, !!onTeamNameChange); }}
                >
                  {teamName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Unit name — 62px Brothers, white, drop shadow */}
        <div className="flex h-[133px] mt-[-20px] items-start justify-start">
          <div className="flex-none" style={{ transform: HEADING_TRANSFORM }}>
            <div
              className="flex flex-col justify-center leading-[0] not-italic relative text-[62px] text-white whitespace-nowrap"
              style={{ ...BROTHERS, textShadow: '3px 4px 0px black' }}
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
                    ...BROTHERS,
                    fontSize:    62,
                    color:       'white',
                    textShadow:  '3px 4px 0px black',
                    borderBottom:'1.5px solid rgba(255,255,255,0.5)',
                    lineHeight:  'normal',
                    width:       560,
                  }}
                />
              ) : (
                <p
                  className="leading-[normal]"
                  style={editCursor(!!onUnitNameChange)}
                  onDoubleClick={e => { e.stopPropagation(); startEdit('unitName', unitName, !!onUnitNameChange); }}
                >
                  {unitName}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Numbers (node 226:3097) ──────────────────────────────────
          Brothers 58px, #0e457d, 3px white stroke behind fill.
          MA/ST: no suffix. AG/PA/AV: "+" suffix at 28px. */}

      {/* MA — top 215 */}
      <div
        className="absolute flex gap-px items-center leading-[0] not-italic whitespace-nowrap"
        style={{ ...STAT_STYLE, left: 87, top: 215 }}
      >
        <div className="flex flex-col justify-end relative shrink-0 text-[68px]">
          {editingField === 'ma' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('ma', onMaChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...STAT_STYLE, fontSize: 68, lineHeight: 'normal', borderBottom: '2px solid rgba(14,69,125,0.5)', width: 60, textAlign: 'center' }}
            />
          ) : (
            <p
              className="leading-[normal]"
              style={editCursor(!!onMaChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('ma', ma, !!onMaChange); }}
            >{ma}</p>
          )}
        </div>
      </div>

      {/* ST — top 350 */}
      <div
        className="absolute flex gap-px items-center leading-[0] not-italic whitespace-nowrap"
        style={{ ...STAT_STYLE, left: 87, top: 350 }}
      >
        <div className="flex flex-col justify-end relative shrink-0 text-[68px]">
          {editingField === 'st' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('st', onStChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...STAT_STYLE, fontSize: 68, lineHeight: 'normal', borderBottom: '2px solid rgba(14,69,125,0.5)', width: 60, textAlign: 'center' }}
            />
          ) : (
            <p
              className="leading-[normal]"
              style={editCursor(!!onStChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('st', st, !!onStChange); }}
            >{st}</p>
          )}
        </div>
      </div>

      {/* AG — top 489, with "+" */}
      <div
        className="absolute flex gap-px items-center leading-[0] not-italic whitespace-nowrap"
        style={{ ...STAT_STYLE, left: 87, top: 489 }}
      >
        <div className="flex flex-col justify-end relative shrink-0 text-[68px]">
          {editingField === 'ag' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('ag', onAgChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...STAT_STYLE, fontSize: 68, lineHeight: 'normal', borderBottom: '2px solid rgba(14,69,125,0.5)', width: 60, textAlign: 'center' }}
            />
          ) : (
            <p
              className="leading-[normal]"
              style={editCursor(!!onAgChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('ag', ag, !!onAgChange); }}
            >{ag}</p>
          )}
        </div>
        <div className="flex flex-col justify-end relative shrink-0 text-[28px]">
          <p className="leading-[normal]">+</p>
        </div>
      </div>

      {/* PA — top 628, with "+" */}
      <div
        className="absolute flex gap-px items-center leading-[0] not-italic whitespace-nowrap"
        style={{ ...STAT_STYLE, left: 87, top: 628 }}
      >
        <div className="flex flex-col justify-end relative shrink-0 text-[68px]">
          {editingField === 'pa' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('pa', onPaChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...STAT_STYLE, fontSize: 68, lineHeight: 'normal', borderBottom: '2px solid rgba(14,69,125,0.5)', width: 60, textAlign: 'center' }}
            />
          ) : (
            <p
              className="leading-[normal]"
              style={editCursor(!!onPaChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('pa', pa, !!onPaChange); }}
            >{pa}</p>
          )}
        </div>
        <div className="flex flex-col justify-end relative shrink-0 text-[28px]">
          <p className="leading-[normal]">+</p>
        </div>
      </div>

      {/* AV — top 763, with "+" */}
      <div
        className="absolute flex gap-px items-center leading-[0] not-italic whitespace-nowrap"
        style={{ ...STAT_STYLE, left: 87, top: 763 }}
      >
        <div className="flex flex-col justify-end relative shrink-0 text-[68px]">
          {editingField === 'av' ? (
            <input
              autoFocus type="text" value={editValue}
              onChange={onDigitChange}
              onBlur={() => commitNumber('av', onAvChange)}
              onKeyDown={onKeyDown}
              style={{ ...INPUT_BASE, ...STAT_STYLE, fontSize: 68, lineHeight: 'normal', borderBottom: '2px solid rgba(14,69,125,0.5)', width: 60, textAlign: 'center' }}
            />
          ) : (
            <p
              className="leading-[normal]"
              style={editCursor(!!onAvChange)}
              onDoubleClick={e => { e.stopPropagation(); startEdit('av', av, !!onAvChange); }}
            >{av}</p>
          )}
        </div>
        <div className="flex flex-col justify-end relative shrink-0 text-[28px]">
          <p className="leading-[normal]">+</p>
        </div>
      </div>

      {/* ── GP Cost (node 31:11427) ───────────────────────────────────────
          Brothers 22px, white, centered in the GP banner ribbon. */}
      <div
        className="-translate-x-1/2 -translate-y-full absolute flex flex-col justify-end leading-[0] not-italic text-[28px] text-center text-white whitespace-nowrap"
        style={{ ...BROTHERS, left: 'calc(50% - 264px)', top: 'calc(50% + 492px)' }}
      >
        {editingField === 'cost' ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            maxLength={getMaxLength(constraints, 'stats.cost')}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitText(onCostChange)}
            onKeyDown={onKeyDown}
            style={{
              ...INPUT_BASE,
              ...BROTHERS,
              fontSize:    28,
              color:       'white',
              borderBottom:'1.5px solid rgba(255,255,255,0.5)',
              lineHeight:  'normal',
              textAlign:   'center',
              width:       100,
            }}
          />
        ) : (
          <p
            className="leading-[normal]"
            style={editCursor(!!onCostChange)}
            onDoubleClick={e => { e.stopPropagation(); startEdit('cost', cost, !!onCostChange); }}
          >
            {cost}
          </p>
        )}
      </div>

      {/* ── Player Role (node 240:4610) ───────────────────────────────────
          Brothers 53px, white, centered, tracking -1.06px, uppercase.
          bottom:96.5 centered at left:calc(50%+80.5px) w:509 */}
      <div
        className="-translate-x-1/2 translate-y-1/2 absolute flex flex-col justify-center leading-[0] not-italic text-[53px] text-center text-white uppercase"
        style={{ ...BROTHERS, left: 'calc(50% + 80.5px)', bottom: 96.5, width: 509, letterSpacing: '-1.06px' }}
      >
        {editingField === 'playerRole' ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            maxLength={getMaxLength(constraints, 'stats.playerRole')}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitText(onPlayerRoleChange)}
            onKeyDown={onKeyDown}
            style={{
              ...INPUT_BASE,
              ...BROTHERS,
              fontSize:      53,
              color:         'white',
              textTransform: 'uppercase',
              letterSpacing: '-1.06px',
              borderBottom:  '1.5px solid rgba(255,255,255,0.5)',
              lineHeight:    'normal',
              textAlign:     'center',
              width:         '100%',
            }}
          />
        ) : (
          <p
            className="leading-[normal]"
            style={editCursor(!!onPlayerRoleChange)}
            onDoubleClick={e => { e.stopPropagation(); startEdit('playerRole', playerRole, !!onPlayerRoleChange); }}
          >
            {playerRole}
          </p>
        )}
      </div>

      {/* ── Skills and Development (node 31:11374) ───────────────────────
          left:163 top:476 width:367
          gap-[10px] between sections (updated from 18px in Figma redesign)
          Skills Container:   h-[118px] pt-[12px] px-[7px]
          Development Container: gap-px px-[7px] (no vertical padding) */}
      <div
        className="absolute w-[367px] h-[231px]"
        style={{ left: 178, top: 679 }}
      >
        {/* Skills Container */}
        <div className="absolute flex flex-col h-[118px] items-start pt-[12px] px-[7px] left-0 right-0 top-0">
          <div
            className="flex flex-col font-normal justify-end leading-[0] relative shrink-0 text-[20px] text-black w-[353px]"
            style={NOTO}
          >
            {editingField === 'skills' ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitText(onSkillsChange)}
                onKeyDown={onKeyDown}
                style={{
                  ...INPUT_BASE,
                  ...NOTO,
                  fontSize:    20,
                  color:       'black',
                  borderBottom:'1.5px solid rgba(0,0,0,0.3)',
                  lineHeight:  'normal',
                  width:       '100%',
                }}
              />
            ) : skillData && skillData.length > 0 ? (
              <p className="leading-[normal]">
                {skillData.map((sk, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); setViewingCardSkill(sk); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setViewingCardSkill(sk); } }}
                      style={{ textDecoration: 'underline', color: '#2563eb', cursor: 'pointer' }}
                    >
                      {sk.label}
                    </span>
                  </span>
                ))}
              </p>
            ) : (
              <p
                className="leading-[normal]"
                style={editCursor(!!onSkillsChange)}
                onDoubleClick={e => { e.stopPropagation(); startEdit('skills', skills, !!onSkillsChange); }}
              >
                {skills}
              </p>
            )}
          </div>
        </div>

        {/* Development Container */}
        <div
          className="absolute flex flex-col gap-px items-start leading-[0] left-0 right-0 px-[7px] text-[18px] text-black tracking-[-0.36px]"
          style={{ top: 166 }}
        >
          {/* Primary */}
          <div className="flex gap-[4px] h-[32px] items-center justify-center relative shrink-0 w-full">
            <div className="flex flex-col justify-center relative shrink-0 whitespace-nowrap" style={NOTO_MED}>
              <p className="leading-[normal]">Primary:</p>
            </div>
            <div className="flex flex-[1_0_0] flex-col font-normal h-full justify-center min-h-px min-w-px relative" style={NOTO}>
              <p className="leading-[normal]">{primaryAttribute}</p>
            </div>
          </div>
          {/* Secondary */}
          <div className="flex gap-[4px] h-[32px] items-center justify-center relative shrink-0 w-full">
            <div className="flex flex-col justify-center relative shrink-0 whitespace-nowrap" style={NOTO_MED}>
              <p className="leading-[normal]">Secondary:</p>
            </div>
            <div className="flex flex-[1_0_0] flex-col font-normal h-full justify-center min-h-px min-w-px relative" style={NOTO}>
              <p className="leading-[normal]">{secondaryAttribute}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Skill info modal (portaled to body to escape card scaling) ── */}
      {viewingCardSkill && createPortal(
        <KeywordInfoModal
          open
          onClose={() => setViewingCardSkill(null)}
          name={viewingCardSkill.name}
          description={viewingCardSkill.description}
          typeName="Skill"
          onEdit={onEditSkill ? () => {
            const sk = viewingCardSkill;
            setViewingCardSkill(null);
            onEditSkill(sk);
          } : undefined}
        />,
        document.body,
      )}

    </div>
  );
};

export default BloodBowlCard;
