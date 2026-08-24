/**
 * EnemyCard.tsx — Repent Ye Foolish Gods enemy card
 *
 * Native size: 890 × 1270 px (portrait), same canvas as the warrior card.
 * Wrap in a scaled container for display.
 *
 * Layout (measured from bg-enemy.png rather than eyeballed — the chrome bakes
 * in the five stat boxes and their labels, and this component draws the values
 * on top of them):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │            Name (Textur, red, centred)                     │  parchment
 *   │            ENEMY TYPE • AI TYPE AI                         │
 *   │  [ Life ] [OFF] [DEF] [TAC] [FATE]   straddling the tear   │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  Special ability box(es)                                   │  black body
 *   │  ── weapon rows ──                                         │
 *   │  ── equipment rows ──                                      │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Differences from the warrior card, all deliberate: no portrait (the chrome
 * has no window for one), no talents strip, and the body is dark rather than
 * cream, so the content boxes read as white panels on black.
 */

import type { RygWeapon } from './RygCard';
import bgEnemy from '../assets/games/card assets/ryg/bg-enemy.png';

// ── Canvas ───────────────────────────────────────────────────────────────────

export const ENEMY_CARD_W = 890;
export const ENEMY_CARD_H = 1270;

// ── Theme ────────────────────────────────────────────────────────────────────
// Declared locally, matching SeptCard and GodCard — every RYG card keeps its
// own copy rather than sharing a theme module.

const BLOOD_RED  = '#890000';
const BORDER_TAN = '#87816e';
const TEXT_DARK  = '#141414';

const TEXTUR           = { fontFamily: "'LLTextur', 'IM Fell English', serif" } as const;
const BASKERVILLE      = { fontFamily: "'Libre Baskerville', 'Georgia', serif" } as const;
const BASKERVILLE_BOLD = { ...BASKERVILLE, fontWeight: 700 } as const;

// ── Geometry ─────────────────────────────────────────────────────────────────
// The stat boxes below are positioned to sit over the white boxes printed in
// bg-enemy.png. Measured centres: life 144.5, then 335 / 485 / 633 / 784.
// The labels (OFFENSE, DEFENSE…) are part of the artwork and occupy roughly
// y 255–289, which is why the values sit at the top of each box.

const NAME_TOP     = 18;
const NAME_H       = 112;
const SUBTITLE_TOP = 145;

const LIFE_LEFT = 32;
const LIFE_TOP  = 181;
const LIFE_W    = 225;
const LIFE_H    = 121;

const STAT_TOP = 191;
const STAT_W   = 146;
const STAT_H   = 100;
const STAT_BOXES = [
  { key: 'offense', left: 262 },
  { key: 'defense', left: 412 },
  { key: 'tactics', left: 560 },
  { key: 'fate',    left: 711 },
] as const;

// Content column — same horizontal metrics as the warrior card, but starting
// higher because there's no talents strip to clear.
const CONTENT_LEFT = 42;
const CONTENT_TOP  = 330;
const CONTENT_W    = 806;
const CONTENT_GAP  = 20;

// ── Public types ─────────────────────────────────────────────────────────────

export interface EnemyAbility {
  id:          string;
  /** Defaults to the enemy's name when the author doesn't give it one. */
  title:       string;
  description: string;
}

/** Armor and items both render as equipment rows — name plus what it does. */
export interface EnemyEquipment {
  id:          string;
  name:        string;
  description: string;
}

export interface EnemyCardProps {
  name:      string;
  /** Minion, Servant, Lieutenant, Champion, Legendary Monster, Vanquisher, God */
  enemyType: string;
  /** Dross, Defender, Hunter, Commander, Legendary Monster, God */
  aiType:    string;
  offense:   number;
  defense:   number;
  life:      number;
  tactics:   number;
  fate:      number;
  abilities?: EnemyAbility[];
  weapons?:   RygWeapon[];
  equipment?: EnemyEquipment[];
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Stats render as an em dash when unset, matching the warrior card. */
const statVal = (v: number | undefined) => (v == null || Number.isNaN(v) ? '—' : String(v));

/**
 * An ability's title is shown only when it says something the card doesn't
 * already. It defaults to the enemy's own name, and "PAINGIVER" printed above
 * Paingiver's only ability is noise.
 */
const showsTitle = (title: string, enemyName: string) =>
  title.trim() !== '' && title.trim().toLowerCase() !== enemyName.trim().toLowerCase();

// ── Component ────────────────────────────────────────────────────────────────

const EnemyCard = ({
  name, enemyType, aiType,
  offense, defense, life, tactics, fate,
  abilities = [], weapons = [], equipment = [],
  className = '',
}: EnemyCardProps) => {
  const stats: Record<string, number> = { offense, defense, tactics, fate };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width:    ENEMY_CARD_W,
        height:   ENEMY_CARD_H,
        overflow: 'hidden',
      }}
    >
      {/* Layer 1 — chrome */}
      <img
        src={bgEnemy}
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Layer 2 — name */}
      <div
        style={{
          position:       'absolute',
          left:           0,
          top:            NAME_TOP,
          width:          ENEMY_CARD_W,
          height:         NAME_H,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '0 40px',
          boxSizing:      'border-box',
        }}
      >
        <span style={{ ...TEXTUR, fontSize: 86, lineHeight: 1, color: BLOOD_RED, textAlign: 'center' }}>
          {name}
        </span>
      </div>

      {/* Layer 2 — ENEMY TYPE • AI TYPE AI */}
      <div
        style={{
          position:       'absolute',
          left:           0,
          top:            SUBTITLE_TOP,
          width:          ENEMY_CARD_W,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          ...BASKERVILLE_BOLD,
          fontSize:       31,
          letterSpacing:  '0.02em',
          textTransform:  'uppercase',
          color:          BLOOD_RED,
        }}>
          {[enemyType, aiType ? `${aiType} AI` : ''].filter(Boolean).join('  •  ')}
        </span>
      </div>

      {/* Layer 3 — Life box. No label in the art, so the value is centred. */}
      <div
        style={{
          position:       'absolute',
          left:           LIFE_LEFT,
          top:            LIFE_TOP,
          width:          LIFE_W,
          height:         LIFE_H,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          boxSizing:      'border-box',
        }}
      >
        <span style={{ ...TEXTUR, fontSize: 84, lineHeight: 1, color: BLOOD_RED }}>
          {statVal(life)}
        </span>
      </div>

      {/* Layer 3 — the four stat boxes. Values sit above the printed labels. */}
      {STAT_BOXES.map(box => (
        <div
          key={box.key}
          style={{
            position:       'absolute',
            left:           box.left,
            top:            STAT_TOP,
            width:          STAT_W,
            height:         STAT_H,
            display:        'flex',
            alignItems:     'flex-start',
            justifyContent: 'center',
            paddingTop:     6,
            boxSizing:      'border-box',
          }}
        >
          <span style={{ ...TEXTUR, fontSize: 52, lineHeight: 1, color: TEXT_DARK }}>
            {statVal(stats[box.key])}
          </span>
        </div>
      ))}

      {/* Layer 4 — content */}
      <div
        style={{
          position:      'absolute',
          left:          CONTENT_LEFT,
          top:           CONTENT_TOP,
          width:         CONTENT_W,
          display:       'flex',
          flexDirection: 'column',
          gap:           CONTENT_GAP,
        }}
      >
        {/* Special abilities */}
        {abilities.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            {abilities.map((ab, i) => (
              <div
                key={ab.id}
                style={{
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '10px 14px',
                  display:    'flex',
                  flexDirection: 'column',
                  gap:        4,
                }}
              >
                {showsTitle(ab.title, name) && (
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, lineHeight: 1.2 }}>
                    {ab.title}
                  </span>
                )}
                <span style={{ ...BASKERVILLE, fontSize: 22, color: TEXT_DARK, lineHeight: 1.35 }}>
                  {ab.description}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Weapons — name, damage, range, keywords, matching the warrior card */}
        {weapons.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            {weapons.map((w, i) => (
              <div
                key={w.id}
                style={{
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '6px 10px',
                  display:    'flex',
                  gap:        6,
                  alignItems: 'center',
                }}
              >
                <div style={{ width: 200, flexShrink: 0 }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, lineHeight: 1.2 }}>
                    {w.name}
                  </span>
                </div>
                <div style={{ width: 100, flexShrink: 0 }}>
                  <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK }}>{w.damage || '—'}</span>
                </div>
                <div style={{ width: 100, flexShrink: 0 }}>
                  <span style={{ ...BASKERVILLE, fontSize: 19, color: TEXT_DARK }}>
                    {w.range > 0 ? `${w.range}"` : '—'}
                  </span>
                </div>
                {/* Keywords sit hard right, as in the design. */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>
                    {w.keywords}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Equipment — armor and items together */}
        {equipment.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            {equipment.map((eq, i) => (
              <div
                key={eq.id}
                style={{
                  background: '#ffffff',
                  border:     `2px solid ${BORDER_TAN}`,
                  borderTop:  i === 0 ? `2px solid ${BORDER_TAN}` : 'none',
                  padding:    '6px 10px',
                  display:    'flex',
                  gap:        6,
                  alignItems: 'center',
                }}
              >
                <div style={{ width: 200, flexShrink: 0 }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.04em', color: TEXT_DARK, lineHeight: 1.2 }}>
                    {eq.name}
                  </span>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <span style={{ ...BASKERVILLE, fontSize: 20, color: TEXT_DARK, lineHeight: 1.3 }}>
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
};

export default EnemyCard;
