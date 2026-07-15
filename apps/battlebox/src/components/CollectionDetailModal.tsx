import { Sheet, UserRounded, Box } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { ImageCarousel } from './ImageCarousel';
import { ModelItem } from './ModelItem';
import { useBoxDetail } from '../hooks/useCollection';

// ── Icons ─────────────────────────────────────────────────────────────────────

const CalendarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ── Date helper ───────────────────────────────────────────────────────────────

/** "2026-04-25" -> "25/04/26" */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-primary-400">
      {icon}
      <span className="font-body text-sm text-white">{children}</span>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
//
// Collections reuse the model modal's shell (the responsive Sheet) but have no
// painting or lore, so there are no tabs — just the details and, in place of the
// model modal's "Included in", the models this collection "Includes".

export function CollectionDetailModal({ boxId, onClose }: {
  boxId: string | null;
  onClose: () => void;
}) {
  const { box } = useBoxDetail(boxId);
  const iconUrl = box?.game?.slug ? GAME_ICONS[box.game.slug] ?? null : null;

  return (
    <Sheet open={boxId !== null} onClose={onClose} className="max-w-2xl">
      {box ? (
        <>
          {/* Hero — sized to the tallest image; fixed frame for the fallback. */}
          {box.images.length > 0 ? (
            <ImageCarousel
              images={box.images}
              alt={box.name}
              dots
              autoHeight
              className="w-full shrink-0 bg-neutral-950 max-h-[55vh]"
            />
          ) : (
            <div className="h-56 shrink-0 relative overflow-hidden bg-neutral-950 flex items-center justify-center">
              {iconUrl ? (
                <>
                  <img src={iconUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />
                  <img src={iconUrl} alt="" className="relative w-24 h-24 rounded-lg object-cover shadow-lg" />
                </>
              ) : (
                <span className="relative font-heading text-white text-lg text-center px-6">{box.name}</span>
              )}
            </div>
          )}

          {/* Name + game */}
          <div className="px-5 pt-4 flex flex-col gap-0.5 shrink-0">
            <h2 className="font-heading text-xl text-white leading-7">{box.name}</h2>
            {box.game && (
              <div className="flex items-center gap-1.5">
                {iconUrl && <img src={iconUrl} alt="" className="w-4 h-4 rounded object-cover" />}
                <span className="font-body text-sm text-neutral-400">{box.game.name}</span>
              </div>
            )}
          </div>

          {/* Body — the desktop scroll region (mobile scrolls with the sheet). */}
          <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg flex flex-col divide-y divide-neutral-800">
              <DetailRow icon={<Box className="w-4 h-4" />}>{box.type}</DetailRow>
              <DetailRow icon={<UserRounded className="w-4 h-4" />}>
                {box.modelCount} {box.modelCount === 1 ? 'Model' : 'Models'}
              </DetailRow>
              {box.purchaseDate && (
                <DetailRow icon={<CalendarIcon />}>Purchased {shortDate(box.purchaseDate)}</DetailRow>
              )}
            </div>

            {box.includes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="font-body text-sm text-neutral-400">Includes:</span>
                {box.includes.map(m => <ModelItem key={m.id} model={m} />)}
              </div>
            ) : (
              box.includesString && (
                <div className="flex flex-col gap-2">
                  <span className="font-body text-sm text-neutral-400">Includes:</span>
                  <p className="font-body text-sm text-white">{box.includesString}</p>
                </div>
              )
            )}
          </div>
        </>
      ) : (
        <div className="p-10 text-center font-body text-sm text-neutral-400">Loading…</div>
      )}
    </Sheet>
  );
}
