/**
 * LocationProfileView.tsx — the body of a venue or club's profile page.
 *
 * The location counterpart to ProfileView: same /@name address space, same
 * page shell (ProfilePage decides which one a handle belongs to). Pure — it is
 * handed everything get_location_profile returned, plus where its links go, so
 * the gallery can render every state without a database.
 *
 * Stores and clubs share every section; labels follow `kind`.
 *
 *   header   — cover image, logo, name, @slug · Est. year, kind, address
 *              (venues; opens in Google Maps), links
 *   actions  — Book a table (a venue with opening hours), else the first link
 *              as the main button; Manage (its admins)
 *   sections — About · Where We Play (club) / Clubs That Play Here (venue) ·
 *              Upcoming Events · Opening Hours (venue) / Club Nights (club) ·
 *              Store/Club Stats · Past Events · House Rules (venue) / Code of
 *              Conduct (club). Each is hidden when it has nothing to say,
 *              except a venue's Opening Hours.
 *
 * Events come from BattlePack. One can be held AT a store and run BY a club,
 * so each row names whichever of the two this page isn't: "at Guf Werribee" on
 * the club's page, "Run by Mini Myths" on the store's.
 */

import { useState } from 'react';
import Button from './Button';
import Badge from './Badge';
import MarkdownBody from './MarkdownBody';
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
  /** Hosted by this club but held somewhere else. Superseded by `venue`. */
  hosted: boolean;
  game: { name: string; slug: string | null } | null;
  /** Where it's held, when that isn't this location. */
  venue?: { name: string; slug: string | null } | null;
  /** The club running it, when that isn't this location. Slug only if its page is public. */
  host?: { name: string; slug: string | null } | null;
}

export interface LocationProfileLink {
  label: string;
  url: string;
}

/** The hand-written part of the page, from location_profiles. */
export interface LocationProfileContent {
  /** Markdown. */
  about: string | null;
  cover_url: string | null;
  /** Width ÷ height, so the page can hold the space before the image loads. */
  cover_aspect: number | null;
  founded_year: number | null;
  /** The first is the page's main button when there's no booking to offer. */
  links: LocationProfileLink[];
  /** Markdown — House Rules for a store, Code of Conduct for a club. */
  rules: string | null;
  /** The full version, kept elsewhere. */
  rules_url: string | null;
}

/** A venue on a club's page, or a club on a venue's. */
export interface LocationProfilePlace {
  id: string;
  slug: string | null;
  name: string;
  icon: string | null;
  /** Venues only. */
  address?: string | null;
  /** The club's home venue. */
  home: boolean;
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
  settings?: { show_stats: boolean; is_public?: boolean } | null;
  profile?: LocationProfileContent | null;
  /** Enabled tables grouped by label. No longer shown; kept for older callers. */
  tables?: { label: string | null; count: number }[];
  /** Bookable timeslots, one entry per weekday each runs on. */
  hours?: LocationProfileSlot[];
  /** Null unless the venue switched stats on and has enough bookings. */
  stats?: LocationProfileStats | null;
  /** A club's venues: listed by the club, or where it has run events. */
  venues?: LocationProfilePlace[];
  /** A venue's clubs: public clubs that list it or run events there. */
  clubs?: LocationProfilePlace[];
  events: LocationProfileEvent[];
  /** Finished events, newest first (up to 20). */
  past_events?: LocationProfileEvent[];
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
  /** Where another venue or club's profile lives. Omit and they aren't links. */
  placeHref?: (slug: string) => string;
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

/** Past events shown before "Show all". */
const PAST_PREVIEW = 5;

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

/** 'discord.gg/abc' from 'https://discord.gg/abc/' — for a link with no label. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function Logo({ icon, kind, size = 160, className = '' }: { icon: string | null; kind: LocationProfileKind; size?: number; className?: string }) {
  return (
    <div
      className={`rounded-lg overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {icon?.startsWith('http')
        ? <img src={icon} alt="" className="w-full h-full object-cover" />
        : icon
          ? <span className="leading-none" style={{ fontSize: size * 0.45 }}>{icon}</span>
          : kind === 'club'
            ? <UsersGroupRounded className="w-[35%] h-[35%] text-neutral-400" />
            : <MapPin className="w-[35%] h-[35%] text-neutral-400" />}
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

const PANEL = 'bg-neutral-800 border border-neutral-700 rounded-lg shadow-md';

/** An event, naming whichever of venue and host this page isn't. */
function EventRow({ event: e, href, past }: { event: LocationProfileEvent; href: string; past?: boolean }) {
  const icon = e.game?.slug ? GAME_ICONS[e.game.slug] : undefined;
  const where = e.host ? `Run by ${e.host.name}` : e.venue ? `at ${e.venue.name}` : e.hosted ? 'Hosted elsewhere' : null;
  return (
    <a
      href={href}
      className={`${PANEL} hover:border-neutral-500 p-[13px] flex gap-3 items-center overflow-hidden`}
    >
      <div className={`${past ? 'w-12 h-12' : 'w-16 h-16'} rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center`}>
        {icon
          ? <img src={icon} alt="" className="w-full h-full object-cover" />
          : <Trophy className="w-7 h-7 text-neutral-500" />}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className={`font-heading text-white leading-6 line-clamp-2 ${past ? 'text-base' : 'text-lg'}`}>{e.name}</span>
        <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
          {e.game?.name ?? 'No game'}{where ? ` · ${where}` : ''}
        </span>
        <span className="font-body text-sm text-neutral-50 leading-5 truncate">
          {formatEventDates(e.starts_on, e.ends_on)}
        </span>
      </div>
      <ExternalLink className="w-4 h-4 text-neutral-500 shrink-0" />
    </a>
  );
}

/** A venue on a club's page, or a club on a venue's. `kind` is the place's. */
function PlaceRow({ place, kind, href }: { place: LocationProfilePlace; kind: LocationProfileKind; href?: string }) {
  const body = (
    <>
      <Logo icon={place.icon} kind={kind} size={40} className="rounded-md" />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-heading text-base text-white leading-6 truncate">{place.name}</span>
        {place.address && <span className="font-body text-xs text-neutral-400 leading-4 truncate">{place.address}</span>}
      </div>
      {place.home && <Badge color="primary">{kind === 'venue' ? 'Home venue' : 'Home club'}</Badge>}
    </>
  );
  const cls = 'flex items-center gap-3 px-[13px] py-2.5';
  return (
    <li>
      {href
        ? <a href={href} className={`${cls} hover:bg-neutral-700/40`}>{body}</a>
        : <div className={cls}>{body}</div>}
    </li>
  );
}

export default function LocationProfileView({ profile, eventHref, placeHref, onBook, onBookDate, onManage }: LocationProfileViewProps) {
  const { location: loc, viewer, events } = profile;
  const [showAllPast, setShowAllPast] = useState(false);
  const isClub = loc.kind === 'club';
  const content = profile.profile ?? null;
  const links = content?.links ?? [];
  const hours = profile.hours ?? [];
  const stats = profile.stats ?? null;
  const pastEvents = profile.past_events ?? [];
  const places = (isClub ? profile.venues : profile.clubs) ?? [];
  const canBook = !!onBook && loc.kind === 'venue' && hours.length > 0;
  // With no booking to offer, the first link (Join our Discord…) is the page's
  // main action.
  const leadLink = !canBook ? links[0] : undefined;
  const otherLinks = leadLink ? links.slice(1) : links;
  const todayName = WEEKDAYS[(new Date().getDay() + 6) % 7];
  const byDay = WEEKDAYS.map(day => ({ day, slots: hours.filter(h => h.day === day) }));
  const noun = isClub ? 'Club' : 'Store';
  // The three busiest weekdays, busiest first.
  const bestDays = stats
    ? [...stats.days].filter(d => d.count > 0).sort((a, b) => b.count - a.count || a.dow - b.dow).slice(0, 3)
    : [];
  const mapsHref = loc.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.name}, ${loc.address}`)}`
    : null;
  const shownPast = showAllPast ? pastEvents : pastEvents.slice(0, PAST_PREVIEW);
  const hasCover = !!content?.cover_url;

  return (
    <div className="flex flex-col gap-8">
      <article className="w-full max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
        {hasCover && (
          <div className="w-full bg-neutral-800" style={{ aspectRatio: String(content!.cover_aspect ?? 2) }}>
            <img src={content!.cover_url!} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 gap-4 flex flex-col items-center">
          <Logo
            icon={loc.icon}
            kind={loc.kind}
            size={hasCover ? 128 : 160}
            className={hasCover ? '-mt-20 ring-4 ring-neutral-900 shadow-lg' : ''}
          />

          <div className="flex flex-col w-full items-center gap-1">
            <h1 className="font-heading text-white text-4xl leading-10 text-center break-words [text-shadow:0px_0px_4px_rgba(255,255,255,0.1)]">
              {loc.name}
            </h1>
            <p className="font-body text-base text-neutral-400 leading-6">
              @{loc.slug}{content?.founded_year ? ` · Est. ${content.founded_year}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              <Badge color="primary">{KIND_LABEL[loc.kind]}</Badge>
              {viewer.is_member && <Badge color="success">Member</Badge>}
              {isClub && profile.settings?.is_public === false && <Badge variant="outline" color="gray">Private</Badge>}
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

          {otherLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {otherLinks.map(l => (
                <Button
                  key={l.url}
                  href={l.url}
                  external
                  size="xs"
                  variant="outline"
                  color="secondary"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  {l.label || shortUrl(l.url)}
                </Button>
              ))}
            </div>
          )}

          {(canBook || leadLink || (viewer.can_manage && onManage)) && (
            <div className="flex flex-col gap-2 w-full pt-1">
              {canBook && (
                <Button color="primary" leftIcon={<Calendar className="w-4 h-4" />} className="w-full justify-center" onClick={onBook}>
                  Book a table
                </Button>
              )}
              {leadLink && (
                <Button
                  href={leadLink.url}
                  external
                  color="primary"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                  className="w-full justify-center"
                >
                  {leadLink.label || shortUrl(leadLink.url)}
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

      {content?.about && (
        <Section title="About">
          <div className={`${PANEL} p-[13px]`}>
            <MarkdownBody className="text-sm leading-6 text-neutral-200">{content.about}</MarkdownBody>
          </div>
        </Section>
      )}

      {places.length > 0 && (
        <Section title={isClub ? 'Where We Play' : 'Clubs That Play Here'}>
          <ul className={`${PANEL} divide-y divide-neutral-700/70 overflow-hidden`}>
            {places.map(p => (
              <PlaceRow
                key={p.id}
                place={p}
                kind={isClub ? 'venue' : 'club'}
                href={p.slug && placeHref ? placeHref(p.slug) : undefined}
              />
            ))}
          </ul>
        </Section>
      )}

      {events.length > 0 && (
        <Section title="Upcoming Events">
          <div className="flex flex-col gap-1.5">
            {events.map(e => <EventRow key={e.id} event={e} href={eventHref(e.slug)} />)}
          </div>
        </Section>
      )}

      {/* A club without regular nights just doesn't show the section. */}
      {(!isClub || hours.length > 0) && (
        <Section title={isClub ? 'Club Nights' : 'Opening Hours'}>
          {hours.length === 0 ? <Empty>No opening hours listed yet.</Empty> : (
            <ul className={`${PANEL} divide-y divide-neutral-700/70`}>
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
      )}

      {stats && (
        <Section title={`${noun} Stats`}>
          <div className={`${PANEL} p-[13px] flex flex-col gap-5`}>
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

      {pastEvents.length > 0 && (
        <Section title="Past Events">
          <div className="flex flex-col gap-1.5">
            {shownPast.map(e => <EventRow key={e.id} event={e} href={eventHref(e.slug)} past />)}
          </div>
          {pastEvents.length > PAST_PREVIEW && (
            <Button size="xs" variant="outline" color="secondary" className="self-start" onClick={() => setShowAllPast(v => !v)}>
              {showAllPast ? 'Show fewer' : `Show all ${pastEvents.length}`}
            </Button>
          )}
        </Section>
      )}

      {(content?.rules || content?.rules_url) && (
        <Section title={isClub ? 'Code of Conduct' : 'House Rules'}>
          <div className={`${PANEL} p-[13px] flex flex-col gap-3`}>
            {content.rules && (
              <MarkdownBody className="text-sm leading-6 text-neutral-200">{content.rules}</MarkdownBody>
            )}
            {content.rules_url && (
              <a
                href={content.rules_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-body text-sm text-primary-400 hover:text-primary-300 self-start"
              >
                Read the full {isClub ? 'Code of Conduct' : 'house rules'}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
