// constraints.ts — fetch, cache, and apply DB-driven field constraints
//
// Constraints are fetched once per (gameSlug, entityType, addonTypeSlug?) and
// cached for the lifetime of the page.  Card components use `clampNumber` and
// `getMaxLength` to replace the old hardcoded 0–9 / unlimited logic.

import { supabase } from './supabase'
import type { EntityConstraints, FieldConstraint } from './database.types'

// ── In-memory cache ──────────────────────────────────────────────────────────

const cache = new Map<string, EntityConstraints>()

function cacheKey(
  gameSlug: string,
  entityType: string,
  addonTypeSlug?: string | null,
): string {
  return `${gameSlug}::${entityType}::${addonTypeSlug ?? '_'}`
}

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches the EntityConstraints for a given game + entity type (+ optional
 * addon type). Returns an empty object if no constraint row exists.
 *
 * Results are cached — safe to call repeatedly from components.
 */
export async function fetchConstraints(
  gameSlug: string,
  entityType: 'card' | 'addon' | 'keyword' | 'rule',
  addonTypeSlug?: string | null,
): Promise<EntityConstraints> {
  const key = cacheKey(gameSlug, entityType, addonTypeSlug)
  const cached = cache.get(key)
  if (cached) return cached

  // Build select with inner join on addon_types only when filtering by it
  const select = addonTypeSlug
    ? 'constraints, games!inner(slug), addon_types!inner(slug)'
    : 'constraints, games!inner(slug)'

  let query = supabase
    .from('game_constraints')
    .select(select)
    .eq('entity_type', entityType)
    .eq('games.slug', gameSlug)

  if (addonTypeSlug) {
    query = query.eq('addon_types.slug', addonTypeSlug)
  } else {
    query = query.is('addon_type_id', null)
  }

  const { data } = await query.limit(1).single()

  const constraints: EntityConstraints = ((data as any)?.constraints as EntityConstraints) ?? {}
  cache.set(key, constraints)
  return constraints
}

/** Clear the cache (useful if constraints are ever hot-reloaded). */
export function clearConstraintsCache(): void {
  cache.clear()
}

// ── Field helpers ────────────────────────────────────────────────────────────

/**
 * Look up the FieldConstraint for a given field key.
 * `fieldKey` follows the same convention as the DB: "name", "description", or
 * "stats.<statKey>" (e.g. "stats.ra").
 */
export function getFieldConstraint(
  constraints: EntityConstraints,
  fieldKey: string,
): FieldConstraint | undefined {
  return constraints.fields?.[fieldKey]
}

/**
 * Clamp a numeric value according to the field's min/max constraints.
 * Falls back to 0–9 if no constraint is found (preserves existing behaviour).
 */
export function clampNumber(
  value: number,
  constraints: EntityConstraints,
  statKey: string,
): number {
  const fc = getFieldConstraint(constraints, `stats.${statKey}`)
  const min = fc?.min ?? 0
  const max = fc?.max ?? 9
  return Math.max(min, Math.min(max, value))
}

/**
 * Returns the maxLength for a text field, or undefined if unconstrained.
 */
export function getMaxLength(
  constraints: EntityConstraints,
  fieldKey: string,
): number | undefined {
  return getFieldConstraint(constraints, fieldKey)?.maxLength
}

/**
 * Validate a text value against its field constraints.
 * Returns an error message string, or null if valid.
 */
export function validateTextField(
  value: string,
  constraints: EntityConstraints,
  fieldKey: string,
): string | null {
  const fc = getFieldConstraint(constraints, fieldKey)
  if (!fc) return null

  if (fc.required && !value.trim()) return 'This field is required'
  if (fc.minLength != null && value.length < fc.minLength)
    return `Must be at least ${fc.minLength} characters`
  if (fc.maxLength != null && value.length > fc.maxLength)
    return `Must be at most ${fc.maxLength} characters`
  if (fc.pattern && !new RegExp(fc.pattern).test(value))
    return 'Invalid format'

  return null
}

// ── Limit helpers ────────────────────────────────────────────────────────────

export function getMaxAddons(constraints: EntityConstraints): number | undefined {
  return constraints.limits?.maxAddons
}

export function getMaxKeywords(constraints: EntityConstraints): number | undefined {
  return constraints.limits?.maxKeywords
}

export function getMaxRules(constraints: EntityConstraints): number | undefined {
  return constraints.limits?.maxRules
}

/**
 * Returns true if adding one more item would exceed the limit.
 * Returns false if there's no limit configured.
 */
export function isAtLimit(
  currentCount: number,
  limit: number | undefined,
): boolean {
  return limit != null && currentCount >= limit
}
