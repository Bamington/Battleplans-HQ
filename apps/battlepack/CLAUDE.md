# BattlePack — Claude Instructions

These rules apply to every command in this project.

## Status: the editor works, the public page does not

`/app` lists a store's packs and `/app/<packId>/edit` is the real three-column
editor — category nav, the pack as a document, and a form per category. The
schema is applied and the registry is populated.

Two things the design doc calls for are still missing, and both are visible
from the app:

- **The create flow's progress bar says 1/3 and 2/3.** There is no third step.

What is already decided and should be kept to:

- **The game is fixed when a pack is created** and cannot be changed afterwards,
  because the game-specific mandatory categories resolve exactly once, at
  creation.
- **The editor lives at `/app/<packId>/edit`** — keyed by row id, so it is
  stable, works for drafts with no slug, and survives the slug being set.
- **On a phone, selecting is navigating — and that is BattlePack's rule, not
  the shell's.** Below `lg` (`panelsAreDrawers()` in
  [PackEditor.tsx](src/pages/PackEditor.tsx)) picking a category closes the list
  and opens its form, because a category and its form are one thing and leaving
  the list up costs a second tap before anything can be typed. BattleCards
  deliberately does NOT do this — you pick through cards with the list up — so
  it lives in `selectCategory`, never in `BuilderShell`. Tapping a section of
  the document is the same door: `DocumentSection` takes an `onSelect` the
  editor passes and the public page does not, and it stands down for clicks on
  links, buttons and finished text selections so the document stays readable.
- **A published pack's public page lives at the root — `battlepack.app/<slug>`.**
  Built: [PublicPack.tsx](src/pages/PublicPack.tsx) on a catch-all `/:slug`
  route, declared LAST in `App.tsx` so the specific routes win. That namespace
  is shared with this app's own routes, so every path added to `App.tsx` is
  permanently reserved against slugs. Currently reserved: `app`, `login`,
  `auth`, `gallery`. Adding another silently makes that word unusable as a slug
  — **the list now lives in THREE places and all three have to agree**:
  `App.tsx`, the database trigger's reserved list, and the rewrite in
  [vercel.json](vercel.json) that sends slugs to the social-preview function.
  Miss the last one and that route is served the preview function instead of
  the app.
- **The social preview is server-rendered by [api/og.ts](api/og.ts).** No
  crawler runs JavaScript, so for a SPA the tags have to be in the HTML on
  arrival — `vercel.json` rewrites `/<slug>` to an edge function that looks the
  pack up, injects the tags into the real `index.html`, and returns it. The app
  boots exactly as before. Every failure path returns the untouched shell: a
  page without a rich preview is a disappointment, one that 500s is an outage.
  The card is `BattlePack: <event> by <club or creator>`, the About section as
  plain text, and the pack's banner — falling back to the game's artwork
  through `game-art.json`, which the build emits because the artwork is bundled
  under content hashes and all 116 rows in `games` have a null `icon` and
  `image`. See [game-art-manifest.ts](../../tools/vite/game-art-manifest.ts);
  it also stops Vite inlining game art, since a data URI is no use to a crawler.
- **Anonymous readers go through `battlepack_by_slug`, never the tables.** The
  battlepack tables have no grants for `anon` and should not get any; the
  SECURITY DEFINER function is the single way in and only ever returns
  published packs. See `20260727000100` for why that split exists.
- **The document is rendered by [packBody.tsx](src/components/packBody.tsx),
  shared between the editor's centre column and the public page.** They show the
  same pack, so they render from the same code — a category that looks one way
  to the organiser and another to an attendee is the bug that file prevents.
- **The accent is emerald.** Set in [index.css](src/index.css), and duplicated in
  HQ's [index.css](../hq/src/index.css) under `[data-app='battlepack']` — there
  is no way to import an `@theme` block into a scoped selector, so both copies
  have to change together.

A reader can put a published event in their own calendar, and doing so is
recorded. Four things about that are decided:

- **The button is the last row of the Key Info card**, not a control in the
  hero. `KeyInfoCard` takes a `footer` slot for it; the editor passes nothing,
  because saving your own draft to your own diary is not a thing anybody does.
  The consequence is that it lives wherever About/Key Info lives — so it is on
  one tab, not on all of them.
- **Three destinations, one event.** [calendar.ts](src/lib/calendar.ts) shapes
  the event once; Google and Outlook take it as a URL, everyone else takes the
  .ics. Times are FLOATING — no `Z`, no TZID — because a pack stores 10am at
  the venue, not an instant, and we have no venue timezone to convert with.
  The length of the day comes from the schedule item durations when there are
  any, and three hours when there are not.
- **The add is recorded silently, through `battlepack_remember_calendar_add`.**
  It takes the slug and resolves the pack itself, the same narrow door
  `battlepack_by_slug` is, so a caller cannot record against a draft or a pack
  id it guessed. `battlepack_calendar_adds` has no INSERT policy at all — the
  SECURITY DEFINER function is the only way a row is written. Nothing in the UI
  mentions it and nothing reads it back.
- **The snapshot is the point.** The row keeps the date and time AS THEY WERE
  when the add happened, so "this person's calendar disagrees with the pack" is
  a comparison rather than a guess.

Those messages are sent by `send-pack-change-notification`, off two triggers on
`battlepacks` (`20260820010000`). Three rules hold it together:

- **The database decides who.** The trigger says only WHICH PACK CHANGED and the
  function calls back — `battlepack_stale_calendar_adds` for a move,
  `battlepack_calendar_audience` for a withdrawal. Rebuilding "is this the same
  date" in TypeScript would be one rule in two languages.
- **Deletion is the exception**, because the pack row is gone and the adds
  cascade with it. That is a BEFORE DELETE trigger which puts the recipients in
  the payload.
- **`notified_signature` is suppression, not a claim about anyone's diary.** The
  snapshot columns still mean "the date they added"; being told a date moved is
  not the same as having fixed your calendar.

**Every path that sends mail asks first**, and the confirmation names a number —
`battlepack_calendar_audience_size` for a date change or a withdrawal,
`battlepack_pending_notify_count` before a re-publish, where the answer may be
nobody. Both are counts and there is deliberately no sibling that returns the
people. A path that sends without asking is the bug to watch for: if a fourth
date column is ever added, `NOTIFYING_FIELDS` in
[PackEditor.tsx](src/pages/PackEditor.tsx) and the trigger's own column list
both have to learn about it.

The slug is wired through the platform: `battlepack` in `AppSlug`
([currentApp.ts](../../packages/ui/src/lib/currentApp.ts)) and `UpdateApp`
([useUpdates.ts](../../packages/ui/src/hooks/useUpdates.ts)), the bundle id
`com.bamington.battlepack` in [supabase.ts](../../packages/ui/src/lib/supabase.ts),
and the route subtree in HQ's `APP_ROUTES` ([App.tsx](../hq/src/App.tsx)).

Access is platform admins, plus store admins **at venues BattlePack has been
switched on for**. Two tables have to agree, and confusing them is the easy
mistake:

- `platform_app_roles` — `20260728000000_battlepack_store_admins.sql` added
  `store_admin` as a PSEUDO-ROLE: a grant `my_platform_apps()` resolves against
  `locations.admins` rather than `user_profiles.role`. This says store admins
  MAY have the app.
- `location_apps` — `20260814010000_location_apps.sql` says AT WHICH venues.
  One row per (venue, app), written by platform admins only, from
  `/app/admin/locations`.

Both must say yes, so the app rolls out a shop at a time. `20260814000000`
briefly revoked the grant entirely; `20260814010000` restored it behind the
per-venue gate, which is why the grant alone changes nothing.

The same `location_apps` row also decides whether that venue sees BattlePlan's
Upcoming Events column — deliberately one switch, so a shop can never have the
column without the app or the reverse.

Row-level access is WIDER than the app gate and that is intended: a venue's
admins and staff can read `battlepacks` at their venue whether or not
BattlePack is switched on for them, because the events column needs it.
Editing is still `locations.admins` only (`can_edit_battlepack`) — every admin
of a store can edit every pack there, and losing the store loses the packs; the
owner column grants nothing on its own.

## An event's shape is TWO answers, not one

`schedule_shape` (days | periods) and `recurrence` (none | weekly | monthly),
replacing the old single `timeline` enum — which conflated them and made a
monthly weekender unrepresentable. Four rules follow from that split and are
easy to undo by accident:

- **One-day is not a shape.** It is `days` with a single segment, so growing a
  one-dayer into a two-dayer is an insert rather than a conversion. Nothing
  stores "this is a one-day event"; `timeline` still does, and is on its way
  out once the app stops reading it.
- **Repeats is not a fourth card.** It sits below the dates in Event Basics and
  in the create flow as a property OF the event, because "multi-day" and
  "repeats monthly" answer different questions and a weekender has to give
  both.
- **A league never repeats.** The database refuses the pairing: its periods ARE
  its schedule. Both forms drop the control entirely rather than disabling it.
- **The rule is written whole or not at all.** A repeating pack must name a
  weekday and an end date, so [EventBasicsForm](src/components/forms/EventBasicsForm.tsx)
  holds a half-made rule in state and saves the moment it is complete — and
  goes straight back to reading the row, so a cancelled confirmation snaps
  back. Changing the rule on a published pack emails everyone holding it, which
  is why the five columns are in `NOTIFYING_PACK_FIELDS` and why that list
  matches `battlepacks_notify_recurrence` column for column.

Three things then have to agree about what a rule MEANS, and they agree by
copying rather than by each computing the same Fridays:
[recurrence.ts](src/lib/recurrence.ts) counts weeks between MONDAYS exactly as
BattlePlan's `blockAppliesOn` and iCalendar's default `WKST=MO` do; the table
hold is ONE recurring `blocked_dates` row with the rule copied across, never an
expanded list of dates; and the RRULE takes `BYDAY` from EACH DAY'S OWN
weekday when a pack has more than one — handing both days of a weekender the
pack's whole list would repeat Saturday's timetable on Sunday too.

The create flow asks TWO questions (repeats, and until when) and derives the
rest from the start date: a series starting on a Friday repeats on Fridays, and
a monthly one starting on the second Saturday means the second Saturday. The
full rule — several weekdays, fortnightly, which week of the month — is in
Event Basics.

Live in production since 2026-08-14: `url` is `https://battlepack.app/app` and
`is_launched` is true. One Supabase project sits behind production and every
preview, so **never point `url` at a preview URL** — it repoints the app
switcher for every user in production. Reach a preview by its own URL instead.

## Deploying to Production

Before every production deploy, bump the version in `package.json`:
- **Patch** (bug fixes, copy tweaks): `0.1.0` → `0.1.1`
- **Minor** (new features, new pages): `0.1.0` → `0.2.0`
- **Major** (breaking changes, full redesigns): `0.1.0` → `1.0.0`

The build date and version shown in the app are injected at build time from
`package.json` — no other files need updating. That injection is the
`__APP_VERSION__` / `__APP_BUILD_DATE__` `define` block in `vite.config.ts`.

## UI Components

- **Always use existing components first.** Before writing any UI, check `packages/ui/src/components/` and then `src/components/`, and use what's already there. Do not recreate something that exists.
- **Never create a new UI component without permission.** If a task requires a component that doesn't exist yet, stop and ask before building it.
- **Build new components from existing ones.** When a new component is approved, compose it from existing components wherever possible (e.g. use `<Button>` inside a new modal, use `<Badge>` inside a new card, etc.). Avoid reinventing primitives.
- **Always add new components to the gallery.** After any new UI component is created, add a demo section for it showing every meaningful variant and state, plus a matching entry in that file's nav array:
  - A component in `src/components/` → this app's `src/pages/ComponentGallery.tsx` (`LOCAL_NAV`).
  - A component in `packages/ui/src/components/` → `packages/ui/src/gallery/SharedSections.tsx` (`SHARED_GALLERY_NAV`), which every app's gallery renders.
- **Decide where a component lives before building it.** If two apps would both use it, it belongs in `packages/ui`, not in one app's `src/components/`.

The gallery is at [`/gallery`](src/pages/ComponentGallery.tsx) — a public route,
outside the protected subtree, because HQ owns one copy of the public routes.
It renders `<SharedGallerySections appName="BattlePack" />` above this app's own
sections. The three-column editor chrome (`BuilderShell` / `ListPanel` /
`EditorPanel`) is shared, so those demos live in the shared sections.

`NewPackModal` is the one local component with no demo. It is also the hardest
to fake, being a two-step flow that writes on finish — the honest version needs
injectable writes the way `SectionForm` takes `save`.

The list-editor demos each render the EDITOR and the document's own rendering
side by side, over an in-memory store. Keep that shape: it is what makes the
storage shape legible — that a checklist keeps text and URL apart so the whole
phrase can be a link, and that an FAQ keeps pairs so the document can collapse
them. A demo of the editor alone would show none of it.
