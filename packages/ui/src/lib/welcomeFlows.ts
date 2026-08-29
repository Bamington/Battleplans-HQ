/**
 * welcomeFlows.ts — the flows shared by more than one app
 *
 * A welcome flow is intro steps plus an optional form step; see
 * components/WelcomeModal.tsx for the shape and the rules. Flows that belong to
 * one app live in that app, next to its other constants. This file is only for
 * the ones every app runs.
 *
 * KEYS ARE PERMANENT. A key records, per user, that they have finished that
 * flow. Changing a key re-shows the flow to everybody; reusing an old key hides
 * new copy from everybody who finished the old one. Neither is ever what you
 * want — a new announcement gets a new key, and the copy under an existing key
 * only ever gets corrected, not repurposed.
 */

import type { WelcomeFlow } from '../components/WelcomeModal';

/**
 * The base onboarding flow: a greeting, then the name fields.
 *
 * Run by every app that needs nothing beyond a profile — BattleCards,
 * BattleBench and BattlePack. BattlePlan needs a venue and a region on top, so
 * it defines its own flow rather than extending this one; two apps asking for
 * different things are two flows, not one flow with a condition in it.
 *
 * `profile-onboarding-v1` is backfilled onto everyone already onboarded (see
 * 20260828010000), so this greets first-time users only.
 */
export const PROFILE_ONBOARDING_FLOW: WelcomeFlow = {
  key: 'profile-onboarding-v1',
  steps: [
    {
      title: 'Welcome!',
      body: [
        'Before you start, a quick word about the two names on your profile — they do different jobs.',
        'Your Username is public. Other players can search for it, and it is how they add you as a friend.',
        'Your Name is your real name. Only friends you accept, and stores you book with, ever see it.',
      ],
      cta: 'Set up my profile',
    },
  ],
  fields: { username: true },
};
