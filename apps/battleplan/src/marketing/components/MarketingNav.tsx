/**
 * MarketingNav.tsx — Top bar for the marketing pages
 *
 * Transparent over the hero so the accent glow reads uninterrupted, then
 * settles onto a surface with a hairline once the page moves. Not the app's
 * AppNavbar: different height, different type, no app affordances.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CTAButton } from './Button';

const LINKS = [
  { to: '/', label: 'For players' },
  { to: '/venue', label: 'For venues' },
];

export function MarketingNav() {
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

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      style={{
        background: solid ? 'rgba(12, 10, 20, 0.92)' : 'transparent',
        borderBottom: `1px solid ${solid ? 'var(--mk-border-strong)' : 'transparent'}`,
        backdropFilter: solid ? 'blur(12px)' : 'none',
      }}
    >
      <nav className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-6 md:px-8 lg:px-12">
        <Link
          to="/"
          className="flex items-center py-3 text-[1.375rem] tracking-[-0.01em]"
          style={{ fontFamily: 'var(--mk-font-display)', color: 'var(--mk-text-primary)' }}
        >
          BattlePlan
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map(link => (
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
          <Link
            to="/login"
            className="hidden items-center py-3 text-[0.9375rem] transition-colors sm:flex"
            style={{ color: 'var(--mk-text-secondary)' }}
          >
            Sign in
          </Link>
          {/*
            Two labels, one button. "Create free account" is 188px wide, which
            with the wordmark and the menu button needed 368 of a 375px phone —
            the pill ended up sitting on the last letter of the wordmark. The
            short label costs about 90px and the collision goes away. Hiding the
            button below sm would have been the other fix, and it's the wrong
            one: this is the page's whole conversion.
          */}
          <CTAButton to="/login" className="!px-5 !py-3">
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Create free account</span>
          </CTAButton>

          {/*
            The menu button exists because "For venues" was otherwise
            unreachable on a phone. The cross-link between the two pages is
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
            {[...LINKS, { to: '/login', label: 'Sign in' }].map(link => (
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
