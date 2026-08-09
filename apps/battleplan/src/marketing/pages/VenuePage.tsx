/**
 * VenuePage.tsx — battleplan.app/venue, for stores
 *
 * Same components, same order, same accent as the player page. That's
 * deliberate: it's one product addressed to a different reader, and looking
 * identical is the point. The only structural differences are three pillars
 * instead of four, no Callout, and an FAQ — a shop owner deciding whether to
 * list has questions a player doesn't.
 */

import { MarketingLayout } from '../MarketingLayout';
import { Section } from '../components/Section';
import { Hero } from '../components/Hero';
import { PillarGrid, type Pillar } from '../components/PillarGrid';
import { FeatureDeepDive } from '../components/FeatureDeepDive';
import { TileGrid, type Tile } from '../components/TileGrid';
import { FAQ, type FAQItem } from '../components/FAQ';
import { Testimonials, type Testimonial } from '../components/Testimonials';
import { ClosingCTA } from '../components/ClosingCTA';
import { VenueSignupForm } from '../components/VenueSignupForm';
import { TablesDemo } from '../components/demos/TablesDemo';
import { DayDemo } from '../components/demos/DayDemo';
import { Calendar, Store, Chart, Server, Phone, Mail, Buildings, Bolt } from '../icons';

/*
 * Screenshots of the real app against the Burrow Games fixture — an invented
 * venue with invented customers, so no real shop's booking diary is on show.
 *
 * Rebuild with: node tools/screenshots/capture.mjs && node tools/screenshots/optimise.mjs
 */
import shotManageStore from '../assets/shots/venue-manage-store.webp';
import shotManageStoreMobile from '../assets/shots/venue-manage-store-mobile.webp';
import shotTables from '../assets/shots/venue-tables.webp';
import shotToday from '../assets/shots/venue-today.webp';
import shotStats from '../assets/shots/venue-stats.webp';
import shotStatsMobile from '../assets/shots/venue-stats-mobile.webp';

/* Tall and narrow, closer to the shape of the column it photographs. */
const COLUMN    = 'aspect-[9/21]';

const PILLARS: Pillar[] = [
  {
    icon: Calendar,
    title: 'Take bookings',
    body: 'Your tables, your timeslots, your closures. Players book what’s genuinely free.',
  },
  {
    icon: Store,
    title: 'Run your floor',
    body: 'Today’s bookings on one screen. Who’s in, when, and what they’re playing.',
  },
  {
    icon: Chart,
    title: 'Understand your customers',
    body: 'Which games fill tables, which nights are dead, who your regulars are.',
  },
  {
    icon: Phone,
    title: 'Available anywhere',
    body: 'Manage your store from behind the counter or on your phone.',
  },
];

const TILES: Tile[] = [
  { icon: Bolt, title: 'Easy setup', body: 'No hardware. No POS integration. Setup in minutes.' },
  { icon: Phone, title: 'Works on a phone', body: 'Built for the screen you already have in your hand.' },
  { icon: Mail, title: 'Fewer no-shows', body: 'Every booking sends a confirmation email, and every cancellation too.' },
  { icon: Buildings, title: 'Multiple stores', body: 'Add all your locations and manage them separately, from the same place.' },
  { icon: Server, title: 'Ongoing support', body: 'New updates every week, based on your feedback.' },
];

const FAQS: FAQItem[] = [
  {
    question: 'How long does setup take?',
    answer: 'An afternoon at most. Add your tables, set your timeslots, block your closures. Most of it is a one-off.',
  },
  {
    question: 'Do my customers need an account?',
    answer: 'Yes — a free one, with an email address. That’s what makes confirmation emails and the booking history work. Staff can also book on behalf of anyone who phones or walks in.',
  },
  {
    question: 'I already take bookings by phone. Does this replace that?',
    answer: 'Only if you want it to. Plenty of venues run both — staff enter phone bookings on the same screen, so the diary stays in one place either way.',
  },
  {
    question: 'What happens during a tournament, when tables aren’t available?',
    answer: 'Block the date. It disappears from what players can book, and comes back when you unblock it.',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'We were losing bookings in a Messenger inbox nobody had time to read. Now it’s one screen and the tables are fuller.',
    name: 'Name Surname',
    detail: '[Store Name], [Town]',
  },
  {
    quote: 'The stats told me our Sunday afternoons were dead and our Thursdays were turning people away. We moved a club night. It worked.',
    name: 'Name Surname',
    detail: '[Store Name], [Town]',
  },
  {
    quote: 'Setup took an afternoon and I’ve barely touched it since. It just runs.',
    name: 'Name Surname',
    detail: '[Store Name], [Town]',
  },
];

export default function VenuePage() {
  return (
    <MarketingLayout
      title="BattlePlan for venues — Your tables, booked."
      description="Players book your tables directly, you see the day on one screen, and you find out which games actually fill your floor. Completely free for stores and clubs."
    >
      <Hero
        title={<>Your tables, booked.</>}
        lead="Stop running your table bookings through Messenger, a paper diary and a group chat. Players book directly, you see the day on one screen, and you finally find out which games are filling your tables."
        secondaryCta={{ to: '/', label: 'Benefits for Players' }}
        note="Completely free for stores and clubs."
        // Same strip, different question answered: a shop owner wants to know
        // which of their peers is already doing this.
        logos={{ label: 'Already taking bookings at' }}
        trustLine="[PLACEHOLDER] 18 venues. 4,100 tables booked this year."
        src={shotManageStore}
        srcMobile={shotManageStoreMobile}
        alt="The venue management screen: blocked dates, tables, bookings by date and timeslots, side by side."
        aspect="aspect-[39/84] md:aspect-[8/5]"
      />

      <Section tone="raised">
        <PillarGrid
          eyebrow="Built for game stores and clubs"
          title="Run your tables effortlessly."
          pillars={PILLARS}
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Setup"
          title="You decide what's available, and when."
          body="Add your tables, set the timeslots you actually run, and block out the dates you're closed or running a tournament. Nothing outside that is bookable, so you never get a booking you can't honour."
          bullets={[
            "Define what tables you have, when they're available, and what activities they're open for",
            'Set the timeslots that suit your opening hours',
            'Block dates for events, holidays and closures',
            'Change any of it whenever you like — it takes effect immediately',
          ]}
          imageSide="left"
          /* The venue page's interactive section. shotTables stays imported so
             reverting to the screenshot is a one-line change. */
          demo={<TablesDemo />}
          wideFrame
          src={shotTables}
          alt="The tables panel, each table listed with the timeslots it can be booked in."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Day to day"
          title="Open one screen and know your day."
          body="Your team understands the day at a glance. Jump to any date to see what's on, and make changes quickly and easily to adjust to the conditions of your store."
          bullets={[
            "Today's bookings, always front and centre",
            'Look ahead to any date',
            'Book on behalf of walk-ins and phone calls',
            'Automatic confirmation emails, so people turn up',
          ]}
          imageSide="right"
          /* shotToday stays imported so reverting to the screenshot is a
             one-line change. */
          demo={<DayDemo />}
          wideFrame
          src={shotToday}
          alt="Today's bookings at a venue, grouped by timeslot, showing who is in and what they are playing."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Statistics"
          title="Make great decisions based on real data."
          body="Should you run Warhammer on Thursday nights? See what your players are playing, and when your store is busiest. Insights like you've never had before."
          bullets={[
            'Bookings over time, and month by month',
            'Your most booked games',
            'Your most frequent bookers',
            'Busiest days of the week and busiest timeslots',
          ]}
          /* Full width above the copy, matching the player page's stats
             section — same screen, same reason: three panels of small figures
             need the whole column to stay legible. */
          layout="stacked"
          src={shotStats}
          srcMobile={shotStatsMobile}
          alt="Venue statistics: bookings by month, most booked games, most frequent bookers, busiest days and timeslots."
          aspect="aspect-[39/84] md:aspect-[8/5]"
        />
      </Section>

      {/*
        The "News & updates" deep dive was here. It's the one section with no
        screenshot to show — its subject is the News & Updates column, which is
        deliberately hidden from every capture. Tones below shift up one step to
        keep the base/raised alternation unbroken.
      */}

      <Section tone="raised">
        <TileGrid title="What you don't have to worry about." tiles={TILES} />
      </Section>

      <Section tone="base">
        <FAQ title="Questions we get asked." items={FAQS} />
      </Section>

      <Section tone="raised">
        <Testimonials title="What venues say" testimonials={TESTIMONIALS} />
      </Section>

      {/*
        Closes on a form rather than two buttons. NOTE: the form has no
        destination yet — see VenueSignupForm. It says so on screen when
        submitted rather than pretending to have sent anything.
      */}
      <ClosingCTA
        title="Get your tables on the map."
        body="Listing your venue is free, and takes an afternoon to set up."
      >
        <VenueSignupForm />
      </ClosingCTA>
    </MarketingLayout>
  );
}
