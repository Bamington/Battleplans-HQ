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
   * The event to add. Non-null: a pack with no date has no event, and the
   * caller drops the whole button rather than passing nothing — there is no
   * useful "Add to Calendar" for an event with no date.
   */
  event: CalendarEvent;
  /**
   * Called once after a destination is chosen. Fire-and-forget: the return
   * value is ignored and the sheet closes regardless.
   */
  onAdd?: () => void;
  /** Extra classes on the trigger button. */
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

const AddToCalendar = ({ event, onAdd, className = '' }: AddToCalendarProps) => {
  const [open, setOpen] = useState(false);

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
      <Button
        color="primary"
        variant="outline"
        leftIcon={<Calendar className="w-4 h-4" />}
        onClick={() => setOpen(true)}
        className={className}
      >
        Add to Calendar
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} className="max-w-md">
        <div className="px-5 pt-5 pb-4 shrink-0">
          <h2 className="font-heading text-xl leading-7 text-white">Add to Calendar</h2>
          <p className="font-body text-sm leading-5 text-gray-400 mt-1">{event.title}</p>
        </div>

        <div className="px-5 pb-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex flex-col gap-px rounded-xl overflow-hidden">
            <Destination
              icon={<Calendar className="w-5 h-5" />}
              label="Google Calendar"
              hint="Opens in a new tab"
              trailing={<AltArrowRight className="w-4 h-4" />}
              onClick={pick(openTab(googleCalendarUrl(event)))}
            />
            <Destination
              icon={<Calendar className="w-5 h-5" />}
              label="Outlook"
              hint="Outlook.com and Microsoft 365"
              trailing={<AltArrowRight className="w-4 h-4" />}
              onClick={pick(openTab(outlookCalendarUrl(event)))}
            />
            <Destination
              /* Calendar in the accent column like the other two — the leading
                 icon says what these rows ARE. What differs is where the row
                 goes, and that is the trailing glyph's job: a chevron leaves,
                 an arrow lands in the downloads folder. */
              icon={<Calendar className="w-5 h-5" />}
              /* Short enough to stay on one line at 375px. The hint carries
                 the rest — the file is what Apple Calendar, desktop Outlook,
                 Android and Thunderbird all accept. */
              label="Apple Calendar & others"
              hint="Downloads an .ics file"
              trailing={<DownloadMinimalistic className="w-4 h-4" />}
              onClick={pick(() => downloadIcs(event))}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
};

export default AddToCalendar;
