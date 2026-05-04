/**
 * TokenMenu.tsx — Floating token action menu for Play mode
 *
 * A popover anchored to the bottom-right of the card area. Closed by default —
 * clicking the "Token" pill button toggles a dropdown of eligible token actions
 * for the currently viewed unit.
 *
 * USAGE:
 *   <TokenMenu
 *     tokenDefinitions={tokenDefs}
 *     card={{ hp: 3, unitKeywords: [...] }}
 *     tokenState={{ 'uuid-1': 0, 'uuid-2': 1 }}
 *     onTokenChange={(defId, val) => ...}
 *   />
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { TokenDefinition } from '../lib/database.types';

// ── SVG icon imports (eager — small fixed set) ───────────────────────────────

import iconDamage       from '../assets/games/card assets/halo/tokens/Token Type=Damage, State=Default.svg';
import iconShield       from '../assets/games/card assets/halo/tokens/Token Type=Shield, State=Default.svg';
import iconShieldOff    from '../assets/games/card assets/halo/tokens/Token Type=Shield, State=Off.svg';
import iconCrouch       from '../assets/games/card assets/halo/tokens/Token Type=Crouch, State=Default.svg';
import iconPinned       from '../assets/games/card assets/halo/tokens/Token Type=Pinned, State=Default.svg';
import iconActivated    from '../assets/games/card assets/halo/tokens/Token Type=Activated, State=Default.svg';
import iconActivatedOff from '../assets/games/card assets/halo/tokens/Token Type=Activated, State=Off.svg';

/** Maps asset path substrings to eagerly imported URLs. */
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

// ── Types ────────────────────────────────────────────────────────────────────

interface CardInfo {
  hp: number;
  unitKeywords: { keywordName: string; paramValue: number | null }[];
}

/** Resolved token with computed limits and eligibility. */
interface ResolvedToken {
  def:        TokenDefinition;
  effectiveMin: number;
  effectiveMax: number | null; // null = unlimited
  iconUrl:    string | undefined;
}

export interface TokenMenuProps {
  /** All token definitions for this game. */
  tokenDefinitions: TokenDefinition[];
  /** Info about the active card needed for eligibility + limit resolution. */
  card: CardInfo;
  /** Current token values keyed by token definition ID. */
  tokenState: Record<string, number>;
  /** Called when a token value should change. */
  onTokenChange: (tokenDefId: string, newValue: number) => void;
}

// ── Stat resolver ────────────────────────────────────────────────────────────

const resolveStatValue = (card: CardInfo, statKey: string): number | null => {
  const map: Record<string, number> = { hp: card.hp };
  return map[statKey] ?? null;
};

// ── Component ────────────────────────────────────────────────────────────────

const TokenMenu = ({ tokenDefinitions, card, tokenState, onTokenChange }: TokenMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Resolve eligible tokens ──────────────────────────────────────────────

  const eligible = useMemo<ResolvedToken[]>(() => {
    return tokenDefinitions
      .filter(def => {
        // If token requires a keyword, check the unit has it
        if (def.keyword_name) {
          return card.unitKeywords.some(
            kw => kw.keywordName.toLowerCase() === def.keyword_name!.toLowerCase()
          );
        }
        return true;
      })
      .map(def => {
        let effectiveMin = def.min_value ?? 0;
        let effectiveMax: number | null = def.max_value ?? null;

        // Resolve stat-based limits
        if (def.stat_key && def.stat_role) {
          const statVal = resolveStatValue(card, def.stat_key);
          if (statVal != null) {
            if (def.stat_role === 'max') effectiveMax = statVal;
            else if (def.stat_role === 'min') effectiveMin = statVal;
          }
        }

        // Resolve keyword-based limits
        if (def.keyword_name && def.keyword_value_role) {
          const kw = card.unitKeywords.find(
            k => k.keywordName.toLowerCase() === def.keyword_name!.toLowerCase()
          );
          if (kw?.paramValue != null) {
            if (def.keyword_value_role === 'max') effectiveMax = kw.paramValue;
            else if (def.keyword_value_role === 'min') effectiveMin = kw.paramValue;
          }
        }

        return {
          def,
          effectiveMin,
          effectiveMax,
          iconUrl: resolveIcon(def.icon),
        };
      });
  }, [tokenDefinitions, card]);

  if (eligible.length === 0) return null;

  // ── Render menu items ────────────────────────────────────────────────────

  const renderItems = () => {
    const items: React.ReactNode[] = [];

    for (const tok of eligible) {
      const current = tokenState[tok.def.id] ?? tok.def.starting_value ?? 0;
      const atMax   = tok.effectiveMax != null && current >= tok.effectiveMax;
      const atMin   = current <= tok.effectiveMin;

      if (tok.def.is_toggle && tok.effectiveMax === 1) {
        // Single toggle: "Mark as X" / "Remove X"
        const isOn = current >= 1;
        items.push(
          <button
            key={tok.def.id}
            type="button"
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                       hover:bg-gray-700 rounded transition-colors text-left"
            onClick={() => {
              onTokenChange(tok.def.id, isOn ? 0 : 1);
            }}
          >
            <img
              src={isOn ? resolveIcon(tok.def.icon_off) || tok.iconUrl : tok.iconUrl}
              alt=""
              className="w-5 h-5 shrink-0"
            />
            <span>{isOn ? `Remove ${tok.def.name}` : `Mark as ${tok.def.name}`}</span>
          </button>
        );
      } else if (tok.def.is_toggle && tok.effectiveMax != null && tok.effectiveMax > 1) {
        // Multi-toggle: "Add Xs" / "Reduce Xs"
        if (!atMax) {
          items.push(
            <button
              key={`${tok.def.id}-add`}
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                         hover:bg-gray-700 rounded transition-colors text-left"
              onClick={() => onTokenChange(tok.def.id, current + 1)}
            >
              <img src={tok.iconUrl} alt="" className="w-5 h-5 shrink-0" />
              <span>Add {tok.def.name}s</span>
            </button>
          );
        }
        if (!atMin) {
          items.push(
            <button
              key={`${tok.def.id}-reduce`}
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                         hover:bg-gray-700 rounded transition-colors text-left"
              onClick={() => onTokenChange(tok.def.id, current - 1)}
            >
              <img src={resolveIcon(tok.def.icon_off) || tok.iconUrl} alt="" className="w-5 h-5 shrink-0" />
              <span>Reduce {tok.def.name}s</span>
            </button>
          );
        }
      } else {
        // Non-toggle counter: "Add X" / "Reduce X"
        if (!atMax) {
          items.push(
            <button
              key={`${tok.def.id}-add`}
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                         hover:bg-gray-700 rounded transition-colors text-left"
              onClick={() => onTokenChange(tok.def.id, current + 1)}
            >
              <img src={tok.iconUrl} alt="" className="w-5 h-5 shrink-0" />
              <span>Add {tok.def.name}</span>
            </button>
          );
        }
        if (!atMin) {
          items.push(
            <button
              key={`${tok.def.id}-reduce`}
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                         hover:bg-gray-700 rounded transition-colors text-left"
              onClick={() => onTokenChange(tok.def.id, current - 1)}
            >
              <img src={tok.iconUrl} alt="" className="w-5 h-5 shrink-0" />
              <span>Reduce {tok.def.name}</span>
            </button>
          );
        }
      }
    }

    return items;
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Dropdown — opens upward from the button */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-800 border border-gray-700
                        rounded-lg shadow-xl py-1 z-50">
          {renderItems()}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                   text-white text-sm font-body font-medium rounded-full
                   transition-colors shadow-lg"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5M8 1.5A6.5 6.5 0 0 1 14.5 8M8 1.5V4m6.5 4H12M8 8l3-3"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Token</span>
      </button>
    </div>
  );
};

export default TokenMenu;
