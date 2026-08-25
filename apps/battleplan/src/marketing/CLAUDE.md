# BattlePlan Marketing — Claude Instructions

This directory is the public marketing site: `battleplan.app` and
`battleplan.app/venue`.

**Read [`packages/marketing/CLAUDE.md`](../../../../packages/marketing/CLAUDE.md)
first.** The design system used to live here and now lives there, shared with
BattlePack and whatever follows. It owns the token rules, the colour rules, the
type rules and the exemption from this app's component rules — none of which are
repeated here. What's left in this file is only what's true of BattlePlan's site
specifically.

## What's still in this directory

`brand.ts`, the two pages, the five demo replicas and their stylesheet,
`VenueLogos`, `VenueSignupForm`, and the screenshots. Everything else — the
layout, the sections, the hero, the deep dive, the frame, the icons, the tokens
— is imported from `@battleplans/marketing`.

If a component here would serve a second app's site unchanged, it belongs in the
package instead. That's the same rule the app uses for `packages/ui`.

## The `/venue` signup form

Settled: listing a venue is a conversation, not self-serve. `VenueSignupForm`
inserts into `public.venue_leads` and a Postgres trigger emails us through the
`send-venue-lead` edge function.

**That table is now shared with BattlePack's `/stores` form.**
`venue_leads.app` says which site a lead came from, defaulting to `'battleplan'`
so this form keeps working without sending the column and so every row written
before `20260825000000` is correctly labelled. If this form ever starts setting
`app` explicitly, it must send `'battleplan'` — the CHECK constraint allows only
the two known values.

This is the one place in this directory that imports from `@battleplans/ui` —
the Supabase client, which isn't a design asset and mustn't be constructed
twice. The design ban still stands for everything else.

## The demos

Five replicas across two pages: `BookingsDemo`, `BattlesDemo`, `FriendsDemo`,
`TablesDemo`, `DayDemo`. They're hand-built markup that looks like the app and
responds to a click — a real trade, because a screenshot can't drift and these
can. If `BookingItem` gets restyled, nothing here fails and nothing tells you.

`demos.css` holds only the parts specific to BattlePlan's screens — the battle
card, the friend's win/loss bar, the venue table switches, the day's bookings.
The generic shell (the frame, the panel, the scrollable list, the row, the
pop-over dialog) is in the shared package.

## Screenshots

Captured against the Burrow Games fixture by `tools/screenshots`. Everything in
them is invented — the venue, the players, the results — so nothing exposes a
real person's account. Rebuild with:

```
node tools/screenshots/capture.mjs && node tools/screenshots/optimise.mjs
```

## Outstanding before launch

The suite-wide items (prerendering, placeholder testimonials) are in the
package's CLAUDE.md. BattlePlan's own:

- **Real testimonials.** Both pages hide the section behind
  `SHOW_TESTIMONIALS = false` rather than shipping the placeholder copy. The
  flag exists so the section stays type-checked while it's off.
- **A trust line.** `Hero` renders nothing when `trustLine` is absent, so
  restoring it is one prop — once there are numbers worth showing.
