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
  /**
   * Set when the headline carries its own <br> breaks and one of those lines
   * is long. Keeps the desktop size and scales down harder on phones, so the
   * lines the copy asked for survive instead of wrapping in half.
   */
  longTitle?: boolean;
  /** Small reassurance under the buttons — never a promise about future pricing. */
  note: string;
  /** The venue strip, directly under the note. Proof before product. */
  logos?: { label: string };
  /** Usage figures. Placeholder until there are real ones worth showing. */
  trustLine?: string;
  mock?: MockVariant;
  /** Real screenshot. Falls back to the placeholder mock when absent. */
  src?: string;
  /** Phone-width capture, swapped in below md. */
  srcMobile?: string;
  alt?: string;
  /** Match the asset's shape so the hero isn't cropped by the frame. */
  aspect?: string;
}

export function Hero({
  title,
  lead,
  primaryCta,
  secondaryCta,
  longTitle = false,
  note,
  logos,
  trustLine,
  mock = 'columns',
  src,
  srcMobile,
  alt,
  aspect = 'aspect-[16/10]',
}: HeroProps) {
  return (
    <section className="mk-surface-base mk-glow relative overflow-hidden pt-[124px] pb-20 md:pt-[152px] md:pb-28 lg:pb-32">
      <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-6 md:px-8 lg:px-12">
        {/*
          Wider than a comfortable measure would suggest, because the headline
          sets its own line breaks with <br>. At the top of the display clamp
          the longest line needs ~870px, and the old 880px block with a 16ch cap
          on the h1 re-wrapped every line it was given. The lead paragraph keeps
          its own 52ch measure, so widening this doesn't stretch the body copy.
        */}
        <div className="mx-auto max-w-[1000px] text-center">
          <Reveal>
            <h1 className={`mk-display-1 mx-auto ${longTitle ? 'mk-display-1-long' : ''}`}>
              {title}
            </h1>
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
              <VenueLogos label={logos.label} />
            </Reveal>
          )}
        </div>

        <Reveal delay={240} className="mt-16 md:mt-20">
          <ScreenshotFrame hero mock={mock} src={src} srcMobile={srcMobile} alt={alt} aspect={aspect} />
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
