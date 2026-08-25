/**
 * brand.tsx — What differs between one app's marketing site and another's
 *
 * The design system is shared; the words in the nav and the footer are not.
 * Rather than thread a wordmark and a link list through every page into
 * MarketingNav and MarketingFooter, the layout puts one object in context and
 * those two components read it.
 *
 * A brand is deliberately small. It is the chrome — the name, the way around,
 * and the one button the whole site is for. Everything else about a page is
 * that page's own business, and anything that starts wanting to live here
 * (a section, a colour, a piece of copy) almost certainly belongs in the page
 * or in marketing.css instead.
 *
 * The one thing NOT here is the palette. `key` names a block in marketing.css
 * — `.mk[data-mk-brand='battlepack']` and friends — because which greens sit
 * next to which greys is a decision about the family of sites, not about one
 * app, and it is worth being able to read all of them in one place.
 */

import React, { createContext, useContext } from 'react';

export interface BrandLink {
  to: string;
  label: string;
}

export interface MarketingBrand {
  /**
   * Selects the palette. Must match a `.mk[data-mk-brand='…']` block in
   * marketing.css, or the page falls back to BattlePlan's violet.
   */
  key: string;
  /** The wordmark, in the nav and again in the footer. */
  wordmark: string;
  /** Under the footer wordmark. One line, the site's whole claim. */
  tagline: string;
  /** The middle of the nav. Desktop inline, and in the mobile menu. */
  links: BrandLink[];
  /**
   * The nav's primary button — the page's conversion, present on every screen
   * width. `short` is used below `sm`: see MarketingNav for why there are two.
   */
  cta: { to: string; label: string; short: string };
  /** The quiet link beside it. Omit to leave the nav with just the button. */
  signIn?: BrandLink;
  /** Footer link columns. Every link must go somewhere real. */
  footerColumns: { heading: string; links: (BrandLink & { muted?: boolean })[] }[];
  /** The line opposite the copyright. */
  footerNote: string;
}

const BrandContext = createContext<MarketingBrand | null>(null);

export function BrandProvider({
  brand,
  children,
}: {
  brand: MarketingBrand;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

/**
 * Throws rather than returning a default.
 *
 * A missing brand means a marketing component was rendered outside
 * MarketingLayout, which is a wiring mistake — and the silent version of it is
 * a nav with somebody else's name in it.
 */
export function useBrand(): MarketingBrand {
  const brand = useContext(BrandContext);
  if (!brand) {
    throw new Error('Marketing components must be rendered inside <MarketingLayout>.');
  }
  return brand;
}
