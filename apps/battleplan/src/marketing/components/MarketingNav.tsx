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
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      style={{
        background: scrolled ? 'rgba(12, 10, 20, 0.85)' : 'transparent',
        borderBottom: `1px solid ${scrolled ? 'var(--mk-border-strong)' : 'transparent'}`,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}
    >
      <nav className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-6 md:px-8 lg:px-12">
        <Link
          to="/"
          className="text-[1.375rem] tracking-[-0.01em]"
          style={{ fontFamily: 'var(--mk-font-display)', color: 'var(--mk-text-primary)' }}
        >
          BattlePlan
        </Link>

        {/* Middle links are desktop-only for now — a mobile menu is the next
            thing this component needs, but the CTA is the only thing that has
            to survive the breakpoint. */}
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map(link => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="text-[0.9375rem] transition-colors"
                style={{ color: active ? 'var(--mk-accent-400)' : 'var(--mk-text-secondary)' }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-[0.9375rem] transition-colors sm:block"
            style={{ color: 'var(--mk-text-secondary)' }}
          >
            Sign in
          </Link>
          <CTAButton to="/login" className="!px-5 !py-2.5">Create free account</CTAButton>
        </div>
      </nav>
    </header>
  );
}
