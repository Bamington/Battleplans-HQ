/**
 * MarketingLayout.tsx — Shell for an app's public marketing pages
 *
 * Owns the one place marketing.css is imported, and the .mk scope class that
 * every marketing token hangs off. Nothing inside .mk should reference an app
 * token, and nothing outside it can reach a --mk-* one.
 *
 * The apps set `class="dark"` on <html> and their own screens depend on it.
 * These pages deliberately ignore it: this is a fixed design, not a themeable
 * one, so every colour here is absolute rather than conditional.
 */

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MarketingNav } from './components/MarketingNav';
import { MarketingFooter } from './components/MarketingFooter';
import { BrandProvider, type MarketingBrand } from './brand';
import './marketing.css';

export function MarketingLayout({
  brand,
  title,
  description,
  children,
}: {
  /** Which app's site this is. See brand.tsx. */
  brand: MarketingBrand;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  /*
   * Set the document title and description per page. These are client-rendered
   * SPAs, so this does nothing for crawlers that don't execute JavaScript —
   * proper SEO needs the marketing routes prerendered at build time. Worth
   * doing before launch; noted in each app's marketing CLAUDE.md.
   */
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [title, description]);

  /*
   * The page background has to reach the document element as well as this
   * wrapper, or an overscroll bounce shows whatever the app's body colour is
   * underneath. Restored on unmount so app screens are unaffected.
   *
   * Read off the wrapper rather than hard-coded, because --mk-surface-base
   * differs per brand and a literal here would have been violet on every site.
   */
  /*
   * Make in-page anchors work across a route change.
   *
   * A browser scrolls to #foo by itself, but only when the element is already
   * in the document — and on a router navigation it isn't yet, so a link from
   * one marketing page to a section of another silently lands at the top. This
   * runs after the target page has rendered and does the scroll the browser
   * couldn't. `scroll-margin-top` on the section is what keeps the fixed nav
   * off the thing being jumped to; see marketing.css.
   */
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({
      /* An instant jump on arrival, because a smooth scroll from the top of a
         page this long takes several seconds and looks like a bug. */
      behavior: 'auto',
      block: 'start',
    });
  }, [hash]);

  const scope = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const surface = getComputedStyle(el).getPropertyValue('--mk-surface-base').trim();
    if (!surface) return;
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = surface;
    return () => { document.body.style.backgroundColor = previous; };
  }, [brand.key]);

  return (
    <BrandProvider brand={brand}>
      <div ref={scope} className="mk min-h-screen" data-mk-brand={brand.key}>
        <a href="#content" className="mk-skip">Skip to content</a>
        <MarketingNav />
        <main id="content">{children}</main>
        <MarketingFooter />
      </div>
    </BrandProvider>
  );
}
