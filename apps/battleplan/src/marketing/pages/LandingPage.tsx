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
import { Testimonials, type Testimonial } from '../components/Testimonials';
import { ClosingCTA } from '../components/ClosingCTA';
import { BookingsDemo } from '../components/demos/BookingsDemo';
import { BattlesDemo } from '../components/demos/BattlesDemo';
import { FriendsDemo } from '../components/demos/FriendsDemo';
import { Calendar, Dice, Chart, Users } from '../icons';

/*
 * Screenshots of the real app, captured against the Burrow Games fixture by
 * tools/screenshots. Everything in them is invented — the venue, the players,
 * the results — so nothing here exposes a real person's account.
 *
 * Rebuild with: node tools/screenshots/capture.mjs && node tools/screenshots/optimise.mjs
 */
import shotHome from '../assets/shots/player-home.webp';
import shotHomeMobile from '../assets/shots/player-home-mobile.webp';
import shotBookings from '../assets/shots/player-bookings.webp';
import shotBattles from '../assets/shots/player-battles.webp';
import shotStats from '../assets/shots/player-stats.webp';
import shotStatsMobile from '../assets/shots/player-stats-mobile.webp';
import shotFriends from '../assets/shots/player-friends.webp';

/*
 * Hidden until there are real quotes. A flag rather than a comment block, so
 * the section stays type-checked and can't quietly rot while it's off.
 */
const SHOW_TESTIMONIALS = false;

/* Tall and narrow, closer to the shape of the column it photographs. The
   landscape shots set their own aspect inline, because they also swap to a
   portrait capture on mobile. */
const COLUMN = 'aspect-[9/21]';

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
        srcMobile={shotHomeMobile}
        alt="The BattlePlan home screen: upcoming bookings, suggested battles, a photo gallery of recent games, and a friends list."
        aspect="aspect-[39/84] md:aspect-[2400/1418]"
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
          title="Confirm your Battlefield."
          body="Choose a venue, a date and a timeslot. BattlePlan already knows what tables are available, and helps you find the perfect place to play. No more calling stores. No more showing up and having nowhere to play."
          bullets={[
            'See available tables at a glance.',
            "Stores know you're coming, and can plan ahead.",
            'Update or cancel your booking at any time.',
            'BattlePlan remembers your preferred venue and games, so booking is ultra-fast.',
          ]}
          imageSide="left"
          /* The one interactive section. shotBookings stays imported so
             swapping back to the screenshot is a one-line change. */
          demo={<BookingsDemo />}
          wideFrame
          src={shotBookings}
          alt="The bookings column, listing tables booked at Burrow Games with the game and timeslot for each."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Battle log"
          title="Log your Victories. Learn from your Defeats."
          body="Remembering the last game is easy enough — but how about your toughest opponents? Your best lists? Your most successful battlefields? BattlePlan helps you log everything, so you can celebrate your wins — or mourn your losses."
          bullets={[
            'Log everything about the games you play.',
            'Get reminders to log games based on your bookings, so you never miss one.',
            "Your opponent's details are saved, so you can remember them for next time.",
            'Upload photos, notes — whatever helps you win the next one.',
          ]}
          imageSide="right"
          /* Second interactive section. shotBattles stays imported so reverting
             to the screenshot is a one-line change. */
          demo={<BattlesDemo />}
          wideFrame
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
          title="Analyze. Adapt. Conquer."
          body="Every battle you log feeds into your personalised statistics."
          bullets={[
            'See your Win/Loss record in certain games, or against certain opponents.',
            'Look into the games you play most — and how successful you are at them.',
            'Check your progress year-on-year.',
            "Find out which venues are the luckiest — and which aren't.",
          ]}
          /* Full width above the copy. The stats screen is three panels of small
             numbers; beside the text at 400px it reads as texture rather than
             information. */
          layout="stacked"
          src={shotStats}
          srcMobile={shotStatsMobile}
          alt="The statistics screen: overall win-loss record, most played games and venues, and best and worst opponents."
          aspect="aspect-[39/84] md:aspect-[8/5]"
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Friends"
          title="Form your Party."
          body="Invite your friends to join you for your games, directly in the app. They'll even see cancellations and time changes."
          bullets={[
            "Invite friends to a booking you've made.",
            'Friends get updates when a booking changes.',
            "See your friend's favorite games, and your win-rate against them.",
            'Create a public profile to show off your stats and models (coming soon).',
          ]}
          imageSide="right"
          /* Third interactive section. shotFriends stays imported so reverting
             to the screenshot is a one-line change. */
          demo={<FriendsDemo />}
          wideFrame
          src={shotFriends}
          alt="The friends column, showing an incoming friend request and a list of connected players."
          aspect={COLUMN}
          narrowImage
        />
      </Section>

      {/* "The short version" and "The suite" removed. */}

      {/*
        Hidden, not deleted — the quotes are still placeholder and the section
        comes back once there are real ones. Kept behind a flag rather than
        commented out so it stays type-checked and can't rot silently.
      */}
      {SHOW_TESTIMONIALS && (
        <Section tone="base">
          <Testimonials title="What players say" testimonials={TESTIMONIALS} />
        </Section>
      )}

      <ClosingCTA
        title="Your next game is a Thursday night away."
        body="Create an account, find your local store, and book a table. It's free."
        primaryCta={{ to: '/login', label: 'Create your free account' }}
        secondaryCta={{ to: '/venue', label: 'Run a store? See BattlePlan for venues' }}
      />
    </MarketingLayout>
  );
}
