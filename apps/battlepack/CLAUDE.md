# BattlePack — Claude Instructions

These rules apply to every command in this project.

## Status: scaffolded, one screen

The app is wired up and builds, but has almost nothing in it. `/app` is a
placeholder home screen; the pack editor, the schema and the category registry
are still to come. See the design doc for the phase order.

What is already decided and should be kept to:

- **The game is fixed when a pack is created** and cannot be changed afterwards,
  because the game-specific mandatory categories resolve exactly once, at
  creation.
- **The editor lives at `/app/<packId>/edit`** — keyed by row id, so it is
  stable, works for drafts with no slug, and survives the slug being set.
- **A published pack's public page lives at the root — `battlepack.app/<slug>`.**
  That namespace is shared with this app's own routes, so every path added to
  `App.tsx` is permanently reserved against slugs. Currently reserved: `app`,
  `login`, `auth`, `gallery`. Think before adding another.
- **The accent is emerald.** Set in [index.css](src/index.css), and duplicated in
  HQ's [index.css](../hq/src/index.css) under `[data-app='battlepack']` — there
  is no way to import an `@theme` block into a scoped selector, so both copies
  have to change together.

The slug is wired through the platform: `battlepack` in `AppSlug`
([currentApp.ts](../../packages/ui/src/lib/currentApp.ts)) and `UpdateApp`
([useUpdates.ts](../../packages/ui/src/hooks/useUpdates.ts)), the bundle id
`com.bamington.battlepack` in [supabase.ts](../../packages/ui/src/lib/supabase.ts),
and the route subtree in HQ's `APP_ROUTES` ([App.tsx](../hq/src/App.tsx)).

It is still admin-only: the `platform_apps` row has no `platform_app_roles`
grants, and `my_platform_apps()` short-circuits for admins, so an app with no
grants is visible to admins alone. `url` is still `'#'` and `is_launched` is
false — both change in the deploy phase, not before.

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
sections. `AppNavbar` is the only local component so far; the three-column editor
chrome it will be built on (`BuilderShell` / `ListPanel` / `EditorPanel`) is
shared, so those demos are in the shared sections.
