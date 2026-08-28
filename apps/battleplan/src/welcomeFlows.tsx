/**
 * welcomeFlows.tsx — BattlePlan's welcome flows
 *
 * The copy shown in the blocking modal after sign-in, kept here rather than
 * inline in App.tsx so every word a user is made to read sits in one reviewable
 * place. See packages/ui/src/components/WelcomeModal.tsx for the mechanism and
 * the rules; the short version:
 *
 *   • one or more intro steps, then an optional form step;
 *   • `key` records completion per user and must never be reused;
 *   • a NEW release that wants to say something adds a NEW flow below and
 *     points App.tsx at it. The old one stays here as a record of what was
 *     said, and is harmless — nothing renders a flow that isn't mounted.
 *
 * BattlePlan defines its own rather than using PROFILE_ONBOARDING_FLOW because
 * it needs a home venue and a region on top of the name fields.
 */

import type { WelcomeFlow } from '@battleplans/ui';

/**
 * The current flow: venue regions.
 *
 * Everyone sees this once, because the key is new and nothing is backfilled
 * onto it — which is intended. It explains why they are suddenly being asked
 * for a postcode, then collects it along with the profile fields.
 *
 * Copy is Chris's, kept verbatim. Plain strings rather than JSX because it
 * carries no emphasis — the step view wraps each entry in its own paragraph.
 */
export const VENUE_REGIONS_FLOW: WelcomeFlow = {
  key: 'battleplan-venue-regions',
  steps: [
    {
      title: 'Add your location',
      body: [
        'As we add more stores, we want to ensure you don’t have to scroll through a bunch of stores nowhere near you when making a booking.',
        'To help with this, please add your Country and Postcode. These won’t be shared with other users — we’ll simply use this information to make sure we’re only showing stores nearby to you.',
        'You’ll be able to update this information at any time in your profile settings.',
      ],
      cta: 'Add my location',
    },
  ],
  // Not "Welcome to BattlePlan" — most people meeting this flow have been
  // booking tables for months. Repeating the intro's title keeps the two
  // screens reading as one thing.
  formTitle: 'Add your location',
  fields: {
    username: true,
    homeRegion: true,
    preferredLocation: true,
    bookingEmailNote: true,
  },
};
