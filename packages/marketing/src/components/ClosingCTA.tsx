/**
 * ClosingCTA.tsx — The second and last accent moment
 *
 * Bookends the hero. Full-bleed accent-tinted panel so the page ends on the
 * brightest thing below the fold rather than trailing off into the footer.
 */

import { CTAButton, ArrowLink } from './Button';
import { Reveal } from './Section';

export function ClosingCTA({
  id,
  title,
  body,
  primaryCta,
  secondaryCta,
  children,
}: {
  /**
   * Anchor target, for a page whose hero button jumps down here. Sections with
   * an id get scroll-margin in marketing.css, so the fixed nav doesn't land on
   * top of the thing being jumped to.
   */
  id?: string;
  title: string;
  body: string;
  /** Omit both to close with something else — a page can end on a form. */
  primaryCta?: { to: string; label: string };
  secondaryCta?: { to: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="mk-surface-base relative overflow-hidden">
      {/*
        Top padding on the same 80/112/160 rhythm every Section uses. This block
        had bottom padding only, so it sat hard against whatever preceded it —
        fine when a tile grid came before it, obvious now the section above ends
        on a frame.
      */}
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-20 pb-24 md:px-8 md:pt-28 md:pb-28 lg:px-12 lg:pt-40 lg:pb-40">
        <Reveal>
          <div className="mk-cta-panel relative overflow-hidden px-8 py-16 text-center md:px-16 md:py-24">
            <h2 className="mk-display-2 mx-auto max-w-[18ch]">{title}</h2>
            <p className="mk-lead mx-auto mt-6 max-w-[46ch]">{body}</p>
            {(primaryCta || secondaryCta) && (
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {primaryCta && <CTAButton to={primaryCta.to}>{primaryCta.label}</CTAButton>}
                {secondaryCta && <ArrowLink to={secondaryCta.to}>{secondaryCta.label}</ArrowLink>}
              </div>
            )}

            {children && <div className="mt-10">{children}</div>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
