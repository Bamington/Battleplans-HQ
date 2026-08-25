# Marketing — Claude Instructions

This package is the design system for every app's **public marketing site** —
`battleplan.app`, `battlepack.app`, and whatever follows. It is **deliberately
exempt** from the component rules in the apps' `CLAUDE.md` files.

## The exemption, and why it exists

The apps' rules say: always use existing components, never create a new one
without permission, always add new components to the gallery. Those rules are
right for an app and wrong here.

An app optimises for consistent, repeated use. A landing page optimises for
selling in one scroll. They want different spacing, different radii, different
type sizes and a different button. Forcing them onto one component set makes
both worse.

So, for this package and for every `src/marketing/` directory that consumes it:

- **Do not import from `@battleplans/ui`.** No components, no icons, no tokens.
  The one carve-out is the Supabase client in an app's own signup form — see
  "The signup forms" below.
- **Do not add anything here to any app's component gallery.** These aren't app
  components and don't belong in it.
- **Do create new components freely** within this package. That's the point.

If a future task asks you to "tidy up" a landing page by reusing shared app
components, that is a misunderstanding of the brief — check before doing it.

## What lives here and what lives in an app

The split is **system vs content**, and it is the thing to get right when adding
anything.

Here: anything a second app would want unchanged. Section shells, the reveal,
the hero, the deep dive, the tile grid, the FAQ, the frame, the button, the
icon set, the tokens, the generic demo shell.

In `apps/<app>/src/marketing/`: everything that is one app's own.

- **`brand.ts`** — the wordmark, the nav links, the CTA, the footer. See
  `brand.tsx` here for what does and doesn't belong in it.
- **`pages/`** — every page. A page is copy, and copy is not shareable.
- **`components/demos/`** and **`demos.css`** — the interactive replicas. The
  generic shell is here; a replica of one app's screen is that app's.
- **`assets/`** — screenshots and logos.
- The signup form, because it touches Supabase.

A component that two apps would both want belongs here, not in one app's
directory — the same rule the apps use for `packages/ui`.

## Tokens

Every token is `--mk-*`, defined in `marketing.css` under the `.mk` scope. The
prefix is a guard rail: nothing here can accidentally resolve an app token, and
nothing in an app can resolve a marketing one. If a marketing component renders
in app colours, that's the bug.

The surface ramp is **lighter than the apps' background** on purpose. The apps
are `#030712`; the page base is a lifted, tinted charcoal. That gap is what lets
a near-black screenshot read as a well rather than dissolving into the page.
Three rules follow:

1. Nothing on the page may be as dark as a screenshot. `--mk-surface-well` is
   reserved for screenshot frames and the footer.
2. Every screenshot keeps its rim light and accent glow. Without them the frame
   reads as a hole.
3. If a screenshot stops separating, **lift `--mk-surface-base`** — don't darken
   the screenshot.

## Brands

`.mk` carries BattlePlan's violet as the fallback. Every other app overrides
**only the accent ramp and the surface tint**, in its own
`.mk[data-mk-brand='…']` block in `marketing.css`. `MarketingLayout` writes that
attribute from `brand.key`.

Adding an app is one block there and one `brand.ts` in the app. Two rules:

- **`--mk-accent-rgb` is a space-separated triplet.** Every translucent accent
  in the stylesheet is written `rgb(var(--mk-accent-rgb) / <alpha>)`, so that one
  line re-tints the glows, the frame hovers, the focus rings and the callout
  panels together. Never reintroduce an `rgba()` literal — it will be violet on
  every site including the ones that aren't.
- **Surfaces are re-hued, not re-invented.** BattlePack's are BattlePlan's at a
  different hue and 85% of the saturation. Keeping the lightness ramp identical
  is what guarantees rule 1 above still holds on a new brand.

`--mk-app-accent` is the accent of the app being *photographed*, for the demo
replicas and the placeholder mock. It belongs to the other design system and is
here only because the shared stylesheet has to be told which one.

## Colour rules

- The accent is the app's own primary, pushed brighter for dark.
- **The primary button is dark ink on a bright fill.** White on
  `--mk-accent-500` fails contrast; `--mk-surface-well` on it passes. This holds
  for every brand, because a fill bright enough to carry a dark page is always
  too bright to take white text. Don't "fix" it to match an app's
  white-on-primary buttons.
- The accent is rationed. Per page it appears in: primary buttons, the active
  nav item, screenshot underglows, the Callout, and the closing CTA panel.
  Bullets and icons are **not** accent-coloured.
- **Headings are the one exception, and only in transit.** `.mk-display-1` and
  `.mk-display-2` arrive in `--mk-accent-300` and settle to `--mk-text-primary`
  as they scroll in. The resting state of every heading is still white — the
  colour is a moment, not a scheme. Card and tile headings (`.mk-display-3`)
  don't do this: they appear in grids of three to eight, and eight simultaneous
  colour transitions is noise rather than emphasis.

## Type

- Display is Tanker, single weight 400. **Never synthesise bold** — it blooms on
  dark. If a heading looks weak, tighten tracking.
- Display tracking is **negative** here, the inverse of the apps'
  `tracking-wide`. That inversion is most of what stops a site reading as its app
  enlarged.
- Body copy is Space Grotesk. A third face (Satoshi) was specced and cut.
- Nothing below weight 400 anywhere.

## Tailwind

The components use Tailwind utilities, and this package lives outside every app's
Vite root — so automatic content detection never reaches it. **Each consuming
app's `src/index.css` carries `@source '../../../packages/marketing/src'`.**
Without it the build silently drops every utility these components use and the
pages render as unstyled stacks. `marketing.css` can't declare it itself: it's
imported from TSX, not into the app's stylesheet, so it isn't part of the graph
Tailwind generates from.

Adding a new consuming app means adding that line, the `paths` entry in
`tsconfig.app.json`, the `resolve.alias` in `vite.config.ts`, and the workspace
dependency — all four, or it fails in a different way each time.

## The signup forms

Settled: getting listed, or getting an app switched on, is a conversation rather
than something self-serve. Both sites close on a form that inserts into
`public.venue_leads`, and a Postgres trigger emails us through the
`send-venue-lead` edge function. `venue_leads.app` says which site the lead came
from, so the two share one table, one trigger and one inbox.

The forms live in the apps, not here, and each imports the Supabase client from
`@battleplans/ui`. That is the one place the ban above is lifted: the client
isn't a design asset, there is exactly one per app on purpose because it holds
the session, and constructing a second would be the actual mistake. This package
stays free of Supabase entirely — a design system that can talk to a database is
one nobody can reason about.

## Known deviations from the spec

**Fonts are not duplicated.** The design spec called for copying the woff2 files
so the two systems share no assets at all. We don't, because each app's
`index.html` warns that a second source for these faces downloads them twice, and
these pages are routes inside the same SPA — `packages/ui`'s stylesheet is
already loaded by the time anyone sees them. Revisit if marketing ever moves to
its own build.

## Outstanding

- **Prerendering.** These are client-rendered SPAs. `MarketingLayout` sets the
  title and description in an effect, which does nothing for crawlers that don't
  run JavaScript. Every marketing route needs prerendering at build time, plus
  real OG tags, before the pages can do their job. (BattlePack's `/:slug` pages
  already have server-rendered tags via `api/og.ts` — the marketing routes
  don't, and that function deliberately doesn't serve them.)
- **All testimonials are placeholder** and carry a visible PLACEHOLDER badge.
  The badge stays until they're real. Both sites currently hide the section
  behind a flag rather than shipping it.
- **`AppMock` is a placeholder,** not a screenshot. It paints itself `#030712`,
  the apps' real background, so it tests the exact thing the design depends on:
  whether a near-black app screenshot separates from a lifted near-black page.
  Pass `src` when real captures exist; nothing around it needs to change.
- **Mock the data in real screenshots.** Real usernames and venue names must not
  appear on a public page. Use one consistent fictional account across every
  shot on a page.
