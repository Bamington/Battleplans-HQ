/**
 * BattleGridItem.tsx — The gallery/grid-view battle card (Figma 1014:22327).
 *
 *   ┌───────────────────────────┐
 *   │        photo hero         │  260px — the battle's primary photo, or a
 *   │                           │         game-branded placeholder if none.
 *   ├───────────────────────────┤
 *   │ [logo] GAME        VICTORY │
 *   │        Against Nathan Haig │
 *   │        Saturday, 13/06/26… │
 *   └───────────────────────────┘
 *
 * Reuses BattleCardBody for the content row. Fixed ~356px tall so the grid's
 * auto page-size calc stays predictable (260 hero + 6 gap + 88 content row + 2
 * border).
 */

import { BattleCardBody, clickableProps, type BattleCardFields } from './BattleItem';

export function BattleGridItem({ photoUrl, onClick, ...fields }: BattleCardFields & {
  /** The battle's primary photo, shown as the hero. Null → branded placeholder. */
  photoUrl?: string | null;
  onClick?:  () => void;
}) {
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col gap-1.5 shadow-md overflow-hidden w-full max-w-[384px]${onClick ? ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500' : ''}`}
    >
      {/* Photo hero, or a game-branded placeholder when the battle has no photo:
          the game icon blurred as a colour backdrop with the crisp icon centred. */}
      <div className="h-[260px] w-full shrink-0 relative overflow-hidden bg-neutral-900 flex items-center justify-center">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : fields.gameIcon ? (
          <>
            <img src={fields.gameIcon} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />
            <img src={fields.gameIcon} alt="" className="relative w-24 h-24 rounded-lg object-cover shadow-lg" />
          </>
        ) : (
          <span className="relative font-heading text-white text-lg text-center px-6">{fields.gameName}</span>
        )}
      </div>

      {/* Content row */}
      <div className="flex gap-1.5 items-start p-3">
        <BattleCardBody {...fields} />
      </div>
    </div>
  );
}
