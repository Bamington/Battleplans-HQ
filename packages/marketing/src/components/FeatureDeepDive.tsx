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
  src,
  srcMobile,
  alt,
  aspect,
  narrowImage = false,
  wideFrame = false,
  layout = 'split',
  demo,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  imageSide?: 'left' | 'right';
  mock?: MockVariant;
  /** Real screenshot. Falls back to the placeholder mock when absent. */
  src?: string;
  /** Phone-width capture, swapped in below md. */
  srcMobile?: string;
  alt?: string;
  /**
   * Match the asset's own shape. A single ratio can't serve both: the full-page
   * shots are landscape and the single-column clips are 3:4, and forcing either
   * into the other's box crops away the half that matters.
   */
  aspect?: string;
  /** Pull the frame in to 80% of its column. For the tall portrait shots. */
  narrowImage?: boolean;
  /**
   * A 20% wider image column. For the interactive demo, which renders real text
   * at real sizes rather than a downscaled screenshot and needs the room.
   */
  wideFrame?: boolean;
  /**
   * "split" puts the frame beside the copy; "stacked" puts it full width above.
   * Stacked is for screenshots that need the whole column to stay legible.
   */
  layout?: 'split' | 'stacked';
  /**
   * An interactive replica shown instead of a screenshot. Brings its own frame.
   * Used once, deliberately — see BookingsDemo on why this is not the default.
   */
  demo?: React.ReactNode;
  /** Anything that belongs under the bullets — the Callout, usually. */
  children?: React.ReactNode;
}) {
  const imageFirst = imageSide === 'left';

  /*
   * Stacked: one full-width frame, then the copy underneath.
   *
   * For a screenshot that needs the whole column to be legible — the stats page
   * is three panels of small numbers, and at 400px in a side-by-side it reads
   * as texture. Heading and body centre under it like the hero; the bullets go
   * two-up, because four of them in a single centred column would run to a
   * ribbon almost as tall as the image.
   */
  if (layout === 'stacked') {
    return (
      <div>
        <Reveal>
          <ScreenshotFrame
            mock={mock}
            src={src}
            srcMobile={srcMobile}
            alt={alt}
            aspect={aspect ?? 'aspect-[8/5]'}
          />
        </Reveal>

        <Reveal delay={60} className="mt-14 text-center md:mt-16">
          <p className="mk-eyebrow mb-4">{eyebrow}</p>
          <h2 className="mk-display-2 mx-auto max-w-[18ch]">{title}</h2>
          <p className="mk-lead mx-auto mt-6">{body}</p>
        </Reveal>

        <Reveal delay={120}>
          <ul className="mx-auto mt-10 grid max-w-[900px] gap-x-10 gap-y-4 sm:grid-cols-2">
            {bullets.map(bullet => (
              <li key={bullet} className="flex gap-3">
                <Tick />
                <span className="mk-body-sm">{bullet}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {children && <Reveal delay={180}>{children}</Reveal>}
      </div>
    );
  }

  /*
   * Uneven columns, not 50/50.
   *
   * A half-and-half split left the body copy at 38 characters per line at
   * 1024px — well under a readable measure — because a portrait screenshot
   * needs far less width than a paragraph does. Giving the image a fixed column
   * and the text whatever remains puts the measure back around 45ch at 1024 and
   * 57ch at 1440, and it means the frame is the same size on every screen
   * rather than growing with the viewport.
   */
  return (
    <div
      className={`grid items-center gap-12 lg:gap-16 ${
        // Only the portrait frames get a fixed column. A landscape screenshot
        // is already the wider, shorter shape and needs the room — squeezing
        // the stats page into 360px would make it unreadable.
        !narrowImage
          ? 'lg:grid-cols-2'
          : wideFrame
            ? imageFirst
              ? 'lg:grid-cols-[432px_1fr] xl:grid-cols-[480px_1fr]'
              : 'lg:grid-cols-[1fr_432px] xl:grid-cols-[1fr_480px]'
            : imageFirst
              ? 'lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr]'
              : 'lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]'
      }`}
    >
      <Reveal className={imageFirst ? 'lg:order-1' : 'lg:order-2'}>
        {/*
          Below lg the layout is stacked and the frame would run the full width
          of the page: at 768 that made a 9:21 image 545 wide and 1272 tall —
          taller than the whole viewport, with a single booking card rendered
          bigger than life size. Capping it keeps a tablet closer to the phone
          treatment, which was the one that already worked.
        */}
        {/*
          A demo is not a screenshot and can't take the same cap. The 80%/300px
          rule below suits an image — it scales, so making it smaller only makes
          it smaller. A demo renders live text at a fixed size, so narrowing it
          doesn't shrink the content, it shortens the box the content has to fit
          in: at 261px across, the bookings list had 187px of room for 1,858px
          of rows. Demos get the full column on a phone and a reading-width cap
          on a tablet, and their height follows their content (see marketing.css).
        */}
        <div
          className={
            demo
              ? 'mx-auto w-full max-w-[420px] lg:max-w-none'
              : narrowImage
                ? `mx-auto w-4/5 lg:w-full lg:max-w-none ${wideFrame ? 'max-w-[360px]' : 'max-w-[300px]'}`
                : ''
          }
        >
          {/* A demo brings its own frame and caption, so it replaces the
              screenshot outright rather than rendering inside one. */}
          {demo ?? (
            <ScreenshotFrame
              mock={mock}
              src={src}
              srcMobile={srcMobile}
              alt={alt}
              aspect={aspect ?? 'aspect-[4/3]'}
            />
          )}
        </div>
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
