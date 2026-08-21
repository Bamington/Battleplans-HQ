/**
 * loadPrintableDeck.ts — load a whole deck, per game, into renderable shapes
 *
 * Every screen that shows a deck it isn't editing needs the same thing: each
 * card with its addons, keywords and images resolved, in deck order, mapped
 * into the Printable* shapes the card components take. That logic used to live
 * inside PrintDeck; it now lives here so the shared-deck view can reuse it
 * rather than grow a second copy that drifts.
 *
 * WHY THE SUPABASE CLIENT IS A PARAMETER
 * A deck opened from a share link belongs to someone else, and is readable only
 * through a client carrying the share token (see shareClient.ts). Taking the
 * client as an argument is what lets the exact same queries serve both the
 * owner's print preview and a stranger's read-only view.
 *
 * Only the four games with finished card layouts are supported —
 * blood-bowl, halo-flashpoint, kill-team and ryg — matching what PrintDeck has
 * always handled. Anything else comes back as an unsupported result.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PrintableBloodBowlCard,
  PrintableHaloCard,
  PrintableKillTeamCard,
  PrintableKillTeamRule,
  PrintableRule,
  PrintableRygCard,
  PrintableRygSept,
  PrintableRygGod,
} from '../components/PrintCardGrid';
import type { RygWeapon, RygArmor, RygItem, RygSpell } from '../components/RygCard';
import type {
  BloodBowlStats,
  HaloFlashpointStats,
  KillTeamStats,
  RygSeptStats,
  RygDestinyStats,
  RygGodStats,
} from './database.types';

// ── Games with a finished card layout ────────────────────────────────────────

export const SUPPORTED_PRINT_GAMES = [
  'blood-bowl', 'halo-flashpoint', 'kill-team', 'ryg',
] as const;

export type SupportedGameSlug = typeof SUPPORTED_PRINT_GAMES[number];

export const isSupportedGame = (slug: string): slug is SupportedGameSlug =>
  (SUPPORTED_PRINT_GAMES as readonly string[]).includes(slug);

// ── Keyword display helper ───────────────────────────────────────────────────

interface LocalKeywordAttachment {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

const buildKeywordsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws
    .map(k => k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName)
    .join(', ');

// ── Per-game print-size fallbacks ────────────────────────────────────────────
//
// `print_size` and `bleed_size` are stored on the `games` table as JSONB
// arrays in mm. If those columns are empty/missing (e.g. the DB seed pre-dates
// the print_size migration, or the kill-team game row was inserted with an
// older `migration_kill_team.sql` that didn't include them), the layout slot
// collapses to 0×0 and the preview goes blank. We hardcode the canonical
// dimensions here so the page works even when the DB hasn't caught up.
//
// Keep these in sync with `schema.sql` + the per-game `migration_*.sql`.
const GAME_PRINT_FALLBACKS: Record<string, { print: [number, number]; bleed: [number, number] }> = {
  'blood-bowl':      { print: [63,  88], bleed: [69,  94] },
  'halo-flashpoint': { print: [127, 89], bleed: [133, 95] },
  'kill-team':       { print: [127, 89], bleed: [133, 95] },
  'ryg':             { print: [63,  89], bleed: [69,  95] },
};

/** Pick a valid [w, h] mm pair: prefer DB value, fall back to the per-game
 *  canonical size. Logs a warning when the DB value looks unusable so the
 *  underlying schema gap is visible in dev tools. */
const resolvePrintDim = (
  fromDb:      unknown,
  fallback:    [number, number],
  label:       string,
  slug:        string,
): [number, number] => {
  if (Array.isArray(fromDb) && fromDb.length === 2 &&
      typeof fromDb[0] === 'number' && typeof fromDb[1] === 'number' &&
      fromDb[0] > 0 && fromDb[1] > 0) {
    return [fromDb[0], fromDb[1]];
  }
  console.warn(
    `[BattleCards] games.${label} missing or invalid for slug="${slug}"; ` +
    `falling back to ${fallback.join('×')} mm. Run the print_size migration ` +
    `or update the kill-team game row to fix this permanently.`
  );
  return fallback;
};

// ── Blood Bowl loader ────────────────────────────────────────────────────
async function loadBloodBowlCards(client: SupabaseClient, deckId: string) {
    type CardKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: BloodBowlStats;
      card_keywords: CardKeywordRow[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
    };

    const { data, error } = await client
      .from('cards')
      .select('id, name, stats, card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)), card_images(file_path, sort_order, image_type)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    const cards = (data as unknown as CardRow[]).map(row => {
      const s = row.stats ?? {};
      const sortedKws = [...(row.card_keywords ?? [])]
        .filter(ck => ck.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const kws: LocalKeywordAttachment[] = sortedKws.map(ck => ({
        keywordId: ck.keyword_id,
        keywordName: ck.keywords!.name,
        description: ck.keywords!.description ?? '',
        hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
        paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
      }));

      const allImages = row.card_images ?? [];
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg = allImages.find(i => i.image_type === 'avatar');
      let portraitUrl: string | null = null;
      if (portraitImg) {
        portraitUrl = client.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl;
      }
      let avatarUrl: string | null = null;
      if (avatarImg) {
        avatarUrl = client.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl;
      }

      return {
        id: row.id,
        teamName: s.teamName ?? '',
        unitName: row.name,
        playerRole: s.playerRole ?? '',
        cost: s.cost ?? '',
        skills: buildKeywordsDisplayString(kws),
        primaryAttribute: s.primaryAttribute ?? '',
        secondaryAttribute: s.secondaryAttribute ?? '',
        ma: s.ma ?? 0,
        st: s.st ?? 0,
        ag: s.ag ?? 0,
        pa: s.pa ?? 0,
        av: s.av ?? 0,
        portraitUrl,
        avatarUrl,
      } as PrintableBloodBowlCard;
    });

    return cards;
}

// ── Halo Flashpoint card loader ──────────────────────────────────────────
async function loadHaloCards(client: SupabaseClient, deckId: string) {
    type AddonKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: HaloFlashpointStats; portrait_style: string | null;
      card_addons: { addon_id: string; sort_order: number | null; addons: { name: string; stats: Record<string, unknown>; addon_keywords: AddonKeywordRow[] } | null }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
      card_keywords: AddonKeywordRow[];
    };

    const { data, error } = await client
      .from('cards')
      .select('id, name, stats, portrait_style, card_addons(addon_id, sort_order, addons(name, stats, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    const cards = (data as unknown as CardRow[]).map(row => {
      const s = row.stats ?? {};
      const sortedAddons = [...(row.card_addons ?? [])]
        .filter(ca => ca.addons != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const allImages = (row.card_images ?? []);
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg = allImages.find(i => i.image_type === 'avatar');
      let portraitUrl: string | null = null;
      if (portraitImg) {
        portraitUrl = client.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl;
      }
      let avatarUrl: string | null = null;
      if (avatarImg) {
        avatarUrl = client.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl;
      }

      const sortedCardKeywords = [...(row.card_keywords ?? [])]
        .filter(ck => ck.keywords != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const unitKws: LocalKeywordAttachment[] = sortedCardKeywords.map(ck => ({
        keywordId: ck.keyword_id,
        keywordName: ck.keywords!.name,
        description: ck.keywords!.description ?? '',
        hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
        paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
      }));

      return {
        id: row.id,
        unitName: row.name,
        keywords: buildKeywordsDisplayString(unitKws) || (s.keywords ?? ''),
        ra: s.ra ?? 0,
        fi: s.fi ?? 0,
        sv: s.sv ?? 0,
        advanceValue: s.advanceValue ?? 0,
        sprintValue: s.sprintValue ?? 0,
        ar: s.ar ?? 0,
        hp: s.hp ?? 0,
        pointsCost: s.pointsCost ?? 0,
        portraitUrl,
        portraitStyle: row.portrait_style ?? null,
        avatarUrl,
        weapons: sortedAddons.map(ca => {
          const ws = ca.addons!.stats;
          const addonKws = [...(ca.addons!.addon_keywords ?? [])]
            .filter(ak => ak.keywords != null)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const wkws: LocalKeywordAttachment[] = addonKws.map(ak => ({
            keywordId: ak.keyword_id,
            keywordName: ak.keywords!.name,
            description: ak.keywords!.description ?? '',
            hasParams: Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
            paramValue: ak.params?.X != null ? Number(ak.params.X) : null,
          }));
          return {
            name: ca.addons!.name,
            type: String(ws.type ?? ''),
            range: String(ws.range ?? ''),
            ap: String(ws.ap ?? ''),
            keywords: buildKeywordsDisplayString(wkws) || String(ws.keywords ?? ''),
          };
        }),
      } as PrintableHaloCard;
    });

    return cards;
}

// ── Halo rules loader ────────────────────────────────────────────────────
async function loadHaloRules(client: SupabaseClient, deckId: string) {
    const { data, error } = await client
      .from('deck_rules')
      .select('id, rule_id, sort_order, rules(id, title, description)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true });

    if (error || !data) return [];

    type DeckRuleRow = { rules: { id: string; title: string; description: string | null } | null };

    const loaded: PrintableRule[] = (data as unknown as DeckRuleRow[])
      .filter(dr => dr.rules != null)
      .map(dr => ({
        id: dr.rules!.id,
        title: dr.rules!.title,
        description: dr.rules!.description ?? '',
      }));

    return loaded;
}

// ── Kill Team loader ─────────────────────────────────────────────────────
  // Pulls operative cards (card_type='operative') AND rule cards
  // (card_type='rule') in one go so the print sheet can render both.
async function loadKillTeamCards(client: SupabaseClient, deckId: string) {
    type AddonKwRow = {
      keyword_id: string;
      params: Record<string, unknown>;
      sort_order: number | null;
      keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
    };
    type CardRow = {
      id: string; name: string; card_type: 'operative' | 'rule' | null;
      stats: KillTeamStats & { description?: string };
      card_addons: {
        addon_id: string;
        sort_order: number | null;
        addons: {
          name: string;
          description: string | null;
          stats: Record<string, unknown>;
          addon_type_id: string;
          addon_keywords: AddonKwRow[];
        } | null;
      }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
    };

    // Resolve addon-type-id → slug so we can split card_addons into weapons
    // vs abilities the same way CardBuilderKillTeam does.
    const { data: addonTypes } = await client
      .from('addon_types')
      .select('id, slug, games!inner(slug)')
      .eq('games.slug', 'kill-team');
    const typeIdToSlug: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });

    const { data, error } = await client
      .from('cards')
      .select('id, name, card_type, stats, card_addons(addon_id, sort_order, addons(name, description, stats, addon_type_id, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return { operatives: [], ruleCards: [] };

    const num = (v: unknown): number => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      const n = parseInt(String(v ?? ''), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const formatHit = (h: unknown): string => {
      const n = num(h);
      return n > 0 ? `${n}+` : '—';
    };
    const formatDamage = (s: Record<string, unknown>): string => {
      const base = num(s.baseDamage);
      const crit = num(s.critDamage);
      if (base > 0 || crit > 0) return `${base}/${crit}`;
      const raw = String(s.damage ?? '');
      return raw || '—';
    };

    const operatives: PrintableKillTeamCard[] = [];
    const ruleCards:  PrintableKillTeamRule[] = [];

    for (const row of (data as unknown as CardRow[])) {
      const s = row.stats ?? {};
      const sortedAddons = [...(row.card_addons ?? [])]
        .filter(ca => ca.addons != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const allImages = row.card_images ?? [];
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg   = allImages.find(i => i.image_type === 'avatar');
      const portraitUrl = portraitImg
        ? client.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl
        : null;
      const avatarUrl = avatarImg
        ? client.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl
        : null;

      type Weapon = NonNullable<PrintableKillTeamCard['weapons']>[number];
      type Ability = NonNullable<PrintableKillTeamCard['abilities']>[number];
      const weapons:   Weapon[]  = [];
      const abilities: Ability[] = [];

      for (const ca of sortedAddons) {
        const addon = ca.addons!;
        const slug = typeIdToSlug[addon.addon_type_id];
        const ws = addon.stats;
        const addonKws = [...(addon.addon_keywords ?? [])]
          .filter(ak => ak.keywords != null)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        if (slug === 'weapons') {
          const mr = ws.meleeOrRanged === 'melee' || ws.meleeOrRanged === 'ranged' ? ws.meleeOrRanged : '';
          const kwList = addonKws.map(ak => ({
            label:       ak.params?.X != null ? `${ak.keywords!.name} (${ak.params.X})` : ak.keywords!.name,
            name:        ak.keywords!.name,
            description: ak.keywords!.description ?? '',
          }));
          weapons.push({
            name:          addon.name,
            meleeOrRanged: mr as 'melee' | 'ranged' | '',
            attack:        num(ws.attack),
            hit:           formatHit(ws.hit),
            damage:        formatDamage(ws),
            keywords:      kwList.map(k => k.label).join(', '),
            keywordData:   kwList,
          });
        } else if (slug === 'abilities') {
          abilities.push({
            name:        addon.name,
            description: addon.description ?? '',
            apCost:      num(ws.apCost),
            keywords:    '',
          });
        }
      }

      if (row.card_type === 'rule') {
        // Rule cards take at most one ability (matches the builder)
        ruleCards.push({
          id:          row.id,
          title:       row.name,
          description: s.description ?? '',
          ability:     abilities[0] ?? null,
        });
      } else {
        operatives.push({
          id:            row.id,
          operativeName: row.name,
          role:          s.role     ?? '',
          teamName:      s.teamName ?? '',
          tags:          s.tags     ?? '',
          actions:       num(s.actions),
          movement:      num(s.movement),
          save:          num(s.save),
          wounds:        num(s.wounds),
          baseSize:      num(s.baseSize),
          weapons,
          abilities,
          portraitUrl,
          avatarUrl,
        });
      }
    }

    return { operatives, ruleCards };
}

// ── RYG loader ───────────────────────────────────────────────────────────
async function loadRygCards(client: SupabaseClient, deckId: string) {
    // Build typeIdToSlug for 'ryg' addon types
    const { data: addonTypes } = await client
      .from('addon_types')
      .select('id, slug, games!inner(slug)')
      .eq('games.slug', 'ryg');
    const typeIdToSlug: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addonTypes as any[] | null)?.forEach(t => { typeIdToSlug[t.id] = t.slug; });

    type CardRow = {
      id: string;
      name: string;
      card_type: string | null;
      stats: Record<string, unknown>;
      card_addons: {
        addon_id: string;
        sort_order: number | null;
        params: Record<string, unknown> | null;
        addons: {
          name: string;
          description: string | null;
          stats: Record<string, unknown>;
          addon_type_id: string;
        } | null;
      }[];
      card_images: { file_path: string; image_type: string }[];
    };

    const { data, error } = await client
      .from('cards')
      .select('id, name, card_type, stats, card_addons(addon_id, sort_order, params, addons(name, description, stats, addon_type_id)), card_images(file_path, image_type)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return { warriors: [], septCard: null, godCard: null };

    const warriors: PrintableRygCard[] = [];
    let septCard: PrintableRygSept | null = null;
    let godCard: PrintableRygGod | null = null;

    for (const row of (data as unknown as CardRow[])) {
      const s = row.stats ?? {};
      const sortedAddons = [...(row.card_addons ?? [])]
        .filter(ca => ca.addons != null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const allImages = row.card_images ?? [];
      const portraitImg = allImages.find(i => i.image_type === 'portrait');
      const avatarImg   = allImages.find(i => i.image_type === 'avatar');
      const portraitUrl = portraitImg
        ? client.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl
        : null;
      const avatarUrl = avatarImg
        ? client.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl
        : null;

      if (row.card_type === 'sept') {
        // Sept card: find septs, destinies, sept-benefits addons
        const septAddon    = sortedAddons.find(ca => typeIdToSlug[ca.addons!.addon_type_id] === 'septs');
        const destinyAddon = sortedAddons.find(ca => typeIdToSlug[ca.addons!.addon_type_id] === 'destinies');
        const benefits     = sortedAddons.filter(ca => typeIdToSlug[ca.addons!.addon_type_id] === 'sept-benefits');

        const septStats   = (septAddon?.addons?.stats ?? {}) as RygSeptStats;
        const destStats   = (destinyAddon?.addons?.stats ?? {}) as RygDestinyStats;

        septCard = {
          id:           row.id,
          septName:     septAddon?.addons?.name ?? row.name,
          prohibited:   septStats.prohibited   ?? '',
          required:     septStats.required     ?? '',
          restricted:   septStats.restricted   ?? '',
          benefits:     benefits.map(ca => ({
            name:        ca.addons!.name,
            description: String((ca.addons!.stats as { description?: string }).description ?? ''),
          })),
          destinyName:  destinyAddon?.addons?.name ?? '',
          destinyDesc:  destStats.description ?? '',
          destinyCurse: destStats.curse       ?? '',
        };
      } else if (row.card_type === 'god') {
        const godAddon = sortedAddons.find(ca => typeIdToSlug[ca.addons!.addon_type_id] === 'gods');
        const godStats = (godAddon?.addons?.stats ?? {}) as RygGodStats;
        godCard = {
          id:             row.id,
          godName:        godAddon?.addons?.name ?? row.name,
          specialAbility: godStats.specialAbility ?? '',
          minions:        godStats.minions        ?? '',
          servants:       godStats.servants       ?? '',
          lieutenants:    godStats.lieutenants    ?? '',
          champions:      godStats.champions      ?? '',
        };
      } else {
        // Warrior card (card_type='operative')
        const weapons:   RygWeapon[]  = [];
        const armor:     RygArmor[]   = [];
        const items:     RygItem[]    = [];
        const spells:    RygSpell[]   = [];
        const talentList: PrintableRygCard['talentList'] = [];

        for (const ca of sortedAddons) {
          const slug = typeIdToSlug[ca.addons!.addon_type_id];
          const ws = ca.addons!.stats as Record<string, unknown>;
          const name = ca.addons!.name;

          if (slug === 'weapons') {
            weapons.push({
              id:       ca.addon_id,
              name,
              damage:   String(ws.damage ?? ''),
              range:    typeof ws.range === 'number' ? ws.range : 0,
              cost:     typeof ws.cost  === 'number' ? ws.cost  : 0,
              keywords: '',
            });
          } else if (slug === 'armor') {
            armor.push({
              id:          ca.addon_id,
              name,
              cost:        typeof ws.cost === 'number' ? ws.cost : 0,
              description: ca.addons!.description ?? '',
            });
          } else if (slug === 'items') {
            items.push({ id: ca.addon_id, name, cost: typeof ws.cost === 'number' ? ws.cost : 0, description: ca.addons!.description ?? '' });
          } else if (slug === 'spells') {
            const ss = ws as { type?: string; fateModifier?: string };
            spells.push({ id: ca.addon_id, name, spellType: ss.type ?? '', fateModifier: ss.fateModifier ?? '', description: ca.addons!.description ?? '' });
          } else if (slug === 'talents') {
            const params = (ca.params ?? {}) as Record<string, string[]>;
            const vals: string[] = [];
            Object.values(params).forEach(v => { if (Array.isArray(v)) vals.push(...v); });
            const displayName = vals.length ? `${name} (${vals.join(', ')})` : name;
            talentList.push({
              addonId:     ca.addon_id,
              name,
              description: ca.addons!.description ?? '',
              displayName,
            });
          }
        }

        const talents = talentList.map(t => t.displayName).join(', ');
        const warriorTypAddon = sortedAddons.find(ca => typeIdToSlug[ca.addons!.addon_type_id] === 'warrior-type');
        const wtStats = (warriorTypAddon?.addons?.stats ?? {}) as { offense?: number; defense?: number; life?: number; tactics?: number; fate?: number };

        warriors.push({
          id:               row.id,
          warriorName:      row.name,
          type:             warriorTypAddon?.addons?.name ?? '',
          sept:             String(s.sept ?? ''),
          offense:          typeof s.offense === 'number' ? s.offense : (wtStats.offense ?? 0),
          defense:          typeof s.defense === 'number' ? s.defense : (wtStats.defense ?? 0),
          life:             typeof s.life    === 'number' ? s.life    : (wtStats.life    ?? 0),
          tactics:          typeof s.tactics === 'number' ? s.tactics : (wtStats.tactics ?? 0),
          fate:             typeof s.fate    === 'number' ? s.fate    : (wtStats.fate    ?? 0),
          talents,
          talentList,
          specialAbilityDesc: String(s.specialAbilityDesc ?? ''),
          weapons,
          armor,
          items,
          spells,
          portrait:   portraitUrl,
          avatarUrl,
        });
      }
    }

    return { warriors, septCard, godCard };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/** Everything a deck view needs, whatever the game. The per-game arrays are
 *  empty for games they don't apply to, which is what PrintCardGrid expects. */
export interface PrintableDeck {
  deckName:       string;
  gameSlug:       SupportedGameSlug;
  printSize:      [number, number];
  bleedSize:      [number, number];
  bloodBowlCards: PrintableBloodBowlCard[];
  haloCards:      PrintableHaloCard[];
  rules:          PrintableRule[];
  killTeamCards:  PrintableKillTeamCard[];
  killTeamRules:  PrintableKillTeamRule[];
  rygCards:       PrintableRygCard[];
  rygSeptCard:    PrintableRygSept | null;
  rygGodCard:     PrintableRygGod | null;
}

export type LoadDeckResult =
  | { ok: true;  deck: PrintableDeck }
  | { ok: false; error: string };

const EMPTY = {
  bloodBowlCards: [] as PrintableBloodBowlCard[],
  haloCards:      [] as PrintableHaloCard[],
  rules:          [] as PrintableRule[],
  killTeamCards:  [] as PrintableKillTeamCard[],
  killTeamRules:  [] as PrintableKillTeamRule[],
  rygCards:       [] as PrintableRygCard[],
  rygSeptCard:    null as PrintableRygSept | null,
  rygGodCard:     null as PrintableRygGod | null,
};

/**
 * Load a deck and everything on its cards.
 *
 * `client` decides what's visible: the app's normal client for a deck the
 * signed-in user owns, or a share-token client for one opened from a link.
 * `deckId` must be a deck that client can actually see — for a share link,
 * resolve it from the token first (loadSharedDeckMeta).
 */
export async function loadPrintableDeck(
  client: SupabaseClient,
  deckId: string,
): Promise<LoadDeckResult> {
  const { data: deck, error: deckErr } = await client
    .from('decks')
    .select('name, game_id, games(slug, print_size, bleed_size)')
    .eq('id', deckId)
    .single();

  if (deckErr || !deck) return { ok: false, error: 'Failed to load deck.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const game = (deck as any).games;
  const slug = game?.slug as string;

  if (!isSupportedGame(slug)) {
    return { ok: false, error: `Unsupported game: ${slug}` };
  }

  const fb = GAME_PRINT_FALLBACKS[slug];
  const base = {
    ...EMPTY,
    deckName:  deck.name as string,
    gameSlug:  slug,
    printSize: resolvePrintDim(game?.print_size, fb.print, 'print_size', slug),
    bleedSize: resolvePrintDim(game?.bleed_size, fb.bleed, 'bleed_size', slug),
  };

  if (slug === 'blood-bowl') {
    return { ok: true, deck: { ...base, bloodBowlCards: await loadBloodBowlCards(client, deckId) } };
  }

  if (slug === 'kill-team') {
    const { operatives, ruleCards } = await loadKillTeamCards(client, deckId);
    return { ok: true, deck: { ...base, killTeamCards: operatives, killTeamRules: ruleCards } };
  }

  if (slug === 'ryg') {
    const { warriors, septCard, godCard } = await loadRygCards(client, deckId);
    return { ok: true, deck: { ...base, rygCards: warriors, rygSeptCard: septCard, rygGodCard: godCard } };
  }

  const [haloCards, rules] = await Promise.all([
    loadHaloCards(client, deckId),
    loadHaloRules(client, deckId),
  ]);
  return { ok: true, deck: { ...base, haloCards, rules } };
}
