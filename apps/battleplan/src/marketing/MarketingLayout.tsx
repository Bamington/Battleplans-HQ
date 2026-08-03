/**
 * MarketingLayout.tsx — Shell for the public marketing pages
 *
 * Owns the one place marketing.css is imported, and the .mk scope class that
 * every marketing token hangs off. Nothing inside .mk should reference an app
 * token, and nothing outside it can reach a --mk-* one.
 *
 * The app sets `class="dark"` on <html> and the app's own screens depend on it.
 * These pages deliberately ignore it: this is a fixed design, not a themeable
 * one, so every colour here is absolute rather than conditional.
 */

import React, { useEffect } from 'react';
import { MarketingNav } from './components/MarketingNav';
import { MarketingFooter } from './components/MarketingFooter';
import './marketing.css';

export function MarketingLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  /*
   * Set the document title and description per page. This is a client-rendered
   * SPA, so this does nothing for crawlers that don't execute JavaScript —
   * proper SEO needs the two marketing routes prerendered at build time. Worth
   * doing before launch; noted in the marketing CLAUDE.md.
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
   */
  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#0c0a14';
    return () => { document.body.style.backgroundColor = previous; };
  }, []);

  return (
    <div className="mk min-h-screen">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
