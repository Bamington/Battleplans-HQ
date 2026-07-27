# BattlePack — Claude Instructions

These rules apply to every command in this project.

## Status: not built yet

This app is reserved, not written. `apps/battlepack/` holds a `package.json` and
nothing else — no `src/`, no `tsconfig.json`, no `vite.config.ts`. `pnpm build`
fails here, and because Turbo aborts the whole run on a failure, build the other
apps with `--filter` rather than a bare `turbo build`.

The slug is already wired through the platform, so keep to it when the app is
built: `battlepack` in `AppSlug` ([currentApp.ts](../../packages/ui/src/lib/currentApp.ts))
and `UpdateApp` ([useUpdates.ts](../../packages/ui/src/hooks/useUpdates.ts)), the
bundle id `com.bamington.battlepack` in [supabase.ts](../../packages/ui/src/lib/supabase.ts),
and an entry in HQ's `APP_ROUTES` ([App.tsx](../hq/src/App.tsx)) that is
currently `null` — the app switcher shows BattlePack as "coming soon" and never
routes to it. Swap that null for the route subtree when there is one.

When scaffolding it, copy a sibling app rather than starting fresh: BattleBox is
the newest and closest. That carries the Vite config, the Tailwind setup and the
`@battleplans/ui` wiring.

## Deploying to Production

Before every production deploy, bump the version in `package.json`:
- **Patch** (bug fixes, copy tweaks): `0.1.0` → `0.1.1`
- **Minor** (new features, new pages): `0.1.0` → `0.2.0`
- **Major** (breaking changes, full redesigns): `0.1.0` → `1.0.0`

The build date and version shown in the app are injected at build time from
`package.json` — no other files need updating. That injection is the
`__APP_VERSION__` / `__APP_BUILD_DATE__` `define` block in `vite.config.ts`;
copy it from a sibling app when this one is scaffolded, or the footer will not
build.

## UI Components

- **Always use existing components first.** Before writing any UI, check `packages/ui/src/components/` and then `src/components/`, and use what's already there. Do not recreate something that exists.
- **Never create a new UI component without permission.** If a task requires a component that doesn't exist yet, stop and ask before building it.
- **Build new components from existing ones.** When a new component is approved, compose it from existing components wherever possible (e.g. use `<Button>` inside a new modal, use `<Badge>` inside a new card, etc.). Avoid reinventing primitives.
- **Always add new components to the gallery.** After any new UI component is created, add a demo section for it showing every meaningful variant and state, plus a matching entry in that file's nav array:
  - A component in `src/components/` → this app's `src/pages/ComponentGallery.tsx` (`LOCAL_NAV`).
  - A component in `packages/ui/src/components/` → `packages/ui/src/gallery/SharedSections.tsx` (`SHARED_GALLERY_NAV`), which every app's gallery renders.
- **Decide where a component lives before building it.** If two apps would both use it, it belongs in `packages/ui`, not in one app's `src/components/`.

This app has no gallery yet — `src/pages/ComponentGallery.tsx` does not exist.
Create it with the first component, following the pattern the other three share:
mount `/gallery` as a public route (outside the protected subtree, since HQ owns
one copy of the public routes), render `<GalleryShell>` with
`nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]}`, and put `<SharedGallerySections
appName="BattlePack" />` above this app's own sections. Copy
[BattleBox's gallery](../battlebox/src/pages/ComponentGallery.tsx) as the
starting point.
