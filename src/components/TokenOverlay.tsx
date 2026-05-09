/**
 * TokenOverlay.tsx — Visual token display overlaid on a Halo Flashpoint card
 *
 * Renders token icons in three zones, positioned absolutely at the card's
 * native 1270×890 coordinate space. Intended to sit inside the active card
 * container div as a sibling to Card3DWrapper, scaling with the card.
 *
 * Three zones:
 *   1. Other Tokens (top-left)  — single-instance toggles: Activated, Crouch, Pinned
 *   2. Shield Area  (top-centre) — multi-instance toggles: Shield
 *   3. Damage Area  (right/HP)   — stacking counters: Damage
 *
 * USAGE:
 *   <TokenOverlay
 *     tokenDefinitions={tokenDefs}
 *     card={{ hp: 4, unitKeywords: [...] }}
 *     tokenState={{ 'uuid-1': 2, 'uuid-2': 1 }}
 *   />
 */

import { useMemo } from 'react';
import type { TokenDefinition } from '../lib/database.types';

// ── SVG icon imports (same set as TokenMenu) ─────────────────────────────────

import iconDamage       from '../assets/games/card assets/halo/tokens/Token Type=Damage, State=Default.svg';
import iconShield       from '../assets/games/card assets/halo/tokens/Token Type=Shield, State=Default.svg';
import iconShieldOff    from '../assets/games/card assets/halo/tokens/Token Type=Shield, State=Off.svg';
import iconCrouch       from '../assets/games/card assets/halo/tokens/Token Type=Crouch, State=Default.svg';
import iconPinned       from '../assets/games/card assets/halo/tokens/Token Type=Pinned, State=Default.svg';
import iconActivated    from '../assets/games/card assets/halo/tokens/Token Type=Activated, State=Default.svg';
import iconActivatedOff from '../assets/games/card assets/halo/tokens/Token Type=Activated, State=Off.svg';

const ICON_MAP: Record<string, string> = {
  'Token Type=Damage, State=Default':    iconDamage,
  'Token Type=Shield, State=Default':    iconShield,
  'Token Type=Shield, State=Off':        iconShieldOff,
  'Token Type=Crouch, State=Default':    iconCrouch,
  'Token Type=Pinned, State=Default':    iconPinned,
  'Token Type=Activated, State=Default': iconActivated,
  'Token Type=Activated, State=Off':     iconActivatedOff,
};

const resolveIcon = (path: string | null): string | undefined => {
  if (!path) return undefined;
  for (const [key, url] of Object.entries(ICON_MAP)) {
    if (path.includes(key)) return url;
  }
  return undefined;
};

// ── Token size at native card scale (40px Figma × 2.104) ────────────────────
const TOKEN_SIZE = 84;
const TOKEN_SHADOW = 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))';
const DAMAGE_OFFSET = 30;

// ── Types ────────────────────────────────────────────────────────────────────

interface CardInfo {
  hp: number;
  unitKeywords: { keywordName: string; paramValue: number | null }[];
}

interface ResolvedToken {
  def: TokenDefinition;
  effectiveMax: number | null;
  iconOn: string | undefined;
  iconOff: string | undefined;
  current: number;
}

export interface TokenOverlayProps {
  tokenDefinitions: TokenDefinition[];
  card: CardInfo;
  tokenState: Record<string, number>;
  /** Called when a toggle token is clicked directly on the overlay. */
  onTokenChange?: (tokenDefId: string, newValue: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolveStatValue = (card: CardInfo, statKey: string): number | null => {
  const map: Record<string, number> = { hp: card.hp };
  return map[statKey] ?? null;
};

/** Categorise a resolved token into its display zone. */
type Zone = 'other' | 'shield' | 'damage';

const getZone = (tok: ResolvedToken): Zone => {
  // Non-toggle counters with a stat link → damage zone
  if (!tok.def.is_toggle && tok.def.stat_key) return 'damage';
  // Toggle with max > 1 → shield zone
  if (tok.def.is_toggle && tok.effectiveMax != null && tok.effectiveMax > 1) return 'shield';
  // Everything else (single toggles, max-1 counters) → other zone
  return 'other';
};

// ── Token icon with tooltip + optional click ────────────────────────────────

interface TokenIconProps {
  src: string;
  alt: string;
  title: string;
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const TokenIcon = ({ src, alt, title, size = TOKEN_SIZE, opacity = 1, style, onClick }: TokenIconProps) => (
  <img
    src={src}
    alt={alt}
    title={title}
    style={{
      width: size,
      height: size,
      opacity,
      filter: TOKEN_SHADOW,
      cursor: onClick ? 'pointer' : undefined,
      pointerEvents: onClick ? 'auto' : undefined,
      ...style,
    }}
    onClick={onClick}
  />
);

// ── Component ────────────────────────────────────────────────────────────────

const TokenOverlay = ({ tokenDefinitions, card, tokenState, onTokenChange }: TokenOverlayProps) => {
  const resolved = useMemo<ResolvedToken[]>(() => {
    return tokenDefinitions
      .filter(def => {
        if (def.keyword_name) {
          return card.unitKeywords.some(
            kw => kw.keywordName.toLowerCase() === def.keyword_name!.toLowerCase()
          );
        }
        return true;
      })
      .map(def => {
        let effectiveMax: number | null = def.max_value ?? null;

        if (def.stat_key && def.stat_role === 'max') {
          const v = resolveStatValue(card, def.stat_key);
          if (v != null) effectiveMax = v;
        }
        if (def.keyword_name && def.keyword_value_role === 'max') {
          const kw = card.unitKeywords.find(
            k => k.keywordName.toLowerCase() === def.keyword_name!.toLowerCase()
          );
          if (kw?.paramValue != null) effectiveMax = kw.paramValue;
        }

        return {
          def,
          effectiveMax,
          iconOn: resolveIcon(def.icon),
          iconOff: resolveIcon(def.icon_off),
          current: tokenState[def.id] ?? def.starting_value ?? 0,
        };
      });
  }, [tokenDefinitions, card, tokenState]);

  const zones: Record<Zone, ResolvedToken[]> = { other: [], shield: [], damage: [] };
  for (const tok of resolved) zones[getZone(tok)].push(tok);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {/* ── Other Tokens Area (top-left) ─────────────────────────── */}
      {zones.other.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 42,
            top: -70,
            display: 'flex',
            gap: 57,
          }}
        >
          {zones.other.map(tok => {
            const isOn = tok.current >= 1;
            // Hide entirely if off and no off-state icon (e.g. Crouch, Pinned)
            if (!isOn && !tok.iconOff) return null;
            const src = isOn ? tok.iconOn : tok.iconOff;
            if (!src) return null;
            // Clickable if it has on/off states
            const canToggle = tok.def.is_toggle && tok.iconOff && onTokenChange;
            return (
              <TokenIcon
                key={tok.def.id}
                src={src}
                alt={tok.def.name}
                title={tok.def.name}
                onClick={canToggle ? () => onTokenChange(tok.def.id, isOn ? 0 : 1) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* ── Shield Area (top-centre, above header) ───────────────── */}
      {zones.shield.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 695,
            top: -70,
            display: 'flex',
            gap: 57,
          }}
        >
          {zones.shield.map(tok => {
            const total = tok.effectiveMax ?? 0;
            const active = tok.current;
            const icons: React.ReactNode[] = [];
            for (let i = 0; i < total; i++) {
              const isOn = i < active;
              const src = isOn ? tok.iconOn : (tok.iconOff || tok.iconOn);
              if (src) {
                // Click toggles this specific shield: if on → reduce by 1, if off → increase by 1
                const canClick = tok.iconOff && onTokenChange;
                icons.push(
                  <TokenIcon
                    key={`${tok.def.id}-${i}`}
                    src={src}
                    alt={`${tok.def.name} ${i + 1}`}
                    title={tok.def.name}
                    opacity={isOn ? 1 : 0.5}
                    onClick={canClick ? () => onTokenChange(tok.def.id, isOn ? active - 1 : active + 1) : undefined}
                  />
                );
              }
            }
            return icons;
          })}
        </div>
      )}

      {/* ── Damage Area (right side, around HP) ──────────────────── */}
      {zones.damage.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 935,
            top: 160,
          }}
        >
          {zones.damage.map(tok => {
            const count = tok.current;
            if (count === 0 || !tok.iconOn) return null;
            const lastOffset = (count - 1) * DAMAGE_OFFSET;
            return (
              <div
                key={tok.def.id}
                style={{
                  position: 'relative',
                  width: TOKEN_SIZE + lastOffset,
                  height: TOKEN_SIZE + lastOffset,
                }}
              >
                {Array.from({ length: count }, (_, i) => (
                  <TokenIcon
                    key={`${tok.def.id}-${i}`}
                    src={tok.iconOn!}
                    alt={`${tok.def.name} ${i + 1}`}
                    title={tok.def.name}
                    style={{
                      position: 'absolute',
                      left: i * DAMAGE_OFFSET,
                      top: i * DAMAGE_OFFSET,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TokenOverlay;
