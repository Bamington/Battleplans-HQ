/**
 * HaloFlashpointRuleCard.tsx — Halo Flashpoint rule card
 *
 * Architecture (same as HaloFlashpointCard):
 *   Layer 1 — bg-rule.svg  : all static chrome (teal header bar, side slot
 *             with "Reference" label, white body area)
 *   Layer 2 — Dynamic text : title (Industry Test Black, 66px, white) in the
 *             header; description (Aller Light, 30px, black, rendered as
 *             markdown) in the body area
 *
 * The card renders at native 1270 × 890 px. Wrap the outer container with a
 * CSS transform to scale it for display (see CardBuilderHaloFlashpoint).
 *
 * All positions and sizes are taken directly from Figma node 419:11453.
 *
 * Inline editing:
 *   Pass an onChange callback to enable double-click editing on that field.
 *   Omit the callback to keep the field read-only.
 */

import { useState, useRef } from 'react';
import Markdown from 'react-markdown';
import { getMaxLength } from '../lib/constraints';
import type { EntityConstraints } from '../lib/database.types';
import bgRuleSvg from '../assets/games/card assets/halo/bg-rule.svg';

// ── Font shorthands ───────────────────────────────────────────────────────────
const ALLER_LT = { fontFamily: "'Aller', sans-serif", fontWeight: 300 } as const;
const INDUSTRY = { fontFamily: "'Industry Test', sans-serif", fontWeight: 900 } as const;

// ── Card dimensions (from Figma) ──────────────────────────────────────────────
const CARD_W = 1270;
const CARD_H = 890;

// ── Shared inline-input base styles ──────────────────────────────────────────
const INPUT_BASE: React.CSSProperties = {
  background:  'transparent',
  border:      'none',
  outline:     'none',
  padding:     0,
  margin:      0,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HaloFlashpointRuleCardProps {
  /** Rule title displayed in the teal header bar */
  title?:       string;
  /** Markdown content displayed in the white body area */
  description?: string;
  className?:   string;
  // ── Inline edit callbacks ──
  onTitleChange?:       (v: string) => void;
  onDescriptionChange?: (v: string) => void;
  /** DB-driven validation constraints */
  constraints?:         EntityConstraints;
}

// ── Component ─────────────────────────────────────────────────────────────────

const HaloFlashpointRuleCard = ({
  title       = 'Rule Title',
  description = '',
  className   = '',
  onTitleChange,
  onDescriptionChange,
  constraints = {},
}: HaloFlashpointRuleCardProps) => {
  // ── Inline edit state ───────────────────────────────────────────────────────
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur();
    if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
  };

  const editCursor = (editable: boolean): React.CSSProperties =>
    editable ? { cursor: 'text', userSelect: 'none' as const } : { userSelect: 'none' as const };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width:    CARD_W,
        height:   CARD_H,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Layer 1 — Static SVG background */}
      <img
        src={bgRuleSvg}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset:    0,
          width:    CARD_W,
          height:   CARD_H,
          pointerEvents: 'none',
        }}
      />

      {/* Layer 2 — Dynamic text */}

      {/* ── Title (header bar) ─────────────────────────────────────────────── */}
      {editingField === 'title' ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitText(onTitleChange)}
          onKeyDown={onKeyDown}
          maxLength={getMaxLength(constraints, 'title')}
          style={{
            ...INPUT_BASE,
            ...INDUSTRY,
            position:       'absolute',
            left:           119,
            top:            15,
            width:          1151,
            height:         80,
            fontSize:       66,
            lineHeight:     '80px',
            letterSpacing:  '1.98px',
            color:          'white',
            textTransform:  'uppercase',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => startEdit('title', title, !!onTitleChange)}
          style={{
            ...INDUSTRY,
            ...editCursor(!!onTitleChange),
            position:       'absolute',
            left:           119,
            top:            15,
            width:          1151,
            height:         80,
            fontSize:       66,
            lineHeight:     '80px',
            letterSpacing:  '1.98px',
            color:          'white',
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            whiteSpace:     'nowrap',
          }}
        >
          {title}
        </div>
      )}

      {/* ── Description (body area) ────────────────────────────────────────── */}
      {editingField === 'description' ? (
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitText(onDescriptionChange)}
          onKeyDown={onKeyDown}
          maxLength={getMaxLength(constraints, 'description')}
          style={{
            ...INPUT_BASE,
            ...ALLER_LT,
            position:   'absolute',
            left:       91,
            top:        148,
            width:      1158,
            height:     701,
            fontSize:   30,
            lineHeight: 'normal',
            color:      'black',
            resize:     'none',
            overflow:   'auto',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => startEdit('description', description, !!onDescriptionChange)}
          style={{
            ...ALLER_LT,
            ...editCursor(!!onDescriptionChange),
            position:   'absolute',
            left:       91,
            top:        148,
            width:      1158,
            height:     701,
            fontSize:   30,
            lineHeight: 'normal',
            color:      'black',
            overflow:   'hidden',
          }}
        >
          <Markdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 0.5em' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
              em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
              ul: ({ children }) => <ul style={{ margin: '0 0 0.5em', paddingLeft: '1.2em' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0 0 0.5em', paddingLeft: '1.2em' }}>{children}</ol>,
              h1: ({ children }) => <strong style={{ fontSize: 36, fontWeight: 700, display: 'block', marginBottom: '0.3em' }}>{children}</strong>,
              h2: ({ children }) => <strong style={{ fontSize: 33, fontWeight: 700, display: 'block', marginBottom: '0.3em' }}>{children}</strong>,
              h3: ({ children }) => <strong style={{ fontSize: 30, fontWeight: 700, display: 'block', marginBottom: '0.3em' }}>{children}</strong>,
            }}
          >
            {description || ' '}
          </Markdown>
        </div>
      )}
    </div>
  );
};

export default HaloFlashpointRuleCard;
