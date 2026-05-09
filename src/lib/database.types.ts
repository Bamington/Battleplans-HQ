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
  deck_id:        string
  name:           string
  /** 'operative' = default game-piece layout; 'rule' = rule / ploy card. */
  card_type:      CardType
  stats:          Record<string, Json>
  sort_order:     number | null
  /** null = default layout; 'portraitFramed' = show portrait frame overlay */
  portrait_style: string | null
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
