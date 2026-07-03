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
 *     card={{ stats: { hp: 3, ... }, unitKeywords: [...] }}
 *     tokenState={{ 'uuid-1': 0, 'uuid-2': 1 }}
 *     onTokenChange={(defId, val) => ...}
 *     onAddCustomToken={() => openCreateModal()}
 *     onEditCustomToken={(tok) => openEditModal(tok)}
 *   />
 *
 * Game-agnostic: token icons resolve via `resolveTokenIcon`, which loads
 * SVGs from any game's `tokens/` folder. Stats resolve via a generic
 * `stats: Record<string, number>` map keyed by `token_definitions.stat_key`.
 *
 * UCT (User-Created Token) support: tokens with `display_color` set render
 * as a colored badge via `<TokenBadge>` and get a ⋯ Edit menu when
 * `onEditCustomToken` is supplied. The "Add Custom Token" entry at the
 * bottom triggers `onAddCustomToken`.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { TokenDefinition } from '../lib/database.types';
import { resolveTokenIcon } from '../lib/tokenIcons';
import TokenBadge from './TokenBadge';
import AddCircle from '@battleplans/ui';
import Pen2 from '@battleplans/ui';

// ── Types ────────────────────────────────────────────────────────────────────

interface CardInfo {
  /** Numeric stats for this card keyed by stat key (e.g. {hp: 3} for Halo,
   *  {wounds: 12} for Kill Team). Used to resolve `token_definitions.stat_key`
   *  limits at runtime. */
  stats:        Record<string, number>;
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
  /** When provided, shows an "Add Custom Token" entry at the bottom of
   *  the dropdown. Called with no args; the caller opens the creation
   *  modal. */
  onAddCustomToken?: () => void;
  /** When provided, deck-scoped (UCT) tokens get a ⋯ Edit menu in the
   *  dropdown. The caller opens the edit modal with the token pre-filled. */
  onEditCustomToken?: (tokenDef: TokenDefinition) => void;
}

// ── Styles ───────────────────────────────────────────────────────────────────

/** Shared className for every TokenMenu action button.
 *
 *  Buttons stay mounted at min/max instead of being hidden — we set the
 *  HTML `disabled` attribute and rely on Tailwind's `disabled:` modifiers
 *  to grey them out, suppress hover, and switch the cursor. Keeping the
 *  buttons rendered avoids the menu layout jumping as the user steps
 *  through tokens. */
const ACTION_BUTTON_CLASS =
  'flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white ' +
  'rounded transition-colors text-left ' +
  'enabled:hover:bg-gray-700 enabled:cursor-pointer ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

// ── Stat resolver ────────────────────────────────────────────────────────────

const resolveStatValue = (card: CardInfo, statKey: string): number | null =>
  card.stats[statKey] ?? null;

// ── Component ────────────────────────────────────────────────────────────────

const TokenMenu = ({
  tokenDefinitions,
  card,
  tokenState,
  onTokenChange,
  onAddCustomToken,
  onEditCustomToken,
}: TokenMenuProps) => {
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
          iconUrl: resolveTokenIcon(def.icon),
        };
      });
  }, [tokenDefinitions, card]);

  // Hide the menu entirely only if there's nothing for it to do — no
  // eligible tokens AND no "Add Custom Token" capability.
  if (eligible.length === 0 && !onAddCustomToken) return null;

  // ── Render menu items ────────────────────────────────────────────────────

  /** Render the 20px visual for a token row — picks the right element
   *  based on the token's display_style:
   *    - 'badge' → coloured TokenBadge (UCTs)
   *    - any other → icon asset via <img>, falling back to nothing if
   *      the row has no icon set.
   *  Bar / pip rendering only affects the on-card visual via TokenOverlay;
   *  in the menu we still show a small icon so the row reads clearly. */
  const renderTokenVisual = (tok: ResolvedToken, opts?: { offState?: boolean }) => {
    if (tok.def.display_style === 'badge') {
      return (
        <TokenBadge
          color={tok.def.display_color ?? '#f85908'}
          glyph={tok.def.display_glyph ?? tok.def.name.slice(0, 2)}
          size={20}
          shadow={false}
        />
      );
    }
    const src = opts?.offState
      ? (resolveTokenIcon(tok.def.icon_off) || tok.iconUrl)
      : tok.iconUrl;
    if (!src) return null;
    return <img src={src} alt="" className="w-5 h-5 shrink-0" />;
  };

  const isUct = (tok: ResolvedToken) =>
    tok.def.deck_id != null && onEditCustomToken != null;

  /** Resolve the user-facing label for a TokenMenu action button.
   *
   *  Each token row can override either direction via `label_on` /
   *  `label_off`. When set, the override replaces the entire string
   *  including the verb — no name suffix, no pluralisation. When null,
   *  fall back to the per-shape default templates ("Add X" / "Mark as X"
   *  / "Add Xs" / etc).
   *
   *  `direction` is the SEMANTIC direction:
   *    - 'on'  → user is increasing the token count (Add / Mark as)
   *    - 'off' → user is decreasing it (Reduce / Remove)
   *
   *  `fallback` is the default template to use when the override is null. */
  const labelFor = (tok: ResolvedToken, direction: 'on' | 'off', fallback: string) => {
    const override = direction === 'on' ? tok.def.label_on : tok.def.label_off;
    return override ?? fallback;
  };

  const renderItems = () => {
    const items: React.ReactNode[] = [];

    for (const tok of eligible) {
      const current = tokenState[tok.def.id] ?? tok.def.starting_value ?? 0;
      const atMax   = tok.effectiveMax != null && current >= tok.effectiveMax;
      const atMin   = current <= tok.effectiveMin;

      if (tok.def.is_toggle && tok.effectiveMax === 1) {
        // Single toggle: "Mark as X" / "Remove X". Toggles its own state
        // each click, so never disabled — but we still use the shared
        // class for consistent hover styling.
        const isOn = current >= 1;
        items.push(
          <button
            key={tok.def.id}
            type="button"
            className={ACTION_BUTTON_CLASS}
            onClick={() => {
              onTokenChange(tok.def.id, isOn ? 0 : 1);
            }}
          >
            {renderTokenVisual(tok, { offState: !isOn })}
            <span>
              {isOn
                ? labelFor(tok, 'off', `Remove ${tok.def.name}`)
                : labelFor(tok, 'on',  `Mark as ${tok.def.name}`)}
            </span>
          </button>
        );
      } else if (tok.def.is_toggle && tok.effectiveMax != null && tok.effectiveMax > 1) {
        // Multi-toggle: "Add Xs" / "Reduce Xs". Both buttons always render
        // so the dropdown layout doesn't shift as the user steps through;
        // the inactive direction is disabled instead.
        items.push(
          <button
            key={`${tok.def.id}-add`}
            type="button"
            disabled={atMax}
            className={ACTION_BUTTON_CLASS}
            onClick={() => onTokenChange(tok.def.id, current + 1)}
          >
            {renderTokenVisual(tok)}
            <span>{labelFor(tok, 'on', `Add ${tok.def.name}s`)}</span>
          </button>
        );
        items.push(
          <button
            key={`${tok.def.id}-reduce`}
            type="button"
            disabled={atMin}
            className={ACTION_BUTTON_CLASS}
            onClick={() => onTokenChange(tok.def.id, current - 1)}
          >
            {renderTokenVisual(tok, { offState: true })}
            <span>{labelFor(tok, 'off', `Reduce ${tok.def.name}s`)}</span>
          </button>
        );
      } else {
        // Non-toggle counter: "Add X" / "Reduce X". Same always-render +
        // disable pattern as the multi-toggle case above.
        items.push(
          <button
            key={`${tok.def.id}-add`}
            type="button"
            disabled={atMax}
            className={ACTION_BUTTON_CLASS}
            onClick={() => onTokenChange(tok.def.id, current + 1)}
          >
            {renderTokenVisual(tok)}
            <span>{labelFor(tok, 'on', `Add ${tok.def.name}`)}</span>
          </button>
        );
        items.push(
          <button
            key={`${tok.def.id}-reduce`}
            type="button"
            disabled={atMin}
            className={ACTION_BUTTON_CLASS}
            onClick={() => onTokenChange(tok.def.id, current - 1)}
          >
            {renderTokenVisual(tok)}
            <span>{labelFor(tok, 'off', `Reduce ${tok.def.name}`)}</span>
          </button>
        );
      }

      // UCT management row — "Edit Token" sits beneath the action buttons
      // for any deck-scoped token, when an edit handler is provided. The
      // edit modal hosts the Delete action so we don't need a separate
      // delete button here.
      if (isUct(tok)) {
        items.push(
          <button
            key={`${tok.def.id}-edit`}
            type="button"
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-gray-300
                       hover:bg-gray-700 hover:text-white rounded transition-colors text-left"
            onClick={() => onEditCustomToken?.(tok.def)}
          >
            <Pen2 className="w-4 h-4 shrink-0" />
            <span>Edit {tok.def.name}</span>
          </button>
        );
      }
    }

    // ── Add Custom Token ────────────────────────────────────────────────
    if (onAddCustomToken) {
      if (items.length > 0) {
        items.push(
          <div key="uct-divider" className="my-1 border-t border-gray-700" />
        );
      }
      items.push(
        <button
          key="uct-add"
          type="button"
          className="flex items-center gap-3 w-full px-3 py-2 text-sm font-body text-white
                     hover:bg-gray-700 rounded transition-colors text-left"
          onClick={() => onAddCustomToken()}
        >
          <AddCircle className="w-4 h-4 shrink-0 text-blue-400" />
          <span>Add Custom Token</span>
        </button>
      );
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
