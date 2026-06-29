/**
 * RygCard.tsx â€” Repent Ye Foolish Gods warrior card
 *
 * Architecture:
 *   Layer 1 â€” bg.svg            : full-card rock texture background
 *   Layer 2 â€” Dark header band  : positioned div covering the top-right area,
 *                                  providing the dark stone background for the
 *                                  name / stats region
 *   Layer 3 â€” Dynamic content   : warrior name, type, sept, stat values,
 *                                  talents, portrait, and all content sections
 *
 * Native size: 890 Ã— 1270 px (portrait). Wrap in a scaled container for display.
 *
 * Layout (from Figma node 959:15634):
 *   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 *   â”‚  Portrait     â”‚  Dark header band                      â”‚
 *   â”‚  298 Ã— 354    â”‚  Name (LLTextur, 82px, white)          â”‚
 *   â”‚               â”‚  â”€â”€ divider â”€â”€                         â”‚
 *   â”‚               â”‚  TYPE â€¢ SEPT                           â”‚
 *   â”‚               â”‚  [OFF] [DEF] [TAC] [FATE]  stat boxes  â”‚
 *   â”œâ”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 *   â”‚[L]â”‚  Talents: comma-separated keywords                 â”‚
 *   â”œâ”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 *   â”‚  SPECIAL ABILITY  (header + description)               â”‚
 *   â”‚  â”€â”€ weapon rows â”€â”€                                     â”‚
 *   â”‚  â”€â”€ armor / item rows â”€â”€                               â”‚
 *   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 *
 * Inline editing:
 *   Pass onChange callbacks to enable editing on individual fields.
 *   Text fields: contentEditable on double-click.
 *   Numeric stats: Counter via the editor panel (no inline click on the card).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
// @ts-ignore â€” path contains spaces
import bgSvg from '../assets/games/card assets/ryg/bg.svg';

// â”€â”€ Native size â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const CARD_W = 890;
export const CARD_H = 1270;

// â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// const DARK_BAND_BG   = 'rgba(10, 8, 6, 0.88)'; // reserved for future use
const LIFE_RED       = '#890000';
const CREAM          = '#e8e5dd';
const BORDER_TAN     = '#87816e';
const TEXT_DARK      = '#141414';

// â”€â”€ Fonts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TEXTUR = { fontFamily: "'LLTextur', 'IM Fell English', serif" } as const;
const BASKERVILLE      = { fontFamily: "'Libre Baskerville', 'Georgia', serif" } as const;
const BASKERVILLE_BOLD = { ...BASKERVILLE, fontWeight: 700 } as const;

// â”€â”€ Geometry (matches Figma node 959:15634) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Portrait area
const PORTRAIT_LEFT = 0;
const PORTRAIT_TOP  = 0;
const PORTRAIT_W    = 298;
const PORTRAIT_H    = 354;

// BAND_LEFT / BAND_TOP / BAND_W / BAND_H reserved for future use

// Warrior name block inside the band
const NAME_LEFT = 317;
const NAME_TOP  = 0;
const NAME_W    = 548;
const NAME_H    = 124;

// Divider line
// DIVIDER_LEFT / DIVIDER_TOP / DIVIDER_W reserved for future use

// Type â€¢ Sept row
const TYPESEPT_CENTER_X = 584;
const TYPESEPT_TOP      = 147;

// 4 stat boxes (Offense, Defense, Tactics, Fate) â€” top=204, h=102
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
const TALENTS_TOP      = 329;
const TALENTS_W        = 590;

// Content area (special ability, weapons, armor, items)
const CONTENT_LEFT = 42;
const CONTENT_TOP  = 432;
const CONTENT_W    = 806;
const CONTENT_GAP  = 20;

// â”€â”€ Inline editable text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Public types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RygWeapon {
  id:            string;
  name:          string;
  /** Free-text die spec, e.g. "1D6+3". */
  damage:        string;
  /** Range in inches; 0 = melee (omitted). */
  range:         number;
  /** Cost in gold pieces. */
  cost:          number;
  keywords:      string;
  keywordList?:  Array<{ name: string; description: string }>;
  description?:  string;
}

export interface RygArmor {
  id:          string;
  name:        string;
  cost:        number;
  description: string;
}

export interface RygItem {
  id:          string;
  name:        string;
  cost:        number;
  description: string;
}

export interface RygSpell {
  id:           string;
  name:         string;
  spellType:    string;
  fateModifier: string;
  description:  string;
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
  /** Comma-separated keyword display string (used when talentList not provided). */
  talents:             string;
  /** Structured talent list — when provided, renders clickable talent names. */
  talentList?:         Array<{ addonId: string; name: string; description: string; displayName: string }>;
  onTalentClick?:      (talent: { name: string; description: string }) => void;
  specialAbilityDesc?: string;
  weapons:             RygWeapon[];
  armor:               RygArmor[];
  items:               RygItem[];
  spells?:             RygSpell[];
  /** URL of the user-uploaded portrait photo. */
  portrait?:           string;

  // Inline editing callbacks â€” omit to make read-only
  onChangeName?:         (v: string) => void;
  onChangeType?:         (v: string) => void;
  onChangeSept?:         (v: string) => void;
  onChangeTalents?:      (v: string) => void;
  onChangeAbilityDesc?:  (v: string) => void;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function RygCard({
  warriorName, type, sept,
  offense, defense, life, tactics, fate,
  talents, talentList, onTalentClick,
  specialAbilityDesc,
  weapons, armor, items, spells = [],
  portrait,
  onChangeName, onChangeType, onChangeSept, onChangeTalents,
  onChangeAbilityDesc,
}: RygCardProps) {

  const statVal = (n: number) => String(n);

  // Scale the warrior name horizontally if it overflows the name box
  const nameContainerRef = useRef<HTMLDivElement>(null);
  const [nameScaleX, setNameScaleX] = useState(1);
  const measureName = useCallback(() => {
    const container = nameContainerRef.current;
    if (!container) return;
    const span = container.querySelector('span') as HTMLSpanElement | null;
    if (!span) return;
    setNameScaleX(Math.min(1, NAME_W / span.scrollWidth));
  }, []);
  useEffect(() => { measureName(); }, [warriorName, measureName]);

  const typeSeptParts = [type, sept].filter(Boolean);

  const hasWeapons    = weapons.length > 0;
  const hasArmor      = armor.length > 0;
  const hasItems      = items.length > 0;
  const hasSpells     = spells.length > 0;
  const hasEquipment  = hasWeapons || hasArmor || hasItems;
  const hasAbility    = Boolean(specialAbilityDesc);

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
      {/* Layer 1 â€” background texture */}
      <img
        src={bgSvg}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        draggable={false}
      />

      {/* Layer 2 â€” portrait photo area */}
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


      {/* Layer 3 â€” Warrior name */}
      <div
        ref={nameContainerRef}
        style={{
          position:        'absolute',
          left:            NAME_LEFT,
          top:             NAME_TOP,
          width:           NAME_W,
          height:          NAME_H,
          display:         'flex',
          alignItems:      'flex-end',
          justifyContent:  'center',
          paddingBottom:   6,
          overflow:        'hidden',
        }}
      >
        <div style={{ transform: `scaleX(${nameScaleX})`, transformOrigin: 'center bottom' }}>
          <EditableText
            value={warriorName}
            onChange={onChangeName}
            placeholder="Warrior Name"
            style={{
              ...TEXTUR,
              fontSize:   72,
              lineHeight: 1,
              color:      '#ffffff',
              whiteSpace: 'nowrap',
            }}
          />
        </div>
      </div>


      {/* Layer 3 â€” Type â€¢ Sept */}
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
          <span style={{ ...BASKERVILLE_BOLD, fontSize: 14, color: CREAM, opacity: 0.8 }}>â€¢</span>
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

      {/* Layer 3 â€” Four stat boxes (Offense, Defense, Tactics, Fate) */}
      {STAT_BOXES.map(box => (
        <div
          key={box.key}
          style={{
            position:       'absolute',
            left:           box.left,
            top:            STAT_TOP,
            width:          STAT_W,
            height:         STAT_H,
            border:         '10px solid #000000',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'space-between',
            paddingTop:     8,
            paddingBottom:  15,
            boxSizing:      'border-box',
          }}
        >
          <span style={{ ...TEXTUR, fontSize: 52, lineHeight: 1, color: TEXT_DARK }}>
            {statVal({ offense, defense, tactics, fate }[box.key])}
          </span>
        </div>
      ))}

      {/* Layer 3 â€” Life box (left side, red) */}
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
          paddingBottom:  11,
          boxSizing:      'border-box',
        }}
      >
        <span style={{ ...TEXTUR, fontSize: 70, lineHeight: 1, color: LIFE_RED }}>
          {statVal(life)}
        </span>
      </div>

      {/* Layer 3 â€” Talents strip */}
      <div
        style={{
          position:  'absolute',
          left:      TALENTS_CENTER_X - TALENTS_W / 2,
          top:       TALENTS_TOP,
          width:     TALENTS_W,
          textAlign: 'center',
        }}
      >
        {talentList && talentList.length > 0 ? (
          <span style={{ ...BASKERVILLE, fontWeight: 500, fontSize: 22, color: CREAM }}>
            {talentList.map((t, i) => (
              <span key={t.addonId}>
                {i > 0 && <span style={{ color: CREAM }}>, </span>}
                <button
                  type="button"
                  onClick={() => onTalentClick?.(t)}
                  style={{
                    ...BASKERVILLE,
                    fontWeight:      500,
                    fontSize:        28,
                    color:           CREAM,
                    background:      'none',
                    border:          'none',
                    padding:         0,
                    cursor:          'pointer',
                    textDecoration:  'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {t.displayName}
                </button>
              </span>
            ))}
          </span>
        ) : (
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
        )}
      </div>

      {/* Layer 3 â€” Content area */}
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
            <EditableText
              value={specialAbilityDesc ?? ''}
              onChange={onChangeAbilityDesc}
              placeholder="Describe the special abilityâ€¦"
              style={{ ...BASKERVILLE, fontSize: 24, color: TEXT_DARK, display: 'block', lineHeight: 1.4 }}
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
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '8px 10px',
                  display:    'flex',
                  gap:        0,
                  alignItems: 'stretch',
                }}
              >
                {/* Left 50%: name + stats */}
                <div style={{ width: '50%', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingRight: 10 }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name}
                  </span>
                  <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK, flexShrink: 0 }}>
                    {w.damage || '—'}
                  </span>
                  {w.range > 0 && (
                    <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK, flexShrink: 0 }}>
                      {w.range}{'”'}
                    </span>
                  )}
                  <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK, flexShrink: 0 }}>
                    {w.cost > 0 ? `${w.cost}gp` : '—'}
                  </span>
                </div>
                {/* Divider */}
                <div style={{ width: 1, background: BORDER_TAN, flexShrink: 0, margin: '2px 0' }} />
                {/* Right 50%: keywords then description */}
                <div style={{ flex: 1, paddingLeft: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                  {(w.keywordList && w.keywordList.length > 0) ? (
                    <span style={{ ...BASKERVILLE, fontStyle: 'italic', fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>
                      {w.keywordList.map((kw, i) => (
                        <span key={kw.name}>
                          {i > 0 && ', '}
                          {onTalentClick ? (
                            <button
                              type="button"
                              onClick={() => onTalentClick(kw)}
                              style={{ ...BASKERVILLE, fontStyle: 'italic', fontSize: 20, color: TEXT_DARK, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                            >
                              {kw.name}
                            </button>
                          ) : kw.name}
                        </span>
                      ))}
                    </span>
                  ) : w.keywords ? (
                    <span style={{ ...BASKERVILLE, fontStyle: 'italic', fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>{w.keywords}</span>
                  ) : null}
                  {w.description && <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>{w.description}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Spells group */}
        {hasSpells && (
          <div style={{ flexShrink: 0 }}>
            {spells.map((sp, i) => (
              <div
                key={sp.id}
                style={{
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '8px 10px',
                  display:    'flex',
                  gap:        0,
                  alignItems: 'stretch',
                }}
              >
                <div style={{ width: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, flexShrink: 0, paddingRight: 10 }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sp.name}
                  </span>
                  <span style={{ ...BASKERVILLE, fontSize: 18, color: TEXT_DARK, opacity: 0.7 }}>
                    {[sp.spellType, sp.fateModifier ? `Fate ${sp.fateModifier}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div style={{ width: 1, background: BORDER_TAN, flexShrink: 0, margin: '2px 0' }} />
                <div style={{ flex: 1, paddingLeft: 10, display: 'flex', alignItems: 'center' }}>
                  <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>
                    {sp.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Armor + Items group */}
        {hasEquipment && (hasArmor || hasItems) && (
          <div style={{ flexShrink: 0 }}>
            {[...armor, ...items].map((eq, i) => (
              <div
                key={eq.id}
                style={{
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '8px 10px',
                  display:    'flex',
                  gap:        0,
                  alignItems: 'stretch',
                }}
              >
                {/* Left 50%: name + cost */}
                <div style={{ width: '50%', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingRight: 10 }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {eq.name}
                  </span>
                  <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK, flexShrink: 0 }}>
                    {eq.cost > 0 ? `${eq.cost}gp` : '—'}
                  </span>
                </div>
                {/* Divider */}
                <div style={{ width: 1, background: BORDER_TAN, flexShrink: 0, margin: '2px 0' }} />
                {/* Right 50%: description */}
                <div style={{ flex: 1, paddingLeft: 10, display: 'flex', alignItems: 'center' }}>
                  <span style={{ ...BASKERVILLE, fontSize: 22, color: TEXT_DARK, lineHeight: 1.3 }}>
                    {eq.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
