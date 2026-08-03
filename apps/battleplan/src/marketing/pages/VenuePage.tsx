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
import {
  Calendar, Store, Chart,
  Server, Plug, Wallet, Phone, Mail, Buildings, Bolt, Shield,
} from '../icons';

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
];

const TILES: Tile[] = [
  { icon: Server, title: 'No hardware', body: 'It runs in a browser. If you have a phone behind the counter, you’re set.' },
  { icon: Plug, title: 'No POS integration', body: 'Nothing to plug into your till system. Nothing to break.' },
  { icon: Wallet, title: 'Free to list', body: 'No card, no setup fee.' },
  { icon: Phone, title: 'Works on a phone', body: 'Built for the screen you already have in your hand.' },
  { icon: Mail, title: 'Fewer no-shows', body: 'Every booking sends a confirmation email, and every cancellation too.' },
  { icon: Buildings, title: 'More than one site', body: 'Running two shops? Manage both from one account.' },
  { icon: Bolt, title: 'Set up in an afternoon', body: 'Tables, timeslots, done.' },
  { icon: Shield, title: 'Your customers, yours', body: 'We don’t market to your players.' },
];

const FAQS: FAQItem[] = [
  {
    question: 'What does it cost?',
    answer: 'Nothing at the moment. BattlePlan is free for players and free for venues. If that changes we’ll tell venues well in advance — no one’s card is on file and nothing switches off without notice.',
  },
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
  {
    question: 'Who owns the data?',
    answer: 'You can see everything about bookings at your venue. We don’t sell it, and we don’t market to your players off the back of it.',
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
      description="Players book your tables directly, you see the day on one screen, and you find out which games actually fill your floor. Free to list your venue."
    >
      <Hero
        title={<>Your tables, booked.</>}
        lead="Stop running your table bookings through Messenger, a paper diary and a group chat. Players book directly, you see the day on one screen, and you finally find out which games are filling your tables."
        primaryCta={{ to: '/login', label: 'List your venue' }}
        secondaryCta={{ to: '/', label: 'See what players get' }}
        note="Free to list your venue."
        // Same strip, different question answered: a shop owner wants to know
        // which of their peers is already doing this.
        logos={{ label: 'Already taking bookings at' }}
        trustLine="[PLACEHOLDER] 18 venues. 4,100 tables booked this year."
        mock="store"
      />

      <Section tone="raised">
        <PillarGrid
          eyebrow="Built for game stores and clubs"
          title="Set it up once. Run it from behind the counter."
          pillars={PILLARS}
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Setup"
          title="You decide what's bookable. The app enforces it."
          body="Add your tables, set the timeslots you actually run, and block out the dates you're closed or running a tournament. Nothing outside that is bookable, so you never get a booking you can't honour."
          bullets={[
            'Define every table you have',
            'Set the timeslots that suit your opening hours',
            'Block dates for events, holidays and closures',
            'Change any of it whenever you like — it takes effect immediately',
          ]}
          imageSide="left"
          mock="store"
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Day to day"
          title="Open one screen and know your day."
          body="Today's bookings and everything coming up, in the order they'll happen. Jump to any date to see what's on. Staff can book on behalf of anyone who phones or walks in, so the diary stays complete instead of splitting in two."
          bullets={[
            "Today's bookings, always front and centre",
            'Look ahead to any date',
            'Book on behalf of walk-ins and phone calls',
            'Automatic confirmation emails, so people turn up',
          ]}
          imageSide="right"
          mock="booking"
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Statistics"
          title="Should you run a Warhammer night on a Thursday?"
          body="Now you can answer that from your own numbers instead of a hunch. Everything here comes from bookings made through BattlePlan — real tables, real dates, at your venue."
          bullets={[
            'Bookings over time, and month by month',
            'Your most booked games',
            'Your most frequent bookers',
            'Busiest days of the week and busiest timeslots',
            'Filter by year or any range',
          ]}
          imageSide="left"
          mock="stats"
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="News & updates"
          title="A line straight to the people who play at your store."
          body="Post an update and it appears on the home screen of everyone who plays at your venue. Tournament announcements, a new stock delivery, a change to opening hours — read by people who have already chosen to come to you."
          bullets={[
            'Post updates from Manage Store',
            "They appear on your players' home screens",
            'No algorithm, no boosting, no ad spend',
          ]}
          imageSide="right"
          mock="update"
        />
      </Section>

      <Section tone="base">
        <TileGrid title="What you don't have to worry about." tiles={TILES} />
      </Section>

      <Section tone="raised">
        <FAQ title="Questions we get asked." items={FAQS} />
      </Section>

      <Section tone="base">
        <Testimonials title="What venues say" testimonials={TESTIMONIALS} />
      </Section>

      <ClosingCTA
        title="Get your tables on the map."
        body="Listing your venue is free, and takes an afternoon to set up."
        primaryCta={{ to: '/login', label: 'List your venue' }}
        secondaryCta={{ to: '/', label: 'Curious what players see?' }}
      />
    </MarketingLayout>
  );
}
