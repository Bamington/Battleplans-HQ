# BattleBench — Claude Instructions

These rules apply to every command in this project.

## Deploying to Production

Before every production deploy, bump the version in `package.json`:
- **Patch** (bug fixes, copy tweaks): `2.0.0` → `2.0.1`
- **Minor** (new features, new pages): `2.0.0` → `2.1.0`
- **Major** (breaking changes, full redesigns): `2.0.0` → `3.0.0`

The build date and version shown in the app are injected automatically at build time from `package.json` — no other files need updating.

**After bumping the version, ask whether they want an update note** — a News & Updates entry published through Manage Updates. Ask; never write one unprompted, and never skip asking. If the change is something users must understand before carrying on, ask whether it warrants a welcome flow too. See the root `CLAUDE.md` for both.

## UI Components

- **Always use existing components first.** Before writing any UI, check `packages/ui/src/components/` and then `src/components/`, and use what's already there. Do not recreate something that exists.
- **Never create a new UI component without permission.** If a task requires a component that doesn't exist yet, stop and ask before building it.
- **Build new components from existing ones.** When a new component is approved, compose it from existing components wherever possible (e.g. use `<Button>` inside a new modal, use `<Badge>` inside a new card, etc.). Avoid reinventing primitives.
- **Always add new components to the gallery.** After any new UI component is created, add a demo section for it showing every meaningful variant and state, plus a matching entry in that file's nav array:
  - A component in `src/components/` → this app's `src/pages/ComponentGallery.tsx` (`LOCAL_NAV`).
  - A component in `packages/ui/src/components/` → `packages/ui/src/gallery/SharedSections.tsx` (`SHARED_GALLERY_NAV`), which every app's gallery renders.
- **Decide where a component lives before building it.** If two apps would both use it, it belongs in `packages/ui`, not in one app's `src/components/`.
