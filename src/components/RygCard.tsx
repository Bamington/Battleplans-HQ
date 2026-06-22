/**
 * RygCard.tsx — Repent Ye Foolish Gods warrior card
 *
 * Architecture:
 *   Layer 1 — bg.svg            : full-card rock texture background
 *   Layer 2 — Dark header band  : positioned div covering the top-right area,
 *                                  providing the dark stone background for the
 *                                  name / stats region
 *   Layer 3 — Dynamic content   : warrior name, type, sept, stat values,
 *                                  talents, portrait, and all content sections
 *
 * Native size: 890 × 1270 px (portrait). Wrap in a scaled container for display.
 *
 * Layout (from Figma node 959:15634):
 *   ┌───────────────┬────────────────────────────────────────┐
 *   │  Portrait     │  Dark header band                      │
 *   │  298 × 354    │  Name (LLTextur, 82px, white)          │
 *   │               │  ── divider ──                         │
 *   │               │  TYPE • SEPT                           │
 *   │               │  [OFF] [DEF] [TAC] [FATE]  stat boxes  │
 *   ├───┬───────────┴────────────────────────────────────────┤
 *   │[L]│  Talents: comma-separated keywords                 │
 *   ├───┴────────────────────────────────────────────────────┤
 *   │  SPECIAL ABILITY  (header + description)               │
 *   │  ── weapon rows ──                                     │
 *   │  ── armor / item rows ──                               │
 *   └────────────────────────────────────────────────────────┘
 *
 * Inline editing:
 *   Pass onChange callbacks to enable editing on individual fields.
 *   Text fields: contentEditable on double-click.
 *   Numeric stats: Counter via the editor panel (no inline click on the card).
 */

import { useState, useRef, useEffect } from 'react';
// @ts-ignore — path contains spaces
import bgSvg from '../assets/games/card assets/ryg/bg.svg';

// ── Native size ──────────────────────────────────────────────────────────────
export const CARD_W = 890;
export const CARD_H = 1270;

// ── Theme ────────────────────────────────────────────────────────────────────
const DARK_BAND_BG   = 'rgba(10, 8, 6, 0.88)';
const LIFE_RED       = '#890000';
const CREAM          = '#e8e5dd';
const BORDER_TAN     = '#87816e';
const TEXT_DARK      = '#141414';

// ── Fonts ────────────────────────────────────────────────────────────────────
const TEXTUR = { fontFamily: "'LLTextur', 'IM Fell English', serif" } as const;
const BASKERVILLE      = { fontFamily: "'Libre Baskerville', 'Georgia', serif" } as const;
const BASKERVILLE_BOLD = { ...BASKERVILLE, fontWeight: 700 } as const;

// ── Geometry (matches Figma node 959:15634) ──────────────────────────────────
// Portrait area
const PORTRAIT_LEFT = 0;
const PORTRAIT_TOP  = 0;
const PORTRAIT_W    = 298;
const PORTRAIT_H    = 354;

// Dark header band (top-right, from portrait edge to right bleed)
const BAND_LEFT = 290;
const BAND_TOP  = 0;
const BAND_W    = CARD_W - BAND_LEFT + 4;  // slight overlap with portrait edge
const BAND_H    = 375;

// Warrior name block inside the band
const NAME_LEFT = 321;
const NAME_TOP  = 0;
const NAME_W    = 548;
const NAME_H    = 124;

// Divider line
const DIVIDER_LEFT = 321;
const DIVIDER_TOP  = 127;
const DIVIDER_W    = 529;

// Type • Sept row
const TYPESEPT_CENTER_X = 584;
const TYPESEPT_TOP      = 147;

// 4 stat boxes (Offense, Defense, Tactics, Fate) — top=204, h=102
const STAT_TOP    = 204;
const STAT_H      = 102;
const STAT_BOXES = [
  { key: 'offense', label: 'Offense', left: 293 },
  { key: 'defense', label: 'Defense', left: 442 },
  { key: 'tactics', label: 'Tactics', left: 591 },
  { key: 'fate',    label: 'Fate',    left: 740 },
] as const;
const STAT_W      = 150;

// Life box (separate, left side, red value)
const LIFE_LEFT = 49;
const LIFE_TOP  = 301;
const LIFE_W    = 200;
const LIFE_H    = 102;

// Talents text strip
const TALENTS_CENTER_X = 590;
const TALENTS_TOP      = 340;
const TALENTS_W        = 590;

// Content area (special ability, weapons, armor, items)
const CONTENT_LEFT = 42;
const CONTENT_TOP  = 432;
const CONTENT_W    = 806;
const CONTENT_GAP  = 20;

// ── Inline editable text ─────────────────────────────────────────────────────

interface EditableTextProps {
  value:       string;
  onChange?:   (v: string) => void;
  style?:      React.CSSProperties;
  className?:  string;
  placeholder?: string;
}

function EditableText({ value, onChange, style, className, placeholder }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onChange?.(trimmed);
  };

  if (!onChange) {
    return (
      <span style={style} className={className}>
        {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={{ ...style, outline: '2px solid rgba(136,113,78,0.7)', minWidth: 40, display: 'inline-block' }}
        className={className}
        onInput={e => setDraft((e.target as HTMLElement).innerText)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setEditing(false); setDraft(value); }
        }}
      >
        {draft}
      </span>
    );
  }

  return (
    <span
      style={{ ...style, cursor: 'text' }}
      className={className}
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
        setTimeout(() => {
          if (ref.current) {
            ref.current.focus();
            const range = document.createRange();
            range.selectNodeContents(ref.current);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
          }
        }, 0);
      }}
    >
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </span>
  );
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface RygWeapon {
  id:       string;
  name:     string;
  /** Free-text die spec, e.g. "1D6+3". */
  damage:   string;
  /** Range in inches; 0 = melee (rendered as "—"). */
  range:    number;
  keywords: string;
}

export interface RygArmor {
  id:          string;
  name:        string;
  description: string;
}

export interface RygItem {
  id:          string;
  name:        string;
  description: string;
}

export interface RygCardProps {
  warriorName:         string;
  type:                string;
  sept:                string;
  offense:             number;
  defense:             number;
  life:                number;
  tactics:             number;
  fate:                number;
  /** Comma-separated keyword display string. */
  talents:             string;
  specialAbilityName?: string;
  specialAbilityDesc?: string;
  weapons:             RygWeapon[];
  armor:               RygArmor[];
  items:               RygItem[];
  /** URL of the user-uploaded portrait photo. */
  portrait?:           string;

  // Inline editing callbacks — omit to make read-only
  onChangeName?:         (v: string) => void;
  onChangeType?:         (v: string) => void;
  onChangeSept?:         (v: string) => void;
  onChangeTalents?:      (v: string) => void;
  onChangeAbilityName?:  (v: string) => void;
  onChangeAbilityDesc?:  (v: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RygCard({
  warriorName, type, sept,
  offense, defense, life, tactics, fate,
  talents,
  specialAbilityName, specialAbilityDesc,
  weapons, armor, items,
  portrait,
  onChangeName, onChangeType, onChangeSept, onChangeTalents,
  onChangeAbilityName, onChangeAbilityDesc,
}: RygCardProps) {

  const statVal = (n: number) => n > 0 ? String(n) : '—';

  const typeSeptParts = [type, sept].filter(Boolean);
  const typeSeptStr   = typeSeptParts.join('  •  ');

  const hasWeapons    = weapons.length > 0;
  const hasArmor      = armor.length > 0;
  const hasItems      = items.length > 0;
  const hasEquipment  = hasWeapons || hasArmor || hasItems;
  const hasAbility    = Boolean(specialAbilityName);

  return (
    <div
      style={{
        position:   'relative',
        width:      CARD_W,
        height:     CARD_H,
        overflow:   'hidden',
        userSelect: 'none',
        fontFamily: BASKERVILLE.fontFamily,
      }}
    >
      {/* Layer 1 — background texture */}
      <img
        src={bgSvg}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        draggable={false}
      />

      {/* Layer 2 — portrait photo area */}
      <div
        style={{
          position:   'absolute',
          left:       PORTRAIT_LEFT,
          top:        PORTRAIT_TOP,
          width:      PORTRAIT_W,
          height:     PORTRAIT_H,
          background: portrait ? undefined : '#1a1612',
          overflow:   'hidden',
        }}
      >
        {portrait && (
          <img
            src={portrait}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            draggable={false}
          />
        )}
      </div>

      {/* Layer 2 — dark header band (top-right) */}
      <div
        style={{
          position:   'absolute',
          left:       BAND_LEFT,
          top:        BAND_TOP,
          width:      BAND_W,
          height:     BAND_H,
          background: DARK_BAND_BG,
          borderLeft: '5px solid #0f1015',
        }}
      />

      {/* Layer 3 — Warrior name */}
      <div
        style={{
          position:   'absolute',
          left:       NAME_LEFT,
          top:        NAME_TOP,
          width:      NAME_W,
          height:     NAME_H,
          display:    'flex',
          alignItems: 'flex-end',
          paddingBottom: 6,
        }}
      >
        <EditableText
          value={warriorName}
          onChange={onChangeName}
          placeholder="Warrior Name"
          style={{
            ...TEXTUR,
            fontSize:      72,
            lineHeight:    1,
            color:         '#ffffff',
            display:       'block',
            width:         '100%',
            whiteSpace:    'nowrap',
            overflow:      'hidden',
          }}
        />
      </div>

      {/* Layer 3 — Divider line */}
      <div
        style={{
          position: 'absolute',
          left:     DIVIDER_LEFT,
          top:      DIVIDER_TOP,
          width:    DIVIDER_W,
          height:   2,
          background: '#ffffff',
        }}
      />
      {/* Decorative diamonds at ends */}
      <div style={{ position: 'absolute', left: DIVIDER_LEFT - 5, top: DIVIDER_TOP - 4, width: 10, height: 10, background: '#ffffff', transform: 'rotate(45deg)' }} />
      <div style={{ position: 'absolute', left: DIVIDER_LEFT + DIVIDER_W - 5, top: DIVIDER_TOP - 4, width: 10, height: 10, background: '#ffffff', transform: 'rotate(45deg)' }} />

      {/* Layer 3 — Type • Sept */}
      <div
        style={{
          position:  'absolute',
          left:      TYPESEPT_CENTER_X,
          top:       TYPESEPT_TOP,
          transform: 'translateX(-50%)',
          display:   'flex',
          alignItems: 'center',
          gap:       18,
          whiteSpace: 'nowrap',
        }}
      >
        <EditableText
          value={type}
          onChange={onChangeType}
          placeholder="Type"
          style={{
            ...BASKERVILLE_BOLD,
            fontSize:      28,
            color:         CREAM,
            textTransform: 'uppercase',
            letterSpacing: '-0.04em',
          }}
        />
        {typeSeptParts.length === 2 && (
          <span style={{ ...BASKERVILLE_BOLD, fontSize: 14, color: CREAM, opacity: 0.8 }}>•</span>
        )}
        <EditableText
          value={sept}
          onChange={onChangeSept}
          placeholder="Sept"
          style={{
            ...BASKERVILLE_BOLD,
            fontSize:      28,
            color:         CREAM,
            textTransform: 'uppercase',
            letterSpacing: '-0.04em',
          }}
        />
      </div>

      {/* Layer 3 — Four stat boxes (Offense, Defense, Tactics, Fate) */}
      {STAT_BOXES.map(box => (
        <div
          key={box.key}
          style={{
            position:       'absolute',
            left:           box.left,
            top:            STAT_TOP,
            width:          STAT_W,
            height:         STAT_H,
            background:     '#ffffff',
            border:         '10px solid #000000',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'space-between',
            paddingTop:     8,
            paddingBottom:  6,
            boxSizing:      'border-box',
          }}
        >
          <span style={{ ...TEXTUR, fontSize: 52, lineHeight: 1, color: TEXT_DARK }}>
            {statVal({ offense, defense, tactics, fate }[box.key])}
          </span>
          <span style={{ ...BASKERVILLE_BOLD, fontSize: 20, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK }}>
            {box.label}
          </span>
        </div>
      ))}

      {/* Layer 3 — Life box (left side, red) */}
      <div
        style={{
          position:       'absolute',
          left:           LIFE_LEFT,
          top:            LIFE_TOP,
          width:          LIFE_W,
          height:         LIFE_H,
          background:     '#ffffff',
          border:         '10px solid #000000',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'space-between',
          paddingTop:     8,
          paddingBottom:  6,
          boxSizing:      'border-box',
        }}
      >
        <span style={{ ...TEXTUR, fontSize: 64, lineHeight: 1, color: LIFE_RED }}>
          {statVal(life)}
        </span>
        <span style={{ ...BASKERVILLE_BOLD, fontSize: 20, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK }}>
          Life
        </span>
      </div>

      {/* Layer 3 — Talents strip */}
      <div
        style={{
          position:  'absolute',
          left:      TALENTS_CENTER_X - TALENTS_W / 2,
          top:       TALENTS_TOP,
          width:     TALENTS_W,
          textAlign: 'center',
        }}
      >
        <EditableText
          value={talents}
          onChange={onChangeTalents}
          placeholder="Talents (e.g. Evasion, Stealthy)"
          style={{
            ...BASKERVILLE,
            fontWeight: 500,
            fontSize:   22,
            color:      CREAM,
          }}
        />
      </div>

      {/* Layer 3 — Content area */}
      <div
        style={{
          position:      'absolute',
          left:          CONTENT_LEFT,
          top:           CONTENT_TOP,
          width:         CONTENT_W,
          bottom:        24,
          display:       'flex',
          flexDirection: 'column',
          gap:           CONTENT_GAP,
          overflow:      'hidden',
        }}
      >
        {/* Special Ability */}
        {hasAbility && (
          <div style={{ background: '#ffffff', border: `2px solid ${BORDER_TAN}`, padding: 10, flexShrink: 0 }}>
            <div style={{ ...BASKERVILLE_BOLD, fontSize: 26, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, marginBottom: 5 }}>
              <EditableText
                value={specialAbilityName ?? ''}
                onChange={onChangeAbilityName}
                style={{ ...BASKERVILLE_BOLD, fontSize: 26, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK }}
              />
            </div>
            <EditableText
              value={specialAbilityDesc ?? ''}
              onChange={onChangeAbilityDesc}
              placeholder="Describe the special ability…"
              style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, display: 'block', lineHeight: 1.4 }}
            />
          </div>
        )}

        {/* Weapons group */}
        {hasWeapons && (
          <div style={{ flexShrink: 0 }}>
            {weapons.map((w, i) => (
              <div
                key={w.id}
                style={{
                  background:  '#ffffff',
                  border:      `2px solid ${BORDER_TAN}`,
                  borderTop:   i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:     '8px 10px',
                  display:     'flex',
                  gap:         6,
                  alignItems:  'center',
                }}
              >
                <span style={{ ...BASKERVILLE_BOLD, fontSize: 22, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, width: 200, flexShrink: 0 }}>
                  {w.name}
                </span>
                <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, width: 80, flexShrink: 0 }}>
                  {w.damage || '—'}
                </span>
                <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, width: 60, flexShrink: 0 }}>
                  {w.range > 0 ? `${w.range}"` : '—'}
                </span>
                <span style={{ ...BASKERVILLE, fontSize: 18, color: TEXT_DARK, flex: 1, textAlign: 'right' }}>
                  {w.keywords}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Armor + Items group */}
        {hasEquipment && (hasArmor || hasItems) && (
          <div style={{ flexShrink: 0 }}>
            {[...armor, ...items].map((eq, i) => {
              const isArmor = i < armor.length;
              return (
                <div
                  key={eq.id}
                  style={{
                    background: '#ffffff',
                    border:     `2px solid ${BORDER_TAN}`,
                    borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                    padding:    '8px 10px',
                    display:    'flex',
                    gap:        6,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 22, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, width: 200, flexShrink: 0 }}>
                    {eq.name}
                  </span>
                  <span style={{ ...BASKERVILLE, fontSize: 18, color: TEXT_DARK, flex: 1, textAlign: isArmor ? 'right' : 'left', lineHeight: 1.3 }}>
                    {eq.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
