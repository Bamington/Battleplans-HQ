/**
 * index.ts — The marketing design system's public surface
 *
 * One import path for every app's marketing pages. Deep imports into
 * ./components are not part of the contract; if something isn't here, it isn't
 * meant to be used from outside yet.
 *
 * `marketing.css` is not exported and doesn't need to be — MarketingLayout
 * imports it, and every page goes through the layout. An app that imports the
 * stylesheet a second time gets it once anyway, but there's no reason to.
 */

export { MarketingLayout } from './MarketingLayout';
export { BrandProvider, useBrand } from './brand';
export type { MarketingBrand, BrandLink } from './brand';

export { Section, Reveal, SectionHeading } from './components/Section';
export type { SectionTone } from './components/Section';
export { Hero } from './components/Hero';
export { CTAButton, ArrowLink } from './components/Button';
export { PillarGrid } from './components/PillarGrid';
export type { Pillar } from './components/PillarGrid';
export { FeatureDeepDive } from './components/FeatureDeepDive';
export { Callout } from './components/Callout';
export { ClosingCTA } from './components/ClosingCTA';
export { TileGrid } from './components/TileGrid';
export type { Tile } from './components/TileGrid';
export { FAQ } from './components/FAQ';
export type { FAQItem } from './components/FAQ';
export { SuiteSection } from './components/SuiteSection';
export { Testimonials } from './components/Testimonials';
export type { Testimonial } from './components/Testimonials';
export { ScreenshotFrame, AppMock } from './components/ScreenshotFrame';
export type { MockVariant } from './components/ScreenshotFrame';
export { MarketingNav } from './components/MarketingNav';
export { MarketingFooter } from './components/MarketingFooter';

export * from './icons';
