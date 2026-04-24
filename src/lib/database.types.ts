// BattleCards — database types
// Mirrors the schema in supabase/schema.sql

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── Stat schema ───────────────────────────────────────────────────────────────

/** The field types supported in a game's or addon_type's stat_schema. */
export type StatFieldType = 'text' | 'number'

/** One entry in a stat_schema array. */
export interface StatField {
  key:   string
  label: string
  type:  StatFieldType
}

// ── Game-specific stat shapes ─────────────────────────────────────────────────

export interface BloodBowlStats {
  teamName?:           string
  playerRole?:         string
  cost?:               string
  primaryAttribute?:   string
  secondaryAttribute?: string
  ma?: number
  st?: number
  ag?: number
  pa?: number
  av?: number
}

export interface HaloFlashpointStats {
  keywords?:     string
  ra?:           number
  fi?:           number
  sv?:           number
  advanceValue?: number
  sprintValue?:  number
  ar?:           number
  hp?:           number
  pointsCost?:   number
}

/** One tier row in StarcraftStats.supplyTiers. */
export interface StarcraftSupplyTier {
  minModels: number
  maxModels: number
  supply:    number
}

export interface StarcraftStats {
  /** Scalar movement value. */
  speed?:        number
  /** Die threshold e.g. "5+". */
  evade?:        string
  /** Die threshold e.g. "5+". */
  armour?:       string
  hitPoints?:    number
  size?:         number
  /** 1–3 tier rows defining models-to-supply cost brackets. */
  supplyTiers?:  StarcraftSupplyTier[]
  /** Free-text, comma-separated (e.g. "Core, Light, Biological, Ground, Terran"). */
  tags?:         string
}

// ── Addon-specific stat shapes ────────────────────────────────────────────────

export interface BloodBowlSkillStats {
  description?: string
}

export interface HaloWeaponStats {
  type?:       string
  range?:      string
  ap?:         string
  keywords?:   string
  pointsCost?: string
}

/** Which of a Starcraft unit's phases this weapon is fired in. */
export type StarcraftWeaponPhase = 'assault' | 'combat'

export interface StarcraftWeaponStats {
  phase?:     StarcraftWeaponPhase
  /** Range — either inches ("12", "18") or "M" for melee. */
  rng?:       string
  /** Rate of Attacks. */
  roa?:       number
  /** Hit threshold e.g. "3+". */
  hit?:       string
  surgeType?: string
  /** Surge dice spec e.g. "D3". */
  sDice?:     string
  dmg?:       number
}

/** Which bucket a Starcraft rule is organised under on the card. */
export type StarcraftRulePhase = 'movement' | 'assault' | 'combat' | 'special_abilities'
export type StarcraftRuleState = 'active' | 'passive' | 'reaction'

export interface StarcraftRuleStats {
  phase?:       StarcraftRulePhase
  /** Activation state. null is valid (rule applies implicitly). */
  state?:       StarcraftRuleState | null
  /** 0–9, or null for rules that cost no command points. */
  cpCost?:      number | null
  description?: string
}

// ── Database row types ────────────────────────────────────────────────────────

export interface Profile {
  id:           string
  display_name: string | null
  avatar_url:   string | null
  created_at:   string
}

export interface Game {
  id:          string
  name:        string
  slug:        string
  stat_schema: StatField[]
  /** [width_mm, height_mm] — card dimensions for printing (no bleed) */
  print_size:  [number, number]
  /** [width_mm, height_mm] — card dimensions for printing (with bleed) */
  bleed_size:  [number, number]
  created_at:  string
}

export interface AddonType {
  id:          string
  game_id:     string
  name:        string
  slug:        string
  stat_schema: StatField[]
  created_at:  string
}

export interface Addon {
  id:            string
  user_id:       string
  addon_type_id: string
  /** Denormalised from addon_type — auto-populated by DB trigger. */
  game_id:       string
  name:          string
  description:   string | null
  stats:         Record<string, Json>
  created_at:    string
}

export interface CardAddon {
  id:         string
  card_id:    string
  addon_id:   string
  /**
   * Optional parent card_addon row on the same card. When set, this addon
   * is rendered as a child/upgrade of the parent (e.g. Starcraft weapon
   * upgrades). Root-level addons have this as null.
   */
  parent_card_addon_id: string | null
  sort_order: number | null
  created_at: string
}

export interface Deck {
  id:         string
  user_id:    string
  game_id:    string
  name:       string
  created_at: string
}

export interface Card {
  id:             string
  /** null only when is_template = true */
  deck_id:        string | null
  /** Always populated. Owner of the card (or template). */
  user_id:        string
  /** null for deck cards (derive via deck); required when is_template = true. */
  game_id:        string | null
  name:           string
  stats:          Record<string, Json>
  sort_order:     number | null
  /** null = default layout; 'portraitFramed' = show portrait frame overlay */
  portrait_style: string | null
  is_template:    boolean
  created_at:     string
}

export interface CardImage {
  id:         string
  card_id:    string
  file_path:  string
  /** 'portrait' = card image, 'avatar' = square thumbnail for lists */
  image_type: string
  sort_order: number
  created_at: string
}

export interface Keyword {
  id:            string
  user_id:       string
  game_id:       string
  name:          string
  description:   string | null
  /** Defines the parameters this keyword accepts (e.g. X in "Weight of Fire (X)"). */
  params_schema: StatField[]
  /** Arbitrary game-specific metadata on the keyword itself. */
  extra:         Record<string, Json>
  created_at:    string
}

export interface CardKeyword {
  id:          string
  card_id:     string
  keyword_id:  string
  /** Instance parameter values, e.g. { X: 3 }. */
  params:      Record<string, Json>
  sort_order:  number | null
  created_at:  string
}

export interface AddonKeyword {
  id:          string
  addon_id:    string
  keyword_id:  string
  /** Instance parameter values, e.g. { X: 2 }. */
  params:      Record<string, Json>
  sort_order:  number | null
  created_at:  string
}

// ── Token types ─────────────────────────────────────────────────────────────

/** How a linked keyword param or stat value affects a token. */
export type TokenValueRole = 'max' | 'min' | 'starting'

export interface TokenDefinition {
  id:                  string
  game_id:             string
  name:                string
  description:         string | null
  icon:                string | null
  icon_off:            string | null
  is_toggle:           boolean
  keyword_name:        string | null
  keyword_value_role:  TokenValueRole | null
  stat_key:            string | null
  stat_role:           TokenValueRole | null
  starting_value:      number | null
  min_value:           number | null
  max_value:           number | null
  /** Net change applied each New Turn: +N adds up to max, -N removes down to min. 0 = no refresh. */
  refresh_on_turn:     number
  /** True if this token represents unit activation — drives the "New Turn" button styling. */
  is_activation_token: boolean
  sort_order:          number | null
  created_at:          string
}

// ── Rule types ───────────────────────────────────────────────────────────────

export interface Rule {
  id:          string
  user_id:     string
  game_id:     string
  title:       string
  description: string | null
  created_at:  string
}

export interface DeckRule {
  id:          string
  deck_id:     string
  rule_id:     string
  sort_order:  number | null
  created_at:  string
}

// ── Constraint types ─────────────────────────────────────────────────────────

/** Validation rules for a single field (stat or direct column). */
export interface FieldConstraint {
  required?:  boolean
  min?:       number
  max?:       number
  minLength?: number
  maxLength?: number
  /** Regex pattern the value must match. */
  pattern?:   string
}

/** Full constraint payload stored in game_constraints.constraints JSONB. */
export interface EntityConstraints {
  /** Per-field rules. Keys are column names ("name") or "stats.<key>". */
  fields?: Record<string, FieldConstraint>
  limits?: {
    maxAddons?:   number
    maxKeywords?: number
    maxRules?:    number
  }
}

export interface GameConstraint {
  id:            string
  game_id:       string
  entity_type:   'card' | 'addon' | 'keyword' | 'rule'
  addon_type_id: string | null
  constraints:   EntityConstraints
  created_at:    string
}

// ── Join types (common query shapes) ─────────────────────────────────────────

export interface DeckWithGame extends Deck {
  game: Game
}

export interface CardWithDeck extends Card {
  deck: Deck
}

export interface AddonWithType extends Addon {
  addon_type: AddonType
}

export interface CardWithAddons extends Card {
  addons: AddonWithType[]
}

export interface CardKeywordWithKeyword extends CardKeyword {
  keyword: Keyword
}

export interface AddonKeywordWithKeyword extends AddonKeyword {
  keyword: Keyword
}

export interface DeckRuleWithRule extends DeckRule {
  rule: Rule
}
