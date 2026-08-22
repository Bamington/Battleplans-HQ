/**
 * AddToCalendar.tsx — "Add to Calendar" on a published pack, and the sheet of
 * destinations behind it.
 *
 * WHY THIS IS A CHOICE AND NOT A DOWNLOAD. An .ics file is the universal
 * answer and the wrong one for the largest group of readers: a Google Calendar
 * user gets a file in their downloads folder and has to find the import screen.
 * Google and Outlook on the web both take an event as a URL, so they get one,
 * and the file stays for everybody else — Apple Calendar, desktop Outlook,
 * Android, Thunderbird — where it is the thing that actually works.
 *
 * The event itself is built by lib/calendar.ts and passed in whole. This file
 * knows how to present three choices; it knows nothing about ICS syntax or
 * timezones.
 *
 * `onAdd` fires once, whichever destination is picked, and after the browser
 * has already been handed the event. It is how the page records the add, and
 * it is deliberately not awaited: bookkeeping must not be able to delay — or
 * fail — the thing the button is for.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AltArrowRight, Button, Calendar, DownloadMinimalistic, Sheet,
} from '@battleplans/ui';
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from '../lib/calendar';
import type { CalendarEvent } from '../lib/calendar';

export interface AddToCalendarProps {
  /**
   * The days to add — one per segment, or a single entry for a one-day event
   * or a league. Never empty: a pack with no dated day has nothing to put in a
   * calendar, and the caller drops the whole button rather than passing none.
   */
  events: CalendarEvent[];
  /**
   * Called once after a destination is chosen. Fire-and-forget: the return
   * value is ignored and the sheet closes regardless.
   */
  onAdd?: () => void;
  /**
   * What opens the sheet.
   *
   * `row` is the one the public page uses: the last row of the Key Info card,
   * flush with the facts above it. `button` is a standalone outline button,
   * which is what the gallery demonstrates and what any other placement would
   * want.
   */
  variant?: 'button' | 'row';
  /** Extra classes on the trigger. */
  className?: string;
}

/**
 * One destination.
 *
 * Styled as a Key Info row rather than as three stacked buttons: the sheet is
 * a list of places to send this, not three competing actions, and the pack
 * page already reads rows of one flat colour with an accent icon that way.
 *
 * A STEP LIGHTER THAN THE PANEL, NOT DARKER. Key Info recedes to gray-900 on
 * the pack's gray-800 card; a sheet's panel is already gray-900 (the shared
 * <Sheet> writes it as neutral-900, which the theme maps to the same value),
 * so the same rows have to come forward instead to be rows at all.
 */
const Destination = ({ icon, label, hint, trailing, onClick }: {
  icon: ReactNode;
  label: string;
  hint: string;
  trailing: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-3 text-left"
  >
    <span className="shrink-0 text-primary-500">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block font-body font-medium text-base leading-6 text-gray-50">{label}</span>
      <span className="block font-body text-sm leading-5 text-gray-400">{hint}</span>
    </span>
    <span className="shrink-0 text-gray-500">{trailing}</span>
  </button>
);

const AddToCalendar = ({ events, onAdd, variant = 'button', className = '' }: AddToCalendarProps) => {
  const [open, setOpen] = useState(false);

  // One day is the ordinary case, and it keeps the sheet to three rows. More
  // than one changes the shape rather than the wording — see the sheet below.
  const single = events.length === 1;
  const first  = events[0];

  /**
   * Do the thing, then close, then record.
   *
   * That order matters for the web calendars: `window.open` has to run inside
   * the click's own call stack or a popup blocker eats it, so nothing may be
   * awaited before it.
   */
  const pick = (go: () => void) => () => {
    go();
    setOpen(false);
    onAdd?.();
  };

  // noopener/noreferrer on both: these are third-party tabs, and a page we
  // hand `window.opener` to can navigate this one.
  const openTab = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <>
      {variant === 'row' ? (
        /* Deliberately the same geometry as a KeyInfoCard fact row — gap-2, a
           w-4 icon, px-4 py-3 — so it lands flush in the card rather than
           sitting in it. What separates it from the facts is the ACCENT LABEL:
           every row above states something about the event in gray-50, and the
           one row you can press says so by being the colour every other action
           in this app is. A hover state on a card whose other rows have none is
           the second half of that. */
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full flex items-center gap-2 bg-gray-900 hover:bg-gray-800 transition-colors px-4 py-3 text-left ${className}`}
        >
          <span className="shrink-0 text-primary-500"><Calendar className="w-4 h-4" /></span>
          <span className="flex-1 min-w-0 font-body font-medium text-base leading-6 text-primary-500">
            Add to Calendar
          </span>
        </button>
      ) : (
        <Button
          color="primary"
          variant="outline"
          leftIcon={<Calendar className="w-4 h-4" />}
          onClick={() => setOpen(true)}
          className={className}
        >
          Add to Calendar
        </Button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} className="max-w-md">
        <div className="px-5 pt-5 pb-4 shrink-0">
          <h2 className="font-heading text-xl leading-7 text-white">Add to Calendar</h2>
          <p className="font-body text-sm leading-5 text-gray-400 mt-1">
            {single ? first.title : `${events.length} days`}
          </p>
        </div>

        <div className="px-5 pb-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex flex-col gap-4">
          {/* The file first when there is more than one day, because it is the
              only destination that can take them all. Google and Outlook are
              pre-filled compose forms with room for exactly one event — there
              is no URL that adds a second day — so they are offered per day
              rather than hidden or quietly adding a fraction of what was
              asked for. */}
          <div className="flex flex-col gap-px rounded-xl overflow-hidden">
            <Destination
              icon={<Calendar className="w-5 h-5" />}
              /* Short enough to stay on one line at 375px. The hint carries
                 the rest — the file is what Apple Calendar, desktop Outlook,
                 Android and Thunderbird all accept. */
              label="Apple Calendar & others"
              hint={single ? 'Downloads an .ics file' : `Downloads all ${events.length} days as one file`}
              trailing={<DownloadMinimalistic className="w-4 h-4" />}
              onClick={pick(() => downloadIcs(events))}
            />
            {single && (
              <>
                <Destination
                  icon={<Calendar className="w-5 h-5" />}
                  label="Google Calendar"
                  hint="Opens in a new tab"
                  trailing={<AltArrowRight className="w-4 h-4" />}
                  onClick={pick(openTab(googleCalendarUrl(first)))}
                />
                <Destination
                  icon={<Calendar className="w-5 h-5" />}
                  label="Outlook"
                  hint="Outlook.com and Microsoft 365"
                  trailing={<AltArrowRight className="w-4 h-4" />}
                  onClick={pick(openTab(outlookCalendarUrl(first)))}
                />
              </>
            )}
          </div>

          {!single && events.map(event => (
            <div key={event.uid} className="flex flex-col gap-1.5">
              <p className="font-body font-bold text-xs uppercase tracking-wide text-gray-500">
                {event.title}
              </p>
              <div className="flex flex-col gap-px rounded-xl overflow-hidden">
                <Destination
                  icon={<Calendar className="w-5 h-5" />}
                  label="Google Calendar"
                  hint="Adds this day only"
                  trailing={<AltArrowRight className="w-4 h-4" />}
                  onClick={pick(openTab(googleCalendarUrl(event)))}
                />
                <Destination
                  icon={<Calendar className="w-5 h-5" />}
                  label="Outlook"
                  hint="Adds this day only"
                  trailing={<AltArrowRight className="w-4 h-4" />}
                  onClick={pick(openTab(outlookCalendarUrl(event)))}
                />
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
};

export default AddToCalendar;
