/**
 * MarketingNav.tsx — Top bar for the marketing pages
 *
 * Transparent over the hero so the accent glow reads uninterrupted, then
 * settles onto a surface with a hairline once the page moves. Not an app's
 * AppNavbar: different height, different type, no app affordances.
 *
 * Everything it says comes from the brand in context — see brand.tsx. The
 * layout, the breakpoints and the two-label button are the shared part.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CTAButton } from './Button';
import { useBrand } from '../brand';

export function MarketingNav() {
  const brand = useBrand();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Never leave the menu open across a navigation.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Escape closes it, which is the one keyboard affordance a disclosure owes you.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  /* The mobile menu carries the middle links plus sign-in, which is the one
     nav item with no room of its own below sm. */
  const menuLinks = brand.signIn ? [...brand.links, brand.signIn] : brand.links;

  return (
    <header
      /* The solid background is the page's own base at 92%, so the bar reads as
         the page rising rather than as a separate grey — and it re-tints with
         the brand instead of being a violet literal. */
      className="mk-nav fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      data-solid={solid}
    >
      <nav className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-6 md:px-8 lg:px-12">
        <Link
          to="/"
          className="flex items-center py-3 text-[1.375rem] tracking-[-0.01em]"
          style={{ fontFamily: 'var(--mk-font-display)', color: 'var(--mk-text-primary)' }}
        >
          {brand.wordmark}
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {brand.links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center py-3 text-[0.9375rem] transition-colors"
              style={{ color: pathname === link.to ? 'var(--mk-accent-400)' : 'var(--mk-text-secondary)' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {brand.signIn && (
            <Link
              to={brand.signIn.to}
              className="hidden items-center py-3 text-[0.9375rem] transition-colors sm:flex"
              style={{ color: 'var(--mk-text-secondary)' }}
            >
              {brand.signIn.label}
            </Link>
          )}
          {/*
            Two labels, one button. "Create free account" is 188px wide, which
            with the wordmark and the menu button needed 368 of a 375px phone —
            the pill ended up sitting on the last letter of the wordmark. The
            short label costs about 90px and the collision goes away. Hiding the
            button below sm would have been the other fix, and it's the wrong
            one: this is the page's whole conversion.
          */}
          <CTAButton to={brand.cta.to} className="!px-5 !py-3">
            <span className="sm:hidden">{brand.cta.short}</span>
            <span className="hidden sm:inline">{brand.cta.label}</span>
          </CTAButton>

          {/*
            The menu button exists because the middle links were otherwise
            unreachable on a phone. The cross-link between a site's two pages is
            structural — a shop owner landing on the player page had no way
            across except the footer, twelve thousand pixels down.
          */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mk-mobile-menu"
            onClick={() => setMenuOpen(o => !o)}
            style={{ color: 'var(--mk-text-primary)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
                 strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              {menuOpen
                ? <path d="M6 6l12 12M18 6L6 18" />
                : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="mk-mobile-menu"
          className="md:hidden"
          style={{ borderTop: '1px solid var(--mk-border-strong)' }}
        >
          <div className="mx-auto flex w-full max-w-[1200px] flex-col px-6 py-2">
            {menuLinks.map(link => (
              <Link
                key={link.to + link.label}
                to={link.to}
                className="flex min-h-[48px] items-center text-[1.0625rem]"
                style={{ color: pathname === link.to ? 'var(--mk-accent-400)' : 'var(--mk-text-secondary)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
