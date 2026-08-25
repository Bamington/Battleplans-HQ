# BattlePack Marketing — Claude Instructions

This directory is the public marketing site: `battlepack.app` and
`battlepack.app/stores`.

**Read [`packages/marketing/CLAUDE.md`](../../../../packages/marketing/CLAUDE.md)
first.** It owns the design system, the token rules, the colour rules and the
exemption from this app's component rules — none of which are repeated here.
What follows is only what's true of BattlePack's site specifically.

## Two readers, two pages

- **`/` is for organisers.** A tournament organiser, a league runner, a club
  night host. Their problem is admin: writing the same event into a Facebook
  post, a Discord pin and a spreadsheet, then answering "what time is round 3"
  forty times.
- **`/stores` is for the venue.** Their problem is the shop: what fills the
  floor, who can keep it up to date, and what it does to the table diary.

**Attendees never see either page.** They arrive at `battlepack.app/<slug>` from
a link somebody sent them. That single fact settles most of the copy — nothing
here has to explain what a Battlepack is to a player, so everything can be about
what the organiser or the shop gets out of it.

## `/stores` reserved the word "stores"

A published pack lives at the root, so the app's routes share a namespace with
every slug an organiser might claim. Adding `/stores` made that word permanently
unavailable, and **the list now lives in four places that all have to agree**:

1. [`App.tsx`](../App.tsx) — the route
2. `battlepack_reserved_slugs()` — `20260825000000_battlepack_marketing.sql`
3. [`vercel.json`](../../vercel.json) — the rewrite, which must NOT send this
   path to the social-preview function. Miss this one and `/stores` is served
   `api/og.ts` instead of the app.
4. [`CLAUDE.md`](../../CLAUDE.md) — where the rule is written down

**Adding a third marketing page means all four again.** The migration that
reserved `stores` also guards against reserving a slug a live event already
holds — copy that `DO $$ … $$` block, because taking a published URL away from
everyone holding the link is the one mistake here that can't be undone.

## The CTA is not a signup, and must never become one

BattlePack is **not self-serve**. Access is platform admins plus store admins at
venues it has been switched on for — two tables that both have to say yes (see
[the app's CLAUDE.md](../../CLAUDE.md)). A "create your free account" button
would send an organiser straight into the access gate.

So the nav button, both hero primaries and the closing CTA all point at
`/stores#get-battlepack`, and the actual conversion is `StoreSignupForm`. If a
future task asks to "add a signup", the answer is that the signup is the form,
unless the access model has changed.

## No pricing claim

BattlePlan's venue page says "completely free for stores and clubs". This site
deliberately does **not** say anything equivalent, because nothing has been
decided. The note under both heroes says how it actually works — "switched on
venue by venue" — which is true and is also the honest answer to the question a
reader is really asking. Don't fill that gap with a guess.

## The two claims to keep honest

- **The BattlePlan integration is conditional.** Publishing a pack really does
  hold the venue's tables and unpublishing really does release them, but only for
  venues running their bookings on BattlePlan. The `/stores` copy and its FAQ
  both say so. Don't let a later edit shorten that into "it manages your tables".
- **Every event on this site is invented.** Burrow Games is the fixture venue
  BattlePlan's screenshots use; the Autumn Open, the escalation league and the
  prices are made up. A real organiser's event on a marketing page is somebody's
  actual Saturday, and the prices stop being true the moment they change.

## The three demos

`PackDemo`, `LeagueDemo` and `EventsDemo` are **replicas, not photographs** —
hand-built markup that looks like the app and responds to a click. That's a real
trade: a screenshot can't drift and these can. If `PackDocument` or
`BattlepackListItem` gets restyled, nothing here fails and nothing tells you.

Three, on two pages, is the budget. Everything else is `AppMock`.

`LeagueDemo` is the one worth the cost and the one to be careful with. Its
arithmetic is `lib/leagues.ts`'s rules **deliberately re-stated rather than
imported** — importing the real module would drag the pack types, the Supabase
client and the segment shape onto a public page. If the league layout rules
change, that file has to change too. The three it has to keep:

- Rounds run end to end from the league's start, every one the same length.
- An Event **occupies** the calendar. Everything after it starts later.
- Rounds are numbered among themselves; an Event takes no number.

## Outstanding before launch

- **Real screenshots.** Every frame that isn't one of the three demos is still
  `AppMock`. Real captures need a fixture venue with invented events, the way
  `tools/screenshots` builds Burrow Games for BattlePlan — that script has no
  BattlePack profile yet.
- **Prerendering**, as for every marketing route in the suite. Note that
  `api/og.ts` deliberately does not serve these paths: `vercel.json` excludes
  `stores` and the root was never rewritten, so both pages arrive as the bare
  SPA shell with no tags.
- **A proof strip.** Neither hero has one. BattlePlan's carries venue logos
  because a player's first question is "is my shop on this?"; an organiser's is
  "will this save me an evening", which a logo wall doesn't answer. It goes in
  when there are events worth naming.
