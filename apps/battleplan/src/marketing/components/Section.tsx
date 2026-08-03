/**
 * Section.tsx — Page section shell and scroll reveal
 *
 * Every marketing section is one of these. It owns the surface tone and the
 * vertical rhythm (80 / 112 / 160px) so no section has to remember either, and
 * so the base/raised alternation down the page stays consistent.
 */

import React, { useEffect, useRef, useState } from 'react';

export type SectionTone = 'base' | 'raised' | 'well';

const TONE_CLASS: Record<SectionTone, string> = {
  base: 'mk-surface-base',
  raised: 'mk-surface-raised',
  well: 'mk-surface-well',
};

interface SectionProps {
  tone?: SectionTone;
  /** Adds the soft accent radial. Hero and closing CTA only — see marketing.css. */
  glow?: boolean;
  /** Full-bleed background with no inner container. */
  bare?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export function Section({
  tone = 'base',
  glow = false,
  bare = false,
  id,
  className = '',
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden ${TONE_CLASS[tone]} ${glow ? 'mk-glow' : ''} py-20 md:py-28 lg:py-40 ${className}`}
    >
      {bare ? children : (
        <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-6 md:px-8 lg:px-12">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Fade-and-rise on entry, once.
 *
 * Deliberately not a library: the whole motion spec is 400ms of opacity and
 * 16px of travel, and re-animating on scroll-back is the thing that makes
 * marketing pages feel cheap. `once` is not configurable for that reason.
 *
 * The reduced-motion path lives in marketing.css rather than here, so it
 * applies even if this component is bypassed.
 */
export function Reveal({
  delay = 0,
  className = '',
  children,
}: {
  /** Stagger between siblings. 60ms steps. */
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    let delivered = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        delivered = true;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Fire a little before the element reaches the viewport edge, so the
      // animation is already settling by the time it's properly on screen.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );

    observer.observe(el);

    /*
     * Fail open.
     *
     * Everything on these pages starts at opacity 0 and is revealed by the
     * observer, so anywhere the observer never runs shows a blank page. That
     * isn't hypothetical: a browser that isn't compositing frames never
     * delivers a callback, and the build-time prerenderer these routes need
     * for SEO may snapshot the DOM the same way.
     *
     * The guard is on *any* callback rather than on visibility. The observer
     * reports out-of-view elements immediately on observe, so `delivered`
     * flips within a frame in a healthy browser — which means a real reader
     * who hasn't scrolled this far yet still gets the animation, and only a
     * genuinely dead observer trips the fallback.
     */
    const failsafe = window.setTimeout(() => {
      if (!delivered) setVisible(true);
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`mk-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--mk-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Eyebrow + heading + optional lead. Every section opens with this, which is
 * the single most load-bearing borrowed idea from the reference site.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <div className={`${centered ? 'mx-auto text-center' : ''} ${className}`}>
      {eyebrow && <p className="mk-eyebrow mb-4">{eyebrow}</p>}
      <h2 className={`mk-display-2 ${centered ? 'mx-auto max-w-[20ch]' : 'max-w-[20ch]'}`}>
        {title}
      </h2>
      {lead && (
        <p className={`mk-lead mt-6 ${centered ? 'mx-auto' : ''}`}>{lead}</p>
      )}
    </div>
  );
}
