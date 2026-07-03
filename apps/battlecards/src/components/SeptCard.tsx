/**
 * SeptCard.tsx — Repent Ye Foolish Gods sept card
 *
 * Native size: 890 × 1270 px. Same header treatment as RygCard.
 *
 * Layout:
 *   Dark header band (full width)
 *     "Sept of" label + sept name
 *   Requirements table (3 rows: Prohibited / Required / Restricted)
 *   Benefits list (bold uppercase title + description per row)
 *   Destiny block (banner with name, DESTINY tag; description; Curse box)
 */

// @ts-ignore — path contains spaces
import bgSvg from '../assets/games/card assets/ryg/bg-septgod.png';

export const CARD_W = 890;
export const CARD_H = 1270;

const TEXT_DARK    = '#141414';

const TEXTUR       = { fontFamily: "'LLTextur', 'IM Fell English', serif" } as const;
const CREAM        = '#e8e5dd';
const BASKERVILLE  = { fontFamily: "'Libre Baskerville', 'Georgia', serif" } as const;
const BASKERVILLE_BOLD = { ...BASKERVILLE, fontWeight: 700 } as const;

// Requirements row colours
const PROHIBITED_BG   = '#de4141';
const PROHIBITED_TEXT = '#ffffff';
const REQUIRED_BG     = '#ffffff';
const REQUIRED_TEXT   = '#141414';
const RESTRICTED_BG   = '#dad4d4';
const RESTRICTED_TEXT = '#141414';

// Destiny block colours
const DESTINY_BANNER_BG     = '#262323';
const DESTINY_BANNER_BORDER = '#823d3d';
const CURSE_BG              = '#2b2b2b';
const CURSE_BORDER          = '#6e0000';

export interface SeptCardProps {
  septName:    string;
  prohibited?: string;
  required?:   string;
  restricted?: string;
  benefits?:   Array<{ name: string; description: string }>;
  destinyName?: string;
  destinyDesc?: string;
  destinyCurse?: string;
}

export default function SeptCard({
  septName,
  prohibited  = '',
  required    = '',
  restricted  = '',
  benefits    = [],
  destinyName  = '',
  destinyDesc  = '',
  destinyCurse = '',
}: SeptCardProps) {
  const CONTENT_L  = 42;
  const CONTENT_T  = 200;
  const CONTENT_W  = CARD_W - CONTENT_L * 2;

  return (
    <div
      style={{
        position: 'relative',
        width:    CARD_W,
        height:   CARD_H,
        overflow: 'hidden',
        fontFamily: "'Libre Baskerville', Georgia, serif",
      }}
    >
      {/* ── Layer 1: background texture ── */}
      <img
        src={bgSvg}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        draggable={false}
      />

      {/* ── Layer 2: title text over chrome header ── */}
      <div
        style={{
          position:       'absolute',
          top:            0,
          left:           0,
          width:          CARD_W,
          height:         180,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            6,
        }}
      >
        <div style={{ ...TEXTUR, color: CREAM, fontSize: 28, letterSpacing: 3, opacity: 0.7, lineHeight: 1 }}>
          Sept of
        </div>
        <div style={{ ...TEXTUR, color: CREAM, fontSize: 64, lineHeight: 1.1, textAlign: 'center', paddingInline: 40 }}>
          {septName || <span style={{ opacity: 0.3 }}>Unnamed Sept</span>}
        </div>
      </div>

      {/* ── Layer 3: content ── */}
      <div
        style={{
          position: 'absolute',
          top:      CONTENT_T,
          left:     CONTENT_L,
          width:    CONTENT_W,
          display:  'flex',
          flexDirection: 'column',
          gap:      28,
        }}
      >
        {/* Requirements table */}
        <div
          style={{
            border:       '2px solid #87816e',
            borderRadius: 6,
            overflow:     'hidden',
          }}
        >
          {(
            [
              { label: 'Prohibited', value: prohibited, bg: PROHIBITED_BG, color: PROHIBITED_TEXT },
              { label: 'Required',   value: required,   bg: REQUIRED_BG,   color: REQUIRED_TEXT   },
              { label: 'Restricted', value: restricted,  bg: RESTRICTED_BG, color: RESTRICTED_TEXT },
            ] as const
          ).map((row, i) => (
            <div
              key={row.label}
              style={{
                display:         'flex',
                background:      row.bg,
                color:           row.color,
                borderTop:       i > 0 ? '1px solid #87816e' : undefined,
              }}
            >
              <div
                style={{
                  ...BASKERVILLE_BOLD,
                  fontSize:      22,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  padding:       '14px 20px',
                  minWidth:      220,
                  borderRight:   '1px solid rgba(135,129,110,0.4)',
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  ...BASKERVILLE,
                  fontSize:    20,
                  padding:     '14px 20px',
                  flex:        1,
                  color:       row.color,
                }}
              >
                {row.value || <span style={{ opacity: 0.35 }}>—</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Benefits list */}
        {benefits.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            {benefits.map((b, i) => (
              <div
                key={i}
                style={{
                  background: '#ffffff',
                  border:     '2px solid #87816e',
                  borderTop:  i === 0 ? '2px solid #87816e' : 'none',
                  padding:    '8px 10px',
                  display:    'flex',
                  alignItems: 'stretch',
                  gap:        0,
                }}
              >
                <div style={{ width: '38%', flexShrink: 0, paddingRight: 10, display: 'flex', alignItems: 'center' }}>
                  <span style={{ ...BASKERVILLE_BOLD, fontSize: 20, textTransform: 'uppercase', letterSpacing: '-0.02em', color: TEXT_DARK }}>
                    {b.name}
                  </span>
                </div>
                <div style={{ width: 1, background: '#87816e', flexShrink: 0, margin: '2px 0' }} />
                <div style={{ flex: 1, paddingLeft: 10, display: 'flex', alignItems: 'center' }}>
                  <span style={{ ...BASKERVILLE, fontSize: 22, color: TEXT_DARK, lineHeight: 1.4 }}>
                    {b.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Destiny block */}
        {(destinyName || destinyDesc || destinyCurse) && (
          <div>
            {/* Banner row */}
            <div
              style={{
                position:     'relative',
                background:   DESTINY_BANNER_BG,
                border:       `2px solid ${DESTINY_BANNER_BORDER}`,
                borderRadius: '6px 6px 0 0',
                padding:      '12px 16px',
                display:      'flex',
                alignItems:   'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'LLTextur', 'IM Fell English', serif",
                  color:      CREAM,
                  fontSize:   32,
                  fontStyle:  'italic',
                  flex:        1,
                }}
              >
                {destinyName || <span style={{ opacity: 0.35 }}>Unnamed Destiny</span>}
              </div>
              {/* DESTINY tag */}
              <div
                style={{
                  ...BASKERVILLE_BOLD,
                  color:         DESTINY_BANNER_BORDER,
                  fontSize:      14,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                DESTINY
              </div>
            </div>

            {/* Description */}
            {destinyDesc && (
              <div
                style={{
                  background:   DESTINY_BANNER_BG,
                  borderLeft:   `2px solid ${DESTINY_BANNER_BORDER}`,
                  borderRight:  `2px solid ${DESTINY_BANNER_BORDER}`,
                  padding:      '12px 16px',
                }}
              >
                <div
                  style={{
                    ...BASKERVILLE,
                    color:      CREAM,
                    fontSize:   18,
                    lineHeight: 1.55,
                  }}
                >
                  {destinyDesc}
                </div>
              </div>
            )}

            {/* Curse box */}
            {destinyCurse && (
              <div
                style={{
                  background:   CURSE_BG,
                  border:       `2px solid ${CURSE_BORDER}`,
                  borderTop:    'none',
                  borderRadius: '0 0 6px 6px',
                  padding:      '12px 16px',
                }}
              >
                <div
                  style={{
                    ...BASKERVILLE_BOLD,
                    color:         '#cc4444',
                    fontSize:      14,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom:  4,
                  }}
                >
                  Curse
                </div>
                <div
                  style={{
                    ...BASKERVILLE,
                    color:      CREAM,
                    fontSize:   18,
                    lineHeight: 1.55,
                  }}
                >
                  {destinyCurse}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
