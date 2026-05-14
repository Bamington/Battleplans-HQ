/**
 * KillTeamCard.tsx — Kill Team operative card
 *
 * Architecture:
 *   Layer 1 — bg.svg            : top + bottom black bands + the four black
 *                                  stat blocks (APL / Move / Save / Wounds)
 *                                  with their labels baked in as vector paths
 *   Layer 2 — Dynamic chrome    : orange under-name divider, weapon-table
 *                                  header + alternating row backgrounds + the
 *                                  orange action-banner. These are data-driven
 *                                  so they live in the React layer rather than
 *                                  the SVG.
 *   Layer 3 — Interactive text  : dynamic values positioned to match Figma node
 *                                  848:4481 exactly. Inline editing lights up
 *                                  on any field whose onChange handler is set.
 *
 * Native size: 1270 × 890 px. Wrap and CSS-transform for display.
 *
 * Inline editing:
 *   Pass onChange callbacks to enable double-click editing on a field.
 *   Edits commit on blur or Enter; Escape cancels without saving.
 *
 * Font: the design uses "Conduit ITC". The .ttf/.otf isn't bundled yet — we
 *   fall back to the system sans-serif until you drop it in /assets/games/fonts.
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import KeywordInfoModal from './KeywordInfoModal';
import TokenOverlay from './TokenOverlay';
import type { TokenDefinition } from '../lib/database.types';
import bgSvg         from '../assets/games/card assets/kill-team/bg.svg';
import bgPortraitSvg from '../assets/games/card assets/kill-team/bg-portrait.svg';
import iconAPL       from '../assets/games/card assets/kill-team/kt-icon-APL.svg';
import iconMove      from '../assets/games/card assets/kill-team/kt-icon-move.svg';
import iconSave      from '../assets/games/card assets/kill-team/kt-icon-save.svg';
import iconWounds    from '../assets/games/card assets/kill-team/kt-icon-wounds.svg';

// ── Native size ──────────────────────────────────────────────────────────────
const CARD_W = 1270;
const CARD_H = 890;

// ── Portrait mask (matches kt-mask.svg, attached by user) ───────────────────
// Parallelogram clipped to the right side of the operative-name band:
//   (47.5,0) → (319.5,0) → (319.5,118) → (0,118) → close
// In CSS clip-path / polygon coordinates relative to the mask container.
const PORTRAIT_LEFT      = 505.5;
const PORTRAIT_TOP       = 0;
const PORTRAIT_W         = 319.5;
const PORTRAIT_H         = 118;
const PORTRAIT_CLIP_PATH = 'polygon(47.5px 0, 319.5px 0, 319.5px 118px, 0 118px)';

// ── Font shorthands ──────────────────────────────────────────────────────────
const CONDUIT      = { fontFamily: "'Conduit ITC', sans-serif" } as const;
const CONDUIT_BOLD = { ...CONDUIT, fontWeight: 700 } as const;
const CONDUIT_REG  = { ...CONDUIT, fontWeight: 400 } as const;

// ── Theme tokens ─────────────────────────────────────────────────────────────
const ORANGE = '#f85908';
const ROW_GRAY = '#d1d2d4';

// ── Stat block geometry (matches Figma 848:4506-4509) ────────────────────────
// Each block is a black panel in bg.svg. Inside: orange icon + white value
// rendered side-by-side, centred in the block. Icon native sizes are taken
// directly from the SVGs in /assets/games/card assets/kill-team.
const STAT_BLOCKS = [
  { left: 834,  width: 96,  icon: iconAPL,    iconW: 48, iconH: 39 },  // APL
  { left: 937,  width: 96,  icon: iconMove,   iconW: 42, iconH: 37 },  // Move
  { left: 1040, width: 96,  icon: iconSave,   iconW: 29, iconH: 37 },  // Save
  { left: 1143, width: 127, icon: iconWounds, iconW: 12, iconH: 39 },  // Wounds
];
const STAT_TOP    = 50;  // top of the icon-and-value row, below the baked-in label
const STAT_HEIGHT = 64;  // tall enough to fit the 64-px value text + icon
const STAT_GAP    = 2;   // gap between icon and value

// ── Weapon-table geometry ────────────────────────────────────────────────────
const TABLE_LEFT     = 30;
const TABLE_WIDTH    = 1211;
const TABLE_TOP      = 126;
const HEADER_H       = 43;
const HEADER_BORDER  = 5;
const ROW_H          = 48;
const BOTTOM_BAND_Y  = 810; // abilities region must end before this
const ABILITIES_GAP  = 14;  // breathing room between weapon table and abilities

// Column widths (match Figma 848:4543/4532/4534/4537/4539/4541)
const COL_RANGE = { left: 0,   width: 67  };
const COL_NAME  = { left: 67,  width: 364 };
const COL_ATK   = { left: 431, width: 67  };
const COL_HIT   = { left: 498, width: 67  };
const COL_DMG   = { left: 565, width: 67  };
const COL_WR    = { left: 632, width: TABLE_WIDTH - 632 };

// ── Abilities region ─────────────────────────────────────────────────────────
// Two equal-width columns, stacked directly under the weapon table. The top
// position is computed at render time from the actual weapon-row count, so a
// shorter table pulls the abilities up and a longer one pushes them down.
// Every ability gets the orange title banner; the AP cost label appears only
// when apCost > 0.
const ABILITIES_COL_GAP = 24;
const ABILITY_BANNER_H  = 43;
const ABILITY_GAP       = 12;

// ── Shared inline-input base styles ──────────────────────────────────────────
const INPUT_BASE: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  padding: 0, margin: 0, display: 'block',
};

// ── Public types ─────────────────────────────────────────────────────────────

/** Structured keyword info for a clickable keyword chip on the card. */
export interface CardKeywordInfo {
  /** Display label, e.g. "Range 8" or "Blast (X)". */
  label:       string;
  /** Canonical keyword name (without param value). */
  name:        string;
  /** Long-form rules text. */
  description: string;
}

export interface KillTeamWeapon {
  name:          string;
  meleeOrRanged: 'melee' | 'ranged' | '';
  attack:        number;
  hit:           string;
  damage:        string;
  /** Display string fallback — used when `keywordData` isn't supplied. */
  keywords:      string;
  /** When provided, weapon keywords render as individually clickable
   *  blue-underline links (clicking opens a KeywordInfoModal). */
  keywordData?:  CardKeywordInfo[];
}

export interface KillTeamAbility {
  name:        string;
  description: string;
  apCost:      number;
  keywords:    string;
}

export interface KillTeamCardProps {
  operativeName?: string;
  /** Stored on the card but not rendered in the current design. */
  role?:          string;
  /** Stored on the card but not rendered in the current design. */
  teamName?:      string;
  /** Bottom-band keyword/faction string. */
  tags?:          string;
  actions?:       number;
  /** UI appends `"` */
  movement?:      number;
  /** UI appends `+` */
  save?:          number;
  wounds?:        number;
  /** Base size in millimetres — rendered as the number in the bottom-right
   *  corner of the card. */
  baseSize?:      number;
  /** Portrait image URL (e.g. uploaded `portraitUrl`). When provided, it
   *  renders masked to the parallelogram defined by `PORTRAIT_CLIP_PATH`
   *  in the right side of the operative-name band. When omitted, the dark
   *  band from bg.svg shows through unchanged. */
  portrait?:      string;
  weapons?:       KillTeamWeapon[];
  abilities?:     KillTeamAbility[];
  className?:     string;

  // ── Inline-edit callbacks (omit to keep field read-only) ──
  onOperativeNameChange?: (v: string) => void;
  onTagsChange?:          (v: string) => void;
  onActionsChange?:       (v: number) => void;
  onMovementChange?:      (v: number) => void;
  onSaveChange?:          (v: number) => void;
  onWoundsChange?:        (v: number) => void;

  /** Click handlers — invoked when a row is clicked on the card itself. */
  onWeaponClick?:  (w: KillTeamWeapon) => void;
  onAbilityClick?: (a: KillTeamAbility) => void;

  // ── Token overlay (play mode) ─────────────────────────────────────────
  /** When provided, renders the play-mode token overlay over the card.
   *  Mirrors `HaloFlashpointCard`'s `tokenOverlay` prop so any game using
   *  the shared TokenOverlay component plumbs in tokens the same way. */
  tokenOverlay?: {
    definitions:  TokenDefinition[];
    unitKeywords: { keywordName: string; paramValue: number | null }[];
    state:        Record<string, number>;
    onChange?:    (tokenDefId: string, newValue: number) => void;
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const KillTeamCard = ({
  operativeName = 'Operative Name',
  tags          = '',
  actions       = 0,
  movement      = 0,
  save          = 0,
  wounds        = 0,
  baseSize      = 0,
  portrait,
  weapons       = [],
  abilities     = [],
  className     = '',
  onOperativeNameChange,
  onTagsChange,
  onActionsChange,
  onMovementChange,
  onSaveChange,
  onWoundsChange,
  onWeaponClick,
  onAbilityClick,
  tokenOverlay,
}: KillTeamCardProps) => {

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [viewingCardKeyword, setViewingCardKeyword] = useState<CardKeywordInfo | null>(null);
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

  const commitNumber = (onChange?: (v: number) => void, max = 999) => {
    if (!cancellingRef.current) {
      const n = parseInt(editValue, 10);
      onChange?.(isNaN(n) ? 0 : Math.max(0, Math.min(max, n)));
    }
    cancellingRef.current = false;
    setEditingField(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  e.currentTarget.blur();
    if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
  };

  const onIntChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 3));
  };

  const editCursor = (editable: boolean): React.CSSProperties =>
    editable ? { cursor: 'text', userSelect: 'none' } : { userSelect: 'none' };

  // ── Split abilities into two equal-width columns by index ──
  const leftAbilities  = abilities.slice(0, Math.ceil(abilities.length / 2));
  const rightAbilities = abilities.slice(Math.ceil(abilities.length / 2));

  // ── Dynamic positioning — abilities start right under the weapon table ──
  const weaponRowCount   = weapons.length;
  const weaponTableBottom = TABLE_TOP + HEADER_H + HEADER_BORDER + (weaponRowCount * ROW_H);
  const abilitiesTop     = weaponTableBottom + ABILITIES_GAP;
  const abilitiesHeight  = Math.max(0, BOTTOM_BAND_Y - abilitiesTop - 10);

  // ── Stat values (with suffix concatenation) ───────────────────────────────
  const movementDisplay = movement > 0 ? `${movement}"` : '—';
  const saveDisplay     = save     > 0 ? `${save}+`    : '—';

  return (
    <div
      className={`relative ${className}`}
      style={{ width: CARD_W, height: CARD_H, ...CONDUIT }}
    >
    <div
      className="relative overflow-hidden"
      style={{ width: CARD_W, height: CARD_H }}
    >

      {/* ── Layer 1: SVG chrome ──────────────────────────────────────────────
            Two background variants: bg-portrait.svg replaces the default
            bg.svg whenever a portrait image is supplied (it includes the
            chrome / framing that wraps the masked photo). */}
      <img
        src={portrait ? bgPortraitSvg : bgSvg}
        alt=""
        className="absolute inset-0 w-full h-full"
        draggable={false}
      />

      {/* ── Layer 2: dynamic chrome + interactive text ────────────────────
            Operative name with an orange underline that hugs the name's
            text width (via `width: max-content` on the inner wrapper). */}
      <div className="absolute" style={{ left: 30, top: 37 }}>
        <div style={{ width: 'max-content' }}>
          <div
            className="flex items-center"
            style={{ height: 48 }}
          >
            {editingField === 'operativeName' ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitText(onOperativeNameChange)}
                onKeyDown={onKeyDown}
                style={{
                  ...INPUT_BASE, ...CONDUIT_BOLD,
                  fontSize: 52, lineHeight: 1, color: 'white',
                  letterSpacing: '-2.08px', textTransform: 'uppercase',
                  width: 600,
                  borderBottom: '1.5px solid rgba(255,255,255,0.4)',
                }}
              />
            ) : (
              <p
                className="whitespace-nowrap"
                style={{
                  ...CONDUIT_BOLD,
                  fontSize: 52, lineHeight: 1, color: 'white',
                  letterSpacing: '-2.08px', textTransform: 'uppercase',
                  ...editCursor(!!onOperativeNameChange),
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  startEdit('operativeName', operativeName, !!onOperativeNameChange);
                }}
              >
                {operativeName}
              </p>
            )}
          </div>
          {/* Orange underline — fills the wrapper, which is sized to the
              name's max-content width. */}
          <div style={{ height: 5, background: ORANGE, width: '100%' }} />
        </div>
      </div>

      {/* ── Layer 3: Portrait image — masked to a parallelogram (kt-mask.svg
            shape). Rendered AFTER the operative name so it sits on top of
            it (and covers any name overflow into the portrait area).
            Only rendered when a portrait URL is supplied; otherwise the
            dark band from bg.svg shows through unchanged. */}
      {portrait && (
        <img
          src={portrait}
          alt=""
          className="absolute object-cover pointer-events-none"
          style={{
            left: PORTRAIT_LEFT, top: PORTRAIT_TOP,
            width: PORTRAIT_W, height: PORTRAIT_H,
            clipPath: PORTRAIT_CLIP_PATH,
          }}
          draggable={false}
        />
      )}

      {/* Stat values — 4 blocks. Each renders an orange icon + white value
          centred in its block (block geometry from STAT_BLOCKS). */}
      {[
        { key: 'actions',  value: actions,  onChange: onActionsChange,  display: String(actions), editable: !!onActionsChange  },
        { key: 'movement', value: movement, onChange: onMovementChange, display: movementDisplay, editable: !!onMovementChange },
        { key: 'save',     value: save,     onChange: onSaveChange,     display: saveDisplay,     editable: !!onSaveChange     },
        { key: 'wounds',   value: wounds,   onChange: onWoundsChange,   display: String(wounds),  editable: !!onWoundsChange   },
      ].map((stat, i) => {
        const cfg = STAT_BLOCKS[i];
        return (
          <div
            key={stat.key}
            className="absolute flex items-center justify-center"
            style={{
              left:   cfg.left,
              top:    STAT_TOP,
              width:  cfg.width,
              height: STAT_HEIGHT,
              gap:    STAT_GAP,
            }}
          >
            <img
              src={cfg.icon}
              alt=""
              style={{ width: cfg.iconW, height: cfg.iconH, flexShrink: 0 }}
              draggable={false}
            />
            {editingField === stat.key ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={onIntChange}
                onBlur={() => commitNumber(stat.onChange, stat.key === 'wounds' ? 999 : 99)}
                onKeyDown={onKeyDown}
                style={{
                  ...INPUT_BASE, ...CONDUIT_BOLD,
                  fontSize: 64, lineHeight: 1, color: 'white',
                  letterSpacing: '-2.56px', textTransform: 'uppercase',
                  textAlign: 'center', width: 70,
                  borderBottom: '2px solid rgba(255,255,255,0.4)',
                }}
              />
            ) : (
              <p
                className="whitespace-nowrap"
                style={{
                  ...CONDUIT_BOLD,
                  fontSize: 64, lineHeight: 1, color: 'white',
                  letterSpacing: '-2.56px', textTransform: 'uppercase',
                  textAlign: 'center',
                  ...editCursor(stat.editable),
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  startEdit(stat.key, stat.value, stat.editable);
                }}
              >
                {stat.display}
              </p>
            )}
          </div>
        );
      })}

      {/* ── Weapon table ────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{ left: TABLE_LEFT, top: TABLE_TOP, width: TABLE_WIDTH }}
      >
        {/* Header row */}
        <div
          className="relative flex items-center"
          style={{ height: HEADER_H }}
        >
          <WeaponHeaderCell col={COL_RANGE}>R</WeaponHeaderCell>
          <WeaponHeaderCell col={COL_NAME} align="left">NAME</WeaponHeaderCell>
          <WeaponHeaderCell col={COL_ATK}>ATK</WeaponHeaderCell>
          <WeaponHeaderCell col={COL_HIT}>HIT</WeaponHeaderCell>
          <WeaponHeaderCell col={COL_DMG}>DMG</WeaponHeaderCell>
          <WeaponHeaderCell col={COL_WR} align="left">WR</WeaponHeaderCell>
          {/* Orange under-header divider (5px) */}
          <div
            style={{
              position: 'absolute', left: 0, bottom: -HEADER_BORDER,
              width: TABLE_WIDTH, height: HEADER_BORDER, background: ORANGE,
            }}
          />
        </div>

        {/* Weapon rows — alternating bg. No hard cap; abilities below shift
            down to accommodate however many weapons are passed. */}
        {weapons.map((w, i) => (
          <div
            key={i}
            className="relative flex items-center"
            style={{
              height: ROW_H,
              background: i % 2 === 1 ? ROW_GRAY : 'transparent',
              cursor: onWeaponClick ? 'pointer' : 'default',
              marginTop: i === 0 ? HEADER_BORDER : 0,
            }}
            onClick={() => onWeaponClick?.(w)}
          >
            <WeaponCell col={COL_RANGE}>
              {w.meleeOrRanged === 'melee' ? 'M' : w.meleeOrRanged === 'ranged' ? 'R' : ''}
            </WeaponCell>
            <WeaponCell col={COL_NAME} align="left">{w.name}</WeaponCell>
            <WeaponCell col={COL_ATK}>{w.attack || '—'}</WeaponCell>
            <WeaponCell col={COL_HIT}>{w.hit || '—'}</WeaponCell>
            <WeaponCell col={COL_DMG}>{w.damage || '—'}</WeaponCell>
            <WeaponCell col={COL_WR} align="left">
              {w.keywordData && w.keywordData.length > 0 ? (
                w.keywordData.map((kw, ki) => (
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
                ))
              ) : (
                w.keywords || '—'
              )}
            </WeaponCell>
          </div>
        ))}
      </div>

      {/* ── Abilities — two equal-width columns, all with orange banner.
            top + height are computed from weapon-row count so the block
            stacks under the weapon table. ── */}
      <div
        className="absolute grid"
        style={{
          left: TABLE_LEFT,
          top: abilitiesTop,
          width: TABLE_WIDTH,
          height: abilitiesHeight,
          // Single ability → full-width single column; 2+ → two equal columns.
          gridTemplateColumns: abilities.length <= 1 ? '1fr' : '1fr 1fr',
          columnGap: ABILITIES_COL_GAP,
          alignContent: 'start',
        }}
      >
        <div className="flex flex-col" style={{ gap: ABILITY_GAP, overflow: 'hidden' }}>
          {leftAbilities.map((a, i) => (
            <KillTeamAbilityBlock key={`l-${i}`} ability={a} onClick={onAbilityClick} />
          ))}
        </div>
        <div className="flex flex-col" style={{ gap: ABILITY_GAP, overflow: 'hidden' }}>
          {rightAbilities.map((a, i) => (
            <KillTeamAbilityBlock key={`r-${i}`} ability={a} onClick={onAbilityClick} />
          ))}
        </div>
      </div>

      {/* ── Bottom band: tags + wounds tracker ──────────────────────────── */}
      <div
        className="absolute flex items-center"
        style={{ left: 30, right: 30, top: 810, height: 80 }}
      >
        {/* Tags (left) */}
        <div className="flex-1 min-w-0">
          {editingField === 'tags' ? (
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitText(onTagsChange)}
              onKeyDown={onKeyDown}
              style={{
                ...INPUT_BASE, ...CONDUIT_BOLD,
                fontSize: 30, lineHeight: 1.1, color: 'white',
                letterSpacing: '-1.2px', textTransform: 'uppercase',
                width: '100%',
                borderBottom: '1.5px solid rgba(255,255,255,0.4)',
              }}
            />
          ) : (
            <p
              className="truncate"
              style={{
                ...CONDUIT_BOLD,
                fontSize: 30, lineHeight: 1.1, color: 'white',
                letterSpacing: '-1.2px', textTransform: 'uppercase',
                ...editCursor(!!onTagsChange),
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                startEdit('tags', tags, !!onTagsChange);
              }}
            >
              {tags || '—'}
            </p>
          )}
        </div>
        {/* Base size (right) — the operative's miniature base diameter (mm) */}
        <p
          style={{
            ...CONDUIT_BOLD,
            fontSize: 30, lineHeight: 1.1, color: 'white',
            letterSpacing: '-1.2px', textTransform: 'uppercase',
            flexShrink: 0, marginLeft: 24, textAlign: 'right',
          }}
        >
          {baseSize}
        </p>
      </div>

      {/* ── Keyword info modal — portaled to body so the card's CSS scaling
            (via CardCarousel) doesn't shrink the modal text. */}
      {viewingCardKeyword && createPortal(
        <KeywordInfoModal
          open
          onClose={() => setViewingCardKeyword(null)}
          name={viewingCardKeyword.name}
          description={viewingCardKeyword.description}
        />,
        document.body,
      )}

    </div>{/* end overflow-hidden inner wrapper */}

    {/* ── Token overlay (play mode) — outside the overflow-clip so tokens
          can extend past the card bounds, matching Halo's pattern. */}
    {tokenOverlay && tokenOverlay.definitions.length > 0 && (
      <TokenOverlay
        gameSlug="kill-team"
        tokenDefinitions={tokenOverlay.definitions}
        card={{ stats: { wounds }, unitKeywords: tokenOverlay.unitKeywords }}
        tokenState={tokenOverlay.state}
        onTokenChange={tokenOverlay.onChange}
      />
    )}

    </div>{/* end outer wrapper */}
  );
};

// ── Cell helpers ─────────────────────────────────────────────────────────────

interface CellCol { left: number; width: number }

const WeaponHeaderCell = ({ col, align = 'center', children }: {
  col: CellCol;
  align?: 'center' | 'left';
  children: React.ReactNode;
}) => (
  <div
    className="absolute flex items-center"
    style={{
      left: col.left, top: 0, width: col.width, height: HEADER_H,
      paddingLeft: align === 'left' ? 14 : 0,
      justifyContent: align === 'left' ? 'flex-start' : 'center',
    }}
  >
    <span style={{ ...CONDUIT_BOLD, fontSize: 30, color: 'black', letterSpacing: '-1.2px', lineHeight: 1 }}>
      {children}
    </span>
  </div>
);

export const KillTeamAbilityBlock = ({
  ability,
  onClick,
}: {
  ability: KillTeamAbility;
  onClick?: (a: KillTeamAbility) => void;
}) => (
  <div
    style={{ cursor: onClick ? 'pointer' : 'default' }}
    onClick={() => onClick?.(ability)}
  >
    {/* Orange banner — name on left, AP cost on right (only if > 0) */}
    <div
      className="flex items-center justify-between"
      style={{
        height: ABILITY_BANNER_H,
        padding: '5px 10px 0',
        background: ORANGE,
      }}
    >
      <p
        className="truncate"
        style={{
          ...CONDUIT_BOLD, fontSize: 30, lineHeight: 1, color: 'white',
          letterSpacing: '-1.2px', textTransform: 'uppercase',
          flex: '1 0 0', minWidth: 0,
        }}
      >
        {ability.name || 'Untitled Ability'}
      </p>
      {ability.apCost > 0 && (
        <p
          style={{
            ...CONDUIT_BOLD, fontSize: 30, lineHeight: 1, color: 'white',
            letterSpacing: '-1.2px', textTransform: 'uppercase',
            flexShrink: 0, marginLeft: 12,
          }}
        >
          {ability.apCost}AP
        </p>
      )}
    </div>
    {/* Description */}
    {ability.description && (
      <p
        style={{
          ...CONDUIT_REG, fontSize: 24, lineHeight: 1.2,
          letterSpacing: '-0.96px', color: 'black',
          whiteSpace: 'pre-wrap', marginTop: 6,
        }}
      >
        {ability.description}
      </p>
    )}
  </div>
);

const WeaponCell = ({ col, align = 'center', children }: {
  col: CellCol;
  align?: 'center' | 'left';
  children: React.ReactNode;
}) => (
  <div
    className="absolute flex items-center"
    style={{
      left: col.left, top: 0, width: col.width, height: ROW_H,
      paddingLeft: align === 'left' ? 14 : 0,
      justifyContent: align === 'left' ? 'flex-start' : 'center',
      overflow: 'hidden',
    }}
  >
    <span
      className="truncate"
      style={{
        ...CONDUIT_BOLD, fontSize: 30, color: 'black',
        letterSpacing: '-1.2px', lineHeight: 1,
        textAlign: align === 'left' ? 'left' : 'center',
      }}
    >
      {children}
    </span>
  </div>
);

export default KillTeamCard;
