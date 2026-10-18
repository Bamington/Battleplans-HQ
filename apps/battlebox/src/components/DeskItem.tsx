/**
 * DeskItem.tsx — A model on the Painting Desk: photo, name, a four-step
 * progress bar (Unpainted → Assembled → Primed → Partially Painted), when it
 * was started, and the two moves that matter — Next step, and Mark Painted.
 * Tapping the card (not a button) opens the model.
 */

import { Button } from '@battleplans/ui';
import { CollectionThumb, clickableProps } from './ModelItem';
import { KebabMenu } from './KebabMenu';
import { GAME_ICONS } from './gameIcons';
import { DESK_STEPS, nextDeskStatus } from '../hooks/useCollection';
import type { CollectionModel, ModelStatus } from '../hooks/useCollection';

const STEP_LABEL: Record<ModelStatus, string> = {
  'None': 'Unpainted',
  'Assembled': 'Assembled',
  'Primed': 'Primed',
  'Partially Painted': 'Partially Painted',
  'Painted': 'Painted',
};

const cardHover = ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

/** "2026-10-12" → "12/10/26" */
const shortDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };

/** Four segments, filled up to and including the current stage. */
export function DeskProgress({ status }: { status: ModelStatus }) {
  const at = Math.max(0, DESK_STEPS.indexOf(status));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" role="img" aria-label={`${STEP_LABEL[status]} — step ${at + 1} of ${DESK_STEPS.length}`}>
        {DESK_STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= at ? 'bg-primary-500' : 'bg-neutral-700'}`} />
        ))}
      </div>
      <span className="font-body text-xs text-neutral-300">{STEP_LABEL[status]}</span>
    </div>
  );
}

export function DeskItem({ model, onClick, onNextStep, onMarkPainted, onRemove, onShare, busy = false }: {
  /** Open the Share dialog for this model. */
  onShare?: () => void;
  model: CollectionModel;
  /** Open the model. */
  onClick?: () => void;
  /** Move to the next stage (not offered at Partially Painted). */
  onNextStep?: (next: ModelStatus) => void;
  /** Finish it — opens the Mark Painted dialog. */
  onMarkPainted?: () => void;
  /** Take it off the desk without finishing it. */
  onRemove?: () => void;
  /** An update for this card is in flight. */
  busy?: boolean;
}) {
  const iconUrl = model.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;
  const next = nextDeskStatus(model.status);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5${onClick ? cardHover : ''}`}
    >
      <CollectionThumb images={model.images} iconUrl={iconUrl} name={model.name} />

      <div className="flex-1 min-w-0 flex flex-col gap-2 pr-2 py-3">
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="font-heading text-lg text-white leading-6 truncate">{model.name}</span>
            <span className="font-body text-xs text-neutral-400 truncate">
              {[model.game?.name, model.startedPaintingDate && `Started ${shortDate(model.startedPaintingDate)}`].filter(Boolean).join(' · ')}
            </span>
          </div>
          {(onRemove || onShare) && (
            <div onClick={stop} onKeyDown={stop}>
              <KebabMenu label={`${model.name} actions`} items={[
                ...(onShare ? [{ label: 'Share', onClick: onShare }] : []),
                ...(onRemove ? [{ label: 'Remove from desk', onClick: onRemove }] : []),
              ]} />
            </div>
          )}
        </div>

        <DeskProgress status={model.status} />

        <div className="flex flex-wrap gap-2" onClick={stop} onKeyDown={stop}>
          {next && onNextStep && (
            <Button size="xs" variant="outline" color="primary" disabled={busy} onClick={() => onNextStep(next)}>
              Next: {STEP_LABEL[next]}
            </Button>
          )}
          {onMarkPainted && (
            <Button size="xs" color="primary" disabled={busy} onClick={onMarkPainted}>Mark Painted</Button>
          )}
        </div>
      </div>
    </div>
  );
}
