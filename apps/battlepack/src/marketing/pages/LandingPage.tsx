/**
 * LandingPage.tsx — battlepack.app, for the people running the events
 *
 * The reader is a tournament organiser, a league runner, a club night host.
 * Not an attendee: an attendee never sees this page, because they arrive at
 * battlepack.app/<slug> from a link somebody sent them. That single fact
 * settles most of the copy — nothing here has to explain what a Battlepack is
 * to a player, and everything can be about the admin the organiser is sick of.
 *
 * Surfaces alternate base / raised down the page so sections separate without
 * hard rules, and the only two accent moments are the hero and the closing CTA.
 *
 * SCREENSHOTS: the two live demos are the real thing; every other frame is
 * still <AppMock>, which is a placeholder. Real captures need a fixture venue
 * with invented events, the way tools/screenshots builds Burrow Games for
 * BattlePlan — see this directory's CLAUDE.md.
 */

import {
  MarketingLayout, Section, Hero, PillarGrid, FeatureDeepDive, Callout,
  TileGrid, ClosingCTA,
  Document, Link, Calendar, Bell, Clock, Repeat, Trophy, Users, Mail, Bolt,
  type Pillar, type Tile,
} from '@battleplans/marketing';
import { BATTLEPACK_BRAND } from '../brand';
import { PackDemo } from '../components/demos/PackDemo';
import { LeagueDemo } from '../components/demos/LeagueDemo';
import '../demos.css';

const PILLARS: Pillar[] = [
  {
    icon: Document,
    title: 'Write it down once',
    body: 'The schedule, the list rules, the prizes, the FAQ. In one place, in a form that asks you the right questions.',
  },
  {
    icon: Link,
    title: 'Share one link',
    body: 'Publish, and your event gets its own address. Paste it anywhere and it looks like it was made for that.',
  },
  {
    icon: Calendar,
    title: 'Land in their calendar',
    body: 'One tap puts your event in a player’s diary, at the right time, at the right address.',
  },
  {
    icon: Bell,
    title: 'Change it without a reply-all',
    body: 'Move the date and everyone holding it is told. Take it down and they hear that too.',
  },
];

const TILES: Tile[] = [
  { icon: Clock, title: 'Timetables that add up', body: 'Give a round a length and the times follow. Change one and the rest move.' },
  { icon: Repeat, title: 'Repeats', body: 'A monthly club night is one event with a rule, not twelve copies to keep in step.' },
  { icon: Trophy, title: 'Prizes and resources', body: 'The mission pack, the scoring sheet, the prize list — attached, not promised.' },
  { icon: Users, title: 'Anyone on the team can edit', body: 'Every admin at your venue can pick a pack up. Nobody is a single point of failure.' },
  { icon: Mail, title: 'Nothing sends by surprise', body: 'Every path that emails your attendees asks first, and tells you how many people that is.' },
  { icon: Bolt, title: 'Drafts are private', body: 'A pack has no address until you publish it. Work on it for a month if you like.' },
];

export default function LandingPage() {
  return (
    <MarketingLayout
      brand={BATTLEPACK_BRAND}
      title="BattlePack — Write the event once. Share one link."
      description="Put your tournament, league or club night on a page players can actually read, share it with one link, and tell everyone at once when something changes."
    >
      <Hero
        title={
          <>
            Write the event once.<br />
            Share one link.<br />
            Stop repeating yourself.
          </>
        }
        longTitle
        lead="Your tournament, league or club night on one page — the schedule, the rules, the prizes, the answers. Change the date and everyone holding it gets told."
        primaryCta={{ to: '/stores#get-battlepack', label: 'Get it for your venue' }}
        secondaryCta={{ to: '/login', label: 'Sign in to BattlePack' }}
        /*
         * Not a pricing claim, because there isn't one to make yet. BattlePack
         * is switched on a venue at a time (see brand.ts), and the honest note
         * is the one that says so rather than one that implies self-serve.
         */
        note="Switched on venue by venue. Ask us about yours."
        /*
         * No proof strip. BattlePlan's hero carries its venue logos because a
         * player's first question is "is my shop on this?" — an organiser's
         * first question is "will this save me an evening", and a logo wall
         * doesn't answer it. It goes in when there are events worth naming.
         */
        mock="page"
        alt="A published Battlepack: the event's banner and title, a card of key information beside the details, and the sections a player needs to read."
        aspect="aspect-[16/10]"
      />

      <Section tone="raised">
        <PillarGrid
          eyebrow="For tournament organisers"
          title="Everything between “we should run one” and “see you Saturday.”"
          pillars={PILLARS}
        />
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="The pack"
          title="Everything they’ll ask, answered."
          body="A pack is built from a catalogue of sections — Event Basics, Schedule, What you’ll need, Registration, Tickets, Prizes, Resources, FAQ. Each one is a form that asks you the specific questions it needs, not an empty box you have to think of everything for."
          bullets={[
            'Add only the sections your event actually has.',
            'Every section has its own form, with helper text written for it.',
            'The FAQ is the one you answer in the group chat every week. Write it once.',
            'Attach the mission pack and the scoring sheet where people will find them.',
          ]}
          imageSide="left"
          demo={<PackDemo />}
          wideFrame
          alt="A published Battlepack, with tabs for Event Format, Registration and FAQ."
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Publishing"
          title="One link. It looks right wherever you paste it."
          body="Publishing gives your event its own address — battlepack.app/your-event — and that address never moves. Post it in the Facebook group, pin it in Discord, print it on a flyer. Attendees don’t need an account to read it."
          bullets={[
            'Your event’s own URL, chosen by you and permanent once set.',
            'A proper preview card, so a pasted link shows the event and not a blank rectangle.',
            'Readers need no account and no app.',
            'Keep editing after you publish — a typo doesn’t cost you the link.',
          ]}
          imageSide="right"
          mock="document"
          alt="The BattlePack editor: the section list, the pack as a document, and the form for the section being edited."
          aspect="aspect-[16/11]"
        >
          <Callout
            quote="Round 1 now starts at 10, not 9:30."
            body="When you change a date or a time on a published pack, BattlePack emails everyone who put it in their calendar — and tells you how many people that is before it sends anything. Take the event down and they’re told that too."
          />
        </FeatureDeepDive>
      </Section>

      <Section tone="base">
        <FeatureDeepDive
          eyebrow="Leagues"
          title="A league that dates itself."
          body="Give it a start date and a round length, and the rounds work out their own dates. Drop a painting week in between rounds two and three and everything after it moves — which is what makes “week three is the break week” a thing you can say at all."
          bullets={[
            'Rounds run end to end from the day the league starts.',
            'A break occupies the calendar, so the rounds after it shift.',
            'Rounds stay numbered among themselves — the one after the break is still Round 3.',
            'The end date follows from the last round. You never type it in.',
          ]}
          imageSide="left"
          demo={<LeagueDemo />}
          wideFrame
          alt="A league's schedule, with the round length and a painting week both adjustable."
          narrowImage
        />
      </Section>

      <Section tone="raised">
        <FeatureDeepDive
          eyebrow="Every shape of event"
          title="A Tuesday night and a three-day weekender, on the same page."
          body="A one-dayer, a weekender, a league, a monthly club night. BattlePack asks what shape your event is and what it repeats on as two separate questions, because “runs over three days” and “happens every month” are not the same answer."
          bullets={[
            'One day, several days, or a run of rounds over weeks.',
            'A weekender gives every day the same timetable to start from, then let day three differ.',
            'A repeating night is one event with a rule — every Friday, or the second Saturday of the month.',
            'Repeats stop on a date you set, so nothing runs on forever by accident.',
          ]}
          /* Full width above the copy. This is the one frame showing several
             shapes at once, and beside the text at 400px it would read as
             texture rather than as four different events. */
          layout="stacked"
          mock="list"
          alt="A venue's Battlepacks: a one-day tournament, a league running over three months, and a monthly club night."
          aspect="aspect-[16/9]"
        />
      </Section>

      <Section tone="base">
        <TileGrid title="The rest of it." tiles={TILES} />
      </Section>

      <ClosingCTA
        title="Your next event deserves better than a pinned message."
        body="BattlePack is switched on for one venue at a time. Tell us about yours and we’ll get you set up."
        primaryCta={{ to: '/stores#get-battlepack', label: 'See it for stores & clubs' }}
        secondaryCta={{ to: '/login', label: 'Already have it? Sign in' }}
      />
    </MarketingLayout>
  );
}
