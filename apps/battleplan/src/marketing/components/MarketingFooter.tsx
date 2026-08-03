/**
 * MarketingFooter.tsx — Site footer
 *
 * Sits on --mk-surface-well, the same floor as the screenshot frames. It's the
 * one place besides a screenshot where the page is allowed to go that dark,
 * and it gives the page a definite bottom edge.
 */

import { Link } from 'react-router-dom';

const COLUMNS: { heading: string; links: { label: string; to: string; muted?: boolean }[] }[] = [
  {
    heading: 'BattlePlan',
    links: [
      { label: 'For players', to: '/' },
      { label: 'For venues', to: '/venue' },
      { label: 'Sign in', to: '/login' },
      { label: 'Mobile apps — coming soon', to: '#', muted: true },
    ],
  },
  {
    heading: 'The suite',
    links: [
      { label: 'BattleBox', to: '#' },
      { label: 'BattlePack', to: '#' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', to: '#' },
      { label: 'Contact', to: '#' },
      { label: 'News', to: '#' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', to: '#' },
      { label: 'Terms', to: '#' },
      { label: 'Cookies', to: '#' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mk-surface-well" style={{ borderTop: '1px solid var(--mk-border-strong)' }}>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <span
              className="text-[1.375rem] tracking-[-0.01em]"
              style={{ fontFamily: 'var(--mk-font-display)', color: 'var(--mk-text-primary)' }}
            >
              BattlePlan
            </span>
            <p className="mk-caption mt-3 max-w-[24ch]">
              Book the table. Log the battle. Know your record.
            </p>
          </div>

          {COLUMNS.map(column => (
            <div key={column.heading}>
              <h3
                className="mb-4 text-[0.75rem] font-semibold uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--mk-text-muted)' }}
              >
                {column.heading}
              </h3>
              <ul className="flex flex-col gap-3">
                {column.links.map(link => (
                  <li key={link.label}>
                    {/* '#' links are placeholders for pages that don't exist
                        yet — rendered as plain text so nothing dead-ends. */}
                    {link.to === '#' ? (
                      <span
                        className="text-[0.9375rem]"
                        style={{ color: 'var(--mk-text-muted)' }}
                      >
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-[0.9375rem] transition-colors"
                        style={{ color: link.muted ? 'var(--mk-text-muted)' : 'var(--mk-text-secondary)' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--mk-border-strong)' }}
        >
          <p className="mk-caption">© {new Date().getFullYear()} BattlePlan</p>
          <p className="mk-caption">Made for people who push little models around tables.</p>
        </div>
      </div>
    </footer>
  );
}
