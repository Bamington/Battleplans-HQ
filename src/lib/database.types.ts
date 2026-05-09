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

export interface KillTeamStats {
  role?:     string
  teamName?: string
  tags?:     string
  actions?:  number
  movement?: number
  save?:     number
  wounds?:   number
  /** Base size in millimetres (e.g. 25, 32, 40). Rendered in the
   *  bottom-right corner of the operative card. */
  baseSize?: number
}

/**
 * One tier row in StarcraftStats.supplyTiers.
 *
 * Storage carries only `maxModels` and `supply` per tier — the *minimum*
 * model count and the validation lower-bound for `supply` are derived
 * from the previous tier:
 *   • Tier 0: model range starts at 1, supply min = 0
 *   • Tier N: model range starts at (tiers[N-1].maxModels + 1),
 *             supply min = (tiers[N-1].supply + 1)
 */
export interface StarcraftSupplyTier {
  /** Inclusive upper bound of the tier's model range. */
  maxModels: number
  /** Supply cost paid to field a unit of this tier's size. */
  supply:    number
}

export interface StarcraftStats {
  /**
   * Optional specific name for a named / hero unit (e.g. "Jim Raynor").
   * The required *Unit Type* (e.g. "Marines") lives on `cards.name`, not in stats.
   */
  unitName?:     string
  /** Scalar movement value. */
  speed?:        number
  /** Die threshold base value — the card renders as "{evade}+". */
  evade?:        number
  /** Die threshold base value — the card renders as "{armour}+". */
  armour?:       number
  hitPoints?:    number
  size?:         number
  /** Total point cost of the unit including weapons and upgrades. */
  pointsCost?:   number
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

export interface KillTeamWeaponStats {
  meleeOrRanged?: 'melee' | 'ranged' | ''
  attack?:        number
  hit?:           number
  baseDamage?:    number
  critDamage?:    number
}

export interface KillTeamAbilityStats {
  apCost?: number
}

/**
 * Turn phase — where the addon (weapon or ability) lives on the card.
 * The card body groups items into headed sections by this value.
 * `null` ≡ "None" / unassigned.
 */
export type StarcraftPhase = 'movement' | 'assault' | 'combat' | 'special_abilities'

/**
 * Activation timing — the coloured chip (Active / Passive / Reaction)
 * rendered next to an addon's name. Independent of turn phase: an addon
 * can have any combination of phase and timing, both optional in storage.
 */
export type StarcraftTiming = 'active' | 'passive' | 'reaction'

export interface StarcraftWeaponStats {
  phase?:     StarcraftPhase | null
  timing?:    StarcraftTiming | null
  /** Range in inches. Melee weapons store 0. */
  range?:     number
  /** Rate of Attacks. */
  roa?:       number
  /** Hit target value. Card renders as "{n}+". */
  hit?:       number
  /** Damage. */
  dmg?:       number
  surgeType?: string
  /** Surge dice spec — free text so values like "D3+1" are valid. */
  sDice?:     string
}

export interface StarcraftRuleStats {
  phase?:       StarcraftPhase | null
  timing?:      StarcraftTiming | null
  /**
   * Resource cost (CP / BM / Energy depending on faction). The label is
   * faction-dependent; the schema only stores the number.
   */
  cpCost?:      number | null
  description?: string
  /** True when this ability is itself an upgrade (gates upgradeCost UI). */
  isUpgrade?:   boolean
  /** Mineral cost for upgrade abilities. 0 / undefined when not an upgrade. */
  upgradeCost?: number | null
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
  /**
   * Optional parent addon — when set, this addon is rendered as an indented
   * upgrade row under its parent on every card it's attached to. Same-game
   * constraint enforced by trigger; one level of nesting (no
   * grandchildren) enforced by the UI.
   */
  parent_addon_id: string | null
  created_at:    string
}

export interface CardAddon {
  id:         string
  card_id:    string
  addon_id:   string
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

/** Layout discriminator for a card row. */
export type CardType = 'operative' | 'rule'

export interface Card {
  id:             string
  /** null only when is_template = true */
  deck_id:        string | null
  /** Always populated. Owner of the card (or template). */
  user_id:        string
  /** null for deck cards (derive via deck); required when is_template = true. */
  game_id:        string | null
  name:           string
  /** 'operative' = default game-piece layout; 'rule' = rule / ploy card. */
  card_type:      CardType
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
