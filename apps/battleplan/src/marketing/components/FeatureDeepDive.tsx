/**
 * FeatureDeepDive.tsx — One feature, one screenshot, one idea
 *
 * The workhorse: four of these on the player page, four on the venue page.
 * The image side alternates down the page, but always stacks ABOVE the text on
 * mobile regardless of desktop side — a screenshot below its own explanation
 * reads as an afterthought on a phone.
 */

import React from 'react';
import { Reveal } from './Section';
import { ScreenshotFrame, type MockVariant } from './ScreenshotFrame';

export function FeatureDeepDive({
  eyebrow,
  title,
  body,
  bullets,
  imageSide = 'left',
  mock = 'columns',
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  imageSide?: 'left' | 'right';
  mock?: MockVariant;
  /** Anything that belongs under the bullets — the Callout, usually. */
  children?: React.ReactNode;
}) {
  const imageFirst = imageSide === 'left';

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <Reveal className={imageFirst ? 'lg:order-1' : 'lg:order-2'}>
        <ScreenshotFrame mock={mock} aspect="aspect-[4/3]" />
      </Reveal>

      <div className={imageFirst ? 'lg:order-2' : 'lg:order-1'}>
        <Reveal>
          <p className="mk-eyebrow mb-4">{eyebrow}</p>
          <h2 className="mk-display-2 max-w-[16ch]">{title}</h2>
          <p className="mk-body mk-measure mt-6">{body}</p>
        </Reveal>

        <Reveal delay={60}>
          <ul className="mt-8 flex flex-col gap-3">
            {bullets.map(bullet => (
              <li key={bullet} className="flex gap-3">
                <Tick />
                <span className="mk-body-sm">{bullet}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {children && <Reveal delay={120}>{children}</Reveal>}
      </div>
    </div>
  );
}

/** Small enough to live here rather than in the icon set. */
function Tick() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="mt-[3px] h-4 w-4 flex-shrink-0"
      style={{ color: 'var(--mk-accent-400)' }}
      aria-hidden="true"
    >
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
