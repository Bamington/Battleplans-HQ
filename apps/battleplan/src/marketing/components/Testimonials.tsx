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

/*
 * The venue logo strip used to live at the bottom of this section. It moved
 * into the hero — "is my shop on this?" is a first-screen question, and the
 * stores are better proof than anything down here.
 */
export function Testimonials({
  title,
  testimonials,
}: {
  title: string;
  testimonials: Testimonial[];
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
