/**
 * ClosingCTA.tsx — The second and last accent moment
 *
 * Bookends the hero. Full-bleed accent-tinted panel so the page ends on the
 * brightest thing below the fold rather than trailing off into the footer.
 */

import { CTAButton, ArrowLink } from './Button';
import { Reveal } from './Section';

export function ClosingCTA({
  title,
  body,
  primaryCta,
  secondaryCta,
}: {
  title: string;
  body: string;
  primaryCta: { to: string; label: string };
  secondaryCta: { to: string; label: string };
}) {
  return (
    <section className="mk-surface-base relative overflow-hidden">
      {/*
        Top padding on the same 80/112/160 rhythm every Section uses. This block
        had bottom padding only, so it sat hard against whatever preceded it —
        fine when a tile grid came before it, obvious now the section above ends
        on a frame.
      */}
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-20 pb-24 md:px-8 md:pt-28 md:pb-28 lg:px-12 lg:pt-40 lg:pb-40">
        <Reveal>
          <div
            className="relative overflow-hidden px-8 py-16 text-center md:px-16 md:py-24"
            style={{
              borderRadius: 'var(--mk-radius-frame)',
              background:
                'linear-gradient(160deg, rgba(155,107,255,0.16) 0%, rgba(155,107,255,0.05) 45%, rgba(20,17,31,0.9) 100%)',
              border: '1px solid rgba(155,107,255,0.25)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <h2 className="mk-display-2 mx-auto max-w-[18ch]">{title}</h2>
            <p className="mk-lead mx-auto mt-6 max-w-[46ch]">{body}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CTAButton to={primaryCta.to}>{primaryCta.label}</CTAButton>
              <ArrowLink to={secondaryCta.to}>{secondaryCta.label}</ArrowLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
