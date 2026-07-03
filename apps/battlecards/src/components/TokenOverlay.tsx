/**
 * TokenOverlay.tsx — Visual token display overlaid on a play-mode card
 *
 * Renders token icons in three zones at the card's native pixel coordinate
 * space. Sits inside the active card container as a sibling to the card
 * itself, scaling with it via the parent's transform.
 *
 * Three zones:
 *   1. Other Tokens (top-left)   — single-instance toggles: Activated, Crouch
 *   2. Shield Area  (top-centre) — multi-instance toggles: Shield
 *   3. Damage Area  (right/HP)   — stacking counters: Damage / Wounds
 *
 * Game-agnostic: zone origins come from `TOKEN_OVERLAY_CONFIG` keyed by
 * `gameSlug`, icons resolve via `resolveTokenIcon`, and stats resolve via
 * a generic `stats: Record<string, number>` map.
 *
 * USAGE:
 *   <TokenOverlay
 *     gameSlug="halo-flashpoint"
 *     tokenDefinitions={tokenDefs}
 *     card={{ stats: { hp: 4 }, unitKeywords: [...] }}
 *     tokenState={{ 'uuid-1': 2, 'uuid-2': 1 }}
 *   />
 */

import { useMemo } from 'react';
import type { TokenDefinition } from '../lib/database.types';
import { resolveTokenIcon } from '../lib/tokenIcons';
import { resolveTokenPalette, paletteFromColorSet } from '../lib/tokenColorSets';
import TokenBadge from './TokenBadge';
import TokenBar from './TokenBar';
import {
  TOKEN_OVERLAY_CONFIG,
  DEFAULT_OVERLAY_CONFIG,
  type OverlayZoneConfig,
} from '../lib/tokenOverlayConfig';

// ── Token visuals ───────────────────────────────────────────────────────────
const TOKEN_SIZE = 84;
const TOKEN_SHADOW = 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))';

// ── Types ────────────────────────────────────────────────────────────────────

interface CardInfo {
  /** Numeric stats keyed by stat key (e.g. {hp: 3} for Halo, {wounds: 12}
   *  for Kill Team). Used to resolve `token_definitions.stat_key` limits. */
  stats:        Record<string, number>;
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
  /** Game slug — used to look up zone positions in TOKEN_OVERLAY_CONFIG. */
  gameSlug:         string;
  tokenDefinitions: TokenDefinition[];
  card:             CardInfo;
  tokenState:       Record<string, number>;
  /** Called when a toggle token is clicked directly on the overlay. */
  onTokenChange?:   (tokenDefId: string, newValue: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolveStatValue = (card: CardInfo, statKey: string): number | null =>
  card.stats[statKey] ?? null;

/** Categorise a resolved token into its display zone. */
type Zone = 'other' | 'shield' | 'damage' | 'badge' | 'bar';

const getZone = (tok: ResolvedToken): Zone => {
  // Explicit display style wins — these are the cases where the token row
  // tells us exactly how to render. Anything left falls through to the
  // legacy icon-based routing below.
  if (tok.def.display_style === 'bar')   return 'bar';
  if (tok.def.display_style === 'badge') return 'badge';

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

const TokenOverlay = ({
  gameSlug,
  tokenDefinitions,
  card,
  tokenState,
  onTokenChange,
}: TokenOverlayProps) => {
  const zoneConfig: OverlayZoneConfig =
    TOKEN_OVERLAY_CONFIG[gameSlug] ?? DEFAULT_OVERLAY_CONFIG;

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
          iconOn:  resolveTokenIcon(def.icon),
          iconOff: resolveTokenIcon(def.icon_off),
          current: tokenState[def.id] ?? def.starting_value ?? 0,
        };
      });
  }, [tokenDefinitions, card, tokenState]);

  const zones: Record<Zone, ResolvedToken[]> = {
    other: [], shield: [], damage: [], badge: [], bar: [],
  };
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
      {/* ── Other Tokens Area ───────────────────────────────────── */}
      {zones.other.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: zoneConfig.other.x,
            top:  zoneConfig.other.y,
            display: 'flex',
            gap: zoneConfig.other.gap,
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

      {/* ── Shield Area ──────────────────────────────────────────── */}
      {zones.shield.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: zoneConfig.shield.x,
            top:  zoneConfig.shield.y,
            display: 'flex',
            gap: zoneConfig.shield.gap,
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

      {/* ── Damage Area (stacking counters) ──────────────────────── */}
      {zones.damage.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: zoneConfig.damage.x,
            top:  zoneConfig.damage.y,
          }}
        >
          {zones.damage.map(tok => {
            const count = tok.current;
            if (count === 0 || !tok.iconOn) return null;
            const offset = zoneConfig.damage.offset;
            const lastOffset = (count - 1) * offset;
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
                      left: i * offset,
                      top: i * offset,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Badge Zone (User-Created Tokens) ─────────────────────────
          Colored circle + glyph for each active UCT, with a small count
          chip when > 1. Click toggles +/- when an onTokenChange is
          provided (reduce by 1, or remove when at 1). */}
      {zones.badge.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: zoneConfig.badge.x,
            top:  zoneConfig.badge.y,
            display: 'flex',
            alignItems: 'flex-end',
            gap: zoneConfig.badge.gap,
            flexWrap: 'wrap',
            maxWidth: 1100,
          }}
        >
          {zones.badge.map(tok => {
            if (tok.current <= 0 || !tok.def.display_color) return null;
            const glyph = tok.def.display_glyph ?? tok.def.name.slice(0, 2);
            const canClick = !!onTokenChange;
            return (
              <div
                key={tok.def.id}
                title={tok.def.name}
                onClick={canClick ? () => onTokenChange(tok.def.id, tok.current - 1) : undefined}
                style={{
                  cursor: canClick ? 'pointer' : 'default',
                  pointerEvents: canClick ? 'auto' : 'none',
                }}
              >
                <TokenBadge
                  color={tok.def.display_color}
                  glyph={glyph}
                  size={TOKEN_SIZE}
                  count={tok.current}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bar Zone (stat-linked counters) ─────────────────────────
          Bars positioned via the per-game zone config. Each bar gets a
          fill colour from `display_color` and a max from the token's
          effectiveMax (resolved from stat_key/stat_role).
          - Vertical bars stack left-to-right (next to the card).
          - Horizontal bars stack top-to-bottom (beneath the card). */}
      {zones.bar.length > 0 && (() => {
        const isHorizontal = zoneConfig.bar.orientation === 'horizontal';
        return (
          <div
            style={{
              position: 'absolute',
              left: zoneConfig.bar.x,
              top:  zoneConfig.bar.y,
              display: 'flex',
              flexDirection: isHorizontal ? 'column' : 'row',
              gap: zoneConfig.bar.gap,
            }}
          >
            {zones.bar.map(tok => {
              // Resolve the palette: color_set wins, falls back to deriving
              // from display_color, then to a sensible green default so the
              // bar always renders something legible.
              const palette = resolveTokenPalette(tok.def)
                           ?? paletteFromColorSet('Green')!;
              const max     = tok.effectiveMax ?? 0;
              return (
                <TokenBar
                  key={tok.def.id}
                  max={max}
                  current={tok.current}
                  palette={palette}
                  width={zoneConfig.bar.width}
                  height={zoneConfig.bar.height}
                  orientation={isHorizontal ? 'horizontal' : 'vertical'}
                  onChange={onTokenChange
                    ? (newCurrent) => onTokenChange(tok.def.id, newCurrent)
                    : undefined}
                />
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};

export default TokenOverlay;
