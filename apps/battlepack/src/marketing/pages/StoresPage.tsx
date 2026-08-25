/**
 * StoresPage.tsx — battlepack.app/stores, for stores and clubs
 *
 * Same components, same order, same accent as the organiser page. That's
 * deliberate: it's one product addressed to a different reader, and looking
 * identical is the point. The differences are the ones the reader forces — an
 * FAQ, because a shop deciding whether to ask for this has questions an
 * organiser doesn't, and a form instead of a button at the end, because getting
 * BattlePack is a conversation rather than a signup.
 *
 * The reader here runs the venue rather than the event. Their question is not
 * "will this save me an evening" — it's "what does this do for the shop", so
 * the page leads with the diary, the tables and the team rather than with the
 * pack builder.
 *
 * THE ONE CLAIM TO BE CAREFUL WITH is the BattlePlan integration. It is real
 * (publishing a pack holds the venue's tables, and unpublishing releases them)
 * but it only applies to venues running their bookings on BattlePlan, and the
 * copy below says so rather than implying every shop gets it.
 */

import {
  MarketingLayout, Section, Hero, PillarGrid, FeatureDeepDive, TileGrid, FAQ,
  ClosingCTA, Store, Calendar, Users, Megaphone, Link, Shield, Bolt, Phone,
  Buildings, Mail,
  type Pillar, type Tile, type FAQItem,
} from '@battleplans/marketing';
import { BATTLEPACK_BRAND } from '../brand';
import { StoreSignupForm } from '../components/StoreSignupForm';
import { EventsDemo } from '../components/demos/EventsDemo';
import '../demos.css';

const PILLARS: Pillar[] = [
  {
    icon: Store,
    title: 'Your whole calendar, in one place',
    body: 'Every event the shop is running — drafts, published, finished — in one column instead of six group chats.',
  },
  {
    icon: Users,
    title: 'Anyone on the team can run it',
    body: 'Every admin at your venue can edit every pack. Nobody has to wait for the one person who wrote it.',
  },
  {
    icon: Calendar,
    title: 'It holds your tables',
    body: 'If you take bookings on BattlePlan, publishing an event closes the tables it needs. Unpublish and they come back.',
  },
  {
    icon: Megaphone,
    title: 'Events people can find',
    body: 'A real page per event, and your upcoming events shown to players already booking with you.',
  },
];

const TILES: Tile[] = [
  { icon: Bolt, title: 'Nothing to install', body: 'It runs in a browser, on whatever you already have behind the counter.' },
  { icon: Phone, title: 'Works on a phone', body: 'Fix a time from the shop floor without going back to the office.' },
  { icon: Link, title: 'Links that keep working', body: 'An event’s address is permanent. A flyer printed in March still works in June.' },
  { icon: Shield, title: 'Drafts stay private', body: 'A pack has no public address until somebody publishes it.' },
  { icon: Buildings, title: 'More than one venue', body: 'Run several shops and each one keeps its own events, from the same login.' },
  { icon: Mail, title: 'One account across the apps', body: 'The same login as BattlePlan and BattleBox. No second password for your staff.' },
];

const FAQS: FAQItem[] = [
  {
    question: 'How do we get BattlePack?',
    answer: 'Ask us. It’s switched on one venue at a time rather than being self-serve, so we turn it on for your shop and your admins have it the next time they sign in. The form at the bottom of this page is the whole process.',
  },
  {
    question: 'Do our players need an account?',
    answer: 'No. A published event is a public page — anyone with the link can read it, put it in their calendar and turn up. Accounts are only for the people writing the events.',
  },
  {
    question: 'Do we have to use BattlePlan as well?',
    answer: 'No. BattlePack works on its own. If you do run your bookings on BattlePlan, the two join up — publishing an event holds the tables it needs and your events show to players booking with you — but nothing here depends on it.',
  },
  {
    question: 'What happens if we take an event down?',
    answer: 'The address stops resolving to the event and says the organiser withdrew it, rather than going to a dead end — and everyone who put it in their calendar is emailed. The address is never handed to a different event.',
  },
  {
    question: 'Who can edit our events?',
    answer: 'Every admin of your venue, on every pack at that venue. That’s deliberate: an event nobody can fix because its author is away is worse than one anybody can. Ownership follows the store, not the person.',
  },
];

export default function StoresPage() {
  return (
    <MarketingLayout
      brand={BATTLEPACK_BRAND}
      title="BattlePack for stores & clubs — Every event you run, in one place."
      description="Give every tournament, league and club night its own page, run them from one screen, and let the whole team keep them up to date."
    >
      <Hero
        title={<>Every event you run, in one place.</>}
        lead="Your tournaments, leagues and club nights on one screen, each with a page you can send to anybody. Written by whoever is free, kept right by everyone."
        primaryCta={{ to: '/stores#get-battlepack', label: 'Ask about your venue' }}
        secondaryCta={{ to: '/', label: 'Benefits for organisers' }}
        note="Switched on venue by venue. It takes one conversation."
        mock="list"
        alt="A venue's events in BattlePack: tournaments, a league and a club night, with their dates and whether each is published."
        aspect="aspect-[16/9]"
      />

      <Section tone="raised">
        <PillarGrid
          eyebrow="Built for game stores and clubs"
          title="Run your events like you run your tables."
          pillars={PILLARS}
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Your calendar"
          title="Open one screen and know what’s on."
          body="Every event at your venue in one column — what’s coming up, what’s still a draft, what’s been and gone. Start a new one in a minute, and hand it to whoever has time to finish it."
          bullets={[
            'Drafts and published events side by side, so nothing is forgotten in someone’s notes app.',
            'Filter to what’s coming up, or look back at what you ran last year.',
            'Every admin at the venue sees the same list and can pick anything up.',
            'Losing a staff member doesn’t lose you the events they wrote.',
          ]}
          imageSide="left"
          demo={<EventsDemo />}
          wideFrame
          alt="A venue's events, filtered to what is current and upcoming."
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="With BattlePlan"
          title="An event that takes its own tables out."
          body="If your bookings run on BattlePlan, publishing an event closes the tables it needs for the days it runs — so a customer can never book a table you’ve already given to a tournament. Unpublish it and they’re released again."
          bullets={[
            'Choose all your tables or just the ones the event actually uses.',
            'A monthly club night holds its tables as one repeating rule, not seventeen entries.',
            'Unpublishing releases them automatically — a closed tab can’t leave you blocked.',
            'Your upcoming events show to the players already booking with you.',
          ]}
          imageSide="right"
          /* BattlePlan's own booking screen, because that is literally what
             this section is about — the tables this event takes out are tables
             in the other app. */
          mock="booking"
          alt="Publishing an event, with the option to hold the venue's tables for the days it runs."
          aspect="aspect-[16/11]"
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Your customers"
          title="A page you’d be happy to see shared."
          body="Every published event gets a page of its own with a real address, a proper preview card when it’s pasted into a chat, and a button that puts it in a player’s calendar. Nothing to install, no account to make, no PDF to open."
          bullets={[
            'Reads properly on a phone, which is where it will be opened.',
            'Add-to-calendar for Google, Outlook and everything else.',
            'Change a time and everyone holding it is emailed.',
            'The event’s address never moves and is never reused.',
          ]}
          /* Full width above the copy. It's a page rather than a panel, and at
             400px beside the text it stops being legible as one. */
          layout="stacked"
          mock="page"
          alt="A published event page: banner, key information, schedule and FAQ."
          /* Wider than the other stacked frame. A page mock is one centred
             column of prose; at 8:5 the panels stretched to twice the height
             their content needed and the frame read as mostly empty. */
          aspect="aspect-[16/9]"
        />
      </Section>

      <Section tone="raised">
        <TileGrid title="What you don’t have to worry about." tiles={TILES} />
      </Section>

      <Section tone="base">
        <FAQ title="Questions we get asked." items={FAQS} />
      </Section>

      {/* Closes on a form rather than two buttons — it writes to venue_leads
          and emails us. See StoreSignupForm. */}
      <ClosingCTA
        id="get-battlepack"
        title="Tell us about your venue."
        body="We’ll switch BattlePack on for your shop and show your team around it. There’s nothing to install and nothing to sign."
      >
        <StoreSignupForm />
      </ClosingCTA>
    </MarketingLayout>
  );
}
