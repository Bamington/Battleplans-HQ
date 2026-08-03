/**
 * StepProgress.tsx — segmented progress bar for a multi-step flow.
 *
 * One rounded bar per step, filled for the steps already reached. A caption
 * above names where you are ("Step 1/3 — Event Basics"), because a bar alone
 * tells you how far along you are but not what you are doing.
 *
 * Matches the Figma stepper on BattlePack's Create New Event card
 * (node 1069:18251): 7px bars, 12px apart, primary-600 done and primary-900
 * to come — so it re-themes with each app's accent for free.
 *
 * Deliberately not a Flowbite-style numbered stepper with circles and
 * connecting lines. Those spend a lot of width naming steps the user cannot
 * jump to, and this flow has three short ones.
 *
 * USAGE:
 *   <StepProgress step={1} total={3} label="Event Basics" />
 *   <StepProgress step={2} total={3} />           // caption without a name
 */

export interface StepProgressProps {
  /** Current step, 1-based. Clamped to [1, total]. */
  step: number;
  /** How many steps there are in total. */
  total: number;
  /** Name of the current step, appended to the caption. Omit for none. */
  label?: string;
  /** Hide the caption entirely and show only the bars. */
  hideCaption?: boolean;
  /** Extra Tailwind classes on the root. */
  className?: string;
}

const StepProgress = ({ step, total, label, hideCaption = false, className = '' }: StepProgressProps) => {
  const safeTotal   = Math.max(1, Math.floor(total));
  const currentStep = Math.min(Math.max(1, Math.floor(step)), safeTotal);

  return (
    <div className={`w-full flex flex-col gap-1 ${className}`.trim()}>
      {!hideCaption && (
        <p className="font-body text-xs leading-4 text-gray-300 text-center">
          Step {currentStep}/{safeTotal}{label ? ` — ${label}` : ''}
        </p>
      )}

      <div
        className="w-full flex items-center gap-3"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-label={label ? `Step ${currentStep} of ${safeTotal}: ${label}` : `Step ${currentStep} of ${safeTotal}`}
      >
        {Array.from({ length: safeTotal }, (_, i) => (
          <span
            key={i}
            className={`flex-1 min-w-px h-[7px] rounded-full transition-colors ${
              i < currentStep ? 'bg-primary-600' : 'bg-primary-900'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default StepProgress;
