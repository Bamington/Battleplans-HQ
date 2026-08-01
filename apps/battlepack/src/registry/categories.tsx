/**
 * categories.tsx — CATEGORY_REGISTRY, the catalogue a pack is built from.
 *
 * A pack is assembled from categories. Each one is a section of the document,
 * an entry in the left nav, and a form in the right panel. Organisers draw from
 * this fixed catalogue and cannot define their own — the middle path between a
 * rigid schema and a page builder, and what lets every category have a bespoke
 * form with hand-written helper copy.
 *
 * WHY THIS IS TYPESCRIPT AND NOT A DATABASE TABLE
 * A database catalogue would only pay off with a generic form renderer driven
 * by a stored field schema, and that is explicitly not wanted: Event Basics has
 * hand-written hint text under each field, Rounds & Breaks is an ordered list of
 * typed rows. A form component per category is being written either way, so a
 * table would be a second source of truth to keep in sync — and adding a
 * category would need a migration AND a deploy instead of just a deploy.
 *
 * Move it into the database only if organisers ever need to define their own
 * categories. That is a long way off.
 *
 * TWO INDEPENDENT AXES
 * Categories vary by SCOPE (universal vs game-specific) and by REQUIREMENT
 * (mandatory / default / optional). Those are separate attributes on one
 * registry rather than three separate mechanisms, because the tiers differed
 * only along those two axes.
 *
 * `requirement` is three-valued on purpose. "Always present" and "present
 * unless removed" are genuinely different: Registration wants to exist on every
 * new pack but still be removable for a walk-up event; the event's name does
 * not. Mandatory is the tier that cannot be hidden, which is what stops a
 * half-completed category being hidden out of the publish check.
 *
 * MANDATORY MEANS SOMETHING DIFFERENT PER LEVEL
 * A category is mandatory (it cannot be removed from the pack). A FIELD inside
 * a category is required (it must be filled in for the category to count as
 * complete). "Event Basics" is a mandatory category; the event's name is a
 * required field within it. Do not let those two words merge.
 */

import type { ComponentType, ReactNode } from 'react';
import {
  Bookmark, Clipboard, FileText, Folder, InfoCircle, ListCheck,
  Notebook, QuestionCircle, Star, UserPlusRounded,
} from '@battleplans/ui';
import type { GameOption, LocationOption, Pack, PackCategoryRow, ScheduleItem } from '../lib/packs';
import SectionForm from '../components/forms/SectionForm';
import ChecklistSectionForm, { readChecklist } from '../components/forms/ChecklistSectionForm';
import FaqSectionForm, { readFaq } from '../components/forms/FaqSectionForm';
import TitledListForm, { readTitledList, titledListFilled } from '../components/forms/TitledListForm';
import EventBasicsForm from '../components/forms/EventBasicsForm';
import RoundsBreaksForm from '../components/forms/RoundsBreaksForm';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Which centre tab a category renders under.
 *
 * The design has a left nav (Event Basics / Event Timeline / Rounds & Breaks)
 * and a centre button group (Event Format / Registration / FAQ). Those are
 * different axes and were never going to line up on their own. Each registry
 * entry naming its own tab settles it: clicking a category switches the centre
 * tab if it needs to, then scrolls.
 */
export type CategoryTab = 'format' | 'registration' | 'faq';

/**
 * Where a category's content lives. Categories differ enough that one storage
 * shape would be wrong for most of them.
 *
 *   core     — real typed columns on `battlepacks`
 *   schedule — rows in `battlepack_schedule_items`
 *   section  — the `content` jsonb on `battlepack_categories`
 */
export type CategoryStorage = 'core' | 'schedule' | 'section';

/** Whether a category is always present, present-unless-removed, or opt-in. */
export type CategoryRequirement = 'mandatory' | 'default' | 'optional';

/** Everything a category's form and completeness check can see. */
export interface CategoryContext {
  pack: Pack;
  /** Rows from battlepack_categories, keyed by category key. Deviations only. */
  rows: Record<string, PackCategoryRow>;
  /** Rounds & Breaks, already ordered. */
  schedule: ScheduleItem[];
  /**
   * The lookups the editor has already loaded. They live on the context rather
   * than being fetched per form because more than one category needs them —
   * Event Basics picks the venue, Key Info renders its address — and a fetch
   * inside each form would mean the same two queries several times over.
   */
  games: GameOption[];
  venues: LocationOption[];
}

export interface CategoryFormProps extends CategoryContext {
  /**
   * Which category this form is rendering for. The registry maps key → Form and
   * not the other way round, so a form that serves more than one category (the
   * placeholder today, a generic section editor later) has no other way to know.
   */
  categoryKey: string;
  /**
   * Persist a partial change to the pack row. Only `core`-storage categories
   * use this — schedule and section categories write to their own tables and
   * then call `reload`.
   */
  onChange: (patch: Record<string, unknown>) => void;
  /**
   * Re-read the pack's data from the database.
   *
   * Forms that write outside the pack row do their own writes (they know their
   * own shape far better than the editor does) and then ask for a refresh, so
   * the document and the left-nav badges catch up.
   */
  reload: () => Promise<void>;
}

export interface CategoryDefinition {
  /** Stable key. Written to battlepack_categories.category_key, so never rename. */
  key: string;
  /** Left-nav text and document heading. */
  label: string;
  /** Which centre tab this renders under. */
  tab: CategoryTab;
  /** Always present, present-unless-removed, or opt-in. */
  requirement: CategoryRequirement;
  /**
   * null = universal, a game id = that game only.
   *
   * Game-specific categories are supported by the model but ship with an EMPTY
   * set — there is no real example yet. The mechanism costs nothing to carry;
   * inventing a category to justify it would. They resolve exactly once, at
   * creation, which is what makes them cheap: the game is fixed from then on,
   * so they never need reconciling.
   */
  gameId: string | null;
  storage: CategoryStorage;
  /** Default sort weight. Organiser reordering is deferred past V1. */
  order: number;
  /** 24px icon for the left-nav row. */
  icon: ReactNode;
  /** Right-panel form. */
  Form: ComponentType<CategoryFormProps>;
  /**
   * Hand-written guidance shown above the form, and the editor's placeholder.
   *
   * These are the reason the registry is TypeScript and not a table: several
   * categories share one form component and differ only in what they tell the
   * organiser to write. A generic renderer would have to fetch this from
   * somewhere, and there would be nowhere sensible to put it.
   */
  formHint?: string;
  placeholder?: string;
  /**
   * What one entry is called, for a list category — "prize", "resource".
   *
   * Drives the Add button and the remove button's screen-reader label, so a
   * list says "Add Prize" rather than the generic "Add Item" that would have
   * every list category sounding like the same one.
   */
  itemNoun?: string;
  /**
   * Heading the DOCUMENT uses, when it differs from the left nav's.
   *
   * "Event Basics" names the form you fill in; "About" names the paragraph it
   * produces. The nav is a list of jobs and the document is a thing people
   * read, so they do not always want the same word.
   */
  documentLabel?: string;
  /**
   * Sections sharing a row id sit side by side, stacking below md.
   *
   * Pairing is a property of the document's layout, not of either category, so
   * it lives here rather than one of them knowing about the other. A row with
   * only one visible member simply renders full width — which is what happens
   * the moment the organiser removes its partner.
   */
  row?: string;
  /** Show a URL field alongside the prose, stored as `content.url`. */
  hasUrl?: boolean;
  /**
   * Owns the rule for whether every REQUIRED FIELD in this category is filled.
   * Drives the COMPLETE badge in the left nav and gates publishing.
   */
  isComplete: (ctx: CategoryContext) => boolean;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export const CATEGORY_TABS: { id: CategoryTab; label: string; icon: ReactNode }[] = [
  { id: 'format',       label: 'Event Format', icon: <InfoCircle className="w-4 h-4" /> },
  { id: 'registration', label: 'Registration & Schedule', icon: <UserPlusRounded className="w-4 h-4" /> },
  { id: 'faq',          label: 'FAQ',           icon: <Notebook className="w-4 h-4" /> },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** True when a `section` category's jsonb has a non-empty value at `field`. */
const sectionFilled = (key: string, field: string) => (ctx: CategoryContext) => {
  const content = ctx.rows[key]?.content as Record<string, unknown> | null | undefined;
  const value   = content?.[field];
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
};

// ── The catalogue ────────────────────────────────────────────────────────────

export const CATEGORY_REGISTRY: CategoryDefinition[] = [
  {
    key: 'event-basics',
    label: 'Event Basics',
    tab: 'format',
    requirement: 'mandatory',
    gameId: null,
    storage: 'core',
    order: 10,
    icon: <FileText className="w-6 h-6" />,
    documentLabel: 'About',
    Form: EventBasicsForm,
    // The name is the only genuinely required field. The game is set at
    // creation and cannot be absent; location and description are optional.
    isComplete: ({ pack }) => pack.name.trim().length > 0,
  },
  {
    key: 'rounds-breaks',
    label: 'Schedule',
    // Sits with Registration rather than with Event Format: when the day runs
    // is the same question as how to get into it, and the format tab is about
    // what kind of event it is.
    tab: 'registration',
    requirement: 'default',
    gameId: null,
    storage: 'schedule',
    // After Tickets (60) and Registration (70), before Prizes (80). You decide
    // whether to come before you care what time Round 3 starts, and `order` is
    // the single sequence behind both the tab and the left nav — so moving it
    // here moves it in both.
    order: 75,
    icon: <ListCheck className="w-6 h-6" />,
    // Default rather than mandatory because a narrative or campaign event may
    // genuinely have no rounds — which is exactly why visibility has to live on
    // battlepack_categories and not on a content row this category doesn't own.
    isComplete: ({ schedule }) => schedule.length > 0,
    Form: RoundsBreaksForm,
  },
  {
    key: 'what-to-bring',
    label: "What you'll need to play",
    tab: 'format',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 30,
    icon: <Clipboard className="w-6 h-6" />,
    isComplete: ctx => readChecklist(ctx.rows['what-to-bring']?.content).some(i => i.text.trim()),
    Form: ChecklistSectionForm,
    formHint: "What a player has to turn up with. Dice, tape, tokens, printed lists — the things people forget.",
    placeholder: "e.g. Dice, measuring tape, and something to score with.",
  },
  {
    key: 'registration',
    label: 'Registration',
    tab: 'registration',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 70,
    icon: <UserPlusRounded className="w-6 h-6" />,
    row: 'signup',
    hasUrl: true,
    isComplete: sectionFilled('registration', 'body'),
    Form: SectionForm,
    formHint: "How to sign up, and by when. Link out if registration happens somewhere else.",
    placeholder: "e.g. Register on Best Coast Pairings at the link below.",
  },
  {
    key: 'tickets',
    label: 'Tickets',
    tab: 'registration',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 60,
    icon: <Bookmark className="w-6 h-6" />,
    row: 'signup',
    hasUrl: true,
    isComplete: sectionFilled('tickets', 'body'),
    Form: SectionForm,
    formHint: "Price, where to buy, and any refund or transfer rules.",
    placeholder: "e.g. Tickets are 40 dollars on the venue website.",
  },
  {
    key: 'prizes',
    label: 'Prizes',
    tab: 'format',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 80,
    icon: <Star className="w-6 h-6" />,
    isComplete: ctx => titledListFilled(readTitledList(ctx.rows['prizes']?.content)),
    Form: TitledListForm,
    itemNoun: 'prize',
    formHint: "What is on offer and how it is decided. Say if it depends on ticket sales.",
    placeholder: "e.g. Best General",
  },
  {
    key: 'resources',
    label: 'Resources',
    tab: 'format',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 85,
    icon: <Folder className="w-6 h-6" />,
    isComplete: ctx => titledListFilled(readTitledList(ctx.rows['resources']?.content)),
    Form: TitledListForm,
    hasUrl: true,
    itemNoun: 'resource',
    formHint: "Anything a player should read beforehand — the mission pack, an FAQ, a scoring sheet.",
    placeholder: "e.g. Mission Pack",
  },
  {
    key: 'faq',
    label: 'FAQ',
    tab: 'faq',
    requirement: 'optional',
    gameId: null,
    storage: 'section',
    order: 90,
    icon: <QuestionCircle className="w-6 h-6" />,
    isComplete: ctx => readFaq(ctx.rows['faq']?.content).some(i => i.question.trim()),
    Form: FaqSectionForm,
    formHint: "The questions you answer over and over in the group chat. Write them here once.",
    placeholder: "e.g. Can I proxy? Yes, as long as it is clearly the right size.",
  },
];

export const CATEGORY_BY_KEY: Record<string, CategoryDefinition> =
  Object.fromEntries(CATEGORY_REGISTRY.map(c => [c.key, c]));

// ── Presence ─────────────────────────────────────────────────────────────────

/**
 * Which categories this pack currently shows, in order.
 *
 * Presence is COMPUTED, not stored. battlepack_categories holds only the rows
 * where a pack departs from these defaults, so `mandatory` and `default` are
 * present, `optional` is absent, and a row overrides that. The alternative —
 * seeding membership at creation — would mean a backfill migration across every
 * existing pack each time this file gains a category, which for a registry that
 * changes often is a recurring tax for no benefit.
 *
 * Mandatory categories ignore `hidden` entirely: that is the whole point of the
 * tier, and it is what stops a half-filled category being hidden out of the
 * publish check with no visible cause.
 */
export function visibleCategories(
  gameId: string,
  rows: Record<string, PackCategoryRow>,
): CategoryDefinition[] {
  return CATEGORY_REGISTRY
    .filter(c => c.gameId === null || c.gameId === gameId)
    .filter(c => {
      if (c.requirement === 'mandatory') return true;
      const row = rows[c.key];
      if (row) return !row.hidden;
      return c.requirement === 'default';
    })
    .sort((a, b) => (rows[a.key]?.sort_order ?? a.order) - (rows[b.key]?.sort_order ?? b.order));
}

/**
 * Categories the organiser could still add, for the Add Category picker.
 *
 * `hasContent` is why the picker needs this shape rather than a plain list:
 * hiding a category retains its content, so re-adding one can silently
 * resurface text the organiser has forgotten about. The picker should say so.
 */
export function addableCategories(
  gameId: string,
  rows: Record<string, PackCategoryRow>,
): { category: CategoryDefinition; hasContent: boolean }[] {
  const visible = new Set(visibleCategories(gameId, rows).map(c => c.key));
  return CATEGORY_REGISTRY
    .filter(c => (c.gameId === null || c.gameId === gameId) && !visible.has(c.key))
    .map(c => ({ category: c, hasContent: rows[c.key]?.content != null }));
}

/**
 * Whether the pack may be published.
 *
 * Every mandatory category, plus every added, non-hidden optional one, must be
 * complete. Adding an optional category is opting in to finishing it — if the
 * organiser does not want to, they hide it. Hidden categories are excluded
 * precisely so a half-filled one cannot block publishing forever with nothing
 * on screen to explain why.
 */
export function incompleteCategories(ctx: CategoryContext): CategoryDefinition[] {
  return visibleCategories(ctx.pack.game_id, ctx.rows).filter(c => !c.isComplete(ctx));
}
