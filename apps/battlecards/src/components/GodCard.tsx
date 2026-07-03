/**
 * GodCard.tsx — Repent Ye Foolish Gods god card
 *
 * Native size: 890 × 1270 px.
 *
 * Layout:
 *   Dark header band (full width)
 *     "Your God" label + god name
 *   Lore text box (cream bg bordered)
 *   Four tier rows (Minions / Servants / Lieutenants / Champions)
 *     Each row: label (200px bold uppercase) + description (flex-1)
 */

// @ts-ignore — path contains spaces
import bgSvg from '../assets/games/card assets/ryg/bg-septgod.png';

export const CARD_W = 890;
export const CARD_H = 1270;

const TEXT_DARK    = '#141414';

const TEXTUR           = { fontFamily: "'LLTextur', 'IM Fell English', serif" } as const;
const CREAM            = '#e8e5dd';
const BASKERVILLE      = { fontFamily: "'Libre Baskerville', 'Georgia', serif" } as const;
const BASKERVILLE_BOLD = { ...BASKERVILLE, fontWeight: 700 } as const;

const TIERS = [
  { key: 'minions',     label: 'Minions'     },
  { key: 'servants',    label: 'Servants'    },
  { key: 'lieutenants', label: 'Lieutenants' },
  { key: 'champions',   label: 'Champions'   },
] as const;

export interface GodCardProps {
  godName?:        string;
  specialAbility?: string;
  minions?:        string;
  servants?:       string;
  lieutenants?:    string;
  champions?:      string;
}

export default function GodCard({
  godName        = '',
  specialAbility = '',
  minions        = '',
  servants       = '',
  lieutenants    = '',
  champions      = '',
}: GodCardProps) {
  const tierValues: Record<string, string> = { minions, servants, lieutenants, champions };

  const CONTENT_L = 42;
  const CONTENT_T = 200;
  const CONTENT_W = CARD_W - CONTENT_L * 2;

  return (
    <div
      style={{
        position: 'relative',
        width:    CARD_W,
        height:   CARD_H,
        overflow: 'hidden',
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
          Your God
        </div>
        <div style={{ ...TEXTUR, color: CREAM, fontSize: 64, lineHeight: 1.1, textAlign: 'center', paddingInline: 40 }}>
          {godName || <span style={{ opacity: 0.3 }}>Unnamed God</span>}
        </div>
      </div>

      {/* ── Layer 3: content ── */}
      <div
        style={{
          position:      'absolute',
          top:           CONTENT_T,
          left:          CONTENT_L,
          width:         CONTENT_W,
          display:       'flex',
          flexDirection: 'column',
          gap:           28,
        }}
      >
        {/* Special ability */}
        {specialAbility && (
          <div
            style={{
              background: '#ffffff',
              border:     '2px solid #87816e',
              padding:    '12px 16px',
              borderRadius: 6,
            }}
          >
            <div style={{ ...BASKERVILLE, fontSize: 23, color: TEXT_DARK, lineHeight: 1.5 }}>
              {specialAbility}
            </div>
          </div>
        )}

        {/* Tier rows */}
        <div
          style={{
            border:       '2px solid #87816e',
            borderRadius: 6,
            overflow:     'hidden',
          }}
        >
          {TIERS.map((tier, i) => (
            <div
              key={tier.key}
              style={{
                display:     'flex',
                background:  '#ffffff',
                borderTop:   i > 0 ? '1px solid #87816e' : undefined,
                minHeight:   80,
              }}
            >
              <div
                style={{
                  ...BASKERVILLE_BOLD,
                  fontSize:      20,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  padding:       '16px 20px',
                  width:         218,
                  flexShrink:    0,
                  color:         TEXT_DARK,
                  borderRight:   '1px solid #87816e',
                  display:       'flex',
                  alignItems:    'center',
                }}
              >
                {tier.label}
              </div>
              <div
                style={{
                  ...BASKERVILLE,
                  fontSize:    23,
                  padding:     '16px 20px',
                  flex:        1,
                  color:       TEXT_DARK,
                  lineHeight:  1.5,
                  display:     'flex',
                  alignItems:  'center',
                }}
              >
                {tierValues[tier.key] || <span style={{ opacity: 0.3 }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
