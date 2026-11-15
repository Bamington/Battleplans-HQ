/**
 * TokenDefinitionForm.tsx — Edit one play-mode token for a game
 *
 * Used by Manage Games › Tracking to add and edit a game's built-in tokens
 * (token_definitions rows with deck_id = null). Controlled: the parent owns
 * the draft and decides when to save.
 *
 * Styles offered are Bar (HP-style vertical bar) and Badge (coloured circle
 * with 1–2 letters). Rows using built-in icon artwork stay editable for their
 * numbers and turn behaviour, but keep their artwork.
 *
 * USAGE:
 *   const [draft, setDraft] = useState(tokenDraftFrom(row));
 *   <TokenDefinitionForm value={draft} onChange={setDraft} />
 *   const error = tokenDraftError(draft);
 */

import { Input, Select, Checkbox, Text } from '@battleplans/ui';
import TokenBadge from './TokenBadge';
import { COLOR_SET_NAMES, paletteFromColorSet } from '../lib/tokenColorSets';
import type { TokenDefinition } from '../lib/database.types';

// ── Draft shape ──────────────────────────────────────────────────────────────

/** Editable fields of a token. Numbers are strings so inputs can be blank. */
export interface TokenDraft {
  name:                string;
  display_style:       TokenDefinition['display_style'];
  /** Card stat whose value is this token's maximum (e.g. "hp"). Blank = none. */
  stat_key:            string;
  min_value:           string;
  max_value:           string;
  starting_value:      string;
  is_toggle:           boolean;
  refresh_on_turn:     string;
  is_activation_token: boolean;
  /** Palette name (e.g. "Red"), or '' for none. */
  color_set:           string;
  display_glyph:       string;
  /** Colour columns as loaded, so an untouched colour is saved unchanged. */
  original?: { color_set: string; row_color_set: string | null; row_display_color: string | null };
}

/** Palette name whose 500 shade is this hex (how existing tokens store colour). */
const paletteNameFromHex = (hex: string | null | undefined): string | null => {
  if (!hex) return null;
  const h = hex.toLowerCase();
  return COLOR_SET_NAMES.find(n => paletteFromColorSet(n)?.active.stroke.toLowerCase() === h) ?? null;
};

export const emptyTokenDraft = (): TokenDraft => ({
  name: '', display_style: 'badge', stat_key: '',
  min_value: '0', max_value: '', starting_value: '0',
  is_toggle: false, refresh_on_turn: '0', is_activation_token: false,
  color_set: 'Blue', display_glyph: '',
});

const str = (n: number | null | undefined) => (n == null ? '' : String(n));

/** Draft from an existing row. */
export const tokenDraftFrom = (t: TokenDefinition): TokenDraft => {
  const colour = paletteFromColorSet(t.color_set)?.name ?? paletteNameFromHex(t.display_color) ?? '';
  return {
  name:                t.name,
  display_style:       t.display_style,
  stat_key:            t.stat_role === 'max' ? t.stat_key ?? '' : '',
  min_value:           str(t.min_value),
  max_value:           str(t.max_value),
  starting_value:      str(t.starting_value),
  is_toggle:           t.is_toggle,
  refresh_on_turn:     String(t.refresh_on_turn ?? 0),
  is_activation_token: t.is_activation_token,
  color_set:           colour,
  display_glyph:       t.display_glyph ?? '',
  original:            { color_set: colour, row_color_set: t.color_set, row_display_color: t.display_color },
  };
};

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** First problem with the draft, or null when it can be saved. */
export const tokenDraftError = (d: TokenDraft): string | null => {
  if (!d.name.trim()) return 'Give the token a name.';
  for (const [label, v] of [['Minimum', d.min_value], ['Maximum', d.max_value], ['Starting value', d.starting_value], ['New Turn change', d.refresh_on_turn]] as const) {
    if (v.trim() !== '' && num(v) == null) return `${label} must be a whole number.`;
  }
  const min = num(d.min_value), max = num(d.max_value), start = num(d.starting_value);
  if (min != null && max != null && min > max) return 'Minimum can’t be more than the maximum.';
  if (start != null && min != null && start < min) return 'Starting value can’t be below the minimum.';
  if (start != null && max != null && start > max) return 'Starting value can’t be above the maximum.';
  if (d.display_style === 'badge' && !d.color_set && !d.original?.row_display_color) return 'Badges need a colour.';
  return null;
};

/** Column values for an insert/update from a valid draft. */
export const tokenDraftToRow = (d: TokenDraft) => {
  const palette = paletteFromColorSet(d.color_set);
  const statKey = d.stat_key.trim() || null;
  // Untouched colour: keep the stored columns exactly. A new or changed colour
  // is stored the way existing tokens are: the palette's 500 shade as hex,
  // which both badges and bars paint from.
  const colour = d.original && d.original.color_set === d.color_set
    ? { color_set: d.original.row_color_set, display_color: d.original.row_display_color }
    : { color_set: null, display_color: palette ? palette.active.stroke : null };
  return {
    name:                d.name.trim(),
    display_style:       d.display_style,
    stat_key:            statKey,
    stat_role:           statKey ? ('max' as const) : null,
    min_value:           num(d.min_value),
    max_value:           num(d.max_value),
    starting_value:      num(d.starting_value),
    is_toggle:           d.is_toggle,
    refresh_on_turn:     num(d.refresh_on_turn) ?? 0,
    is_activation_token: d.is_activation_token,
    ...colour,
    display_glyph:       d.display_glyph.trim().slice(0, 2) || null,
  };
};

// ── Component ────────────────────────────────────────────────────────────────

export interface TokenDefinitionFormProps {
  value:     TokenDraft;
  onChange:  (next: TokenDraft) => void;
  disabled?: boolean;
  /** Card stat keys to suggest for "Maximum from card stat" (e.g. hp, wounds). */
  statKeys?: string[];
}

const STYLE_OPTIONS = [
  { value: 'bar',   label: 'Bar' },
  { value: 'badge', label: 'Badge' },
];

const TokenDefinitionForm = ({ value, onChange, disabled = false, statKeys = [] }: TokenDefinitionFormProps) => {
  const set = <K extends keyof TokenDraft>(key: K, v: TokenDraft[K]) => onChange({ ...value, [key]: v });
  const isIcon = value.display_style === 'icon' || value.display_style === 'pips';
  const palette = paletteFromColorSet(value.color_set);
  const glyph = (value.display_glyph || value.name.slice(0, 2) || '?').toUpperCase();
  const listId = statKeys.length ? 'token-stat-keys' : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Name" required value={value.name} disabled={disabled} placeholder="e.g. Damage"
          onChange={e => set('name', e.target.value)} />
        {isIcon ? (
          <Input label="Style" value="Icon (built-in artwork)" disabled helperText="Icon tokens keep their artwork." />
        ) : (
          <Select label="Style" options={STYLE_OPTIONS} value={value.display_style} disabled={disabled}
            onChange={e => set('display_style', e.target.value as TokenDraft['display_style'])} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input label="Minimum" type="number" inputMode="numeric" value={value.min_value} disabled={disabled}
          onChange={e => set('min_value', e.target.value)} />
        <Input label="Maximum" type="number" inputMode="numeric" value={value.max_value} disabled={disabled}
          placeholder="None" onChange={e => set('max_value', e.target.value)} />
        <Input label="Starting" type="number" inputMode="numeric" value={value.starting_value} disabled={disabled}
          onChange={e => set('starting_value', e.target.value)} />
      </div>

      <Input
        label="Maximum from card stat"
        value={value.stat_key}
        disabled={disabled}
        placeholder="e.g. hp"
        list={listId}
        helperText="When set, each card's value for this stat is its maximum, instead of the fixed maximum above."
        onChange={e => set('stat_key', e.target.value)}
      />
      {listId && (
        <datalist id={listId}>
          {statKeys.map(k => <option key={k} value={k} />)}
        </datalist>
      )}

      <div className="flex flex-col gap-3">
        <Checkbox label="On/off token" helperText="Tapping it switches it on or off, instead of counting up and down."
          checked={value.is_toggle} disabled={disabled} onChange={e => set('is_toggle', e.target.checked)} />
        <Checkbox label="Counts as activation" helperText="The New Turn button lights up once every unit has this token maxed."
          checked={value.is_activation_token} disabled={disabled} onChange={e => set('is_activation_token', e.target.checked)} />
        <Input label="Change each New Turn" type="number" inputMode="numeric" value={value.refresh_on_turn} disabled={disabled}
          helperText="Added on every New Turn, within min and max. Use -1 to clear a token like Activated, 0 for no change."
          onChange={e => set('refresh_on_turn', e.target.value)} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Colour"
            value={value.color_set}
            disabled={disabled}
            options={[{ value: '', label: 'None' }, ...COLOR_SET_NAMES.map(n => ({ value: n, label: n }))]}
            onChange={e => set('color_set', e.target.value)}
          />
          {value.display_style === 'badge' && (
            <Input label="Letters" value={value.display_glyph} maxLength={2} disabled={disabled}
              placeholder={value.name.slice(0, 2) || 'AB'} onChange={e => set('display_glyph', e.target.value)} />
          )}
        </div>
        <div className="flex flex-col items-center gap-1 pb-1">
          {value.display_style === 'badge' && palette ? (
            <TokenBadge color={palette.active.stroke} glyph={glyph} size={40} />
          ) : value.display_style === 'bar' ? (
            <div className="w-3 h-10 rounded-full border-2" style={{ background: palette?.active.bg ?? '#374151', borderColor: palette?.active.stroke ?? '#6b7280' }} />
          ) : (
            <div className="w-10 h-10" />
          )}
          <Text size="xs" color="secondary">Preview</Text>
        </div>
      </div>
    </div>
  );
};

export default TokenDefinitionForm;
