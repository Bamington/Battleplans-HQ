/**
 * StarcraftCard.tsx — StarCraft unit card
 *
 * Two-layer architecture (mirrors HaloFlashpointCard):
 *   Layer 1 — bg.svg          : all static chrome (card shape, name-banner
 *             region, stat chip frames + baked-in stat labels, phase header
 *             bars, weapon-table headers, Models/Supply label)
 *   Layer 2 — Dynamic text    : unit name, stat values, supply tier numbers,
 *             tags, rule rows, and weapon-table data rows — all positioned
 *             over the SVG
 *
 * The card renders at native 1270 × 890. Wrap and CSS-transform the outer
 * container to scale it for display.
 *
 * Layout note: this pass uses flex/grid for the dynamic-text layer because
 * we don't yet have per-field Figma coordinates. Text will roughly match
 * the chrome; precise pixel positions will be tuned against the rendered
 * result. Swap the flex blocks for absolute-positioned elements à la
 * HaloFlashpointCard when the design is locked.
 *
 * Fonts: 'Eurostile Pro Condensed' for headings/labels,
 * 'Eurostile Pro' for stats, 'Source Sans 3' for body text.
 *
 * Editing happens in the CardBuilderStarcraft right-panel editor, not inline
 * on the card — there are no `onChange` callbacks here yet.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import KeywordInfoModal from './KeywordInfoModal';
import StarcraftPhaseFrame from './StarcraftPhaseFrame';
import bgSvg from '../assets/games/card assets/starcraft/bg.svg';

// ── Font shorthands ───────────────────────────────────────────────────────────

const EURO_BD        = { fontFamily: "'Eurostile Pro', sans-serif", fontWeight: 700 } as const;
const EURO_BK        = { fontFamily: "'Eurostile Pro', sans-serif", fontWeight: 900 } as const;
const EURO_CND_BD    = { fontFamily: "'Eurostile Pro Condensed', sans-serif", fontWeight: 700 } as const;
const SOURCE_BD      = { fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700 } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Turn phase — where the addon (weapon or ability) lives on the card.
 * Both weapons and abilities use the same enum. `null` ≡ "None".
 */
export type StarcraftPhase = 'movement' | 'assault' | 'combat' | 'special_abilities';

/**
 * Activation timing — the coloured chip (Active / Passive / Reaction)
 * rendered next to the addon's name. Independent of `StarcraftPhase`.
 */
export type StarcraftTiming = 'active' | 'passive' | 'reaction';

/**
 * One tier row in the Models / Supply header table (1–3 rows on the card).
 * Only the upper bound is stored — the lower bound is derived from the
 * previous tier (Tier 0 starts at 1; Tier N starts at prev.maxModels + 1).
 */
export interface StarcraftSupplyTier {
  /** Inclusive upper bound of the tier's model range. */
  maxModels: number;
  /** Supply cost paid to field a unit of this tier's size. */
  supply:    number;
}

/**
 * A keyword attached to a weapon (or an ability — same shape).
 * Values are free-text strings (e.g. "Ground", "18", "All") — different
 * from Halo where values are numeric only.
 */
export interface StarcraftKeywordAttachment {
  keywordId:   string;
  name:        string;
  description: string;
  /** True if the keyword definition declares a value parameter. */
  hasValue:    boolean;
  /** The instance value (e.g. "Ground", "18"). null when hasValue is false. */
  value:       string | null;
}

export interface StarcraftAbility {
  /** Stable id used for list keys. */
  id:          string;
  name:        string;
  /** Turn phase — drives where this ability is grouped on the card. */
  phase?:      StarcraftPhase | null;
  /** Activation timing — drives the coloured chip next to the name. */
  timing?:     StarcraftTiming | null;
  /** Resource cost (CP / BM / Energy — faction-dependent label). */
  cpCost?:     number | null;
  description?: string;
  keywords?:    StarcraftKeywordAttachment[];
  /** True when this ability is itself an upgrade (gates upgradeCost UI). */
  isUpgrade?:   boolean;
  /** Mineral cost for upgrade abilities. */
  upgradeCost?: number | null;
}

export interface StarcraftWeapon {
  /** Stable id used for list keys and as `parentId` on child rows. */
  id:        string;
  name:      string;
  /** Turn phase — drives where this weapon table is grouped on the card. */
  phase?:    StarcraftPhase | null;
  /** Activation timing — independent of phase, both optional. */
  timing?:   StarcraftTiming | null;
  /** Range in inches. Melee = 0. */
  range?:    number;
  roa?:      number;
  /** Hit target value — rendered as "{n}+". */
  hit?:      number;
  dmg?:      number;
  surgeType?: string;
  /** Surge dice spec — free text (e.g. "D3", "D3+1"). */
  sDice?:    string;
  keywords?: StarcraftKeywordAttachment[];
  /**
   * If set, this weapon is rendered as an indented child of the weapon with
   * the matching `id`. Children inherit no stats — they render their own row.
   */
  parentId?: string | null;
}

export interface StarcraftCardProps {
  /**
   * Required unit type — the prominent banner text on the card
   * (e.g. "Marines", "Marauders").
   */
  unitType?:    string;
  /**
   * Optional specific name for a named / hero unit (e.g. "Jim Raynor").
   * Stored on the card; rendering position TBD.
   */
  unitName?:    string;

  // Core stats
  speed?:       number;
  /** Base die-threshold value — rendered on the card as "{evade}+". */
  evade?:       number;
  /** Base die-threshold value — rendered on the card as "{armour}+". */
  armour?:      number;
  hitPoints?:   number;
  size?:        number;
  /** Total unit point cost (stored, not yet rendered on the card). */
  pointsCost?:  number;

  /** 1–3 tier rows. */
  supplyTiers?: StarcraftSupplyTier[];

  /** Abilities (rules) attached to this card. */
  abilities?:   StarcraftAbility[];

  /** Weapons attached to this card, ordered. Children render under their parent. */
  weapons?:     StarcraftWeapon[];

  /** Free-text tag line, e.g. 'Core, Light, Biological, Ground, Terran'. */
  tags?:        string;

  className?:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Phase order on the card body — empty phases are skipped at render time. */
const PHASE_ORDER: StarcraftPhase[] = ['movement', 'assault', 'combat', 'special_abilities'];

const PHASE_LABEL: Record<StarcraftPhase, string> = {
  movement:          'Movement Phase',
  assault:           'Assault Phase',
  combat:            'Combat Phase',
  special_abilities: 'Special Abilities',
};

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Stat value slot — absolutely positioned, centered on (cx, cy) per Figma
 * node 807:2736-2740. All five stats share the same styling; only the
 * centre x coordinate differs.
 *
 *   Source Sans 3 Bold · 49.915px · white · tracking -0.4992px · uppercase
 *   box: w 61 × h 31, centered on cx / cy
 */
const StatValue = ({ cx, cy, value }: { cx: number; cy: number; value: string }) => (
  <div
    style={{
      position:       'absolute',
      left:           cx,
      top:            cy,
      width:          61,
      height:         31,
      transform:      'translate(-50%, -50%)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}
  >
    <span
      style={{
        ...SOURCE_BD,
        fontSize:      49.915,
        lineHeight:    'normal',
        letterSpacing: '-0.4992px',
        textAlign:     'center',
        textTransform: 'uppercase',
        color:         '#fff',
      }}
    >
      {value || '—'}
    </span>
  </div>
);

/** Figma x-centre for each stat value on the header row (y = 53.5). */
const STAT_CX = {
  speed:     497.5,
  evade:     572.5,
  armour:    647.5,
  hitPoints: 722.5,
  size:      797.5,
} as const;
const STAT_CY = 53.5;

/** Section header. Used for "Abilities" and "Weapons" body sections. */

// ── Component ─────────────────────────────────────────────────────────────────

const StarcraftCard = ({
  unitType    = 'Unit Type',
  speed,
  evade,
  armour,
  hitPoints,
  size,
  supplyTiers = [],
  abilities   = [],
  weapons     = [],
  tags        = '',
  className   = '',
}: StarcraftCardProps) => {
  // Keyword-info modal — portaled to body so the modal isn't affected by the
  // CSS transform/scale applied by the parent (CardCarousel).
  const [viewingKeyword, setViewingKeyword] = useState<StarcraftKeywordAttachment | null>(null);
  const viewingLabel = viewingKeyword
    ? (viewingKeyword.value != null && viewingKeyword.value !== ''
        ? `${viewingKeyword.name} (${viewingKeyword.value})`
        : viewingKeyword.name)
    : '';

  return (
    <div
      className={className}
      style={{
        position:   'relative',
        width:      1270,
        height:     890,
        color:      '#111',
        overflow:   'hidden',
      }}
    >
      {/* Layer 1 — static chrome (card shape, frames, baked labels) */}
      <img
        src={bgSvg}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset:    0,
          width:    '100%',
          height:   '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 2 — dynamic text (absolute coordinates from Figma node 807:2260) */}
      <div style={{ position: 'absolute', inset: 0 }}>

      {/* ── Unit type — Figma node 807:2698 ─────────────────────────────
          Eurostile Pro Condensed Bold · 44px · white
          tracking -0.44px · uppercase · nowrap
          position: left 41, top 35
          (Figma spec is 40px / top 45 / -0.4px tracking; bumped ~10% in size
          and nudged up 10px per design tweaks.)
          The required *Unit Type* (e.g. "Marines") goes here. The optional
          *Unit Name* (e.g. "Jim Raynor") is stored on the card but its
          on-card position has not been designed yet. */}
      <p
        style={{
          position:      'absolute',
          left:          41,
          top:           35,
          margin:        0,
          ...EURO_CND_BD,
          fontSize:      44,
          lineHeight:    'normal',
          letterSpacing: '-0.44px',
          color:         '#fff',
          textTransform: 'uppercase',
          whiteSpace:    'nowrap',
        }}
      >
        {unitType}
      </p>

      {/* ── Core stats — Figma nodes 807:2736-2740 ──────────────────────
          All stats share style; only the centre x differs (75px apart, y=53.5). */}
      <StatValue cx={STAT_CX.speed}     cy={STAT_CY} value={speed     != null ? String(speed)     : ''} />
      <StatValue cx={STAT_CX.evade}     cy={STAT_CY} value={evade     != null ? `${evade}+`      : ''} />
      <StatValue cx={STAT_CX.armour}    cy={STAT_CY} value={armour    != null ? `${armour}+`     : ''} />
      <StatValue cx={STAT_CX.hitPoints} cy={STAT_CY} value={hitPoints != null ? String(hitPoints) : ''} />
      <StatValue cx={STAT_CX.size}      cy={STAT_CY} value={size      != null ? String(size)      : ''} />

      {/* ── Supply / Models — Figma container at (866, 16). Design TBD,
            so we render a minimal placeholder positioned at the right x/y. */}
      <div style={{ position: 'absolute', left: 866, top: 16 }}>
        <SupplyTable tiers={supplyTiers} />
      </div>

      {/* ── BODY — Phase List (Figma node 797:17905) ────────────────────
            Positioned at left=315, top=121 with a fixed width of 947 — the
            left strip of the card (0–315px) is reserved for the faction
            silhouette / portrait. Each phase frame contains its own
            abilities (above) + weapon table (below), wrapped in the
            bracketed blue chrome. Phases with no abilities + no weapons
            are skipped. Items with `phase: null` are not rendered — every
            addon needs an explicit phase to land on the card. */}
      <div
        style={{
          position:      'absolute',
          left:          315,
          top:           121,
          width:         947,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}
      >
        {PHASE_ORDER.map(phase => {
          const phaseWeapons   = weapons.filter(w   => w.phase === phase);
          const phaseAbilities = abilities.filter(a => a.phase === phase);
          if (phaseWeapons.length === 0 && phaseAbilities.length === 0) return null;
          return (
            <StarcraftPhaseFrame
              key={phase}
              phaseName={PHASE_LABEL[phase]}
              weapons={phaseWeapons}
              abilities={phaseAbilities}
              onKeywordClick={setViewingKeyword}
            />
          );
        })}
      </div>

      {/* ── Tags — Figma node 807:2318 ──────────────────────────────────
          Container: left 0, top 827, w 379, h 63, bg #0d1122, px 20
          flex-centered both axes.
          "Tags: " — Eurostile Pro Medium (500, non-italic) 22px white
          value   — Eurostile Pro Medium Italic (500, italic)       22px white
          Both share tracking -0.44px, leading 23px. */}
      {tags && (
        <div
          style={{
            position:       'absolute',
            left:           0,
            top:            827,
            width:          379,
            height:         63,
            background:     '#0d1122',
            padding:        '0 20px',
            boxSizing:      'border-box',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <p
            style={{
              margin:        0,
              fontFamily:    "'Eurostile Pro', sans-serif",
              fontWeight:    500,
              fontStyle:     'italic',
              fontSize:      22,
              lineHeight:    '23px',
              letterSpacing: '-0.44px',
              color:         '#fff',
              textAlign:     'center',
            }}
          >
            <span style={{ fontStyle: 'normal' }}>Tags: </span>
            <span>{tags}</span>
          </p>
        </div>
      )}
      </div>
      {/* /Layer 2 */}

      {/* Keyword info modal — portaled to body so it isn't affected by the
           card's CSS transform/scale (the carousel scales the card down). */}
      {viewingKeyword && createPortal(
        <KeywordInfoModal
          open
          onClose={() => setViewingKeyword(null)}
          name={viewingLabel}
          description={viewingKeyword.description}
        />,
        document.body,
      )}
    </div>
  );
};

// ── Supply table — one row per tier, up to 3 tiers ────────────────────────────

/**
 * Supply / Models table — renders only the dynamic tier numbers.
 * The "MODELS / SUPPLY" label and the cell frames live in bg.svg.
 *
 * The minimum model count is derived: tier 0 starts at 1, tier N starts at
 * the previous tier's maxModels + 1. Storage only carries the upper bound.
 */
const SupplyTable = ({ tiers }: { tiers: StarcraftSupplyTier[] }) => {
  if (tiers.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {tiers.map((t, i) => {
        const min = i === 0 ? 1 : tiers[i - 1].maxModels + 1;
        return (
          <div
            key={i}
            style={{
              flex:           1,
              minWidth:       60,
              height:         70,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ ...EURO_BK, fontSize: 22, lineHeight: 1, color: '#111' }}>
              {min}-{t.maxModels}
            </span>
            <span style={{ ...EURO_BD, fontSize: 14, marginTop: 6, color: '#fff', background: '#111', padding: '2px 10px', borderRadius: 3 }}>
              {t.supply}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default StarcraftCard;
