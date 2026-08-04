/**
 * LandingPage.tsx — battleplan.app, for players
 *
 * Section order and copy follow the agreed deck. Surfaces alternate
 * base / raised down the page so sections separate without hard rules, and the
 * only two accent moments are the hero and the closing CTA.
 *
 * All testimonial content is placeholder and marked as such on screen.
 */

import { MarketingLayout } from '../MarketingLayout';
import { Section } from '../components/Section';
import { Hero } from '../components/Hero';
import { PillarGrid, type Pillar } from '../components/PillarGrid';
import { FeatureDeepDive } from '../components/FeatureDeepDive';
import { Callout } from '../components/Callout';
import { TileGrid, type Tile } from '../components/TileGrid';
import { SuiteSection } from '../components/SuiteSection';
import { Testimonials, type Testimonial } from '../components/Testimonials';
import { ClosingCTA } from '../components/ClosingCTA';
import { Calendar, Dice, Chart, Users, Wallet, Pin, Layers } from '../icons';

/*
 * Screenshots of the real app, captured against the Burrow Games fixture by
 * tools/screenshots. Everything in them is invented — the venue, the players,
 * the results — so nothing here exposes a real person's account.
 *
 * Rebuild with: node tools/screenshots/capture.mjs && node tools/screenshots/optimise.mjs
 */
import shotHome from '../assets/shots/player-home.webp';
import shotBookings from '../assets/shots/player-bookings.webp';
import shotBattles from '../assets/shots/player-battles.webp';
import shotStats from '../assets/shots/player-stats.webp';
import shotFriends from '../assets/shots/player-friends.webp';

/* Match each asset's own shape — see FeatureDeepDive's `aspect`. */
const LANDSCAPE = 'aspect-[8/5]';
/* Tall and narrow, closer to the shape of the column it photographs. */
const COLUMN    = 'aspect-[9/21]';

const PILLARS: Pillar[] = [
  {
    icon: Calendar,
    title: 'Book a table',
    body: 'Pick your venue, your date, your slot. The confirmation lands in your inbox.',
  },
  {
    icon: Dice,
    title: 'Log your battles',
    body: 'Game, opponent, result, photos. Thirty seconds after you pack the army away.',
  },
  {
    icon: Chart,
    title: 'See your record',
    body: 'Win rates, streaks, and the matchups you quietly keep losing.',
  },
  {
    icon: Users,
    title: 'Bring your friends',
    body: "Share a booking and invite the people you're actually playing.",
  },
];

/*
 * Four headline benefits rather than eight small features, and no supporting
 * copy — each line is the whole point on its own.
 *
 * The section heading changed with them: "The small stuff that adds up" was
 * right for eight minor conveniences and wrong for four summary claims.
 */
const TILES: Tile[] = [
  { icon: Pin, title: 'One place to book at any store' },
  { icon: Users, title: 'Invite your friends and find new opponents' },
  { icon: Layers, title: 'Your tabletop history' },
  { icon: Wallet, title: 'Free to use' },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "I'd been booking tables over Messenger for two years. This took about a minute to get used to and I've not gone back.",
    name: 'Name Surname',
    detail: 'plays 40K at [Store Name]',
  },
  {
    quote: 'The stats page is genuinely a bit humbling. I thought I was better at this than I am.',
    name: 'Name Surname',
    detail: 'plays Age of Sigmar',
  },
  {
    quote: "Being able to see the photos of every game I've played this year is worth it on its own.",
    name: 'Name Surname',
    detail: 'plays Kill Team',
  },
];

export default function LandingPage() {
  return (
    <MarketingLayout
      title="BattlePlan — Book the table. Log the battle. Know your record."
      description="Book a table at your local game store, log the battles you fight there, and find out who actually beats you. Free to use."
    >
      <Hero
        title={
          <>
            Find your next game.<br />
            Book your next Battlefield.<br />
            Claim your next Victory.
          </>
        }
        longTitle
        lead="Book a table at your local store, log the battles you fight there, and find out who actually beats you."
        primaryCta={{ to: '/login', label: 'Create your free account' }}
        secondaryCta={{ to: '/venue', label: 'See it for a venue' }}
        note="Free to use."
        logos={{ label: 'Book a table at' }}
        trustLine="[PLACEHOLDER] 3,400 battles logged by 610 players across 18 venues"
        src={shotHome}
        alt="The BattlePlan home screen: upcoming bookings, suggested battles, a photo gallery of recent games, and a friends list."
        aspect="aspect-[2400/1418]"
      />

      <Section tone="raised">
        <PillarGrid
          eyebrow="One app for the whole hobby"
          title={'Everything between "fancy a game?" and "well played."'}
          pillars={PILLARS}
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Booking"
          title="Your table, sorted in four taps."
          body="Choose a venue, a date and a timeslot. BattlePlan already knows which tables that store has, when they're free, and when the store has closed for a tournament — so anything you can pick is a table you can actually have."
          bullets={[
            "Every venue's real tables and real timeslots",
            'Confirmation and cancellation emails, sent automatically',
            'Your upcoming bookings, always the first thing you see',
            'Your usual store remembered, so you can stop picking it every time',
          ]}
          imageSide="left"
          src={shotBookings}
          alt="The bookings column, listing tables booked at Burrow Games with the game and timeslot for each."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Battle log"
          title="A record of every game you've played."
          body="Most of us remember the last game and forget the forty before it. Log a battle when you finish it and the whole season is still there in December — the lists that worked, the tables you played on, the people who beat you."
          bullets={[
            'Game, date, result, venue and opponent',
            'Add photos of the table — they become the card',
            'Opponents are people, not free text, so head-to-heads add up on their own',
            "Log it from your phone before you've left the shop",
          ]}
          imageSide="right"
          src={shotBattles}
          alt="The battle gallery: each game shown as a card with a photograph of the table, the opponent and the result."
          aspect={COLUMN}
          narrowImage
        >
          <Callout
            quote="You booked a table on the 14th. Did you play?"
            body="BattlePlan spots bookings you've never logged a battle against, and offers to fill in the game, the date and the venue for you. One tap to log it. One tap to make it go away if it was a bad night."
          />
        </FeatureDeepDive>
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Statistics"
          title="Find out who your nemesis is."
          body="Every battle you log feeds a picture of how you actually play — not how you remember playing."
          bullets={[
            'Overall win/loss record and your current win streak',
            'Most played games, venues and opponents',
            'Break the whole thing down game by game',
            'Best and worst: the games you win, the opponents you don’t, the venues where it goes wrong',
            'Filter by year, or any range you like',
          ]}
          imageSide="left"
          src={shotStats}
          alt="The statistics screen: overall win-loss record, most played games and venues, and best and worst opponents."
          aspect={LANDSCAPE}
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Friends"
          title="Nobody plays alone."
          body="Book the table, then invite the person you're playing. They see it in their bookings, and neither of you has to check a group chat from three weeks ago to confirm it's still on."
          bullets={[
            "Invite friends to a booking you've made",
            'Invitations land in their bookings, with accept or decline',
            'Profiles with a picture and a username',
            'Find people by username — no phone numbers, no address book',
          ]}
          imageSide="right"
          src={shotFriends}
          alt="The friends column, showing an incoming friend request and a list of connected players."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      <Section tone="base">
        <TileGrid title="The short version." tiles={TILES} />
      </Section>

      <Section tone="raised">
        <SuiteSection />
      </Section>

      <Section tone="base">
        <Testimonials title="What players say" testimonials={TESTIMONIALS} />
      </Section>

      <ClosingCTA
        title="Your next game is a Thursday night away."
        body="Create an account, find your local store, and book a table. It's free."
        primaryCta={{ to: '/login', label: 'Create your free account' }}
        secondaryCta={{ to: '/venue', label: 'Run a store? See BattlePlan for venues' }}
      />
    </MarketingLayout>
  );
}
