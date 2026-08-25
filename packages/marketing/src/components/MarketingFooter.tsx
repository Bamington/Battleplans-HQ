/**
 * MarketingFooter.tsx — Site footer
 *
 * Sits on --mk-surface-well, the same floor as the screenshot frames. It's the
 * one place besides a screenshot where the page is allowed to go that dark,
 * and it gives the page a definite bottom edge.
 *
 * The wordmark, the tagline and the columns come from the brand in context —
 * see brand.tsx. One rule survives the move and is worth keeping: every link
 * goes somewhere. A column of placeholders pointing at pages that don't exist
 * is furniture, and it's most of what the first version of this was.
 */

import { Link } from 'react-router-dom';
import { useBrand } from '../brand';

export function MarketingFooter() {
  const brand = useBrand();

  return (
    <footer className="mk-surface-well" style={{ borderTop: '1px solid var(--mk-border-strong)' }}>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:px-8 lg:px-12 lg:py-20">
        {/* Two columns, not five — a five-track grid holding two things leaves
            most of the footer as empty space. */}
        <div className="grid gap-10 sm:grid-cols-2">
          <div className="lg:col-span-1">
            <span
              className="text-[1.375rem] tracking-[-0.01em]"
              style={{ fontFamily: 'var(--mk-font-display)', color: 'var(--mk-text-primary)' }}
            >
              {brand.wordmark}
            </span>
            <p className="mk-caption mt-3 max-w-[24ch]">{brand.tagline}</p>
          </div>

          {brand.footerColumns.map(column => (
            <div key={column.heading}>
              <h3
                className="mb-4 text-[0.75rem] font-semibold uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--mk-text-muted)' }}
              >
                {column.heading}
              </h3>
              <ul className="flex flex-col gap-1">
                {column.links.map(link => (
                  <li key={link.label}>
                    {/* '#' links are placeholders for pages that don't exist
                        yet — rendered as plain text so nothing dead-ends. */}
                    {link.to === '#' ? (
                      <span
                        className="inline-flex min-h-[36px] items-center text-[0.9375rem]"
                        style={{ color: 'var(--mk-text-muted)' }}
                      >
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        to={link.to}
                        className="inline-flex min-h-[36px] items-center text-[0.9375rem] transition-colors"
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
          <p className="mk-caption">© {new Date().getFullYear()} {brand.wordmark}</p>
          <p className="mk-caption">{brand.footerNote}</p>
        </div>
      </div>
    </footer>
  );
}
