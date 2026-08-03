/**
 * Testimonials.tsx — Social proof
 *
 * Everything rendered here is currently placeholder copy, written the way a
 * real quote would sound so the layout holds when the real ones arrive. The
 * PLACEHOLDER badge is deliberate and should stay until they're swapped — a
 * fake testimonial that looks finished is the easiest thing on this page to
 * ship by accident.
 */

import { Quote } from '../icons';
import { Reveal, SectionHeading } from './Section';

export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

export function Testimonials({
  title,
  testimonials,
  logoCaption,
}: {
  title: string;
  testimonials: Testimonial[];
  logoCaption: string;
}) {
  return (
    <>
      <Reveal>
        <SectionHeading title={title} align="center" />
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.name + i} delay={i * 60}>
            <figure className="mk-card h-full p-7">
              <span style={{ color: 'var(--mk-accent-500)' }}>
                <Quote className="w-7 h-7" />
              </span>
              <blockquote className="mk-body mt-5">{t.quote}</blockquote>
              <figcaption className="mk-caption mt-6">
                <span style={{ color: 'var(--mk-text-primary)' }}>{t.name}</span>
                {' — '}{t.detail}
              </figcaption>
              <PlaceholderBadge />
            </figure>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-14">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex h-10 w-[130px] items-center justify-center"
                style={{
                  borderRadius: 'var(--mk-radius-chip)',
                  border: '1px dashed var(--mk-border-strong)',
                  color: 'var(--mk-text-muted)',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.08em',
                }}
              >
                VENUE LOGO
              </div>
            ))}
          </div>
          <p className="mk-caption mt-8 text-center">{logoCaption}</p>
        </div>
      </Reveal>
    </>
  );
}

function PlaceholderBadge() {
  return (
    <span
      className="mt-4 inline-block px-2 py-1"
      style={{
        borderRadius: 'var(--mk-radius-chip)',
        border: '1px dashed var(--mk-border-strong)',
        color: 'var(--mk-text-muted)',
        fontSize: '0.625rem',
        letterSpacing: '0.1em',
      }}
    >
      PLACEHOLDER
    </span>
  );
}
