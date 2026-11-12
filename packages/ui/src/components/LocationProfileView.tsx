/**
 * LocationProfileView.tsx — the body of a venue or club's profile page.
 *
 * The location counterpart to ProfileView: same /@name address space, same
 * page shell (ProfilePage decides which one a handle belongs to). Pure — it is
 * handed everything get_location_profile returned, plus where its links go, so
 * the gallery can render every state without a database.
 *
 *   header   — logo, name, @slug, kind (and Test, for staff looking at one)
 *   address  — venues only; opens in Google Maps
 *   actions  — Book a table (a venue with opening hours), Manage (its admins)
 *   sections — Upcoming Events (only when there are any), Opening Hours (from
 *              bookable timeslots), Store Stats (opt-in, from bookings: top 5
 *              games and the 3 best days, as ranked lists with no numbers)
 *
 * Everything here is derived from what the platform already knows — the
 * hand-written details (about, photos, contact) arrive with the editor.
 */

import Button from './Button';
import Badge from './Badge';
import MapPin from '../icons/MapPin';
import Trophy from '../icons/Trophy';
import Calendar from '../icons/Calendar';
import Settings from '../icons/Settings';
import ExternalLink from '../icons/ExternalLink';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import { GAME_ICONS } from '../lib/gameArt';

export type LocationProfileKind = 'venue' | 'club';

export interface LocationProfileEvent {
  id: string;
  name: string;
  slug: string;
  starts_on: string | null;
  ends_on: string | null;
  /** Hosted by this club but held somewhere else. */
  hosted: boolean;
  game: { name: string; slug: string | null } | null;
}

/** get_location_profile(handle), as returned. */
export interface LocationProfile {
  location: {
    id: string;
    slug: string;
    name: string;
    kind: LocationProfileKind;
    /** An image URL, an emoji, or empty. */
    icon: string | null;
    address: string | null;
    country: string | null;
    is_test: boolean;
  };
  viewer: { can_manage: boolean; is_member: boolean };
  /** Admins only: the profile's switches, as stored. */
  settings?: { show_stats: boolean } | null;
  /** Enabled tables grouped by label. No longer shown; kept for older callers. */
  tables?: { label: string | null; count: number }[];
  /** Bookable timeslots, one entry per weekday each runs on. */
  hours?: LocationProfileSlot[];
  /** Null unless the venue switched stats on and has enough bookings. */
  stats?: LocationProfileStats | null;
  events: LocationProfileEvent[];
}

export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface LocationProfileSlot {
  day: Weekday;
  /** 'HH:MM', 24-hour. */
  start: string;
  end: string;
  name: string;
  /** 1 = every week; 2 = fortnightly, counted from anchor_date. */
  interval_weeks: number;
  anchor_date: string | null;
  audience: 'anyone' | 'members';
}

export interface LocationProfileStats {
  /** Bookings in the last twelve months. */
  bookings: number;
  /** Most-booked games, most first (top five). */
  games: { name: string; slug: string | null; count: number }[];
  /** Bookings by ISO weekday (1 = Monday). Days with none are absent. */
  days: { dow: number; count: number }[];
}

export interface LocationProfileViewProps {
  profile: LocationProfile;
  /** Where an event's public page lives. */
  eventHref: (slug: string) => string;
  /** Book a table here. Omit to hide the button (e.g. no booking app). */
  onBook?: () => void;
  /**
   * Book on a particular date (YYYY-MM-DD) — the "Book table" on each Opening
   * Hours row. Pass it only for a signed-in viewer; omit and the rows have none.
   */
  onBookDate?: (date: string) => void;
  /** Manage this location. Shown only to its own staff, and only when given. */
  onManage?: () => void;
}

const KIND_LABEL: Record<LocationProfileKind, string> = { venue: 'Venue', club: 'Club' };

/** 'Sat 22 Aug 2026', or 'Sat 22 Aug – Sun 23 Aug 2026' over several days. */
function formatEventDates(starts: string | null, ends: string | null): string {
  if (!starts) return 'Date to be announced';
  const d = (iso: string) => new Date(`${iso}T00:00:00`);
  const day = (iso: string) => d(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const year = (iso: string) => d(iso).getFullYear();
  if (!ends || ends === starts) return `${day(starts)} ${year(starts)}`;
  return `${day(starts)} – ${day(ends)} ${year(ends)}`;
}

const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** '10:30' → '10:30am', '18:00' → '6pm'. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

/** Back-to-back or overlapping slots read as one stretch of opening. */
function mergeRanges(slots: LocationProfileSlot[]): { start: string; end: string }[] {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const out: { start: string; end: string }[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) { if (s.end > last.end) last.end = s.end; }
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** Local YYYY-MM-DD — the viewer's own today, not UTC's. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Does this slot run on this date? Weekly always; fortnightly etc. by anchor. */
function runsOn(slot: LocationProfileSlot, date: Date): boolean {
  if (slot.interval_weeks <= 1 || !slot.anchor_date) return true;
  const anchor = new Date(`${slot.anchor_date}T00:00:00`);
  const weeks = Math.round((date.getTime() - anchor.getTime()) / (7 * 86_400_000));
  return ((weeks % slot.interval_weeks) + slot.interval_weeks) % slot.interval_weeks === 0;
}

/** The next date (from today) this weekday's slots actually run, or null. */
function nextDateFor(day: Weekday, slots: LocationProfileSlot[], today = new Date()): string | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 * 8; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (WEEKDAYS[(d.getDay() + 6) % 7] !== day) continue;
    if (slots.some(s => runsOn(s, d))) return isoDate(d);
  }
  return null;
}

function Logo({ icon, kind }: { icon: string | null; kind: LocationProfileKind }) {
  return (
    <div className="w-[160px] h-[160px] rounded-lg overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
      {icon?.startsWith('http')
        ? <img src={icon} alt="" className="w-full h-full object-cover" />
        : icon
          ? <span className="text-7xl leading-none">{icon}</span>
          : kind === 'club'
            ? <UsersGroupRounded className="w-14 h-14 text-neutral-400" />
            : <MapPin className="w-14 h-14 text-neutral-400" />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg text-white">{title}</h2>
      {children}
    </section>
  );
}

/**
 * One row of a ranked list — "1. Warhammer 40,000". Rank only: the page never
 * prints booking numbers.
 */
function RankedItem({ rank, label, icon }: { rank: number; label: string; icon?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-right font-heading text-base text-neutral-400 tabular-nums">{rank}.</span>
      {icon}
      <span className="font-body text-sm text-neutral-50 truncate">{label}</span>
    </li>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="font-body text-sm text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3">{children}</p>
);

export default function LocationProfileView({ profile, eventHref, onBook, onBookDate, onManage }: LocationProfileViewProps) {
  const { location: loc, viewer, events } = profile;
  const hours = profile.hours ?? [];
  const stats = profile.stats ?? null;
  const canBook = !!onBook && loc.kind === 'venue' && hours.length > 0;
  const todayName = WEEKDAYS[(new Date().getDay() + 6) % 7];
  const byDay = WEEKDAYS.map(day => ({ day, slots: hours.filter(h => h.day === day) }));
  const statsNoun = loc.kind === 'club' ? 'Club' : 'Store';
  // The three busiest weekdays, busiest first.
  const bestDays = stats
    ? [...stats.days].filter(d => d.count > 0).sort((a, b) => b.count - a.count || a.dow - b.dow).slice(0, 3)
    : [];
  const mapsHref = loc.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.name}, ${loc.address}`)}`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <article className="w-full max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 gap-4 flex flex-col items-center">
          <Logo icon={loc.icon} kind={loc.kind} />

          <div className="flex flex-col w-full items-center gap-1">
            <h1 className="font-heading text-white text-4xl leading-10 text-center break-words [text-shadow:0px_0px_4px_rgba(255,255,255,0.1)]">
              {loc.name}
            </h1>
            <p className="font-body text-base text-neutral-400 leading-6">@{loc.slug}</p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              <Badge color="primary">{KIND_LABEL[loc.kind]}</Badge>
              {viewer.is_member && <Badge color="success">Member</Badge>}
              {loc.is_test && <Badge variant="outline" color="warning">Test</Badge>}
            </div>
          </div>

          {loc.kind === 'venue' && loc.address && mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-1.5 font-body text-sm text-neutral-300 hover:text-white text-center"
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-neutral-400" />
              <span>{loc.address}</span>
            </a>
          )}

          {(canBook || (viewer.can_manage && onManage)) && (
            <div className="flex flex-col gap-2 w-full pt-1">
              {canBook && (
                <Button color="primary" leftIcon={<Calendar className="w-4 h-4" />} className="w-full justify-center" onClick={onBook}>
                  Book a table
                </Button>
              )}
              {viewer.can_manage && onManage && (
                <Button variant="outline" color="secondary" leftIcon={<Settings className="w-4 h-4" />} className="w-full justify-center" onClick={onManage}>
                  Manage {KIND_LABEL[loc.kind].toLowerCase()}
                </Button>
              )}
            </div>
          )}
        </div>
      </article>

      {events.length > 0 && (
        <Section title="Upcoming Events">
          <div className="flex flex-col gap-1.5">
            {events.map(e => {
              const icon = e.game?.slug ? GAME_ICONS[e.game.slug] : undefined;
              return (
                <a
                  key={e.id}
                  href={eventHref(e.slug)}
                  className="bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded-lg p-[13px] flex gap-3 items-center shadow-md overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
                    {icon
                      ? <img src={icon} alt="" className="w-full h-full object-cover" />
                      : <Trophy className="w-7 h-7 text-neutral-500" />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-heading text-lg text-white leading-6 line-clamp-2">{e.name}</span>
                    <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
                      {e.game?.name ?? 'No game'}{e.hosted ? ' · Hosted elsewhere' : ''}
                    </span>
                    <span className="font-body text-sm text-neutral-50 leading-5 truncate">
                      {formatEventDates(e.starts_on, e.ends_on)}
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-neutral-500 shrink-0" />
                </a>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Opening Hours">
        {hours.length === 0 ? <Empty>No opening hours listed yet.</Empty> : (
          <ul className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-md divide-y divide-neutral-700/70">
            {byDay.map(({ day, slots }) => {
              const ranges = mergeRanges(slots);
              const open = ranges.length > 0;
              const occasional = open && slots.every(sl => sl.interval_weeks > 1);
              const nextDate = open && onBookDate ? nextDateFor(day, slots) : null;
              const isToday = day === todayName;
              return (
                <li key={day} className="flex items-center gap-3 px-[13px] py-2.5 min-h-[52px]">
                  <span className={`w-24 shrink-0 font-body text-sm ${isToday ? 'font-bold text-white' : 'text-neutral-300'}`}>
                    {day}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    {open ? (
                      <span className="font-body text-sm text-neutral-50">
                        {ranges.map(r => `${formatTime(r.start)} – ${formatTime(r.end)}`).join(', ')}
                      </span>
                    ) : (
                      <span className="font-body text-sm text-neutral-500">Closed</span>
                    )}
                    {occasional && (
                      <span className="font-body text-xs text-neutral-400">Every {slots[0].interval_weeks} weeks</span>
                    )}
                  </div>
                  {nextDate && (
                    <Button size="xs" variant="outline" color="primary" onClick={() => onBookDate!(nextDate)}>
                      Book table
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {stats && (
        <Section title={`${statsNoun} Stats`}>
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] shadow-md flex flex-col gap-5">
            {stats.games.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-heading text-sm uppercase tracking-wide text-neutral-300">Top 5 games this year</h3>
                <ol className="flex flex-col gap-2">
                  {stats.games.map((g, i) => {
                    const icon = g.slug ? GAME_ICONS[g.slug] : undefined;
                    return (
                      <RankedItem
                        key={g.name}
                        rank={i + 1}
                        label={g.name}
                        icon={icon ? <img src={icon} alt="" className="w-5 h-5 rounded-sm object-cover shrink-0" /> : undefined}
                      />
                    );
                  })}
                </ol>
              </div>
            )}
            {bestDays.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-heading text-sm uppercase tracking-wide text-neutral-300">Best Days to Play</h3>
                <ol className="flex flex-col gap-2">
                  {bestDays.map((d, i) => (
                    <RankedItem key={d.dow} rank={i + 1} label={WEEKDAYS[d.dow - 1]} />
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
