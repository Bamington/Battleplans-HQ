/**
 * CenterViewport.tsx — Centre column chrome for the card-builder shell.
 *
 * Wraps the <CardCarousel> with the small amount of layout every builder
 * needs around it:
 *   - A `<main>`-level flex column with the page background, applying the
 *     desktop/mobile order classes (order-1 on mobile, order-2 at md+).
 *   - A logo strip at the top that hides on mobile when a side panel is open
 *     and on short viewports (e.g. landscape phones), to give the active
 *     card more vertical room.
 *   - A `flex-1` vs `flex-none` switch on the main element, driven by
 *     `mobilePanelOpen`, so the centre collapses when a slide-in panel
 *     takes over the viewport on mobile.
 *
 * The carousel itself, plus any after-content (play-mode keyword cards,
 * rules tab, etc.), is passed as `children`. Top/bottom carousel overlay
 * slots stay on <CardCarousel>'s own `bottomLeftSlot` / `bottomRightSlot`
 * props — they're not duplicated here.
 *
 * Designed to be rendered as the `center` slot of <BuilderShell>.
 *
 * USAGE:
 *   <CenterViewport
 *     logo={<img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />}
 *     mobilePanelOpen={builder.mobilePanelOpen}
 *     isShortHeight={builder.isShortHeight}
 *   >
 *     <CardCarousel ... />
 *   </CenterViewport>
 */

import type { ReactNode } from 'react';

export interface CenterViewportProps {
  /** Logo node rendered above the carousel. Hidden when `mobilePanelOpen || isShortHeight`. */
  logo?: ReactNode;
  /** True when a mobile slide-in panel is currently visible. Collapses the centre to flex-none. */
  mobilePanelOpen?: boolean;
  /** True on short viewports (e.g. landscape phones). Forces the logo strip to hide. */
  isShortHeight?: boolean;
  /** Carousel + any below-carousel content (play-mode keyword cards, etc.). */
  children?: ReactNode;
}

const CenterViewport = ({
  logo,
  mobilePanelOpen = false,
  isShortHeight = false,
  children,
}: CenterViewportProps) => {
  const hideLogo = mobilePanelOpen || isShortHeight;

  return (
    <main className={`order-1 md:order-2 flex flex-col items-center overflow-hidden bg-gray-950 ${mobilePanelOpen ? 'flex-none' : 'flex-1'}`}>
      {logo != null && (
        <div className={`flex items-center justify-center w-full shrink-0 py-3 ${hideLogo ? 'hidden' : ''}`}>
          {logo}
        </div>
      )}
      {children}
    </main>
  );
};

export default CenterViewport;
