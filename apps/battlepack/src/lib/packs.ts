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
import type { PendingBanner } from '@battleplans/ui';

// ── Types ────────────────────────────────────────────────────────────────────

export type PackStatus = 'draft' | 'published' | 'unpublished';

/** The shape of the event, chosen once at creation. */
export type PackTimeline = 'one-day' | 'multi-day' | 'league';

/**
 * What a schedule row is.
 *
 * Rounds are play and breaks are the gaps between. An `event` is neither: it is
 * something worth flagging on the timetable in its own right — prizegiving, a
 * demo, a painting competition. Those were being typed in as breaks, which is
 * true only in the narrow sense that no game is happening, and reads as dead
 * time in a row styled to recede.
 */
export type ScheduleKind = 'round' | 'break' | 'event';

export interface Pack {
  id: string;
  name: string;
  game_id: string;
  location_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  /** What time the day begins. Anchors every schedule item's clock time. */
  starts_at: string | null;
  /** Free text for Key Info, e.g. "2000 Points, Matched Play". */
  format: string | null;
  description: string | null;
  /**
   * Object key in the `pack-banners` bucket, not a URL — resolve with
   * bannerUrl() at read time. Null means fall back to the game's artwork.
   */
  banner_path: string | null;
  /**
   * Width ÷ height of the banner, so the hero can reserve its height before the
   * image loads. Null for banners uploaded before ratios were kept, which were
   * all cropped to 3:1.
   */
  banner_aspect: number | null;
  /**
   * Chosen at creation and never null. Decides whether an end date is asked
   * for — a one-day event has none. Only 'one-day' is selectable until the
   * schedule can span dates.
   */
  timeline: PackTimeline;
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
  kind: ScheduleKind;
  label: string | null;
  /** How long it lasts. When it happens is derived, never stored. */
  duration_minutes: number;
}

/** A schedule item with the clock times worked out. */
export interface TimedScheduleItem extends ScheduleItem {
  startsAt: string;
  endsAt: string;
}

/**
 * Lay the day out from the pack's start time and each item's length.
 *
 * Derived on read rather than stored, so a reorder or a deletion cannot leave
 * the times saying one thing and the order another. Without a start time there
 * is nothing to anchor to, and the caller shows durations alone.
 */
export function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

export function timeSchedule(items: ScheduleItem[], dayStart: string | null): TimedScheduleItem[] {
  if (!dayStart) return [];
  const [h, m] = dayStart.split(':').map(Number);
  let cursor = (h || 0) * 60 + (m || 0);

  return items.map(item => {
    const startsAt = minutesToTime(cursor);
    cursor += item.duration_minutes;
    return { ...item, startsAt, endsAt: minutesToTime(cursor) };
  });
}

/** A pack plus the bits the home screen shows alongside it. */
export interface PackSummary extends Pack {
  game_name: string | null;
  /** The game's slug, which keys the shared artwork maps. */
  game_slug: string | null;
  /** `games.icon`, which is empty for most of the catalogue — a fallback only. */
  game_icon: string | null;
}

// ── Games ────────────────────────────────────────────────────────────────────

export interface GameOption {
  id: string;
  name: string;
  /** Keys the shared GAME_ICONS / GAME_BANNERS artwork maps. */
  slug: string;
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
    .select('id, name, slug, icon, image')
    .order('name');
  if (error) throw error;
  return (data ?? []) as GameOption[];
}

export interface LocationOption {
  id: string;
  name: string;
  address: string | null;
  icon?: string | null;
}

/**
 * The venues the signed-in user administers — never the whole catalogue.
 *
 * A pack belongs to the store running it, and only that store's admins can
 * create or edit one, so offering any other venue would be offering something
 * the database will refuse. The row-level policy is the real gate; this just
 * stops the picker suggesting a dead end.
 */
export async function listMyLocations(): Promise<LocationOption[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('locations')
    .select('id, name, address, icon')
    .contains('admins', [auth.user.id])
    .order('name');
  if (error) throw error;
  return (data ?? []) as LocationOption[];
}

// ── Packs ────────────────────────────────────────────────────────────────────

export async function listPacks(): Promise<PackSummary[]> {
  const { data, error } = await supabase
    .from('battlepacks')
    .select('*, games(name, slug, icon)')
    .order('starts_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(row => {
    const { games, ...pack } = row as Pack & {
      games: { name: string; slug: string; icon: string | null } | null;
    };
    return {
      ...pack,
      game_name: games?.name ?? null,
      game_slug: games?.slug ?? null,
      game_icon: games?.icon ?? null,
    };
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
export async function createPack(fields: {
  name: string;
  gameId: string;
  locationId?: string | null;
  description?: string | null;
  format?: string | null;
  /** Omitted means the column's default, 'one-day'. */
  timeline?: PackTimeline;
}): Promise<Pack> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in to create a pack.');

  const { data, error } = await supabase
    .from('battlepacks')
    .insert({
      name: fields.name.trim(),
      game_id: fields.gameId,
      location_id: fields.locationId || null,
      description: fields.description?.trim() || null,
      format: fields.format?.trim() || null,
      ...(fields.timeline ? { timeline: fields.timeline } : {}),
      owner_id: auth.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Pack;
}

/**
 * Games and venues this organiser reached for most recently, newest first.
 *
 * Derived from their own packs rather than stored as a preference: the answer
 * is already in the data, and a separate "recently used" table would be one
 * more thing to keep in step with reality. Someone who runs a monthly RTT for
 * one game at one venue should not have to search for either.
 */
export function recentIdsFrom(packs: PackSummary[]): { games: string[]; venues: string[] } {
  const byNewest = [...packs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const games  = [...new Set(byNewest.map(p => p.game_id))];
  const venues = [...new Set(byNewest.map(p => p.location_id).filter((id): id is string => !!id))];
  return { games, venues };
}

export async function updatePack(id: string, patch: Partial<Pack>): Promise<void> {
  const { error } = await supabase.from('battlepacks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePack(id: string): Promise<void> {
  const { error } = await supabase.from('battlepacks').delete().eq('id', id);
  if (error) throw error;
}

// ── Banner ───────────────────────────────────────────────────────────────────
//
// `banner_path` holds a bucket object key, not a full URL — the same convention
// as avatars / model_images / battle_images — so the public URL is resolved at
// read time and a project move needs no data migration.

const BANNER_BUCKET = 'pack-banners';

/**
 * Resolve a stored `banner_path` to a public URL. Null for a missing path, so
 * callers can fall through to the game's artwork.
 */
export function bannerUrl(path?: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a cropped banner and return its object key.
 *
 * The key is always '{pack_id}/…' because the bucket policy resolves that first
 * segment through can_edit_battlepack() — which is why the pack row has to exist
 * before this is called, and why the create flow uploads after the insert rather
 * than before it.
 *
 * A fresh filename every time rather than overwriting: it sidesteps CDN caching
 * of a stale image, and the previous object is left alone rather than
 * blind-deleted, per the project's surgical-deletes rule.
 */
export async function uploadPackBanner(packId: string, blob: Blob): Promise<string> {
  const path = `${packId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Apply a pending banner change from a picker to a pack.
 *
 * The three states mirror BannerPicker's contract exactly:
 *   undefined      → untouched, write nothing
 *   PendingBanner  → upload and point the pack at the new object
 *   null           → clear the columns and fall back to the game artwork
 *
 * Path and ratio are always written together. A path with a stale ratio is
 * worse than no banner: the hero reserves the wrong height and everything below
 * it lands in the wrong place.
 *
 * Clearing only nulls the columns; the object stays in the bucket. Removing a
 * banner is not the same as proving nothing else refers to that file, and the
 * cost of an orphan is a few hundred KB against the cost of deleting something
 * still in use.
 */
export async function savePackBanner(
  packId: string,
  pending: PendingBanner | null | undefined,
): Promise<void> {
  if (pending === undefined) return;
  if (pending === null) {
    await updatePack(packId, { banner_path: null, banner_aspect: null });
    return;
  }
  await updatePack(packId, {
    banner_path:   await uploadPackBanner(packId, pending.blob),
    banner_aspect: pending.aspect,
  });
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

/** Append a round or a break to the end of the day. */
export async function addScheduleItem(
  packId: string,
  kind: ScheduleItem['kind'],
  ordinal: number,
  label?: string,
  durationMinutes?: number,
): Promise<ScheduleItem> {
  const { data, error } = await supabase
    .from('battlepack_schedule_items')
    .insert({
      pack_id: packId,
      kind,
      ordinal,
      label: label ?? null,
      duration_minutes: durationMinutes ?? (kind === 'round' ? 120 : 10),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ScheduleItem;
}

export async function updateScheduleItem(
  id: string,
  patch: Partial<Pick<ScheduleItem, 'label' | 'duration_minutes' | 'kind'>>,
): Promise<void> {
  const { error } = await supabase.from('battlepack_schedule_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteScheduleItem(id: string): Promise<void> {
  const { error } = await supabase.from('battlepack_schedule_items').delete().eq('id', id);
  if (error) throw error;
}

export interface RoundDefaults {
  /** How many playing rounds the day has. */
  rounds: number;
  /** Minutes per round. */
  roundMinutes: number;
  /** Minutes of break between one round and the next. */
  breakMinutes: number;
}

/**
 * Turn the round defaults into an actual day: rounds with breaks between them.
 *
 * Breaks go BETWEEN rounds, so N rounds produce N-1 breaks — a trailing break
 * after the last round would be the end of the event, not a gap in it.
 *
 * No clock times here: an item knows how long it lasts, and where it lands
 * follows from the pack's start time and everything before it.
 *
 * Returned rather than written so the caller can show the day before committing
 * to it, and so this can be checked without a database.
 */
export function buildSchedule(defaults: RoundDefaults): Omit<ScheduleItem, 'id' | 'pack_id'>[] {
  const { rounds, roundMinutes, breakMinutes } = defaults;
  const items: Omit<ScheduleItem, 'id' | 'pack_id'>[] = [];

  for (let i = 0; i < rounds; i++) {
    items.push({
      ordinal: items.length,
      kind: 'round',
      label: `Round ${i + 1}`,
      duration_minutes: roundMinutes,
    });

    if (i < rounds - 1 && breakMinutes > 0) {
      items.push({
        ordinal: items.length,
        kind: 'break',
        label: 'Break',
        duration_minutes: breakMinutes,
      });
    }
  }

  return items;
}

/** Write a generated day to a pack. Used by the create flow's round defaults. */
export async function insertSchedule(
  packId: string,
  items: Omit<ScheduleItem, 'id' | 'pack_id'>[],
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase
    .from('battlepack_schedule_items')
    .insert(items.map(i => ({ ...i, pack_id: packId })));
  if (error) throw error;
}

/**
 * Renumber the whole day in one go.
 *
 * This is why `battlepack_schedule_items_pack_ordinal_key` is DEFERRABLE.
 * Moving item 3 above item 2 means two rows briefly hold the same ordinal, and
 * an immediate unique constraint would reject the batch halfway through. With
 * the check deferred to the end of the transaction, the intermediate collision
 * never matters — and PostgREST sends a multi-row upsert as one transaction, so
 * there is no shuffling through temporary ordinals.
 */
export async function reorderSchedule(items: ScheduleItem[]): Promise<void> {
  const rows = items.map((item, i) => ({
    id: item.id,
    pack_id: item.pack_id,
    kind: item.kind,
    ordinal: i,
  }));
  const { error } = await supabase
    .from('battlepack_schedule_items')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;
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
 * Publish a pack, claiming its slug the first time.
 *
 * The slug is only sent when the pack does not already have one. It is
 * immutable in the database once set, so re-publishing something that was
 * withdrawn must not try to write it again — the trigger would reject the
 * update even if the value were identical in spirit, and there is nothing to
 * gain from asking.
 *
 * Whether the pack is complete enough to publish is decided by the registry,
 * not here: the database has no idea what a required field is.
 */
export async function publishPack(pack: Pack, slug?: string): Promise<void> {
  const patch: Partial<Pack> = { status: 'published' };
  if (!pack.slug) {
    if (!slug?.trim()) throw new Error('A pack needs a URL before it can be published.');
    patch.slug = slug.trim();
  }
  await updatePack(pack.id, patch);
}

/**
 * Withdraw a published pack.
 *
 * The slug stays with it. An unpublished pack's URL serves a tombstone rather
 * than a 404, and it can never be claimed by anything else — that is what makes
 * unpublishing safe to undo.
 */
export async function unpublishPack(packId: string): Promise<void> {
  await updatePack(packId, { status: 'unpublished' });
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
