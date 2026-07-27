# BattlePlan HQ — Claude Instructions

These rules apply to every command in this project.

## What this app is

HQ is the shell, not a fifth product. It mounts the other apps' route subtrees
— `battleplanRoutes()`, `battlecardsRoutes()`, `battlebenchRoutes()`,
`battlepackRoutes()` — so they all ship as one native binary, and it owns one
copy of the public routes (`/login`, `/auth/*`) for all of them. It shows one
app at a time, so `/app` means whichever app is currently mounted.

Consequences worth remembering:
- **Screens belong to their own app, not here.** Adding a page means editing that
  app's `appRoutes()`, which HQ picks up for free. Editing HQ's routing is for
  changing how apps are hosted, not for adding features.
- **Each app's `/gallery` stays out of `appRoutes()`** and so is not reachable
  through HQ. That is deliberate — it is a dev tool, and the public routes live
  here once.
- `APP_ROUTES` keys are `AppSlug` values, and every slug now has a subtree. A
  `null` entry is how a reserved-but-unwritten app renders as "coming soon" in
  the switcher without ever being routed to.

## Deploying to Production

Before every production deploy, bump the version in `package.json`:
- **Patch** (bug fixes, copy tweaks): `0.1.0` → `0.1.1`
- **Minor** (new features, new pages): `0.1.0` → `0.2.0`
- **Major** (breaking changes, full redesigns): `0.1.0` → `1.0.0`

The build date and version shown in the app are injected automatically at build time from `package.json` — no other files need updating.

This is also the Android binary. A version bump here is the one users see in the
store listing, and it is independent of the three apps' own versions — bumping
BattlePlan does not bump HQ.

## UI Components

- **Always use existing components first.** Before writing any UI, check `packages/ui/src/components/` and then `src/components/`, and use what's already there. Do not recreate something that exists.
- **Never create a new UI component without permission.** If a task requires a component that doesn't exist yet, stop and ask before building it.
- **Build new components from existing ones.** When a new component is approved, compose it from existing components wherever possible (e.g. use `<Button>` inside a new modal, use `<Badge>` inside a new card, etc.). Avoid reinventing primitives.
- **Always add new components to the gallery.** After any new UI component is created, add a demo section for it showing every meaningful variant and state, plus a matching entry in that file's nav array:
  - A component in `src/components/` → this app's `src/pages/ComponentGallery.tsx` (`LOCAL_NAV`).
  - A component in `packages/ui/src/components/` → `packages/ui/src/gallery/SharedSections.tsx` (`SHARED_GALLERY_NAV`), which every app's gallery renders.
- **Decide where a component lives before building it.** If two apps would both use it, it belongs in `packages/ui`, not in one app's `src/components/`.

HQ has no `src/components/` and should not grow one. Anything it needs is by
definition shared by all three apps, so it belongs in `packages/ui` — and its
demo therefore goes in `packages/ui/src/gallery/SharedSections.tsx`, where all
three galleries already show it. That is why HQ has no gallery of its own.
