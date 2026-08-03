# BattlePlan Marketing — Claude Instructions

This directory is the public marketing site: `battleplan.app` and
`battleplan.app/venue`. It is **deliberately exempt** from the component rules in
`apps/battleplan/CLAUDE.md`.

## The exemption, and why it exists

The app's rules say: always use existing components, never create a new one
without permission, always add new components to the gallery. Those rules are
right for the app and wrong here.

The app optimises for consistent, repeated use. A landing page optimises for
selling in one scroll. They want different spacing, different radii, different
type sizes and a different button. Forcing them onto one component set makes
both worse.

So, for this directory only:

- **Do not import from `@battleplans/ui`.** No components, no icons, no tokens.
- **Do not add anything here to the component gallery.** These aren't app
  components and don't belong in it.
- **Do create new components freely** within this directory. That's the point.

If a future task asks you to "tidy up" the landing page by reusing shared
components, that is a misunderstanding of the brief — check before doing it.

## Tokens

Every token is `--mk-*`, defined in `marketing.css` under the `.mk` scope. The
prefix is a guard rail: nothing here can accidentally resolve an app token, and
nothing in the app can resolve a marketing one. If a marketing component renders
in app colours, that's the bug.

The surface ramp is **lighter than the app's background** on purpose. The app is
`#030712`; the page base is `#0c0a14`. That gap is what lets a near-black
screenshot read as a well rather than dissolving into the page. Three rules
follow:

1. Nothing on the page may be as dark as a screenshot. `--mk-surface-well` is
   reserved for screenshot frames and the footer.
2. Every screenshot keeps its rim light and accent glow. Without them the frame
   reads as a hole.
3. If a screenshot stops separating, **lift `--mk-surface-base`** — don't darken
   the screenshot.

## Colour rules

- The accent is violet, drawn from the app's primary but brighter for dark.
- **The primary button is dark ink on a bright fill.** White on
  `--mk-accent-500` fails contrast at 3.5:1; `--mk-surface-well` on it passes at
  5.7:1. Don't "fix" this to match the app's white-on-violet buttons.
- The accent is rationed. Per page it appears in: primary buttons, the active
  nav item, screenshot underglows, the Callout, and the closing CTA panel.
  Section headings, bullets and icons are **not** accent-coloured.

## Type

- Display is Tanker, single weight 400. **Never synthesise bold** — it blooms on
  dark. If a heading looks weak, tighten tracking.
- Display tracking is **negative** here, the inverse of the app's
  `tracking-wide`. That inversion is most of what stops the site reading as the
  app enlarged.
- Body copy is Space Grotesk. A third face (Satoshi) was specced and cut.
- Nothing below weight 400 anywhere.

## Known deviations from the spec

**Fonts are not duplicated.** The design spec called for copying the woff2 files
so the two systems share no assets at all. We don't, because `index.html` warns
that a second source for these faces downloads them twice, and these pages are
routes inside the same SPA — `packages/ui`'s stylesheet is already loaded by the
time anyone sees them. Revisit if marketing ever moves to its own build.

## Outstanding before launch

- **Prerendering.** This is a client-rendered SPA. `MarketingLayout` sets the
  title and description in an effect, which does nothing for crawlers that don't
  run JavaScript. The two marketing routes need prerendering at build time, plus
  real OG tags, before the page can do its job.
- **Real screenshots.** `ScreenshotFrame` falls back to `<AppMock>`, an abstract
  placeholder painted in the app's real background colour so it tests the
  frame's separation honestly. Pass `src` when real captures exist; nothing
  around it needs to change.
- **Mock the data in real screenshots.** Real usernames and venue names must not
  appear on a public page. Use one consistent fictional account across every
  shot on a page.
- **All testimonials are placeholder** and carry a visible PLACEHOLDER badge.
  The badge stays until they're real.
- **Mobile nav.** The middle links are desktop-only; the nav needs a proper
  mobile menu.
- **The `/venue` CTA** currently points at `/login`. Whether listing a venue is
  self-serve or a conversation is still undecided.
