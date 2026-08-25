/**
 * brand.ts — BattlePlan's marketing chrome
 *
 * The nav and the footer read this. See @battleplans/marketing's brand.tsx for
 * what belongs here and what doesn't — in short, it's the site's furniture, not
 * its content.
 *
 * `key` selects the palette from a `.mk[data-mk-brand='…']` block in the shared
 * marketing.css. BattlePlan's violet is the block that `.mk` itself carries, so
 * naming it here is belt and braces — but it means the site says out loud which
 * palette it expects rather than relying on being the default one.
 */

import type { MarketingBrand } from '@battleplans/marketing';

export const BATTLEPLAN_BRAND: MarketingBrand = {
  key: 'battleplan',
  wordmark: 'BattlePlan',
  tagline: 'Book the table. Log the battle. Know your record.',
  links: [
    { to: '/', label: 'For players' },
    { to: '/venue', label: 'For venues' },
  ],
  cta: { to: '/login', label: 'Create free account', short: 'Get started' },
  signIn: { to: '/login', label: 'Sign in' },
  /*
   * One column, and every link goes somewhere.
   *
   * The suite, company and legal columns were placeholders pointing at pages
   * that don't exist — three quarters of the footer was furniture. What's left
   * is only what a reader can actually follow.
   */
  footerColumns: [
    {
      heading: 'BattlePlan',
      links: [
        { to: '/', label: 'For players' },
        { to: '/venue', label: 'For venues' },
        { to: '/login', label: 'Sign in' },
      ],
    },
  ],
  footerNote: 'Made for people who push little models around tables.',
};
