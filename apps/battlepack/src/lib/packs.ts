/**
 * packs.ts — reads and writes for BattlePack's four tables.
 *
 * Types are hand-written rather than generated: this repo has no `gen types`
 * script, and BattleCards' database.types.ts covers its own tables only.
 *
 * Everything here relies on row level security to scope results — the policies
 * already restrict a pack to its owner, platform admins and the venue's admins,
 * so these queries deliberately do NOT re-filter by user. Doing both would let
 * the two disagree, and the database is the half that cannot be bypassed.
 */

import { supabase } from '@battleplans/ui';

// ── Types ────────────────────────────────────────────────────────────────────

export type PackStatus = 'draft' | 'published' | 'unpublished';

export interface Pack {
  id: string;
  name: string;
  game_id: string;
  location_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  description: string | null;
  owner_id: string;
  status: PackStatus;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackCategoryRow {
  pack_id: string;
  category_key: string;
  hidden: boolean;
  sort_order: number | null;
  content: unknown;
}

export interface ScheduleItem {
  id: string;
  pack_id: string;
  ordinal: number;
  kind: 'round' | 'break';
  label: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** A pack plus the bits the home screen shows alongside it. */
export interface PackSummary extends Pack {
  game_name: string | null;
  game_icon: string | null;
}

// ── Games ────────────────────────────────────────────────────────────────────

export interface GameOption {
  id: string;
  name: string;
  icon: string | null;
  image: string | null;
}

/**
 * Games for the create-pack picker.
 *
 * Reads `game_catalogue`, not `games`. `games.status` is BattleCards' CONTENT
 * READINESS gate — does this game have playable card content — and it hides 112
 * real games from ordinary users. You can organise an event for a game whether
 * or not somebody has authored cards for it, so BattlePack reads past that gate
 * the same way BattlePlan does.
 */
export async function listGames(): Promise<GameOption[]> {
  const { data, error } = await supabase
    .from('game_catalogue')
    .select('id, name, icon, image')
    .order('name');
  if (error) throw error;
  return (data ?? []) as GameOption[];
}

export interface LocationOption {
  id: string;
  name: string;
  address: string | null;
}

export async function listLocations(): Promise<LocationOption[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, address')
    .order('name');
  if (error) throw error;
  return (data ?? []) as LocationOption[];
}

// ── Packs ────────────────────────────────────────────────────────────────────

export async function listPacks(): Promise<PackSummary[]> {
  const { data, error } = await supabase
    .from('battlepacks')
    .select('*, games(name, icon)')
    .order('starts_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(row => {
    const { games, ...pack } = row as Pack & { games: { name: string; icon: string | null } | null };
    return { ...pack, game_name: games?.name ?? null, game_icon: games?.icon ?? null };
  });
}

export async function getPack(id: string): Promise<Pack | null> {
  const { data, error } = await supabase
    .from('battlepacks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Pack) ?? null;
}

/**
 * Create a pack. Name and game only — everything else is filled in afterwards.
 *
 * The game is required here and nowhere else, because it is fixed at creation:
 * the mandatory category set cannot resolve without it, and allowing a change
 * later would mean reconciling game-specific categories that may already have
 * content typed into them.
 */
export async function createPack(name: string, gameId: string): Promise<Pack> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in to create a pack.');

  const { data, error } = await supabase
    .from('battlepacks')
    .insert({ name: name.trim(), game_id: gameId, owner_id: auth.user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data as Pack;
}

export async function updatePack(id: string, patch: Partial<Pack>): Promise<void> {
  const { error } = await supabase.from('battlepacks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePack(id: string): Promise<void> {
  const { error } = await supabase.from('battlepacks').delete().eq('id', id);
  if (error) throw error;
}

// ── Categories ───────────────────────────────────────────────────────────────

/**
 * The pack's category rows, keyed by category key.
 *
 * Remember these are DEVIATIONS from the registry defaults, not membership: a
 * pack with no rows at all still shows every mandatory and default category.
 */
export async function getCategoryRows(packId: string): Promise<Record<string, PackCategoryRow>> {
  const { data, error } = await supabase
    .from('battlepack_categories')
    .select('*')
    .eq('pack_id', packId);
  if (error) throw error;

  return Object.fromEntries(((data ?? []) as PackCategoryRow[]).map(r => [r.category_key, r]));
}

/** Add an optional category, or un-hide one that was removed earlier. */
export async function showCategory(packId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from('battlepack_categories')
    .upsert({ pack_id: packId, category_key: key, hidden: false }, { onConflict: 'pack_id,category_key' });
  if (error) throw error;
}

/**
 * Remove a category from the pack.
 *
 * Hidden, never deleted, and the content is retained — so re-adding brings the
 * organiser's text back rather than silently losing it.
 */
export async function hideCategory(packId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from('battlepack_categories')
    .upsert({ pack_id: packId, category_key: key, hidden: true }, { onConflict: 'pack_id,category_key' });
  if (error) throw error;
}

export async function saveCategoryContent(
  packId: string,
  key: string,
  content: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('battlepack_categories')
    .upsert({ pack_id: packId, category_key: key, hidden: false, content }, { onConflict: 'pack_id,category_key' });
  if (error) throw error;
}

// ── Schedule ─────────────────────────────────────────────────────────────────

export async function getSchedule(packId: string): Promise<ScheduleItem[]> {
  const { data, error } = await supabase
    .from('battlepack_schedule_items')
    .select('*')
    .eq('pack_id', packId)
    .order('ordinal');
  if (error) throw error;
  return (data ?? []) as ScheduleItem[];
}

// ── Slugs ────────────────────────────────────────────────────────────────────

/**
 * Whether a slug can still be claimed.
 *
 * Advisory only — two organisers publishing the same slug at the same moment
 * would both see "available" here. The primary key on battlepack_slugs is what
 * actually decides, and the loser gets an error on publish.
 */
export async function isSlugAvailable(candidate: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('battlepack_slug_available', { candidate });
  if (error) throw error;
  return data === true;
}

/**
 * Suggest slugs from the event name.
 *
 * Deliberately simple. The one cheap improvement worth having is a second
 * candidate with the venue name stripped, since a league called "Gaming Arena
 * Season 6 League" held at Gaming Arena should be able to offer
 * `season-6-league`. Anything cleverer — initialisms like `GA-6` — cannot be
 * produced reliably and generates nonsense on most names. The field is freely
 * editable, and that is what covers the rest.
 */
export function suggestSlugs(name: string, venueName?: string | null): string[] {
  const slugify = (s: string) =>
    s.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const base = slugify(name);
  const out  = base ? [base] : [];

  if (venueName) {
    const stripped = slugify(name.replace(new RegExp(venueName, 'ig'), ''));
    if (stripped && stripped !== base) out.push(stripped);
  }
  return out;
}
