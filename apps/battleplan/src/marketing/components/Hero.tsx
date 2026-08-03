/**
 * Hero.tsx — Opening section
 *
 * One of only two accent moments on the page (the other is the closing CTA).
 * The radial glow sits behind the headline and fades out well before the
 * screenshot, so the frame's own underglow stays the brightest thing below
 * the fold.
 */

import { CTAButton, ArrowLink } from './Button';
import { ScreenshotFrame, type MockVariant } from './ScreenshotFrame';
import { Reveal } from './Section';
import { VenueLogos } from './VenueLogos';

interface HeroProps {
  title: React.ReactNode;
  lead: string;
  primaryCta: { to: string; label: string };
  secondaryCta: { to: string; label: string };
  /** Small reassurance under the buttons — never a promise about future pricing. */
  note: string;
  /** The venue strip, directly under the note. Proof before product. */
  logos?: { label: string; venues?: string[] };
  /** Usage figures. Placeholder until there are real ones worth showing. */
  trustLine?: string;
  mock?: MockVariant;
}

export function Hero({
  title,
  lead,
  primaryCta,
  secondaryCta,
  note,
  logos,
  trustLine,
  mock = 'columns',
}: HeroProps) {
  return (
    <section className="mk-surface-base mk-glow relative overflow-hidden pt-[124px] pb-20 md:pt-[152px] md:pb-28 lg:pb-32">
      <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-[880px] text-center">
          <Reveal>
            <h1 className="mk-display-1 mx-auto max-w-[16ch]">{title}</h1>
          </Reveal>

          <Reveal delay={60}>
            <p className="mk-lead mx-auto mt-7 max-w-[52ch]">{lead}</p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CTAButton to={primaryCta.to}>{primaryCta.label}</CTAButton>
              <ArrowLink to={secondaryCta.to}>{secondaryCta.label}</ArrowLink>
            </div>
            <p className="mk-caption mt-5">{note}</p>
          </Reveal>

          {logos && (
            <Reveal delay={180}>
              <VenueLogos label={logos.label} venues={logos.venues} />
            </Reveal>
          )}
        </div>

        <Reveal delay={240} className="mt-16 md:mt-20">
          <ScreenshotFrame hero mock={mock} aspect="aspect-[16/10]" />
        </Reveal>

        {trustLine && (
          <Reveal delay={300}>
            <p className="mk-caption mt-10 text-center">{trustLine}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
