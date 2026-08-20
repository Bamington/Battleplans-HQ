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
- **A published pack's public page lives at the root — `battlepack.app/<slug>`.**
  Built: [PublicPack.tsx](src/pages/PublicPack.tsx) on a catch-all `/:slug`
  route, declared LAST in `App.tsx` so the specific routes win. That namespace
  is shared with this app's own routes, so every path added to `App.tsx` is
  permanently reserved against slugs. Currently reserved: `app`, `login`,
  `auth`, `gallery`. Adding another silently makes that word unusable as a slug
  — add it to the database trigger's reserved list too, or an organiser can
  claim a URL that will never resolve.
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
recorded. Three things about that are decided:

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

**Nothing sends those messages yet.** The table is the list of people to tell
when an organiser moves a date or unpublishes; the job that reads it and the
email it sends are not built. See `20260820000000`.

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
