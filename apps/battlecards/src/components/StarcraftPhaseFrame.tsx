/**
 * StarcraftPhaseFrame.tsx — One phase section on a StarCraft unit card.
 *
 * Implements Figma node 797:13069 ("Phase Frame"): a single boxed frame
 * that contains everything for one turn-phase on the card.
 *
 *   ┌──────────────────────────┐
 *   │ ● MOVEMENT PHASE         │   ← heading bar (sloped caps + blue body)
 *   ╞══════════════════════════╡
 *   │ ⬢ STIMPACK: [ACTIVE][1CP] description …                │   ← abilities
 *   │ NAME │RNG│RoA│Hit│ …     │   ← weapon table header
 *   │ C-14 RIFLE │ 12 │ 2 │ … │   ← weapon row (parent)
 *   │  ⬢ AGG-12  │ 12 │ 3 │ … │   ← weapon row (upgrade — indented + icon)
 *   └──────────────────────────┘
 *
 * Outer chrome: continuous 2px brand-colour border on the left and right
 * sides, a 2px horizontal rule below the heading, and a 2px bottom rule —
 * the heading "punches" through the top edge with sloped left/right caps.
 *
 * Abilities render above the weapon table as full-width rows (no left/right
 * caps — the new layout absorbs them into the frame). Weapons keep the
 * Halo-style 8-column data table with header, parent rows, and indented
 * upgrade rows. Both can opt into clickable keyword chips via the
 * `onKeywordClick` prop — the parent owns the keyword-info modal.
 */

import bracketLeft       from '../assets/games/card assets/starcraft/phase-chrome/heading-left-cap.svg';
import bracketRight      from '../assets/games/card assets/starcraft/phase-chrome/heading-right-cap.svg';
import headingDot        from '../assets/games/card assets/starcraft/phase-chrome/heading-icon.svg';
import upgradeIconSvg    from '../assets/games/card assets/starcraft/phase-chrome/upgrade-icon.svg';
import upgradeUnionSvg   from '../assets/games/card assets/starcraft/phase-chrome/upgrade-icon-union.svg';
import type {
  StarcraftAbility,
  StarcraftKeywordAttachment,
  StarcraftTiming,
  StarcraftWeapon,
} from './StarcraftCard';

// ── Constants ────────────────────────────────────────────────────────────────

const ECB     = "'Eurostile Pro Condensed', sans-serif";
const FW_BD   = 700;
const FW_BK   = 900;

/** Phase chrome palette (Figma node 797:13069). */
const COLOR = {
  /** Heading bar + frame border. */
  brand:       '#004389',
  /** Table header row. */
  tableHeader: '#3a3a3a',
  /** Table body cell. */
  tableCell:   '#cfcfcf',
  /** Cell text. */
  cellText:    '#1f1f1f',
  /** Activation-trait chips. */
  active:      '#6b9313',
  passive:     '#a9101c',
  reaction:    '#cc6100',
  /** Resource cost (CP / BM / Energy) chip. */
  cp:          '#6b9313',
} as const;

/** Activation-timing chip colour lookup. null/undefined → no chip rendered. */
const TIMING_BG: Record<StarcraftTiming, string> = {
  active:   COLOR.active,
  passive:  COLOR.passive,
  reaction: COLOR.reaction,
};

// ── Weapon column layout (matches Figma exactly) ─────────────────────────────

interface WeaponCol {
  key:      keyof StarcraftWeapon | 'name' | 'keywords';
  label:    string;
  /** Fixed pixel width; null = flex-1 (only for "name"). */
  width:    number | null;
  align:    'left' | 'center';
}

const WEAPON_COLUMNS: WeaponCol[] = [
  { key: 'name',      label: 'Name',       width: null, align: 'left'   },
  { key: 'range',     label: 'RNG',        width: 46,   align: 'center' },
  { key: 'roa',       label: 'RoA',        width: 46,   align: 'center' },
  { key: 'hit',       label: 'Hit',        width: 46,   align: 'center' },
  { key: 'surgeType', label: 'Surge Type', width: 92,   align: 'center' },
  { key: 'sDice',     label: 'S.Dice',     width: 46,   align: 'center' },
  { key: 'dmg',       label: 'Dmg',        width: 46,   align: 'center' },
  { key: 'keywords',  label: 'Keyword',    width: 383,  align: 'left'   },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a weapon cell value with the StarCraft-specific rendering rules. */
const cellValue = (col: WeaponCol, w: StarcraftWeapon): string => {
  switch (col.key) {
    case 'name':      return w.name.toUpperCase();
    case 'range':     return w.range == null ? '' : w.range === 0 ? 'M' : String(w.range);
    case 'roa':       return w.roa  != null ? String(w.roa) : '';
    case 'hit':       return w.hit  != null ? `${w.hit}+`   : '';
    case 'surgeType': return w.surgeType ?? '-';
    case 'sDice':     return w.sDice     ?? '-';
    case 'dmg':       return w.dmg  != null ? String(w.dmg) : '';
    case 'keywords':  return '';   // handled with JSX below
    default:          return '';
  }
};

/** Tree weapons into root rows + child rows keyed by parent id. */
const buildTree = (weapons: StarcraftWeapon[]) => {
  const byParent: Record<string, StarcraftWeapon[]> = {};
  const roots: StarcraftWeapon[] = [];
  for (const w of weapons) {
    if (w.parentId) (byParent[w.parentId] ??= []).push(w);
    else            roots.push(w);
  }
  return { roots, byParent };
};

// ── Sub-components ───────────────────────────────────────────────────────────

/** Phase heading bar with sloped caps + label. */
const PhaseHeading = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
    <img src={bracketLeft} alt="" aria-hidden style={{ width: 8, height: 32, display: 'block' }} />
    <div
      style={{
        background:   COLOR.brand,
        height:       32,
        display:      'flex',
        alignItems:   'center',
        gap:          4,
        padding:      '0 8px',
        flexShrink:   0,
      }}
    >
      <img src={headingDot} alt="" aria-hidden style={{ width: 24, height: 24, display: 'block' }} />
      <span
        style={{
          fontFamily:    ECB,
          fontWeight:    FW_BD,
          fontSize:      26,
          lineHeight:    'normal',
          letterSpacing: '-0.52px',
          textTransform: 'uppercase',
          color:         '#fff',
          whiteSpace:    'nowrap',
        }}
      >
        {label}
      </span>
    </div>
    <img src={bracketRight} alt="" aria-hidden style={{ width: 8, height: 32, display: 'block' }} />
  </div>
);

/** Dark "upgrade" badge — used as a prefix on upgrade weapon rows + ability headings. */
const UpgradeIcon = () => (
  <div style={{ position: 'relative', width: 26.5, height: 21, flexShrink: 0 }}>
    <img src={upgradeIconSvg} alt="" aria-hidden style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
    <div style={{ position: 'absolute', top: '9.52%', left: '22.64%', right: '20.75%', bottom: 0 }}>
      <img src={upgradeUnionSvg} alt="" aria-hidden style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
    </div>
  </div>
);

/** Solid-colour chip for activation timing (Active / Passive / Reaction) and CP cost. */
const Chip = ({ label, color }: { label: string; color: string }) => (
  <div
    style={{
      background:     color,
      padding:        '0 4px',
      height:         18,
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
    }}
  >
    <span
      style={{
        fontFamily:    ECB,
        fontWeight:    FW_BD,
        fontSize:      19,
        lineHeight:    '20px',
        letterSpacing: '0.38px',
        textTransform: 'uppercase',
        color:         '#fff',
        whiteSpace:    'nowrap',
      }}
    >
      {label}
    </span>
  </div>
);

/** One ability row — full-width inside the phase frame. */
const AbilityRow = ({ ability }: { ability: StarcraftAbility }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, paddingTop: 4 }}>
    {ability.isUpgrade && <UpgradeIcon />}
    <span
      style={{
        fontFamily:    ECB,
        fontWeight:    FW_BK,
        fontSize:      22,
        lineHeight:    'normal',
        letterSpacing: '-0.44px',
        textTransform: 'uppercase',
        color:         '#000',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}
    >
      {ability.name}{ability.description ? ':' : ''}
    </span>
    {ability.timing && <Chip label={ability.timing} color={TIMING_BG[ability.timing]} />}
    {ability.cpCost != null && ability.cpCost > 0 && (
      <Chip label={`${ability.cpCost}CP`} color={COLOR.cp} />
    )}
    {ability.description && (
      <p
        style={{
          flex:          '1 1 0',
          minWidth:      0,
          margin:        0,
          fontFamily:    ECB,
          fontWeight:    FW_BD,
          fontSize:      22,
          lineHeight:    'normal',
          letterSpacing: '-0.44px',
          color:         '#000',
        }}
      >
        {ability.description}
      </p>
    )}
  </div>
);

/** Weapon table header row. */
const WeaponHeader = () => (
  <div style={{ display: 'flex', gap: 2, alignItems: 'stretch', width: '100%' }}>
    {WEAPON_COLUMNS.map(col => (
      <div
        key={col.key as string}
        style={{
          background:     COLOR.tableHeader,
          height:         29,
          flex:           col.width == null ? '1 0 0' : `0 0 ${col.width}px`,
          minWidth:       col.width == null ? 0 : undefined,
          display:        'flex',
          alignItems:     'center',
          justifyContent: col.align === 'left' ? 'flex-start' : 'center',
          padding:        '6px 6px 0',
          boxSizing:      'border-box',
        }}
      >
        <span
          style={{
            fontFamily:    ECB,
            fontWeight:    FW_BK,
            fontSize:      22,
            lineHeight:    'normal',
            letterSpacing: '-0.44px',
            textTransform: 'uppercase',
            color:         '#fff',
            textAlign:     col.align,
            width:         col.align === 'left' ? 'auto' : '100%',
          }}
        >
          {col.label}
        </span>
      </div>
    ))}
  </div>
);

/** Single weapon-table data row. Children render with the upgrade icon prefix. */
const WeaponRow = ({
  weapon,
  isUpgrade,
  onKeywordClick,
}: {
  weapon:          StarcraftWeapon;
  isUpgrade:       boolean;
  onKeywordClick?: (kw: StarcraftKeywordAttachment) => void;
}) => (
  <div style={{ display: 'flex', gap: 2, alignItems: 'stretch', width: '100%' }}>
    {WEAPON_COLUMNS.map(col => {
      const isName     = col.key === 'name';
      const isKeywords = col.key === 'keywords';
      const baseStyle  = {
        background:     COLOR.tableCell,
        flex:           col.width == null ? '1 0 0' : `0 0 ${col.width}px`,
        minWidth:       col.width == null ? 0 : undefined,
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '6px 6px 0',
        boxSizing:      'border-box',
        minHeight:      32,
      } as const;
      const spanStyle = {
        fontFamily:    ECB,
        fontWeight:    FW_BD,
        fontSize:      22,
        lineHeight:    '23px',
        letterSpacing: '-0.44px',
        textTransform: 'uppercase' as const,
        color:         COLOR.cellText,
        textAlign:     col.align,
        flex:          1,
        minWidth:      0,
      };

      if (isKeywords) {
        const kws = weapon.keywords ?? [];
        return (
          <div key={col.key as string} style={baseStyle}>
            {kws.length === 0 ? (
              <span style={{ ...spanStyle, whiteSpace: 'nowrap' }}>-</span>
            ) : (
              <span style={{ ...spanStyle, whiteSpace: 'normal', textTransform: 'uppercase' }}>
                {kws.map((kw, i) => (
                  <span key={kw.keywordId ?? i}>
                    {i > 0 && ', '}
                    {onKeywordClick ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onKeywordClick(kw); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onKeywordClick(kw);
                          }
                        }}
                        style={{ textDecoration: 'underline', color: '#2563eb', cursor: 'pointer' }}
                      >
                        {kw.value != null && kw.value !== '' ? `${kw.name} (${kw.value})` : kw.name}
                      </span>
                    ) : (
                      kw.value != null && kw.value !== '' ? `${kw.name} (${kw.value})` : kw.name
                    )}
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      }

      return (
        <div key={col.key as string} style={baseStyle}>
          {isName && isUpgrade && <UpgradeIcon />}
          <span style={{ ...spanStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cellValue(col, weapon)}
          </span>
        </div>
      );
    })}
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

export interface StarcraftPhaseFrameProps {
  /** Display label for the heading bar (e.g. "Movement Phase"). */
  phaseName:       string;
  /** Weapons attached to this phase, root rows first; children render indented. */
  weapons?:        StarcraftWeapon[];
  /** Abilities attached to this phase. */
  abilities?:      StarcraftAbility[];
  /** Called when a clickable weapon keyword chip is clicked. */
  onKeywordClick?: (kw: StarcraftKeywordAttachment) => void;
  className?:      string;
}

const StarcraftPhaseFrame = ({
  phaseName,
  weapons    = [],
  abilities  = [],
  onKeywordClick,
  className  = '',
}: StarcraftPhaseFrameProps) => {
  const { roots, byParent } = buildTree(weapons);
  const hasWeapons   = weapons.length   > 0;
  const hasAbilities = abilities.length > 0;

  return (
    <div className={className} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top section: heading + horizontal white spacer + 2px right strip ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', alignSelf: 'stretch' }}>
        <PhaseHeading label={phaseName} />
        <div style={{ background: '#fff', flex: '1 1 0', alignSelf: 'stretch', minWidth: 0 }} />
        <div style={{ background: COLOR.brand, width: 2, alignSelf: 'stretch' }} />
      </div>

      {/* 2px brand-colour rule under the heading */}
      <div style={{ background: COLOR.brand, height: 2, width: '100%' }} />

      {/* ── Middle section — white interior with 2px brand-colour vertical strips ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', background: '#fff', minHeight: 0 }}>
        <div style={{ background: COLOR.brand, width: 2, flexShrink: 0 }} />

        <div
          style={{
            flex:           '1 1 0',
            minWidth:       0,
            padding:        '6px 0',
            display:        'flex',
            flexDirection:  'column',
            gap:            10,
          }}
        >
          {/* Abilities — full-width rows, stacked top-to-bottom. */}
          {hasAbilities && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {abilities.map(a => <AbilityRow key={a.id} ability={a} />)}
            </div>
          )}

          {/* Weapon table — header followed by one row per weapon (children indented). */}
          {hasWeapons && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <WeaponHeader />
              {roots.map(root => (
                <div key={root.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <WeaponRow weapon={root} isUpgrade={false} onKeywordClick={onKeywordClick} />
                  {(byParent[root.id] ?? []).map(child => (
                    <WeaponRow key={child.id} weapon={child} isUpgrade onKeywordClick={onKeywordClick} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: COLOR.brand, width: 2, flexShrink: 0 }} />
      </div>

      {/* ── Bottom frame — 6px tall closer with a 2px bottom rule ───────────── */}
      <div style={{ display: 'flex', height: 6, alignItems: 'flex-end', background: '#fff' }}>
        <div style={{ background: COLOR.brand, width: 2, height: '100%' }} />
        <div style={{ background: COLOR.brand, flex: '1 1 0', height: 2, minWidth: 0 }} />
        <div style={{ background: COLOR.brand, width: 2, height: '100%' }} />
      </div>
    </div>
  );
};

export default StarcraftPhaseFrame;
