/**
 * brand.ts — BattlePack's marketing chrome
 *
 * The nav and the footer read this. See @battleplans/marketing's brand.tsx for
 * what belongs here and what doesn't.
 *
 * `key` selects the emerald palette from the `.mk[data-mk-brand='battlepack']`
 * block in the shared marketing.css. Get it wrong and the site renders in
 * BattlePlan's violet, which is the fallback — so a purple BattlePack page
 * means this string, not the stylesheet.
 *
 * THE CTA GOES TO /login AND NOT TO A SIGNUP. BattlePack is not self-serve:
 * access is platform admins plus store admins at venues it has been switched on
 * for (see the app's CLAUDE.md). "Create free account" would be a promise the
 * app can't keep — an organiser who made one would land on the access gate. So
 * the button signs existing organisers in, and the page's actual ask for
 * everyone else is the form at the bottom of /stores.
 */

import type { MarketingBrand } from '@battleplans/marketing';

export const BATTLEPACK_BRAND: MarketingBrand = {
  key: 'battlepack',
  wordmark: 'BattlePack',
  tagline: 'Write the event once. Share one link. Keep everyone up to date.',
  links: [
    { to: '/', label: 'For organisers' },
    { to: '/stores', label: 'For stores & clubs' },
  ],
  /*
   * The button is the ASK, not the sign-in. BattlePlan's is "Create free
   * account" because a player can have one in thirty seconds; BattlePack has no
   * such door, so the equivalent conversion is the conversation that gets a
   * venue switched on. Signing in is the quiet link beside it, where a product
   * with a real signup would put it too.
   */
  cta: { to: '/stores#get-battlepack', label: 'Get BattlePack', short: 'Get it' },
  signIn: { to: '/login', label: 'Sign in' },
  footerColumns: [
    {
      heading: 'BattlePack',
      links: [
        { to: '/', label: 'For organisers' },
        { to: '/stores', label: 'For stores & clubs' },
        { to: '/login', label: 'Sign in' },
      ],
    },
  ],
  footerNote: 'Made for the people who run the events.',
};
