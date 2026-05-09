/**
 * KillTeamRuleCard.tsx — Kill Team faction rule card
 *
 * Mirrors Figma node 848:4770 exactly. Native size 700 × 1200.
 *
 * Layout (Figma frame coordinates):
 *   • Header band         0,0,700×81           bg #2b292a, "FACTION RULE" 52px
 *   • Title section       14,101,672×181       (gap 6 between title and desc)
 *       Title block        0,0,672×35          (overlapping orange underline)
 *           Title text     0,0,672×35          38px Conduit Bold orange
 *           Underline      0,32,672×3          orange
 *       Description       0,41,672×140         30px Conduit Regular black
 *   • Ability section     14,302,672×158       (gap 11 between banner and desc)
 *       Banner             0,0,672×43          orange #f85908, pt 5, px 10
 *           Name           10,10,…,28          30px Conduit Bold uppercase white
 *           AP             621,10,41,28        30px right-aligned
 *       Description        0,54,672×104        28px Conduit Regular black
 *
 * Inline editing:
 *   Pass onChange callbacks to enable double-click edit on title + description.
 *   Click the ability section to fire `onAbilityClick`.
 */

import { useState, useRef } from 'react';
import { type KillTeamAbility } from './KillTeamCard';

// ── Native size ──────────────────────────────────────────────────────────────
const CARD_W = 700;
const CARD_H = 1200;

// ── Font shorthands ──────────────────────────────────────────────────────────
const CONDUIT      = { fontFamily: "'Conduit ITC', sans-serif" } as const;
const CONDUIT_BOLD = { ...CONDUIT, fontWeight: 700 } as const;
const CONDUIT_REG  = { ...CONDUIT, fontWeight: 400 } as const;

// ── Theme ────────────────────────────────────────────────────────────────────
const ORANGE       = '#f85908';
const HEADER_BG    = '#2b292a';
const BODY_BG      = '#e5e5e7';

// ── Layout constants (Figma exact) ───────────────────────────────────────────
const HEADER_H        = 81;
const HEADER_FONT     = 52;
const BODY_PAD_X      = 14;
const BODY_W          = CARD_W - BODY_PAD_X * 2; // 672

const BODY_TOP        = 101;
const TITLE_H         = 35;
const TITLE_FONT      = 38;
const TITLE_UNDERLINE = 3;
const TITLE_GAP       = 6;  // gap between title block and rule description
const RULE_DESC_FONT  = 28; // -2pt from Figma 30 — packs more text per line
const SECTION_GAP     = 20; // gap between rule description and ability section

const ABILITY_BANNER_H   = 43;
const ABILITY_BANNER_FONT = 30;
const ABILITY_GAP        = 11; // gap between banner and ability description
const ABILITY_DESC_FONT  = 26; // -2pt from Figma 28

// ── Shared inline-input base ─────────────────────────────────────────────────
const INPUT_BASE: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  padding: 0, margin: 0, display: 'block',
};

export interface KillTeamRuleCardProps {
  title?:       string;
  description?: string;
  /** 0 or 1 attached ability. Pass null/undefined to render no ability slot. */
  ability?:     KillTeamAbility | null;
  className?:   string;

  // ── Inline-edit callbacks (omit to keep field read-only) ──
  onTitleChange?:       (v: string) => void;
  onDescriptionChange?: (v: string) => void;
  /** Called when the ability section is clicked. */
  onAbilityClick?:      (a: KillTeamAbility) => void;
}

const KillTeamRuleCard = ({
  title       = 'Rule Title',
  description = '',
  ability     = null,
  className   = '',
  onTitleChange,
  onDescriptionChange,
  onAbilityClick,
}: KillTeamRuleCardProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue,    setEditValue]    = useState('');
  const cancellingRef = useRef(false);

  const startEdit = (field: string, value: string, editable: boolean) => {
    if (!editable) return;
    setEditingField(field);
    setEditValue(value);
  };
  const commitText = (onChange?: (v: string) => void) => {
    if (!cancellingRef.current) onChange?.(editValue);
    cancellingRef.current = false;
    setEditingField(null);
  };
  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  e.currentTarget.blur();
    if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
  };
  const onKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter inserts newline; plain Enter commits.
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
  };
  const editCursor = (editable: boolean): React.CSSProperties =>
    editable ? { cursor: 'text', userSelect: 'none' } : { userSelect: 'none' };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width: CARD_W, height: CARD_H, background: BODY_BG, ...CONDUIT }}
    >
      {/* ── Header band ──────────────────────────────────────────────── */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: 0, top: 0, width: CARD_W, height: HEADER_H, background: HEADER_BG }}
      >
        <p
          style={{
            ...CONDUIT_BOLD,
            fontSize: HEADER_FONT, lineHeight: 1, color: 'white',
            letterSpacing: '-2.08px', textTransform: 'uppercase',
          }}
        >
          Faction Rule
        </p>
      </div>

      {/* ── Body — single flow column. Each section hugs its content
            vertically; the card itself is fixed 1200 tall and clips any
            overflow at the bottom. ─────────────────────────────────────── */}
      <div
        className="absolute flex flex-col"
        style={{
          left: BODY_PAD_X,
          right: BODY_PAD_X,
          top:  BODY_TOP,
          bottom: 0,
        }}
      >
        {/* Title block: title text + orange underline overlapping bottom 3px */}
        <div className="relative shrink-0" style={{ height: TITLE_H }}>
          {editingField === 'title' ? (
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitText(onTitleChange)}
              onKeyDown={onKeyDownInput}
              style={{
                ...INPUT_BASE, ...CONDUIT_BOLD,
                fontSize: TITLE_FONT, lineHeight: 1, color: ORANGE,
                letterSpacing: '-1.52px', textTransform: 'uppercase',
                width: '100%', height: TITLE_H,
                borderBottom: '1.5px solid rgba(248,89,8,0.5)',
              }}
            />
          ) : (
            <p
              className="truncate"
              style={{
                ...CONDUIT_BOLD,
                fontSize: TITLE_FONT, lineHeight: 1, color: ORANGE,
                letterSpacing: '-1.52px', textTransform: 'uppercase',
                width: '100%', height: TITLE_H,
                display: 'flex', alignItems: 'center',
                ...editCursor(!!onTitleChange),
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                startEdit('title', title, !!onTitleChange);
              }}
            >
              {title}
            </p>
          )}
          {/* Orange underline at y=32 (overlaps title bottom by 3px) */}
          <div
            style={{
              position: 'absolute', left: 0, top: 32,
              width: '100%', height: TITLE_UNDERLINE, background: ORANGE,
            }}
          />
        </div>

        {/* Rule description — auto height, no clipping at this level. */}
        <div className="shrink-0" style={{ marginTop: TITLE_GAP, width: '100%' }}>
          {editingField === 'description' ? (
            <textarea
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitText(onDescriptionChange)}
              onKeyDown={onKeyDownTextarea}
              style={{
                ...INPUT_BASE, ...CONDUIT_REG,
                fontSize: RULE_DESC_FONT, lineHeight: 'normal', color: 'black',
                letterSpacing: '-1.2px',
                width: '100%', minHeight: 140, resize: 'none',
                borderBottom: '1.5px dashed rgba(0,0,0,0.25)',
              }}
            />
          ) : (
            <p
              style={{
                ...CONDUIT_REG,
                fontSize: RULE_DESC_FONT, lineHeight: 'normal', color: 'black',
                letterSpacing: '-1.2px',
                whiteSpace: 'pre-wrap',
                ...editCursor(!!onDescriptionChange),
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                startEdit('description', description, !!onDescriptionChange);
              }}
            >
              {description || (onDescriptionChange ? 'Double-click to add description' : '')}
            </p>
          )}
        </div>

        {/* Ability section (optional) — sits below the rule description with
            a 20px gap; banner + description both hug their content. */}
        {ability && (
          <div
            className="shrink-0"
            style={{
              marginTop: SECTION_GAP, width: '100%',
              cursor: onAbilityClick ? 'pointer' : 'default',
            }}
            onClick={() => onAbilityClick?.(ability)}
          >
            {/* Orange banner */}
            <div
              className="flex items-center justify-between"
              style={{
                height: ABILITY_BANNER_H,
                paddingTop: 5, paddingLeft: 10, paddingRight: 10,
                background: ORANGE,
              }}
            >
              <p
                className="truncate"
                style={{
                  ...CONDUIT_BOLD,
                  fontSize: ABILITY_BANNER_FONT, lineHeight: 'normal', color: 'white',
                  letterSpacing: '-1.2px', textTransform: 'uppercase',
                  flex: '1 0 0', minWidth: 0,
                }}
              >
                {ability.name || 'Untitled Ability'}
              </p>
              {ability.apCost > 0 && (
                <p
                  style={{
                    ...CONDUIT_BOLD,
                    fontSize: ABILITY_BANNER_FONT, lineHeight: 'normal', color: 'white',
                    letterSpacing: '-1.2px', textTransform: 'uppercase',
                    flexShrink: 0, marginLeft: 12,
                  }}
                >
                  {ability.apCost}AP
                </p>
              )}
            </div>
            {/* Description — auto height */}
            {ability.description && (
              <p
                style={{
                  ...CONDUIT_REG,
                  fontSize: ABILITY_DESC_FONT, lineHeight: 'normal', color: 'black',
                  letterSpacing: '-1.12px',
                  whiteSpace: 'pre-wrap',
                  marginTop: ABILITY_GAP,
                }}
              >
                {ability.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KillTeamRuleCard;
